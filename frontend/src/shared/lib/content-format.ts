export function safePublicUrl(value?: string | null): string | undefined {
  if (!value) return undefined;
  try {
    const url = new URL(value, window.location.origin);
    return ["http:", "https:"].includes(url.protocol) ? url.href : undefined;
  } catch {
    return undefined;
  }
}
export function publicDate(value?: string | null) {
  if (!value) return "Chưa cập nhật";
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? "Chưa cập nhật"
    : new Intl.DateTimeFormat("vi-VN", {
        timeZone: "Asia/Ho_Chi_Minh",
        dateStyle: "medium",
        timeStyle: "short",
      }).format(date);
}
