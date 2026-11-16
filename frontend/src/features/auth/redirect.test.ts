import { expect, it } from "vitest";
import { authFormHref, resolvePostLoginPath } from "./redirect";

it.each([
  ["/", "admin", "/admin"],
  ["/", "user", "/me"],
  ["/me/clubs", "admin", "/me/clubs"],
  ["/me/clubs", "user", "/me/clubs"],
  ["/admin", "admin", "/admin"],
  ["/admin", "user", "/me"],
  ["/admin/clubs", "user", "/me"],
  ["//evil.com", "admin", "/admin"],
  ["https://evil.com", "user", "/me"],
  ["/me/clubs?mode=login", "user", "/me/clubs"],
  ["/me/clubs?mode=login&returnTo=%2Fadmin&page=2#list", "user", "/me/clubs?page=2#list"],
  ["/?view=abc", "admin", "/?view=abc"],
  ["/?view=abc", "user", "/?view=abc"],
  ["/#section", "admin", "/#section"],
  ["/#section", "user", "/#section"],
  ["/\\evil.com", "user", "/me"],
  ["/%2f%2fevil.com", "user", "/me"],
  ["/%5cevil.com", "user", "/me"],
  ["/me/../admin", "user", "/me"],
  ["/%61dmin/clubs", "user", "/me"],
  [null, "admin", "/admin"],
] as const)("resolves %s for %s to %s", (returnTo, role, expected) => {
  expect(resolvePostLoginPath(returnTo, role)).toBe(expected);
});

it("encodes the destination as a single query parameter", () => {
  const target = "/me/clubs?page=2#summary";
  const url = new URL(authFormHref("login", target), "https://unicircle.invalid");
  expect(url.pathname).toBe("/");
  expect(url.searchParams.get("mode")).toBe("login");
  expect(url.searchParams.get("returnTo")).toBe(target);
});
