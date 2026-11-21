import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';

const stylesheet = readFileSync(new URL('../meeting-theme.css', import.meta.url), 'utf8');
function luminance(hex: string) {
  const channels = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16) / 255)
    .map(c => c <= .04045 ? c / 12.92 : ((c + .055) / 1.055) ** 2.4);
  return channels[0] * .2126 + channels[1] * .7152 + channels[2] * .0722;
}
function contrast(a: string, b: string) {
  const values = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (values[0] + .05) / (values[1] + .05);
}

it.each(['light', 'dark'])('%s palette keeps text and control states readable', theme => {
  const block = stylesheet.split(`.meeting-app[data-theme='${theme}'] {`)[1].split('}')[0];
  const tokens = Object.fromEntries([...block.matchAll(/(--[a-z-]+):\s*(#[0-9a-f]{6})\b/g)].map(match => [match[1], match[2]]));
  for (const [fg, bg] of [
    ['--meeting-text', '--meeting-bg'], ['--meeting-muted', '--meeting-surface'],
    ['--meeting-text', '--theme-input'], ['--meeting-muted', '--theme-input'],
    ['--meeting-text', '--theme-control'], ['--meeting-text', '--theme-control-hover'],
    ['--theme-button-text', '--theme-button'], ['--theme-button-text', '--theme-button-hover'],
    ['--theme-danger-text', '--theme-danger-soft'], ['--theme-success', '--theme-success-soft'],
  ]) expect(contrast(tokens[fg], tokens[bg]), `${theme}: ${fg} on ${bg}`).toBeGreaterThanOrEqual(4.5);
  expect(contrast('#ffffff', tokens['--theme-danger'])).toBeGreaterThanOrEqual(4.5);
  expect(contrast(tokens['--theme-input-line'], tokens['--theme-input'])).toBeGreaterThanOrEqual(3);
});
