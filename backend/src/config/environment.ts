export function validateEnvironment(env: Record<string, unknown>) {
  const port = Number(env.PORT ?? 3000);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error('PORT must be an integer from 1 to 65535.');
  }
  const frontendUrl = String(env.FRONTEND_URL ?? 'http://localhost:5173');
  const origin = new URL(frontendUrl);
  if (
    !['http:', 'https:'].includes(origin.protocol) ||
    origin.origin !== frontendUrl
  ) {
    throw new Error(
      'FRONTEND_URL must be an HTTP(S) origin without a trailing slash.',
    );
  }
  const livekitUrl = String(env.LIVEKIT_URL ?? '').trim();
  if (livekitUrl && new URL(livekitUrl).protocol !== 'wss:') {
    throw new Error('LIVEKIT_URL must use wss://.');
  }
  const ttl = Number(env.LIVEKIT_TOKEN_TTL_SECONDS ?? 300);
  if (!Number.isInteger(ttl) || ttl < 60 || ttl > 600) {
    throw new Error('LIVEKIT_TOKEN_TTL_SECONDS must be between 60 and 600.');
  }
  const room = String(env.LIVEKIT_ROOM_NAME ?? 'media-test-room').trim();
  if (!/^[a-zA-Z0-9_-]{1,64}$/.test(room)) {
    throw new Error(
      'LIVEKIT_ROOM_NAME must contain 1–64 letters, digits, underscores or hyphens.',
    );
  }
  // This endpoint has no application authentication. Fail closed in production.
  if (env.NODE_ENV === 'production' && env.POC_ENABLED === 'true') {
    throw new Error(
      'Unauthenticated PoC token issuance must not be enabled in production.',
    );
  }
  return {
    ...env,
    PORT: port,
    HOST: String(env.HOST ?? '127.0.0.1'),
    FRONTEND_URL: frontendUrl,
    LIVEKIT_URL: livekitUrl,
    LIVEKIT_ROOM_NAME: room,
    LIVEKIT_TOKEN_TTL_SECONDS: ttl,
    POC_ENABLED: env.POC_ENABLED === 'true',
  };
}
