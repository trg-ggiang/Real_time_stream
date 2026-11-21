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

export function publicDateOnly(value?: string | null) {
  const date = value ? new Date(value) : null;
  if (!date || Number.isNaN(date.getTime())) return "Chưa cập nhật";
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Ho_Chi_Minh",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(date);
}

export function publicDateRange(start?: string | null, end?: string | null) {
  const valid = (value?: string | null) => value && Number.isFinite(Date.parse(value)) ? new Date(value) : null;
  const first = valid(start), last = valid(end);
  if (!first || !last) return publicDateOnly(first ? start : end);
  const formatter = new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Ho_Chi_Minh', day: '2-digit', month: '2-digit', year: 'numeric' });
  const parts = (date: Date) => Object.fromEntries(formatter.formatToParts(date).map(part => [part.type, part.value]));
  const a = parts(first), b = parts(last);
  if (formatter.format(first) === formatter.format(last)) return formatter.format(first);
  if (a.year === b.year) return `${a.day}/${a.month}–${b.day}/${b.month}/${b.year}`;
  return `${formatter.format(first)}–${formatter.format(last)}`;
}

export function publicTime(value?: string | null) {
  if (!value || !Number.isFinite(Date.parse(value))) return '';
  return new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Ho_Chi_Minh', hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date(value));
}
