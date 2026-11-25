// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, expect, it, vi } from 'vitest';
import { HelpPage } from './HelpPage';
import { ReportIssuePage } from './ReportIssuePage';
import { MyReportsPage } from './MyReportsPage';
import { ReportContent } from './SupportShared';
import { accountRequest } from '../../shared/api/account-http';
import type { SupportReport } from './support-api';
import { AdminSupportDetail } from '../admin/pages/AdminSupport';

vi.mock('../../shared/api/account-http', () => ({ accountRequest: vi.fn() }));
const item: SupportReport = { report_id: 'b0f46f64-eafb-40d7-8eba-a441d8e44cc4', category: 'meetings', title: 'Microphone không hoạt động',
  description: 'Không bật được microphone khi tham gia phòng họp của CLB.', steps: 'Mở phòng rồi bật microphone.', page_path: '/workspace',
  priority: 'normal', status: 'new', admin_response: '', created_at: '2026-11-25T08:00:00Z', updated_at: '2026-11-25T08:00:00.123456Z', resolved_at: null,
  reporter: { user_id: 'student', display_name: 'Minh Hải', email: 'test@example.com' } };
afterEach(() => { cleanup(); vi.clearAllMocks(); });
function fillReport() {
  fireEvent.change(screen.getByLabelText(/Bạn gặp vấn đề ở đâu/), { target: { value: 'meetings' } });
  fireEvent.change(screen.getByLabelText(/Tiêu đề sự cố/), { target: { value: item.title } });
  fireEvent.change(screen.getByLabelText(/Mô tả chi tiết/), { target: { value: item.description } });
}

it('filters real help questions with accent-insensitive search and topic selection', () => {
  render(<MemoryRouter><HelpPage signedIn /></MemoryRouter>);
  fireEvent.change(screen.getByRole('searchbox', { name: 'Tìm kiếm hướng dẫn' }), { target: { value: 'camera' } });
  expect(screen.getByText('Vì sao camera hoặc microphone không hoạt động?')).toBeTruthy();
  expect(screen.queryByText('Làm thế nào để tham gia một câu lạc bộ?')).toBeNull();
  fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'zzzzzzzz' } });
  expect(screen.getByText('Chưa tìm thấy hướng dẫn phù hợp')).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: 'Xem tất cả hướng dẫn' }));
  fireEvent.click(screen.getByRole('button', { name: 'Phòng họp trực tuyến' }));
  expect(screen.getByRole('status').textContent).toContain('2 hướng dẫn');
});

it('requires login before showing a report form or requesting history', () => {
  render(<MemoryRouter><ReportIssuePage /></MemoryRouter>);
  expect(screen.queryByRole('form', { name: 'Báo cáo sự cố' })).toBeNull();
  expect(screen.getByRole('link', { name: 'Đăng nhập' }).getAttribute('href')).toContain('returnTo=%2Freport-issue');
  expect(accountRequest).not.toHaveBeenCalled();
});

it('rejects incomplete form content without sending a request', () => {
  render(<MemoryRouter><ReportIssuePage token="test-token" /></MemoryRouter>);
  fireEvent.submit(screen.getByRole('form', { name: 'Báo cáo sự cố' }));
  expect(screen.getByRole('alert').textContent).toContain('ít nhất 20 ký tự');
  expect(accountRequest).not.toHaveBeenCalled();
});

it('keeps the draft and retry UUID after an unconfirmed send, and only shows receipt after success', async () => {
  vi.mocked(accountRequest).mockRejectedValueOnce(new Error('Kết nối gián đoạn')).mockResolvedValueOnce({ item });
  render(<MemoryRouter><ReportIssuePage token="test-token" displayName="Minh Hải" /></MemoryRouter>);
  fillReport();
  fireEvent.submit(screen.getByRole('form', { name: 'Báo cáo sự cố' }));
  await screen.findByRole('alert');
  expect((screen.getByLabelText(/Mô tả chi tiết/) as HTMLTextAreaElement).value).toBe(item.description);
  expect(screen.queryByText('Đã tiếp nhận báo cáo của bạn')).toBeNull();
  fireEvent.submit(screen.getByRole('form', { name: 'Báo cáo sự cố' }));
  await screen.findByText('Đã tiếp nhận báo cáo của bạn');
  const calls = vi.mocked(accountRequest).mock.calls;
  expect(calls).toHaveLength(2);
  const first = JSON.parse(String(calls[0][2]?.body)), second = JSON.parse(String(calls[1][2]?.body));
  expect(first.report_id).toBe(second.report_id);
  expect(first).not.toHaveProperty('reporter_id');
  expect(screen.getByRole('link', { name: /Theo dõi báo cáo/ }).getAttribute('href')).toBe(`/help/reports/${item.report_id}`);
});

it('locks duplicate submissions while the first report is being saved', async () => {
  let resolve!: (value: unknown) => void;
  vi.mocked(accountRequest).mockReturnValue(new Promise(yes => { resolve = yes; }));
  render(<MemoryRouter><ReportIssuePage token="test-token" /></MemoryRouter>);
  fillReport();
  const form = screen.getByRole('form', { name: 'Báo cáo sự cố' });
  fireEvent.submit(form); fireEvent.submit(form);
  expect(accountRequest).toHaveBeenCalledTimes(1);
  expect((screen.getByRole('button', { name: /Đang gửi báo cáo/ }) as HTMLButtonElement).disabled).toBe(true);
  await act(async () => resolve({ item }));
});

it('shows status and admin response from persisted report detail and renders user HTML as plain text', async () => {
  vi.mocked(accountRequest).mockResolvedValue({ item: { ...item, status: 'resolved', admin_response: 'Đã sửa thiết bị âm thanh.' } });
  render(<MemoryRouter initialEntries={[`/help/reports/${item.report_id}`]}><Routes><Route path="/help/reports/:id" element={<MyReportsPage token="test-token" />} /></Routes></MemoryRouter>);
  await screen.findByText('Đã sửa thiết bị âm thanh.');
  expect(screen.getByText('Đã giải quyết')).toBeTruthy();
  cleanup();
  const { container } = render(<ReportContent report={{ ...item, description: '<img src=x onerror=alert(1)>' }} />);
  expect(container.querySelector('img')).toBeNull();
  expect(screen.getByText('<img src=x onerror=alert(1)>')).toBeTruthy();
});

it('admin saves against the exact version, retains edits on a conflict and does not claim success', async () => {
  vi.mocked(accountRequest).mockResolvedValueOnce({ item }).mockRejectedValueOnce(new Error('Báo cáo vừa được cập nhật.'));
  render(<MemoryRouter initialEntries={[`/admin/support-reports/${item.report_id}`]}><Routes><Route path="/admin/support-reports/:id" element={<AdminSupportDetail token="admin-token" />} /></Routes></MemoryRouter>);
  await screen.findByRole('form', { name: 'Xử lý báo cáo' });
  fireEvent.change(screen.getByLabelText('Trạng thái xử lý'), { target: { value: 'resolved' } });
  fireEvent.change(screen.getByLabelText(/Phản hồi cho người gửi/), { target: { value: 'Đã xác minh và khắc phục sự cố.' } });
  fireEvent.submit(screen.getByRole('form', { name: 'Xử lý báo cáo' }));
  await screen.findByRole('alert');
  const patch = vi.mocked(accountRequest).mock.calls.find(call => call[2]?.method === 'PATCH');
  expect(JSON.parse(String(patch?.[2]?.body)).expected_updated_at).toBe(item.updated_at);
  expect((screen.getByLabelText(/Phản hồi cho người gửi/) as HTMLTextAreaElement).value).toBe('Đã xác minh và khắc phục sự cố.');
  expect(screen.queryByText('Đã lưu trạng thái và phản hồi cho người gửi.')).toBeNull();
});

it('admin cannot close a report without a meaningful response and can save a valid decision', async () => {
  vi.mocked(accountRequest).mockResolvedValueOnce({ item }).mockResolvedValueOnce({ item: { ...item, status: 'resolved', admin_response: 'Đã sửa lỗi camera trong phòng họp.', updated_at: '2026-11-25T09:00:00Z' } });
  render(<MemoryRouter initialEntries={[`/admin/support-reports/${item.report_id}`]}><Routes><Route path="/admin/support-reports/:id" element={<AdminSupportDetail token="admin-token" />} /></Routes></MemoryRouter>);
  await screen.findByRole('form', { name: 'Xử lý báo cáo' });
  fireEvent.change(screen.getByLabelText('Trạng thái xử lý'), { target: { value: 'resolved' } });
  fireEvent.submit(screen.getByRole('form', { name: 'Xử lý báo cáo' }));
  expect(screen.getByRole('alert').textContent).toContain('ít nhất 10 ký tự');
  expect(accountRequest).toHaveBeenCalledTimes(1);
  fireEvent.change(screen.getByLabelText(/Phản hồi cho người gửi/), { target: { value: 'Đã sửa lỗi camera trong phòng họp.' } });
  fireEvent.submit(screen.getByRole('form', { name: 'Xử lý báo cáo' }));
  await waitFor(() => expect(screen.getByRole('status').textContent).toContain('Đã lưu trạng thái'));
  expect(screen.getAllByText('Đã giải quyết').length).toBeGreaterThan(0);
});
