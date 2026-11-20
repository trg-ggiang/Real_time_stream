import { confirmAction } from '../../../shared/lib/confirm-action';
import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import {
  followState,
  registrationState,
  type Registration,
} from "../services/personal-api";

/** The button stays locked until current server state is known. Writes never retry. */
export function AccountAction({
  token,
  id,
  kind,
  unavailable = false,
}: {
  token: string;
  id: string;
  kind: "follow" | "registration";
  unavailable?: boolean;
}) {
  const [following, setFollowing] = useState(false);
  const [registration, setRegistration] = useState<Registration | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [attempt, setAttempt] = useState(0);
  const [followMenuOpen, setFollowMenuOpen] = useState(false);
  const mutation = useRef<AbortController | null>(null);
  const actionRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => () => mutation.current?.abort(), []);
  useEffect(() => {
    if (!followMenuOpen) return;
    const closeOnOutsideClick = (event: PointerEvent) => {
      if (event.target instanceof Node && !actionRef.current?.contains(event.target))
        setFollowMenuOpen(false);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setFollowMenuOpen(false);
    };
    document.addEventListener("pointerdown", closeOnOutsideClick);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOnOutsideClick);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [followMenuOpen]);
  useEffect(() => {
    const controller = new AbortController();
    setLoaded(false);
    setError("");
    setMessage("");
    void (
      kind === "follow"
        ? followState(token, id, { signal: controller.signal }).then((data) => {
            if (!controller.signal.aborted) setFollowing(data.following);
          })
        : registrationState(token, id, { signal: controller.signal }).then(
            (data) => {
              if (!controller.signal.aborted)
                setRegistration(data.registration);
            },
          )
    )
      .then(() => {
        if (!controller.signal.aborted) setLoaded(true);
      })
      .catch((cause) => {
        if (!controller.signal.aborted) setError(cause.message);
      });
    return () => controller.abort();
  }, [token, id, kind, attempt]);
  async function change() {
    if (busy || !loaded || mutation.current) return;
    const remove =
      kind === "follow" ? following : registration?.status === "registered";
    if (
      kind === "registration" &&
      remove &&
      !(await confirmAction("Hủy đăng ký hoạt động này?"))
    )
      return;
    setBusy(true);
    const controller = new AbortController();
    mutation.current = controller;
    setError("");
    setMessage("");
    try {
      if (kind === "follow") {
        const data = await followState(token, id, {
          method: remove ? "DELETE" : "PUT",
          signal: controller.signal,
        });
        if (controller.signal.aborted) return;
        setFollowing(data.following);
        setMessage("");
      } else {
        const data = await registrationState(token, id, {
          method: remove ? "DELETE" : "PUT",
          signal: controller.signal,
        });
        if (controller.signal.aborted) return;
        setRegistration(data.registration);
        setMessage(
          (data.registration?.status === "registered") === remove
            ? "Trạng thái đã thay đổi ở nơi khác. Kiểm tra thông tin hiện tại."
            : data.registration?.status === "registered"
              ? "Đã đăng ký hoạt động."
              : "Đăng ký đã được hủy.",
        );
      }
    } catch (cause) {
      if (controller.signal.aborted) return;
      setError(
        cause instanceof Error
          ? cause.message
          : "Không thực hiện được thao tác.",
      );
      setLoaded(false);
    } finally {
      mutation.current = null;
      if (!controller.signal.aborted) setBusy(false);
    }
  }
  const active =
    kind === "follow" ? following : registration?.status === "registered";
  return (
    <div className={`ps-action${kind === "follow" ? " ps-follow-action" : ""}`} ref={actionRef}>
      {error ? (
        <>
          <p role="alert">{error}</p>
          <button onClick={() => setAttempt((n) => n + 1)} disabled={busy}>
            Tải lại trạng thái
          </button>
        </>
      ) : (
        <div className={kind === "follow" ? "ps-follow-control" : "ps-registration-control"}>
          <button
            className={`dc-button${kind === "follow" && following ? " is-following" : ""}`}
            disabled={!loaded || busy || (unavailable && !active)}
            aria-haspopup={kind === "follow" && following ? "menu" : undefined}
            aria-expanded={kind === "follow" && following ? followMenuOpen : undefined}
            onClick={() => {
              if (kind === "follow" && following) setFollowMenuOpen((open) => !open);
              else void change();
            }}
          >
            {busy
              ? "Đang xử lý…"
              : !loaded
                ? "Đang kiểm tra…"
                : kind === "follow"
                  ? following
                    ? "Đang quan tâm"
                    : "Quan tâm CLB"
                  : active
                    ? "Đã đăng ký · Hủy đăng ký"
                    : unavailable
                      ? "Đã đóng đăng ký"
                      : "Đăng ký tham gia"}
          </button>
          {kind === "follow" && following && followMenuOpen && (
            <div className="ps-follow-dropdown" role="menu">
              <button type="button" role="menuitem" disabled={busy} onClick={() => void change()}>
                {busy ? "Đang xử lý…" : "Bỏ quan tâm"}
              </button>
            </div>
          )}
        </div>
      )}
      {message && <p role="status">{message}</p>}
      <Link to={kind === "follow" ? "/me/follows" : "/me/registrations"}>
        Xem trong không gian của tôi →
      </Link>
    </div>
  );
}
