export class PublicApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

function pause(ms: number, signal: AbortSignal) {
  return new Promise<void>((resolve, reject) => {
    if (signal.aborted) {
      reject(new DOMException("Aborted", "AbortError"));
      return;
    }
    const abort = () => {
      clearTimeout(timer);
      reject(new DOMException("Aborted", "AbortError"));
    };
    const timer = window.setTimeout(() => {
      signal.removeEventListener("abort", abort);
      resolve();
    }, ms);
    signal.addEventListener("abort", abort, { once: true });
  });
}

/** Only idempotent public GETs retry. Never replay registration or review writes. */
export async function publicGet<T>(
  path: string,
  signal: AbortSignal,
): Promise<T> {
  const base = (import.meta.env.VITE_API_URL?.trim() || "").replace(/\/$/, "");
  for (let attempt = 0; ; attempt++) {
    const controller = new AbortController();
    const abort = () => controller.abort();
    signal.addEventListener("abort", abort, { once: true });
    if (signal.aborted) controller.abort();
    const timeout = window.setTimeout(abort, 8000);
    try {
      const response = await fetch(`${base}/api/public/${path}`, {
        signal: controller.signal,
      });
      if (!response.ok)
        throw new PublicApiError(
          response.status,
          response.status === 404
            ? "Nội dung không tồn tại hoặc chưa được công khai."
            : "Chưa tải được nội dung. Vui lòng thử lại.",
        );
      return (await response.json()) as T;
    } catch (error) {
      const retryable =
        error instanceof TypeError ||
        (error instanceof DOMException && error.name === "AbortError") ||
        (error instanceof PublicApiError &&
          [500, 502, 503, 504].includes(error.status));
      if (signal.aborted) throw new DOMException("Aborted", "AbortError");
      if (!retryable || attempt >= 2) throw error;
    } finally {
      clearTimeout(timeout);
      signal.removeEventListener("abort", abort);
    }
    await pause(attempt === 0 ? 600 : 1600, signal);
  }
}
