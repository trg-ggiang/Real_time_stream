import type { ComponentPropsWithoutRef } from 'react';
import { CloudArrowUp } from '@phosphor-icons/react/dist/csr/CloudArrowUp';
import './image-upload.css';

type ImageFilePickerProps = Omit<ComponentPropsWithoutRef<'input'>, 'type'> & {
  busy?: boolean;
  hasImage?: boolean;
};

export function ImageFilePicker({ busy, hasImage, disabled, ...input }: ImageFilePickerProps) {
  return <span className="uc-image-picker">
    <CloudArrowUp size={19} aria-hidden="true" />
    <span aria-hidden="true">{busy ? 'Đang tải…' : hasImage ? 'Đổi ảnh' : 'Chọn ảnh'}</span>
    <input {...input} type="file" disabled={disabled || busy} />
  </span>;
}
