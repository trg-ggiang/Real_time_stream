import { useState, type FormEvent } from 'react';
import { VideoCamera } from '@phosphor-icons/react/dist/csr/VideoCamera';

export type CreateValues = { title: string; waitingRoomEnabled: boolean; allowEarlyJoin: boolean; recurrenceRule: string | null; scheduledStartAt?: string; scheduledEndAt?: string };

function readSchedule(form: HTMLFormElement, recurring = false) {
  const values = new FormData(form);
  const startText = values.has('firstDate') ? `${values.get('firstDate')}T${values.get('startTime')}` : String(values.get('start'));
  const endText = values.has('firstDate') ? `${recurring ? values.get('firstDate') : values.get('endDate') || values.get('firstDate')}T${values.get('endTime')}` : String(values.get('end'));
  const start = new Date(startText), end = new Date(endText);
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

export function CreateMeetingForm({ busy, onCreate, kind }: { busy: boolean; onCreate: (values: CreateValues, quick: boolean) => Promise<void>; kind: 'quick' | 'scheduled' }) {
  const [frequency, setFrequency] = useState('');
  const [weekdays, setWeekdays] = useState<number[]>([]);
  const [differentEndDate, setDifferentEndDate] = useState(false);
  const [error, setError] = useState('');
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (busy) return;
    const form = event.currentTarget, data = new FormData(form);
    try {
      const title = String(data.get('title')).trim();
      if (!title) { (form.elements.namedItem('title') as HTMLInputElement).focus(); throw new Error('Nhập tên cuộc họp.'); }
      const schedule = kind === 'scheduled' ? readSchedule(form, !!frequency) : null;
      let recurrenceRule: string | null = null;
      if (schedule && frequency) {
        const untilDate = String(data.get('endDate') || '');
        const until = new Date(`${untilDate}T23:59:59.999`);
        if (!untilDate || !Number.isFinite(until.getTime()) || until < new Date(schedule.scheduledStartAt)) {
          throw new Error('Chọn ngày kết thúc lịch không trước ngày tổ chức.');
        }
        const untilUtc = until.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
        recurrenceRule = `FREQ=${frequency};UNTIL=${untilUtc}`;
        if (frequency === 'WEEKLY') {
          const firstDay = new Date(schedule.scheduledStartAt).getDay();
          if (!weekdays.length || !weekdays.includes(firstDay)) throw new Error('Chọn ít nhất một thứ, gồm thứ của buổi đầu tiên.');
          const codes = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'];
          recurrenceRule += `;BYDAY=${weekdays.map(day => codes[day]).join(',')}`;
        }
      }
      const values: CreateValues = { title, waitingRoomEnabled: data.get('waiting') === 'on', allowEarlyJoin: kind === 'scheduled' && data.get('allowEarlyJoin') === 'on',
        recurrenceRule,
        ...(schedule ?? {}),
      };
      setError(''); await onCreate(values, kind === 'quick');
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Kiểm tra thông tin rồi thử lại.'); }
  }
  return <section className="workspace-create" aria-labelledby="create-title">
    <div className="workspace-section-title"><VideoCamera size={25} aria-hidden="true" /><h2 id="create-title">{kind === 'quick' ? 'Tạo cuộc họp ngay' : 'Lên lịch cuộc họp'}</h2></div>
    <form onSubmit={event => void submit(event)} className="workspace-form" aria-busy={busy}>
      <fieldset disabled={busy}>
        <label>Tiêu đề cuộc họp *<input name="title" required maxLength={160} autoComplete="off" placeholder="VD: Họp định kỳ ban kỹ thuật" /></label>
        {kind === 'scheduled' ? <>
          <div className="workspace-schedule-dates">
            <label>Ngày tổ chức *<input name="firstDate" type="date" required onChange={event => {
              if (frequency === 'WEEKLY' && event.target.value) setWeekdays([new Date(`${event.target.value}T00:00`).getDay()]);
            }} /></label>
            <div className="workspace-schedule-other-date">
              {frequency ? <label>Đến ngày *<input name="endDate" type="date" required /></label> : <>
                <label className="workspace-check"><input type="checkbox" checked={differentEndDate} onChange={event => setDifferentEndDate(event.target.checked)} /><span>Kết thúc ngày khác</span></label>
                {differentEndDate && <label>Ngày kết thúc<input name="endDate" type="date" required /></label>}
              </>}
            </div>
          </div>
          <div className="workspace-schedule-time">
            <label>Bắt đầu *<input name="startTime" type="time" required /></label>
            <label>Kết thúc *<input name="endTime" type="time" required /></label>
          </div>
          <p className="workspace-field-title">Lặp lại</p>
          <div className="workspace-repeat-options" role="radiogroup" aria-label="Lặp lại">
            {([['', 'Không lặp'], ['DAILY', 'Hàng ngày'], ['WEEKLY', 'Hàng tuần']] as const).map(([value, label]) => <label key={label}><input type="radio" name="frequency" value={value} checked={frequency === value} onChange={event => {
              setFrequency(value);
              if (value === 'WEEKLY') {
                const start = (event.currentTarget.form?.elements.namedItem('firstDate') as HTMLInputElement)?.value;
                setWeekdays(start ? [new Date(`${start}T00:00`).getDay()] : []);
              }
            }} />{label}</label>)}
          </div>
          {frequency === 'WEEKLY' && <fieldset className="workspace-weekdays"><legend>Vào thứ</legend>{['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'].map((label, day) => <label key={label}><input type="checkbox" checked={weekdays.includes(day)} onChange={() => setWeekdays(current => current.includes(day) ? current.filter(value => value !== day) : [...current, day])} />{label}</label>)}</fieldset>}
          <p className="workspace-help">{frequency ? 'Các buổi giữ cùng giờ và thời lượng đến ngày kết thúc lịch. ' : ''}Múi giờ: {Intl.DateTimeFormat().resolvedOptions().timeZone}</p>
        </> : null}
        <details className="workspace-meeting-advanced"><summary>Cài đặt nâng cao</summary><label className="workspace-check"><input name="waiting" type="checkbox" defaultChecked /><span>Yêu cầu xác nhận tham gia</span></label>{kind === 'scheduled' && <label className="workspace-check"><input name="allowEarlyJoin" type="checkbox" /><span>Cho phép vào phòng trước giờ họp 15 phút</span></label>}</details>
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
