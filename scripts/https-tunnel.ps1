param([switch]$Stop)

$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'
$projectRoot = Split-Path $PSScriptRoot -Parent
$runtimeDir = Join-Path $projectRoot 'logs/tunnel'
$statePath = Join-Path $runtimeDir 'session.json'

function Get-Sha256([string]$LiteralPath) {
    # Avoid depending on Get-FileHash/module auto-loading in nested npm shells.
    $stream = [System.IO.File]::OpenRead($LiteralPath)
    $algorithm = [System.Security.Cryptography.SHA256]::Create()
    try {
        return [System.BitConverter]::ToString($algorithm.ComputeHash($stream)).Replace('-', '').ToLowerInvariant()
    } finally {
        $algorithm.Dispose()
        $stream.Dispose()
    }
}

function Stop-OwnedProcess($record) {
    $process = Get-Process -Id $record.id -ErrorAction SilentlyContinue
    if ($process -and $process.StartTime.ToUniversalTime().ToString('o') -eq $record.started) {
        Stop-Process -Id $process.Id
    }
}

if ($Stop) {
    if (Test-Path -LiteralPath $statePath) {
        $state = Get-Content -LiteralPath $statePath -Raw | ConvertFrom-Json
        foreach ($record in $state.processes) { Stop-OwnedProcess $record }
        Write-Host 'Tunnel stopped. Only processes started by this tunnel session were stopped.'
    } else { Write-Host 'No tunnel session recorded.' }
    exit 0
}

New-Item -ItemType Directory -Force -Path $runtimeDir | Out-Null
if (Test-Path -LiteralPath $statePath) {
    $previous = Get-Content -LiteralPath $statePath -Raw | ConvertFrom-Json
    foreach ($record in $previous.processes) {
        $process = Get-Process -Id $record.id -ErrorAction SilentlyContinue
        if ($process -and $process.StartTime.ToUniversalTime().ToString('o') -eq $record.started) {
            throw 'A tunnel session is already running. Run npm run tunnel:stop first.'
        }
    }
}

Push-Location $projectRoot
try {
    & npm.cmd run build
    if ($LASTEXITCODE -ne 0) { throw 'Build failed; tunnel was not started.' }
} finally { Pop-Location }

# Keep the executable outside the repository; pin and verify the official release.
$toolDir = Join-Path $env:LOCALAPPDATA 'RealTimeStream/tools'
$cloudflared = Join-Path $toolDir 'cloudflared-2026.10.7.exe'
$expectedHash = '2493dbc168923bb3e59e5e7716f71deced92992eea9acd6e9d74f84ac7751343'
if (-not (Test-Path -LiteralPath $cloudflared)) {
    New-Item -ItemType Directory -Force -Path $toolDir | Out-Null
    Write-Host 'Downloading official cloudflared 2026.10.7 (Windows x64)...'
    $downloadPath = "$cloudflared.download"
    Invoke-WebRequest -UseBasicParsing -Uri 'https://github.com/cloudflare/cloudflared/releases/download/2026.10.7/cloudflared-windows-amd64.exe' -OutFile $downloadPath
    if ((Get-Sha256 $downloadPath) -ne $expectedHash) {
        throw 'Downloaded cloudflared SHA256 verification failed.'
    }
    Move-Item -LiteralPath $downloadPath -Destination $cloudflared -Force
}
if ((Get-Sha256 $cloudflared) -ne $expectedHash) {
    throw 'cloudflared SHA256 verification failed. Do not run this executable.'
}

function Wait-Http([string]$Url, $Child) {
    for ($attempt = 0; $attempt -lt 30; $attempt++) {
        if ($Child -and $Child.HasExited) { throw "Local service exited. See $runtimeDir" }
        try {
            $response = Invoke-WebRequest -UseBasicParsing -Uri $Url -TimeoutSec 2
            if ($response.StatusCode -eq 200) { return }
        } catch { }
        Start-Sleep -Milliseconds 500
    }
    throw "Local service did not become ready: $Url"
}

$owned = @()
$runId = Get-Date -Format 'yyyyMMdd-HHmmss-fff'
function Start-Owned([string]$Executable, [string[]]$Arguments, [string]$Directory, [string]$Name) {
    $child = Start-Process -FilePath $Executable -ArgumentList $Arguments -WorkingDirectory $Directory -WindowStyle Hidden -PassThru -RedirectStandardOutput (Join-Path $runtimeDir "$runId-$Name.out.log") -RedirectStandardError (Join-Path $runtimeDir "$runId-$Name.err.log")
    $script:owned += [pscustomobject]@{ id = $child.Id; started = $child.StartTime.ToUniversalTime().ToString('o') }
    return $child
}

$oldProxy = $env:API_PROXY_TARGET
try {
    $node = (Get-Command node.exe).Source
    $backend = $null
    $backendListener = Get-NetTCPConnection -State Listen -LocalPort 3000 -ErrorAction SilentlyContinue
    if (-not $backendListener) {
        $backend = Start-Owned $node @('dist/main.js') (Join-Path $projectRoot 'backend') 'backend'
    } else { Write-Host 'Reusing the existing backend on port 3000; it will not be stopped.' }
    Wait-Http 'http://127.0.0.1:3000/api/health' $backend

    if (Get-NetTCPConnection -State Listen -LocalPort 4173 -ErrorAction SilentlyContinue) {
        throw 'Port 4173 is occupied. Stop the existing preview before starting this tunnel.'
    }
    $env:API_PROXY_TARGET = 'http://127.0.0.1:3000'
    $preview = Start-Owned $node @('../node_modules/vite/bin/vite.js', 'preview', '--host', '127.0.0.1', '--port', '4173', '--strictPort') (Join-Path $projectRoot 'frontend') 'preview'
    Wait-Http 'http://127.0.0.1:4173/' $preview

    # Rewrite only the origin Host header. Keep Vite's host protections enabled.
    $tunnel = Start-Owned $cloudflared @('tunnel', '--url', 'http://127.0.0.1:4173', '--http-host-header', 'localhost:4173', '--no-autoupdate') $projectRoot 'cloudflared'
    $tunnelLog = Join-Path $runtimeDir "$runId-cloudflared.err.log"
    $publicUrl = $null
    for ($attempt = 0; $attempt -lt 60; $attempt++) {
        if ($tunnel.HasExited) { throw "Tunnel exited. See $tunnelLog" }
        $log = Get-Content -LiteralPath $tunnelLog -Raw -ErrorAction SilentlyContinue
        if ($log -match 'https://[a-z0-9-]+\.trycloudflare\.com') { $publicUrl = $Matches[0]; break }
        Start-Sleep -Milliseconds 500
    }
    if (-not $publicUrl) { throw "No public URL received. See $tunnelLog" }
    [pscustomobject]@{ url = $publicUrl; processes = $owned } | ConvertTo-Json -Depth 4 | Set-Content -LiteralPath $statePath -Encoding UTF8
    Write-Host "HTTPS meeting URL: $publicUrl"
    Write-Host 'Login is required; registered users share the PoC room. Share only with your test group.'
    Write-Host 'Keep this terminal running. Ctrl+C or npm run tunnel:stop stops this session.'
    while (-not $tunnel.HasExited) {
        if ($preview.HasExited -or ($backend -and $backend.HasExited)) { throw 'A local service stopped.' }
        Start-Sleep -Seconds 1
    }
} finally {
    $env:API_PROXY_TARGET = $oldProxy
    foreach ($record in $owned) { Stop-OwnedProcess $record }
}
