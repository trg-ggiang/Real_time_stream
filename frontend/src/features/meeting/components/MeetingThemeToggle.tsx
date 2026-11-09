import { Sun } from '@phosphor-icons/react/dist/csr/Sun';
import { Moon } from '@phosphor-icons/react/dist/csr/Moon';
import type { MeetingTheme } from '../hooks/use-meeting-theme';

export function MeetingThemeToggle({ theme, onChange }: { theme: MeetingTheme; onChange: (theme: MeetingTheme) => void }) {
  return <div className="meeting-theme-switch" role="group" aria-label="Giao diện">
    <button type="button" aria-label="Giao diện sáng" title="Giao diện sáng" aria-pressed={theme === 'light'} onClick={() => onChange('light')}><Sun size={19} aria-hidden="true" /></button>
    <button type="button" aria-label="Giao diện tối" title="Giao diện tối" aria-pressed={theme === 'dark'} onClick={() => onChange('dark')}><Moon size={19} aria-hidden="true" /></button>
  </div>;
}
