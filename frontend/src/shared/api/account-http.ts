export class AccountApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
    public readonly code?: string,
    public readonly fields?: Record<string, string>,
  ) {
    super(message);
  }
}
/** Private requests never retry writes and never place tokens in URLs or caches. */
export async function accountRequest<T>(
  token: string,
  path: string,
  options: RequestInit = {},
  responseKind: "json" | "text" = "json",
): Promise<T> {
  const base = (import.meta.env.VITE_API_URL?.trim() || "").replace(/\/$/, "");
  const controller = new AbortController();
  const abort = () => controller.abort();
  options.signal?.addEventListener("abort", abort, { once: true });
  if (options.signal?.aborted) controller.abort();
  const timeout = window.setTimeout(abort, 15000);
  try {
    const response = await fetch(`${base}/api/${path}`, {
      ...options,
      signal: controller.signal,
      cache: "no-store",
      headers: {
        ...options.headers,
        Authorization: `Bearer ${token}`,
        ...(options.body && !(options.body instanceof FormData) && { "Content-Type": "application/json" }),
      },
    });
    const data = response.ok && responseKind === "text" ? await response.text() : await response.json().catch(() => null);
    if (!response.ok) {
      if (response.status === 401)
        window.dispatchEvent(new Event("uc:auth-expired"));
      if (data?.code === "PROFILE_INCOMPLETE")
        window.dispatchEvent(new Event("uc:profile-required"));
      const message =
        typeof data?.message === "string"
          ? data.message
          : Array.isArray(data?.message)
            ? "Một số thông tin chưa hợp lệ. Kiểm tra lại biểu mẫu."
            : "Không thực hiện được thao tác. Vui lòng thử lại.";
      throw new AccountApiError(response.status, message, data?.code, data?.fields);
    }
    if (data === null)
      throw new Error(
        "Phản hồi chưa hợp lệ. Hãy tải lại trạng thái trước khi thử lại.",
      );
    return data as T;
  } catch (error) {
    if (error instanceof AccountApiError) throw error;
    if (options.signal?.aborted)
      throw new DOMException("Aborted", "AbortError");
    throw new Error(
      "Kết nối bị gián đoạn. Hãy tải lại trạng thái để kiểm tra kết quả trước khi thử lại.",
    );
  } finally {
    clearTimeout(timeout);
    options.signal?.removeEventListener("abort", abort);
  }
}
