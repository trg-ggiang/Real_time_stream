import type { ReactNode } from 'react';

const urlPattern = /\bhttps?:\/\/[^\s<>"“”‘’\\]+/giu;
const openingBracket: Record<string, string> = { ')': '(', ']': '[', '}': '{' };

function linkText(candidate: string) {
  let text = candidate.replace(/[.,!?;:'…]+$/u, '');
  // Keep balanced brackets inside the URL, such as a Wikipedia page title.
  for (let closing = text.at(-1); closing && openingBracket[closing]; closing = text.at(-1)) {
    const opening = openingBracket[closing];
    if (text.split(closing).length <= text.split(opening).length) break;
    text = text.slice(0, -1);
  }
  return text;
}

export function ChannelMessageText({ content }: { content: string }) {
  const parts: ReactNode[] = [];
  let end = 0;
  for (const match of content.matchAll(urlPattern)) {
    const text = linkText(match[0]);
    let url: URL;
    try { url = new URL(text); }
    catch { continue; }
    if (url.protocol !== 'https:' && url.protocol !== 'http:') continue;

    const external = url.origin !== window.location.origin;
    parts.push(content.slice(end, match.index), <a key={match.index} className="cw-message-link"
      href={url.href} target={external ? '_blank' : undefined}
      rel={external ? 'noopener noreferrer' : undefined}>{text}</a>);
    end = match.index + text.length;
  }
  parts.push(content.slice(end));
  return <>{parts}</>;
}
