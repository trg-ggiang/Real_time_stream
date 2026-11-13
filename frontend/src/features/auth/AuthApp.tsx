import { useEffect, useRef, useState, type FormEvent } from 'react';
import { ArrowRight } from '@phosphor-icons/react/dist/csr/ArrowRight';
import { Eye } from '@phosphor-icons/react/dist/csr/Eye';
import { EyeSlash } from '@phosphor-icons/react/dist/csr/EyeSlash';
import { Monitor } from '@phosphor-icons/react/dist/csr/Monitor';
import { Moon } from '@phosphor-icons/react/dist/csr/Moon';
import { Sun } from '@phosphor-icons/react/dist/csr/Sun';
import { VideoCamera } from '@phosphor-icons/react/dist/csr/VideoCamera';
import { MeetingPage } from '../meeting/MeetingPage';
import { authenticate, type AuthSession } from './auth-api';
import { restoreSession, saveSession, sessionExpiresAt } from './session-storage';
import '@fontsource/be-vietnam-pro/400.css';
import '@fontsource/be-vietnam-pro/500.css';
import '@fontsource/be-vietnam-pro/600.css';
import './auth.css';

type Mode = 'login' | 'register';
type Field = 'email' | 'password' | 'displayName';
type Theme = 'system' | 'light' | 'dark';
const themePreferenceKey = 'rts.meeting-theme.v1';
function savedTheme(): Theme {
  try {
    const value = localStorage.getItem(themePreferenceKey);
    return value === 'light' || value === 'dark' ? value : 'system';
  } catch { return 'system'; }
}

export function AuthApp() {
  const [session, setSession] = useState<AuthSession | null>(restoreSession);
  const [mode, setMode] = useState<Mode>('login');
  const [theme, setTheme] = useState<Theme>(savedTheme);
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<Field, string>>>({});
  const pending = useRef<AbortController | null>(null);
  const formRef = useRef<HTMLFormElement | null>(null);
  const errorRef = useRef<HTMLParagraphElement | null>(null);
  const registering = mode === 'register';

  function logout() {
    saveSession(null);
    setTheme(savedTheme());
    setSession(null);
  }

  function changeTheme(next: Theme) {
    setTheme(next);
    try {
      if (next === 'system') localStorage.removeItem(themePreferenceKey);
      else localStorage.setItem(themePreferenceKey, next);
    } catch { /* Continue without persistence. */ }
  }

  useEffect(() => {
    const sync = (event: StorageEvent) => { if (event.key === themePreferenceKey) setTheme(savedTheme()); };
    window.addEventListener('storage', sync);
    return () => window.removeEventListener('storage', sync);
  }, []);

  useEffect(() => {
    if (session) return;
    const query = window.matchMedia?.('(prefers-color-scheme: dark)');
    const meta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
    const previous = meta?.content;
    const update = () => { if (meta) meta.content = (theme === 'dark' || (theme === 'system' && query?.matches)) ? '#1a1a1e' : '#ffffff'; };
    update(); query?.addEventListener('change', update);
    return () => { query?.removeEventListener('change', update); if (meta && previous !== undefined) meta.content = previous; };
  }, [theme, session]);

  useEffect(() => {
    if (!session) return;
    const remaining = sessionExpiresAt(session) - Date.now();
    if (remaining <= 0) return;
    const timer = window.setTimeout(logout, remaining);
    return () => window.clearTimeout(timer);
  }, [session]);

  useEffect(() => () => {
    pending.current?.abort();
    pending.current = null;
  }, []);

  function switchMode(next: Mode) {
    if (busy || next === mode) return;
    setMode(next);
    setError('');
    setFieldErrors({});
    setShowPassword(false);
    const password = formRef.current?.elements.namedItem('password');
    if (password instanceof HTMLInputElement) password.value = '';
  }

  function clearFieldError(field: Field) {
    setFieldErrors(previous => ({ ...previous, [field]: undefined }));
    setError('');
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending.current) return;
    const form = event.currentTarget;
    const values = new FormData(form);
    const email = String(values.get('email') ?? '').trim();
    const password = String(values.get('password') ?? '');
    const displayName = String(values.get('displayName') ?? '').trim();
    const errors: Partial<Record<Field, string>> = {};
    if (registering && (Array.from(displayName).length < 2 || Array.from(displayName).length > 50)) {
      errors.displayName = 'Nhập tên hiển thị từ 2 đến 50 ký tự.';
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errors.email = 'Nhập địa chỉ email hợp lệ.';
    if (!password) errors.password = 'Nhập mật khẩu của bạn.';
    else if (registering && Array.from(password).length < 8) errors.password = 'Mật khẩu cần ít nhất 8 ký tự.';
    else if (new TextEncoder().encode(password).length > 72) {
      errors.password = 'Mật khẩu quá dài. Tối đa 72 byte; ký tự có dấu có thể chiếm nhiều byte.';
    }
    setFieldErrors(errors);
    setError('');
    const firstInvalid = (['displayName', 'email', 'password'] as Field[]).find(field => errors[field]);
    if (firstInvalid) {
      (form.elements.namedItem(firstInvalid) as HTMLInputElement | null)?.focus();
      return;
    }

    const controller = new AbortController();
    pending.current = controller;
    setBusy(true);
    const timeout = window.setTimeout(() => controller.abort(), 15_000);
    try {
      const result = await authenticate(mode, {
        email, password, ...(registering ? { displayName } : {}),
      }, controller.signal);
      if (!controller.signal.aborted) {
        saveSession(result);
        setSession(result);
      }
    } catch (cause) {
      if (pending.current === controller) {
        setError(controller.signal.aborted
          ? 'Yêu cầu quá thời gian. Vui lòng thử lại.'
          : cause instanceof TypeError ? 'Chưa kết nối được máy chủ. Hãy kiểm tra kết nối rồi thử lại.'
          : cause instanceof Error ? cause.message : 'Không thể đăng nhập. Vui lòng thử lại.');
        window.requestAnimationFrame(() => errorRef.current?.focus());
      }
    } finally {
      window.clearTimeout(timeout);
      if (pending.current === controller) {
        pending.current = null;
        setBusy(false);
      }
    }
  }

  if (session) return <MeetingPage accessToken={session.access_token}
    displayName={session.user.displayName} onLogout={logout} />;

  return (
    <div className="auth-page" data-theme={theme}>
      <a href="#auth-form" className="auth-skip-link">Đến biểu mẫu</a>
      <div className="auth-layout">
        <div className="auth-primary">
          <div className="auth-topbar">
            <div className="auth-brand">
              <span className="auth-brand-icon"><VideoCamera size={23} weight="fill" aria-hidden="true" /></span>
              <span>Real-time Stream</span>
            </div>
            <div className="auth-theme-switch" role="group" aria-label="Giao diện">
              {([
                ['light', Sun, 'Giao diện sáng'],
                ['system', Monitor, 'Theo hệ thống'],
                ['dark', Moon, 'Giao diện tối'],
              ] as const).map(([value, Icon, label]) => (
                <button type="button" key={value} aria-label={label} title={label}
                  aria-pressed={theme === value} onClick={() => changeTheme(value)}>
                  <Icon size={17} aria-hidden="true" />
                </button>
              ))}
            </div>
          </div>

          <main className="auth-main">
            <section className="auth-content" aria-labelledby="auth-title">
              <div className="auth-mode-switch" role="group" aria-label="Chọn thao tác">
                <button type="button" aria-pressed={!registering} disabled={busy} onClick={() => switchMode('login')}>Đăng nhập</button>
                <button type="button" aria-pressed={registering} disabled={busy} onClick={() => switchMode('register')}>Đăng ký</button>
              </div>
              <div className="auth-intro" key={mode}>
                <h1 id="auth-title">{registering ? 'Bắt đầu kết nối.' : 'Chào mừng trở lại.'}</h1>
                <p>{registering ? 'Tạo tài khoản để gặp gỡ và học cùng nhóm.' : 'Đăng nhập để tiếp tục cuộc trò chuyện của bạn.'}</p>
              </div>

              <form id="auth-form" className="auth-form" ref={formRef} onSubmit={event => void submit(event)} noValidate aria-busy={busy}>
                {registering && <div className="auth-field">
                  <label htmlFor="auth-name">Tên hiển thị</label>
                  <input id="auth-name" name="displayName" autoComplete="nickname" placeholder="Tên mọi người sẽ nhìn thấy"
                    required minLength={2} maxLength={50} disabled={busy} onChange={() => clearFieldError('displayName')}
                    aria-invalid={!!fieldErrors.displayName} aria-describedby={fieldErrors.displayName ? 'auth-name-error' : undefined} />
                  {fieldErrors.displayName && <p id="auth-name-error" className="auth-field-error">{fieldErrors.displayName}</p>}
                </div>}
                <div className="auth-field">
                  <label htmlFor="auth-email">Email</label>
                  <input id="auth-email" name="email" type="email" autoComplete="email" placeholder="email@gmail.com"
                    required disabled={busy} onChange={() => clearFieldError('email')}
                    aria-invalid={!!fieldErrors.email} aria-describedby={fieldErrors.email ? 'auth-email-error' : undefined} />
                  {fieldErrors.email && <p id="auth-email-error" className="auth-field-error">{fieldErrors.email}</p>}
                </div>
                <div className="auth-field">
                  <label htmlFor="auth-password">Mật khẩu</label>
                  <div className="auth-password-wrap">
                    <input id="auth-password" name="password" type={showPassword ? 'text' : 'password'}
                      autoComplete={registering ? 'new-password' : 'current-password'}
                      placeholder={registering ? 'Tạo mật khẩu của bạn' : 'Nhập mật khẩu của bạn'}
                      required minLength={registering ? 8 : 1} maxLength={72} disabled={busy}
                      onChange={() => clearFieldError('password')} aria-invalid={!!fieldErrors.password}
                      aria-describedby={fieldErrors.password ? 'auth-password-error' : registering ? 'auth-password-hint' : undefined} />
                    <button type="button" className="auth-password-toggle" disabled={busy}
                      aria-label={showPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'} aria-pressed={showPassword}
                      onClick={() => setShowPassword(previous => !previous)}>
                      {showPassword ? <EyeSlash size={20} aria-hidden="true" /> : <Eye size={20} aria-hidden="true" />}
                    </button>
                  </div>
                  {fieldErrors.password ? <p id="auth-password-error" className="auth-field-error">{fieldErrors.password}</p>
                    : registering && <p id="auth-password-hint" className="auth-field-hint">Dùng ít nhất 8 ký tự cho mật khẩu của bạn.</p>}
                </div>
                {error && <p ref={errorRef} role="alert" tabIndex={-1} className="auth-server-error">{error}</p>}
                <button type="submit" className="auth-submit" disabled={busy}>
                  <span>{busy ? 'Đang xử lý…' : registering ? 'Tạo tài khoản' : 'Đăng nhập'}</span>
                  {!busy && <ArrowRight size={20} aria-hidden="true" />}
                </button>
              </form>
            </section>
          </main>
          <footer className="auth-footer"><span>Real-time Stream</span><span>Kết nối để cùng học, cùng làm.</span></footer>
        </div>

        <aside className="auth-companion" aria-label="Học và làm việc cùng nhau">
          <img src="/images/study-together.jpg" width="1024" height="768"
            alt="Nhóm sinh viên cùng trao đổi bài học bên laptop trong thư viện" />
        </aside>
      </div>
    </div>
  );
}
