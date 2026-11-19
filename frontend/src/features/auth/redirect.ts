const internalOrigin = "https://unicircle.invalid";

function isInternalPath(value: string) {
  return value.startsWith("/") && !value.includes("//") && !/[\\\x00-\x20\x7f]/.test(value);
}

export function sanitizeReturnTo(value: string | null | undefined): string | null {
  if (!value || !isInternalPath(value)) return null;

  try {
    const target = new URL(value, internalOrigin);
    const decodedPath = decodeURIComponent(target.pathname);
    if (target.origin !== internalOrigin || !isInternalPath(decodedPath)) return null;

    // Preserve other query parameters as written when there is nothing to remove.
    if (target.searchParams.has("mode") || target.searchParams.has("returnTo")) {
      target.searchParams.delete("mode");
      target.searchParams.delete("returnTo");
    }
    return `${target.pathname}${target.search}${target.hash}`;
  } catch {
    return null;
  }
}

export function resolvePostLoginPath(returnTo: string | null | undefined, role?: string | null) {
  const fallback = role === "admin" ? "/admin" : "/";
  const path = sanitizeReturnTo(returnTo);
  if (!path) return fallback;

  const target = new URL(path, internalOrigin);
  if (target.pathname === "/" && !target.hash && !target.searchParams.has("view")) return fallback;

  // Role only selects the landing destination. The route and API enforce access.
  if (/^\/admin(?:\/|$)/i.test(decodeURIComponent(target.pathname)) && role !== "admin") return fallback;
  return path;
}

export function authFormHref(mode: "login" | "register", returnTo: string) {
  return `/?${new URLSearchParams({ mode, returnTo })}`;
}
