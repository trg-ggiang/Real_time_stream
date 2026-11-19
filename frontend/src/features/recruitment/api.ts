import { useEffect, useRef, useState } from "react";
import { accountRequest } from "../../shared/api/account-http";
import { publicGet } from "../../shared/api/public-http";
import type { Attachment } from "./types";
export function useRecruitmentQuery<T>(path: string, token?: string) {
  const identity = `${token || "public"}:${path}`;
  const [attempt, retry] = useState(0);
  const [state, setState] = useState<{ key: string; data?: T; error?: string }>({ key: identity });
  useEffect(() => {
    const controller = new AbortController();
    setState({ key: identity });
    const request = token ? accountRequest<T>(token, path, { signal: controller.signal }) : publicGet<T>(path, controller.signal);
    void request.then(data => { if (!controller.signal.aborted) setState({ key: identity, data }); }).catch(error => {
      if (!controller.signal.aborted) setState({ key: identity, error: error.message });
    });
    return () => controller.abort();
  }, [identity, attempt]);
  const current = state.key === identity ? state : { key: identity };
  return { ...current, retry: () => retry(n => n + 1) };
}
export function useRecruitmentWrite() {
  const pending = useRef(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function run<T>(action: () => Promise<T>): Promise<T | undefined> {
    if (pending.current) return;
    pending.current = true; setBusy(true); setError("");
    try { return await action(); } catch (cause) { setError(cause instanceof Error ? cause.message : "Thao tác chưa thành công."); }
    finally { pending.current = false; setBusy(false); }
  }
  return { run, busy, error, setError };
}
export const writeRecruitment = <T,>(token: string, path: string, body: unknown, method = "POST") => accountRequest<T>(token, path, { method, body: JSON.stringify(body) });
export async function uploadRecruitmentFile(token: string, campaign: string, file: File, purpose: "answer" | "cover", questionOrVersion: string) {
  const body = new FormData(); body.append("file", file); body.append("purpose", purpose);
  body.append(purpose === "answer" ? "question_id" : "expected_updated_at", questionOrVersion);
  return accountRequest<{ file: Attachment; campaign?: import("./types").Campaign }>(token, `recruitments/${campaign}/files`, { method: "POST", body });
}
export async function openAttachment(token: string, id: string) {
  const tab = window.open("about:blank", "_blank");
  if (!tab) throw new Error("Hãy cho phép mở tab mới để xem file đính kèm.");
  tab.opener = null;
  try {
    const { url } = await accountRequest<{ url: string }>(token, `recruitment-files/${id}/download`);
    const parsed = new URL(url);
    if (!["https:", "http:"].includes(parsed.protocol)) throw new Error("Đường dẫn tải file chưa hợp lệ.");
    tab.location.replace(url);
  } catch (error) { tab.close(); throw error; }
}
