import { useEffect, useRef, useState } from 'react';
import { DownloadSimple } from '@phosphor-icons/react/dist/csr/DownloadSimple';
import { File as FileIcon } from '@phosphor-icons/react/dist/csr/File';
import { X } from '@phosphor-icons/react/dist/csr/X';
import { workspaceRequest, type ChannelAttachment } from '../services/workspace-api';
import { useClub } from '../workspace-context';
import { useWorkspaceMutation } from '../use-workspace-mutation';

const imageExtensions = ['jpg', 'jpeg', 'png', 'webp'];
const clipboardImageExtensions: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
};
const fileExtensions = [...imageExtensions, 'pdf', 'docx', 'xlsx', 'pptx'];
const extension = (name: string) => name.split('.').pop()?.toLowerCase() || '';
export const channelFileAccept = fileExtensions.map(value => '.' + value).join(',');

export function pastedChannelImages(clipboard: DataTransfer) {
  const items = Array.from(clipboard.items ?? [])
    .filter(item => item.kind === 'file' && item.type.startsWith('image/'))
    .flatMap(item => {
      const file = item.getAsFile();
      return file ? [file] : [];
    });
  const images = items.length ? items : Array.from(clipboard.files ?? [])
    .filter(file => file.type.startsWith('image/') || (!file.type && imageExtensions.includes(extension(file.name))));
  return images.map(file => {
    const suffix = clipboardImageExtensions[file.type];
    if (!suffix || (imageExtensions.includes(extension(file.name)) && file.name !== 'image.png')) return file;
    return new File([file], `anh-da-dan.${suffix}`, { type: file.type });
  });
}

export function channelFileError(files: File[]) {
  if (files.length > 3) return 'Mỗi tin nhắn gửi tối đa 3 tệp.';
  if (files.reduce((total, file) => total + file.size, 0) > 15 * 1024 * 1024) {
    return 'Tổng dung lượng tệp tối đa là 15 MiB.';
  }
  if (files.some(file => !file.size || !fileExtensions.includes(extension(file.name)))) {
    return 'Chọn tệp có nội dung thuộc định dạng JPEG, PNG, WebP, PDF, DOCX, XLSX hoặc PPTX.';
  }
  return '';
}

function fileSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  return bytes < 1024 * 1024 ? `${Math.ceil(bytes / 1024)} KiB` : `${(bytes / (1024 * 1024)).toFixed(1)} MiB`;
}

export function DraftChannelAttachment({ file, onRemove, disabled }: {
  file: File; onRemove: () => void; disabled: boolean;
}) {
  const [preview, setPreview] = useState('');
  const image = imageExtensions.includes(extension(file.name));
  useEffect(() => {
    if (!image) return;
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file, image]);
  return <li className={`cw-attachment-draft${image ? ' cw-image-draft' : ''}`}>
    {image ? preview && <img src={preview} alt="Ảnh đang soạn" /> : <>
      <FileIcon size={19} aria-hidden="true" />
      <div><strong title={file.name}>{file.name}</strong><small>{fileSize(file.size)}</small></div>
    </>}
    <button type="button" aria-label={image ? `Bỏ ảnh ${file.name}` : `Bỏ tệp ${file.name}`} disabled={disabled} onClick={onRemove}><X size={15} aria-hidden="true" /></button>
  </li>;
}

function ChannelImageViewer({ path, onClose, onDownload, downloading, downloadError }: {
  path: string; onClose: () => void; onDownload: () => void; downloading: boolean; downloadError: string;
}) {
  const { token, clubId } = useClub();
  const dialog = useRef<HTMLDialogElement>(null);
  const [source, setSource] = useState('');
  const [failed, setFailed] = useState(false);
  const [revision, setRevision] = useState(0);

  function dismiss() {
    dialog.current?.close();
    onClose();
  }

  useEffect(() => {
    const element = dialog.current;
    element?.showModal();
    return () => element?.close();
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    void workspaceRequest<{ url: string }>(token, clubId, path + '?mode=preview', { signal: controller.signal })
      .then(({ url }) => { if (!controller.signal.aborted) setSource(url); })
      .catch(() => { if (!controller.signal.aborted) setFailed(true); });
    return () => controller.abort();
  }, [token, clubId, path, revision]);

  return <dialog ref={dialog} className="cw-image-viewer" aria-label="Xem ảnh đính kèm"
    onCancel={event => { event.preventDefault(); dismiss(); }}
    onClick={event => { if (event.target === event.currentTarget) dismiss(); }}>
    <div className="cw-image-viewer-content">
      <div className="cw-image-viewer-actions">
        <button type="button" aria-label="Tải ảnh xuống" disabled={downloading} onClick={onDownload}><DownloadSimple size={20} aria-hidden="true" /></button>
        <button type="button" aria-label="Đóng ảnh" onClick={dismiss}><X size={20} aria-hidden="true" /></button>
      </div>
      {failed ? <button type="button" onClick={() => { setFailed(false); setSource(''); setRevision(value => value + 1); }}>Thử mở lại ảnh</button>
        : source ? <img src={source} alt="Ảnh đính kèm" referrerPolicy="no-referrer" onError={() => setFailed(true)} />
          : <p role="status">Đang mở ảnh…</p>}
      {downloadError && <small role="alert">{downloadError}</small>}
    </div>
  </dialog>;
}

export function ChannelMessageAttachment({ attachment, channelId }: {
  attachment: ChannelAttachment; channelId: string;
}) {
  const { token, clubId } = useClub();
  const container = useRef<HTMLLIElement>(null);
  const [preview, setPreview] = useState('');
  const [previewError, setPreviewError] = useState(false);
  const [viewing, setViewing] = useState(false);
  const [revision, setRevision] = useState(0);
  const download = useWorkspaceMutation();
  const image = attachment.mime_type.startsWith('image/');
  const path = `channels/${channelId}/attachments/${attachment.attachment_id}`;

  useEffect(() => {
    const element = container.current;
    if (!image || !element) return;
    const controller = new AbortController();
    async function loadPreview() {
      try {
        const { url } = await workspaceRequest<{ url: string }>(token, clubId, path + '?mode=preview', { signal: controller.signal });
        if (!controller.signal.aborted) setPreview(url);
      } catch {
        if (!controller.signal.aborted) setPreviewError(true);
      }
    }
    if (typeof IntersectionObserver === 'undefined') {
      void loadPreview();
      return () => controller.abort();
    }
    const observer = new IntersectionObserver(entries => {
      if (entries.some(entry => entry.isIntersecting)) {
        observer.disconnect();
        void loadPreview();
      }
    });
    observer.observe(element);
    return () => { observer.disconnect(); controller.abort(); };
  }, [token, clubId, path, image, revision]);

  async function downloadFile() {
    const result = await download.run(signal => workspaceRequest<{ url: string }>(token, clubId, path, { signal }));
    if (result) {
      const link = document.createElement('a');
      link.href = result.url;
      link.rel = 'noreferrer';
      link.click();
    }
  }

  if (image) return <li className="cw-message-image" ref={container}>
    {previewError ? <button className="cw-link" type="button" onClick={() => { setPreviewError(false); setPreview(''); setRevision(value => value + 1); }}>Thử mở lại ảnh</button>
      : preview ? <button type="button" className="cw-message-image-button" aria-label="Xem ảnh lớn" aria-haspopup="dialog" onClick={() => setViewing(true)}>
        <img src={preview} alt="Ảnh đính kèm" decoding="async" referrerPolicy="no-referrer" onError={() => setPreviewError(true)} />
      </button> : <small className="cw-image-loading">Đang tải ảnh…</small>}
    {viewing && <ChannelImageViewer path={path} onClose={() => setViewing(false)} onDownload={() => void downloadFile()}
      downloading={download.busy} downloadError={download.error} />}
  </li>;

  return <li className="cw-message-attachment">
    <div className="cw-attachment-file">
      <FileIcon size={19} aria-hidden="true" />
      <div><strong>{attachment.original_name}</strong><small>{fileSize(attachment.size_bytes)}</small></div>
      <button type="button" aria-label={`Tải xuống ${attachment.original_name}`} disabled={download.busy} onClick={() => void downloadFile()}>
        <DownloadSimple size={18} aria-hidden="true" />
      </button>
    </div>
    {download.error && <small role="alert">{download.error}</small>}
  </li>;
}
