import type { ButtonHTMLAttributes } from 'react';
import { CaretLeft } from '@phosphor-icons/react/dist/csr/CaretLeft';
import { CaretRight } from '@phosphor-icons/react/dist/csr/CaretRight';

type Props = Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children'> & { direction: 'previous' | 'next' };

export function PaginationButton({ direction, style, ...props }: Props) {
  const label = direction === 'previous' ? 'Trang trước' : 'Trang sau';
  const Icon = direction === 'previous' ? CaretLeft : CaretRight;
  return <button {...props} type="button" aria-label={props['aria-label'] || label} title={props.title || label}
    style={{ ...style, display: 'inline-grid', placeItems: 'center', width: 40, minWidth: 40, minHeight: 40, padding: 0 }}>
    <Icon size={18} aria-hidden="true" />
  </button>;
}
