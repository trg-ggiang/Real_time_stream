import { useEffect, useRef, useState, type FormEvent } from "react";
import { accountRequest } from "../../shared/api/account-http";
import {
  emptyProfile,
  normalizeProfile,
  profileComplete,
  profileFields,
  type StudentProfile,
} from "./profile-model";
import "./profile.css";
import { useUnsavedChanges } from "../../shared/lib/use-unsaved-changes";

export function ProfileForm({
  token,
  onboarding = false,
  autoContinue = false,
  onComplete,
  onLogout,
}: {
  token: string;
  onboarding?: boolean;
  autoContinue?: boolean;
  onComplete?: () => void;
  onLogout?: () => void;
}) {
  const [profile, setProfile] = useState<StudentProfile>(emptyProfile);
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [baseline, setBaseline] = useState("");
  const mutation = useRef<AbortController | null>(null);
  useEffect(() => () => mutation.current?.abort(), []);
  const dirty = loaded && JSON.stringify(profile) !== baseline;
  useEffect(() => {
    const controller = new AbortController();
    setLoaded(false);
    setError("");
    void accountRequest<StudentProfile>(token, "users/me/profile", {
      signal: controller.signal,
    })
      .then((data) => {
        if (controller.signal.aborted) return;
        const normalized = normalizeProfile(data);
        setProfile(normalized);
        setBaseline(JSON.stringify(normalized));
        setLoaded(true);
        if (onboarding && autoContinue && profileComplete(normalized))
          onComplete?.();
      })
      .catch((cause) => {
        if (!controller.signal.aborted) setError(cause.message);
      });
    return () => controller.abort();
  }, [token, attempt, onboarding, autoContinue]);
  useUnsavedChanges(dirty);
  async function save(event: FormEvent) {
    event.preventDefault();
    if (saving || mutation.current) return;
    setMessage("");
    setError("");
    if (!profileComplete(profile)) {
      setError(
        "Vui lòng điền họ tên, mã sinh viên, trường/khoa, ngành và khóa trước khi tiếp tục.",
      );
      return;
    }
    setSaving(true);
    const controller = new AbortController();
    mutation.current = controller;
    try {
      const saved = normalizeProfile(
        await accountRequest<StudentProfile>(token, "users/me/profile", {
          method: "PATCH",
          body: JSON.stringify(profile),
          signal: controller.signal,
        }),
      );
      if (controller.signal.aborted) return;
      if (!profileComplete(saved))
        throw new Error("Hồ sơ chưa đầy đủ. Vui lòng kiểm tra lại.");
      setProfile(saved);
      setBaseline(JSON.stringify(saved));
      setMessage("Đã lưu hồ sơ sinh viên.");
      if (onboarding) onComplete?.();
    } catch (cause) {
      if (controller.signal.aborted) return;
      setError(
        cause instanceof Error ? cause.message : "Không lưu được hồ sơ.",
      );
    } finally {
      mutation.current = null;
      if (!controller.signal.aborted) setSaving(false);
    }
  }
  return (
    <section className={`pf-card ${onboarding ? "pf-onboarding" : ""}`}>
      {onboarding && (
        <header className="pf-top">
          <a href="/" className="pf-brand">
            uni<span>circle</span>.
          </a>
          <button type="button" onClick={onLogout} data-leave-account>
            Đăng xuất
          </button>
        </header>
      )}
      <div className="pf-intro">
        {onboarding ? (
          <h1>
            Một chút về bạn,
            <br />
            để kết nối đúng hơn.
          </h1>
        ) : (
          <h2>Thông tin sinh viên</h2>
        )}
        <p>
          {onboarding
            ? "Hoàn thiện hồ sơ để bắt đầu. Sau này bạn có thể cập nhật trong mục Tài khoản."
            : "Thông tin dùng khi đăng ký hoạt động và tham gia cộng đồng."}
        </p>
      </div>
      {!loaded ? (
        <div className="pf-feedback">
          {error ? (
            <>
              <p role="alert">{error}</p>
              <button onClick={() => setAttempt((n) => n + 1)}>
                Thử tải lại hồ sơ
              </button>
            </>
          ) : (
            <p role="status">Đang kiểm tra hồ sơ sinh viên…</p>
          )}
        </div>
      ) : (
        <form onSubmit={save} aria-busy={saving}>
          <div className="pf-fields">
            {profileFields.map((field) => (
              <label key={field.key}>
                {field.label}
                {field.required && <span aria-hidden="true"> *</span>}
                {field.key === "bio" ? (
                  <textarea
                    aria-label={field.label}
                    maxLength={field.limit}
                    value={profile.bio}
                    disabled={saving}
                    onChange={(e) => {
                      setProfile((p) => ({ ...p, bio: e.target.value }));
                      setMessage("");
                    }}
                  />
                ) : (
                  <input
                    aria-label={field.label}
                    required={field.required}
                    maxLength={field.limit}
                    type={field.key === "phone" ? "tel" : "text"}
                    value={profile[field.key]}
                    disabled={saving}
                    onChange={(e) => {
                      setProfile((p) => ({
                        ...p,
                        [field.key]: e.target.value,
                      }));
                      setMessage("");
                    }}
                  />
                )}
              </label>
            ))}
          </div>
          <p className="pf-hint">
            Các trường có dấu * là bắt buộc. Điện thoại và giới thiệu có thể bổ
            sung sau.
          </p>
          {error && (
            <p className="pf-error" role="alert">
              {error}
            </p>
          )}
          {message && (
            <p className="pf-success" role="status">
              {message}
            </p>
          )}
          <div className="pf-actions">
            <span>
              {dirty
                ? "Bạn có thay đổi chưa lưu."
                : "Thông tin được lưu theo tài khoản của bạn."}
            </span>
            <button type="submit" disabled={saving || (!onboarding && !dirty)}>
              {saving ? "Đang lưu…" : "Lưu hồ sơ"}
            </button>
          </div>
        </form>
      )}
    </section>
  );
}
