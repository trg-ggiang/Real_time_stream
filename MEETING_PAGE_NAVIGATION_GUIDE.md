# Hướng dẫn mở Meeting thành trang riêng

Tài liệu này mô tả cách chuyển luồng hiện tại thành hai trang trong cùng ứng dụng:

- `/` — Home: ảnh giới thiệu và khu vực `New Join`.
- `/meeting` — trang phòng họp riêng: hướng dẫn tham gia, form quyền phòng, rồi mới kết nối LiveKit.

Đây là điều hướng SPA (React Router): trình duyệt đổi URL và nội dung trang mà không tải lại toàn bộ ứng dụng.

## Luồng sau khi triển khai

```text
Đăng nhập / đăng ký
        ↓
Home (/)
        ↓ bấm "Tham gia phòng" hoặc icon "Phòng họp"
Meeting (/meeting)
        ↓ bấm "Tham gia phòng"
Form quyền phòng
        ↓ lưu cài đặt
Nút "Vào phòng"
        ↓
POST /api/livekit/token → LiveKitRoom
```

Sidebar và navbar được dùng chung giữa hai route. Nút Home, icon Phòng họp, link trong menu và nút trình duyệt Back/Forward chuyển trang tương ứng.

> **Session hiện tại:** JWT chỉ được giữ trong React state, không lưu trong local storage. Reload trực tiếp `/meeting` sẽ yêu cầu đăng nhập lại. Sau khi đăng nhập, route hiện tại vẫn được Router đọc từ URL. Nếu cần giữ đăng nhập qua reload, cần thiết kế riêng cơ chế session an toàn; không lưu JWT vào local storage chỉ để làm cho route hoạt động.

## 1. Thêm React Router

Tại root:

```powershell
npm install --workspace frontend react-router-dom
```

Lệnh này cập nhật dependency của `frontend/package.json` và lockfile root. Không cần thêm thư viện router nào khác.

## 2. Thêm layout dùng chung

Tạo `frontend/src/app/AuthenticatedShell.tsx`:

```tsx
import { Outlet } from 'react-router-dom';
import { Navbar } from '../../components/Navbar';
import { Sidebar } from '../../components/Sidebar';
import './authenticated-shell.css';

type AuthenticatedShellProps = {
  displayName: string;
  onLogout: () => void;
};

export function AuthenticatedShell({
  displayName,
  onLogout,
}: AuthenticatedShellProps) {
  return (
    <div className="workspace">
      <Sidebar displayName={displayName} onLogout={onLogout} />
      <Navbar displayName={displayName} onLogout={onLogout} />
      <main className="workspace-main">
        <Outlet />
      </main>
    </div>
  );
}
```

Tạo `frontend/src/app/authenticated-shell.css` để dành chỗ cho các thanh cố định và cho các trang route tự quản lý nội dung:

```css
.workspace {
  min-height: 100dvh;
  margin-left: 82px;
  padding-top: 76px;
  background:
    radial-gradient(ellipse at 68% 0%, rgb(53 94 78 / 19%), transparent 44%),
    #101c19;
  color: #e7f0e9;
}

.workspace-main {
  width: min(1120px, 100%);
  min-height: calc(100dvh - 76px);
  margin: 0 auto;
  padding: 32px clamp(24px, 5vw, 72px) 28px;
}

@media (max-width: 640px) {
  .workspace {
    margin-left: 0;
    padding-top: 68px;
    padding-bottom: 72px;
  }

  .workspace-main {
    padding: 24px 16px;
  }
}
```

Nếu các class `.workspace` và `.workspace-main` vẫn còn trong `Sidebar.css`, chuyển chúng sang file CSS này để tránh định nghĩa trùng.

## 3. Khai báo hai route sau khi đăng nhập

Trong `frontend/src/features/auth/AuthApp.tsx`, giữ nguyên form và hàm đăng nhập. Thêm các imports:

```tsx
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AuthenticatedShell } from '../../app/AuthenticatedShell';
import { HomePage } from '../home/page';
```

Thay nhánh hiện tại:

```tsx
if (session) return <MeetingPage ... />;
```

bằng:

```tsx
if (session) {
  const logout = () => setSession(null);

  return (
    <BrowserRouter>
      <Routes>
        <Route
          element={
            <AuthenticatedShell
              displayName={session.user.displayName}
              onLogout={logout}
            />
          }
        >
          <Route index element={<HomePage />} />
          <Route
            path="meeting"
            element={
              <MeetingPage
                accessToken={session.access_token}
                displayName={session.user.displayName}
                onLogout={logout}
              />
            }
          />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
```

Sau thay đổi này, bỏ import `MeetingPage` cũ nếu không còn dùng ở nơi khác. Form đăng nhập hiện tại vẫn nằm trong nhánh render khi `session` rỗng.

Router chỉ được mount sau khi session tồn tại. Cách này giữ JWT trong state như hiện nay và tránh truyền token qua URL hoặc `localStorage`.

## 4. Đổi Sidebar sang link route

Trong `frontend/components/Sidebar.tsx`, thay thẻ `<a href="#...">` bằng `NavLink`. Ví dụ đầy đủ phần điều hướng:

```tsx
import { NavLink } from 'react-router-dom';
import './Sidebar.css';

const sections = [
  { to: '/', label: 'Home', icon: '/icon/home.svg', end: true },
  { to: '/meeting', label: 'Phòng họp', icon: '/icon/meeting.svg' },
];

export function Sidebar({
  displayName,
  onLogout,
}: {
  displayName: string;
  onLogout: () => void;
}) {
  const initial = displayName.trim().charAt(0).toUpperCase() || '?';

  return (
    <aside className="app-sidebar" aria-label="Thanh điều hướng">
      <nav className="sidebar-nav" aria-label="Điều hướng chính">
        {sections.map(({ to, label, icon, end }) => (
          <NavLink
            className={({ isActive }) =>
              `sidebar-link${isActive ? ' sidebar-link-active' : ''}`
            }
            to={to}
            end={end}
            key={to}
            aria-label={label}
          >
            <img src={icon} alt="" aria-hidden="true" />
            <span className="sidebar-tooltip" role="tooltip">
              {label}
            </span>
          </NavLink>
        ))}
      </nav>

      <div className="sidebar-account">
        <span className="sidebar-avatar" title={displayName} aria-hidden="true">
          {initial}
        </span>
        <button
          className="sidebar-logout"
          type="button"
          onClick={onLogout}
          aria-label="Đăng xuất"
          title="Đăng xuất"
        >
          <img src="/icon/sign-out.svg" alt="" aria-hidden="true" />
        </button>
      </div>
    </aside>
  );
}
```

Để giữ style active hiện có, dùng callback `className`:

```tsx
<NavLink
  to={to}
  end={end}
  className={({ isActive }) =>
    `sidebar-link${isActive ? ' sidebar-link-active' : ''}`
  }
>
```

Sau đó trong `Sidebar.css` đổi selector:

```css
.sidebar-link[data-active='true'] { ... }
.sidebar-link[data-active='true']::before { ... }
```

thành:

```css
.sidebar-link-active { ... }
.sidebar-link-active::before { ... }
```

Không giữ `useState` cho `activeHref`: `NavLink` tự đồng bộ trạng thái active với URL, kể cả Back/Forward.

## 5. Đổi logo/navbar sang route Home

Trong `frontend/components/Navbar.tsx`, dùng `Link` thay vì anchor hash:

```tsx
import { Link } from 'react-router-dom';
```

Thay:

```tsx
<a className="navbar-camera" href="#home" aria-label="Real-time Stream — Home">
  <img src="/icon/video-camera.svg" alt="" aria-hidden="true" />
  <span>Real-time Stream</span>
</a>
```

bằng:

```tsx
<Link
  className="navbar-camera"
  to="/"
  aria-label="Real-time Stream — Home"
>
  <img src="/icon/video-camera.svg" alt="" aria-hidden="true" />
  <span>Real-time Stream</span>
</Link>
```

Giữ nguyên menu tài khoản và xử lý đăng xuất hiện có.

## 6. Home là route độc lập

Đổi `frontend/src/features/home/page.tsx` thành trang Home hoàn chỉnh thay vì component bọc `children`. Giữ hero hiện tại và đặt CTA dẫn tới route Meeting:

```tsx
import { Link } from 'react-router-dom';
import './home.css';

export function HomePage() {
  return (
    <div className="home-dashboard">
      <section className="home-hero" aria-labelledby="home-title">
        <img
          className="home-hero-image"
          src="/images/study-together.jpg"
          alt="Nhóm bạn cùng học và trao đổi qua máy tính"
        />
        <div className="home-hero-copy">
          <span className="home-hero-kicker">REAL-TIME STUDY ROOM</span>
          <h1 id="home-title">Cùng gặp nhau, từ bất cứ đâu.</h1>
          <p>Phòng thử nghiệm âm thanh và hình ảnh trực tiếp.</p>
        </div>
      </section>

      <section className="home-new-join" aria-labelledby="new-join-title">
        <div className="home-section-heading">
          <span>YOUR NEXT SESSION</span>
          <h2 id="new-join-title">New Join</h2>
        </div>
        <article className="join-card">
          <span className="badge">Phòng thử nghiệm chung</span>
          <h3>Sẵn sàng kết nối?</h3>
          <p>
            Mở phòng họp để kiểm tra camera và microphone cùng mọi người.
          </p>
          <Link className="home-join-link" to="/meeting">
            Tham gia phòng
          </Link>
        </article>
      </section>
    </div>
  );
}
```

Thêm style cho Link vì global `button` style không áp dụng lên anchor:

```css
.home-join-link {
  display: inline-flex;
  min-height: 48px;
  align-items: center;
  justify-content: center;
  margin-top: 12px;
  padding: 10px 18px;
  border-radius: 10px;
  background: #9ce6ce;
  color: #102a27;
  font-size: 13px;
  font-weight: 600;
  text-decoration: none;
}

.home-join-link:focus-visible {
  outline: 3px solid #d7ed9f;
  outline-offset: 4px;
}
```

Không đặt `id="meeting"` lên Home card nữa; route `/meeting` thay cho anchor `#meeting`.

## 7. Meeting là trang riêng

Thay nội dung `frontend/src/features/meeting/MeetingPage.tsx` bằng route page chỉ chứa các bước chuẩn bị và họp. Không render Navbar/Sidebar/Home ở đây vì chúng đã nằm trong `AuthenticatedShell`.

```tsx
import { lazy, Suspense, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  RoomPermissionForm,
  type RoomPermissions,
} from '../../../components/RoomPermissionForm';
import { useMeetingSession } from './hooks/use-meeting-session';

const MeetingRoom = lazy(() =>
  import('./components/MeetingRoom').then((module) => ({
    default: module.MeetingRoom,
  })),
);

const defaultRoomPermissions: RoomPermissions = {
  allowMic: true,
  allowScreenShare: true,
  allowVideo: true,
  waitingRoom: true,
};

type MeetingPageProps = {
  accessToken: string;
  onLogout: () => void;
};

export function MeetingPage({ accessToken, onLogout }: MeetingPageProps) {
  const session = useMeetingSession(accessToken, onLogout);
  const [permissionFormOpen, setPermissionFormOpen] = useState(false);
  const [permissions, setPermissions] = useState(defaultRoomPermissions);
  const [permissionsSaved, setPermissionsSaved] = useState(false);

  return (
    <section className="meeting-page" aria-labelledby="meeting-title">
      <header className="meeting-page-header">
        <Link to="/">Quay lại Home</Link>
        <p className="eyebrow">MEETING / MODULE 01</p>
        <h1 id="meeting-title">Phòng thử nghiệm</h1>
        <p className="subtitle">
          Chuẩn bị camera và microphone trước khi tham gia phòng chung.
        </p>
      </header>

      {session.credentials ? (
        <Suspense fallback={<p role="status">Đang tải phòng họp…</p>}>
          <MeetingRoom
            credentials={session.credentials}
            onLeave={session.leave}
            onEnded={session.endSession}
          />
        </Suspense>
      ) : permissionFormOpen ? (
        <RoomPermissionForm
          initialPermissions={permissions}
          onCancel={() => setPermissionFormOpen(false)}
          onSave={(nextPermissions) => {
            setPermissions(nextPermissions);
            setPermissionsSaved(true);
            setPermissionFormOpen(false);
          }}
        />
      ) : (
        <section className="join-card" aria-label="Tham gia phòng thử nghiệm">
          <span className="badge">Phòng thử nghiệm chung</span>
          <h2>Sẵn sàng kết nối?</h2>
          <p>
            Khi vào phòng, trình duyệt sẽ yêu cầu quyền sử dụng camera và
            microphone.
          </p>
          {session.error && (
            <p className="notice error" role="alert">
              {session.error}
            </p>
          )}
          <div className="join-actions">
            <button
              disabled={session.isJoining}
              onClick={() =>
                permissionsSaved
                  ? void session.join()
                  : setPermissionFormOpen(true)
              }
            >
              {session.isJoining
                ? 'Đang chuẩn bị…'
                : permissionsSaved
                  ? 'Vào phòng'
                  : 'Tham gia phòng'}
            </button>
            {session.isJoining && (
              <button
                className="secondary"
                onClick={session.leave}
              >
                Hủy
              </button>
            )}
          </div>
        </section>
      )}
    </section>
  );
}
```

Chỉ render `MeetingRoom` sau khi `session.credentials` được cấp thành công. Nếu người dùng rời phòng, `session.leave()` xóa credentials và trang trở về thẻ tham gia.

Props được truyền từ route trong `AuthApp`:

```tsx
type MeetingPageProps = {
  accessToken: string;
  onLogout: () => void;
};
```

Các quyền trong form hiện chỉ là state frontend. Backend cấp token cho room cố định và không lưu cài đặt chia sẻ màn hình hoặc chờ duyệt; không hiển thị chúng như quyền đã được server áp dụng.

## Danh sách file

| File | Thay đổi |
|---|---|
| `frontend/package.json` và `package-lock.json` | Cài `react-router-dom` |
| `frontend/src/features/auth/AuthApp.tsx` | Bọc các route authenticated bằng Router; giữ form login và session ở đây |
| `frontend/src/app/AuthenticatedShell.tsx` | Thêm layout dùng chung Sidebar/Navbar và `Outlet` |
| `frontend/src/app/authenticated-shell.css` | Đưa layout/padding cho navbar/sidebar vào một chỗ |
| `frontend/components/Sidebar.tsx` | Dùng `NavLink` tới `/` và `/meeting` |
| `frontend/components/Sidebar.css` | Style active state lấy từ route |
| `frontend/components/Navbar.tsx` | Logo dùng `Link to="/"`; giữ menu/logout |
| `frontend/src/features/home/page.tsx` | Home route riêng, CTA điều hướng tới `/meeting` |
| `frontend/src/features/home/home.css` | Giữ hero và thêm style cho CTA Link |
| `frontend/src/features/meeting/MeetingPage.tsx` | Chỉ render luồng form/Join/LiveKit của meeting |
| `frontend/src/features/meeting/MeetingPage.test.tsx` | Kiểm tra form và join; mock router/layout nếu test render route |
| `frontend/src/features/meeting/Sidebar.test.tsx` | Dùng `MemoryRouter` khi render `NavLink` |

## Kiểm tra sau khi triển khai

Từ root:

```powershell
npm --workspace frontend run typecheck
npm --workspace frontend test
npm --workspace frontend run build
```

Kiểm tra thủ công:

1. Đăng nhập và xác nhận URL là `/`.
2. Bấm `Tham gia phòng` ở `New Join`; xác nhận URL thành `/meeting`.
3. Bấm icon Phòng họp trên sidebar; xác nhận cùng trang Meeting mở ra.
4. Hủy form rồi mở lại; lưu form rồi bấm `Vào phòng`.
5. Kiểm tra token API thành công mới render `MeetingRoom`.
6. Bấm Home/logo, rồi thử Back và Forward của trình duyệt.
7. Đăng xuất từ navbar; xác nhận quay về form auth và không còn màn meeting.
8. Thử direct reload `/meeting`; với session hiện chỉ lưu trong memory, việc yêu cầu đăng nhập lại là hành vi dự kiến.
