// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { ClubApplicationDialog } from './ClubApplicationDialog';

afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });

it('sends selected club types from the legacy creation dialog', async () => {
  HTMLDialogElement.prototype.showModal = function () { this.open = true; };
  HTMLDialogElement.prototype.close = function () { this.open = false; };
  const categories = [
    { category_id: '11111111-1111-4111-8111-111111111111', name: 'Thể thao' },
    { category_id: '22222222-2222-4222-8222-222222222222', name: 'Kỹ năng' },
  ];
  const fetchMock = vi.fn(async (url: string, _init?: RequestInit) => ({ ok: true, json: async () =>
    url.endsWith('/club-categories') ? { items: categories } : { club: { club_id: 'new-id' } },
  }));
  vi.stubGlobal('fetch', fetchMock);
  render(<ClubApplicationDialog token="token" onClose={vi.fn()} onSubmitted={vi.fn()} />);
  fireEvent.change(screen.getByPlaceholderText('VD: CLB Công nghệ thông tin'), { target: { value: 'CLB Mới' } });
  fireEvent.change(screen.getByPlaceholderText('Giới thiệu ngắn về CLB'), { target: { value: 'Cộng đồng sinh viên mới' } });
  fireEvent.change(screen.getByPlaceholderText('Mục đích, hoạt động và định hướng của CLB...'), { target: { value: 'Cùng sinh hoạt và tổ chức hoạt động cho sinh viên.' } });
  fireEvent.change(screen.getByPlaceholderText('Sứ mệnh của câu lạc bộ'), { target: { value: 'Kết nối sinh viên.' } });
  fireEvent.click(await screen.findByLabelText('Thể thao'));
  fireEvent.click(screen.getByLabelText('Kỹ năng'));
  fireEvent.click(screen.getByRole('button', { name: 'Gửi yêu cầu thành lập CLB' }));
  await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
  const body = JSON.parse(String(fetchMock.mock.calls[1][1]?.body));
  expect(body.category_ids).toEqual(categories.map((item) => item.category_id));
});
