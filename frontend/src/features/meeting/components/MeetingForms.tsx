import { useState, type FormEvent } from 'react';
import { CalendarBlank } from '@phosphor-icons/react/dist/csr/CalendarBlank';
import { VideoCamera } from '@phosphor-icons/react/dist/csr/VideoCamera';

export type CreateValues = { title: string; waitingRoomEnabled: boolean; recurrenceRule: string | null; scheduledStartAt?: string; scheduledEndAt?: string };

function readSchedule(form: HTMLFormElement) {
  const values = new FormData(form);
  const start = new Date(String(values.get('start'))), end = new Date(String(values.get('end')));
  if (!Number.isFinite(start.getTime()) || !Number.isFinite(end.getTime()) || start.getTime() <= Date.now() || end <= start) {
    throw new Error('Chọn giờ bắt đầu trong tương lai và giờ kết thúc sau giờ bắt đầu.');
  }
  return { scheduledStartAt: start.toISOString(), scheduledEndAt: end.toISOString() };
}

function ScheduleFields() {
  return <div className="workspace-form-row">
    <label>Bắt đầu<input name="start" type="datetime-local" required autoComplete="off" /></label>
    <label>Kết thúc<input name="end" type="datetime-local" required autoComplete="off" /></label>
  </div>;
}

export function CreateMeetingForm({ busy, onCreate }: { busy: boolean; onCreate: (values: CreateValues, quick: boolean) => Promise<void> }) {
  const [kind, setKind] = useState<'quick' | 'scheduled'>('quick');
  const [error, setError] = useState('');
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (busy) return;
    const form = event.currentTarget, data = new FormData(form);
    try {
      const title = String(data.get('title')).trim();
      if (!title) { (form.elements.namedItem('title') as HTMLInputElement).focus(); throw new Error('Nhập tên cuộc họp.'); }
      const frequency = String(data.get('frequency') || '');
      const count = Number(data.get('count') || 1);
      const values: CreateValues = { title, waitingRoomEnabled: data.get('waiting') === 'on',
        recurrenceRule: kind === 'scheduled' && frequency ? `FREQ=${frequency};COUNT=${count}` : null,
        ...(kind === 'scheduled' ? readSchedule(form) : {}),
      };
      setError(''); await onCreate(values, kind === 'quick');
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Kiểm tra thông tin rồi thử lại.'); }
  }
  return <section className="workspace-create" aria-labelledby="create-title">
    <div className="workspace-section-title"><VideoCamera size={25} aria-hidden="true" /><h2 id="create-title">Bắt đầu một cuộc gặp</h2></div>
    <div className="workspace-mode" role="group" aria-label="Loại cuộc họp">
      <button type="button" aria-pressed={kind === 'quick'} disabled={busy} onClick={() => setKind('quick')}><VideoCamera size={17} aria-hidden="true" />Họp ngay</button>
      <button type="button" aria-pressed={kind === 'scheduled'} disabled={busy} onClick={() => setKind('scheduled')}><CalendarBlank size={17} aria-hidden="true" />Lên lịch</button>
    </div>
    <form onSubmit={event => void submit(event)} className="workspace-form" aria-busy={busy}>
      <fieldset disabled={busy}>
        <label>Tên cuộc họp<input name="title" required maxLength={160} autoComplete="off" /></label>
        {kind === 'scheduled' ? <><ScheduleFields /><div className="workspace-form-row"><label>Lặp lại<select name="frequency" aria-label="Lặp lại"><option value="">Không lặp</option><option value="DAILY">Hàng ngày</option><option value="WEEKLY">Hàng tuần</option><option value="MONTHLY">Hàng tháng</option><option value="YEARLY">Hàng năm</option></select></label><label>Số buổi (nếu lặp)<input name="count" type="number" min={1} max={100} defaultValue={4} required inputMode="numeric" /></label></div><p className="workspace-help">Múi giờ: {Intl.DateTimeFormat().resolvedOptions().timeZone}</p></> : null}
        <label className="workspace-check"><input name="waiting" type="checkbox" defaultChecked /><span>Duyệt khách trước khi vào phòng</span></label>
        {error ? <p className="notice error" role="alert">{error}</p> : null}
        <button className="meeting-join-button" type="submit">{busy ? 'Đang tạo…' : kind === 'quick' ? 'Tạo cuộc họp ngay' : 'Tạo cuộc họp và lịch hẹn'}</button>
      </fieldset>
    </form>
  </section>;
}

export function ScheduleSessionForm({ busy, onSchedule }: { busy: boolean; onSchedule: (values: { scheduledStartAt: string; scheduledEndAt: string }) => Promise<void> }) {
  const [error, setError] = useState('');
  return <form className="workspace-form" aria-label="Lên lịch buổi họp" onSubmit={async event => {
    event.preventDefault(); if (busy) return;
    try { const values = readSchedule(event.currentTarget); setError(''); await onSchedule(values); }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Không tạo được lịch. Hãy thử lại.'); }
  }}><fieldset disabled={busy}><ScheduleFields />{error ? <p role="alert" className="notice error">{error}</p> : null}<button type="submit">{busy ? 'Đang lưu…' : 'Lưu lịch hẹn'}</button></fieldset></form>;
}
