// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, it } from 'vitest';
import { confirmAction } from './confirm-action';
import { useUnsavedChanges } from './use-unsaved-changes';

afterEach(() => { document.querySelector<HTMLButtonElement>('.uc-confirm-actions button')?.click(); cleanup(); });

it('requires explicit acceptance and safely displays plain text', async () => {
  const result = confirmAction('<img src=x onerror=alert(1)>');
  expect(screen.getByRole('alertdialog')).toBeTruthy();
  expect(document.querySelector('.uc-confirm img')).toBeNull();
  expect(await confirmAction('Duplicate')).toBe(false);
  fireEvent.click(screen.getByRole('button', { name: 'Xác nhận' }));
  expect(await result).toBe(true);
  expect(screen.queryByRole('alertdialog')).toBeNull();
});

it('cancels and restores focus when Escape is pressed', async () => {
  render(<button>Mở xác nhận</button>);
  const trigger = screen.getByRole('button'); trigger.focus();
  const result = confirmAction('Xóa thành viên?');
  fireEvent(screen.getByRole('alertdialog'), new Event('cancel', { cancelable: true }));
  expect(await result).toBe(false);
  expect(document.activeElement).toBe(trigger);
});

it('dismisses stale confirmation when browser history navigates', async () => {
  const result = confirmAction('Thao tác ở trang trước');
  window.dispatchEvent(new PopStateEvent('popstate'));
  expect(await result).toBe(false);
  expect(screen.queryByRole('alertdialog')).toBeNull();
  const next = confirmAction('Thao tác mới');
  fireEvent.click(screen.getByRole('button', { name: 'Hủy' }));
  expect(await next).toBe(false);
});

it('does not ask to discard changes for new-tab and download links', () => {
  function Form() { useUnsavedChanges(true); return <><a href="/docs" target="_blank">Tài liệu</a><a href="/file.pdf" download>Tải tệp</a></>; }
  render(<Form />);
  // Stop the actual navigation after the document capture listener has run.
  for (const link of screen.getAllByRole('link')) {
    link.addEventListener('click', event => event.preventDefault());
    fireEvent.click(link);
  }
  expect(screen.queryByRole('alertdialog')).toBeNull();
});

it('blocks unsaved navigation until the popup is accepted', async () => {
  let calls = 0;
  function Form() { useUnsavedChanges(true); return <button data-leave-account onClick={() => calls++}>Rời trang</button>; }
  render(<Form />);
  fireEvent.click(screen.getByRole('button', { name: 'Rời trang' }));
  expect(calls).toBe(0);
  await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Hủy' })));
  expect(calls).toBe(0);
  fireEvent.click(screen.getByRole('button', { name: 'Rời trang' }));
  await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Xác nhận' })));
  expect(calls).toBe(1);
});
