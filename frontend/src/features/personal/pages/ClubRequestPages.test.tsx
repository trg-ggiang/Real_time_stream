// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, expect, it, vi } from 'vitest';
import { NewClubRequest } from './ClubRequestPages';
import { accountRequest } from '../../../shared/api/account-http';

vi.mock('../../../shared/api/account-http', () => ({ accountRequest: vi.fn() }));
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });

it('submits more than one club type with a new club request', async () => {
  const categories = [
    { category_id: '11111111-1111-4111-8111-111111111111', name: 'Học thuật & công nghệ' },
    { category_id: '22222222-2222-4222-8222-222222222222', name: 'Kỹ năng' },
  ];
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({ items: categories }) }));
  vi.mocked(accountRequest).mockResolvedValue({ club: { club_id: 'new-id' } });
  render(<MemoryRouter initialEntries={['/me/club-requests/new']}>
    <Routes><Route path="/me/club-requests/new" element={<NewClubRequest token="token" />} />
      <Route path="/me/club-requests/:id" element={<p>Đã gửi</p>} /></Routes>
  </MemoryRouter>);

  fireEvent.change(screen.getByLabelText('Tên CLB'), { target: { value: 'CLB Mới' } });
  fireEvent.change(screen.getByLabelText('Giới thiệu ngắn'), { target: { value: 'Cộng đồng học tập mới' } });
  fireEvent.change(screen.getByLabelText('Mô tả chi tiết'), { target: { value: 'Cùng học hỏi và tổ chức hoạt động cho sinh viên.' } });
  fireEvent.click(screen.getByRole('button', { name: 'Gửi đề nghị xét duyệt' }));
  expect(screen.getByRole('alert').textContent).toContain('Chọn ít nhất một loại CLB');

  fireEvent.click(await screen.findByLabelText('Học thuật & công nghệ'));
  fireEvent.click(screen.getByLabelText('Kỹ năng'));
  fireEvent.click(screen.getByRole('button', { name: 'Gửi đề nghị xét duyệt' }));
  await waitFor(() => expect(accountRequest).toHaveBeenCalledOnce());
  const [, path, options] = vi.mocked(accountRequest).mock.calls[0];
  expect(path).toBe('public/clubs');
  expect(JSON.parse(String(options?.body)).category_ids).toEqual(categories.map((item) => item.category_id));
  expect(await screen.findByText('Đã gửi')).toBeTruthy();
});
