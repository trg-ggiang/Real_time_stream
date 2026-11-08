// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { HomePage } from './page';

afterEach(cleanup);

it('opens room permissions from the Home join card', () => {
  render(
    <HomePage
      onMeetingCreated={vi.fn()}
      activeRoomId={null}
      onLeaveRoom={vi.fn()}
      onUnauthorized={vi.fn()}
    />,
  );

  expect(screen.getByRole('heading', { name: 'Sẵn sàng kết nối?' })).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: 'Tham gia phòng' }));
  expect(screen.getByRole('heading', { name: 'Thiết lập phòng' })).toBeTruthy();
  expect(screen.getByRole('button', { name: 'Lưu thiết lập và vào phòng' })).toBeTruthy();
});
