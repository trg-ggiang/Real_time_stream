export interface AuthSession {
  access_token: string;
  user: { userId: string; email: string; displayName: string; avatarUrl: string | null };
}

export async function authenticate(
  mode: 'login' | 'register',
  input: { email: string; password: string; displayName?: string },
  signal: AbortSignal,
): Promise<AuthSession> {
  const base = (import.meta.env.VITE_API_URL?.trim() || '').replace(/\/$/, '');
  const response = await fetch(`${base}/api/auth/${mode}`, {
    method: 'POST', cache: 'no-store', signal,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  if (!response.ok) {
    const messages: Record<number, string> = {
      400: 'Thông tin chưa hợp lệ. Hãy kiểm tra email, tên hiển thị và mật khẩu rồi thử lại.',
      401: 'Email hoặc mật khẩu không đúng.',
      409: 'Email đã được sử dụng.',
      429: 'Bạn thử quá nhiều lần. Vui lòng chờ một phút.',
    };
    throw new Error(messages[response.status] ?? 'Chưa thể xử lý yêu cầu. Vui lòng thử lại sau.');
  }
  const data = await response.json();
  if (!data || typeof data.access_token !== 'string' || !data.access_token ||
      typeof data.user?.userId !== 'string' || typeof data.user?.displayName !== 'string' ||
      typeof data.user?.email !== 'string') throw new Error('Thông tin đăng nhập từ máy chủ không hợp lệ.');
  return data;
}
