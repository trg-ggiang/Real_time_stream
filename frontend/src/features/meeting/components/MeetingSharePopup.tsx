import { useCallback } from 'react';
import { MeetingNotification } from './MeetingNotification';
import type { MeetingShareResult } from '../services/meetings-api';

export function MeetingSharePopup({ result, dismiss }: {
  result: MeetingShareResult | null;
  dismiss: (value: null) => void;
}) {
  const close = useCallback(() => dismiss(null), [dismiss]);
  return result ? <MeetingNotification message={result.message} manualLink={result.manualLink}
    kind={result.manualLink ? 'warning' : 'success'} onClose={close} /> : null;
}
