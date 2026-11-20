// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { ImageUpload } from './ImageUpload';

afterEach(() => { cleanup(); vi.unstubAllGlobals(); });
it('uploads a file as multipart and assigns only the server-generated URL', async () => {
  const changed = vi.fn(), busy = vi.fn();
  const fetcher = vi.fn(async (_url: string, _options?: RequestInit) => ({ ok: true, json: async () => ({ url: 'https://storage.example/actor/image.png' }) }));
  vi.stubGlobal('fetch', fetcher);
  render(<ImageUpload token="jwt" label="Ảnh bìa" onChange={changed} onBusyChange={busy} />);
  fireEvent.change(screen.getByLabelText('Ảnh bìa'), { target: { files: [new File(['image'], 'photo.png', { type: 'image/png' })] } });
  await waitFor(() => expect(changed).toHaveBeenCalledWith('https://storage.example/actor/image.png'));
  expect(fetcher.mock.calls[0][0]).toBe('/api/media/images');
  const options = (fetcher.mock.calls as unknown as [string, RequestInit][])[0][1];
  expect(options.body).toBeInstanceOf(FormData);
  expect((options.body as FormData).get('file')).toBeInstanceOf(File);
  expect(busy.mock.calls.map(([value]) => value)).toEqual([true, false]);
});
it('rejects SVG without uploading and preserves the previous image on failure', async () => {
  const changed = vi.fn(), fetcher = vi.fn(async () => ({ ok: false, status: 503, json: async () => ({ message: 'Chưa tải được ảnh.' }) }));
  vi.stubGlobal('fetch', fetcher);
  render(<ImageUpload token="jwt" label="Logo" value="https://storage.example/old.png" onChange={changed} />);
  fireEvent.change(screen.getByLabelText('Logo'), { target: { files: [new File(['<svg/>'], 'bad.svg', { type: 'image/svg+xml' })] } });
  expect(fetcher).not.toHaveBeenCalled();
  fireEvent.change(screen.getByLabelText('Logo'), { target: { files: [new File(['image'], 'photo.png', { type: 'image/png' })] } });
  await screen.findByText('Chưa tải được ảnh.');
  expect(changed).not.toHaveBeenCalled();
  expect(screen.getByRole('img').getAttribute('src')).toBe('https://storage.example/old.png');
});
