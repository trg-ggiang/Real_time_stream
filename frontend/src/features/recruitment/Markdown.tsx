import type { ReactNode } from "react";
function inline(text: string): ReactNode[] {
  return text.split(/(\*\*[^*]+\*\*|`[^`]+`|\[[^\]]+\]\(https?:\/\/[^\s)]+\))/g).map((part, i) => {
    if (part.startsWith("**")) return <strong key={i}>{part.slice(2, -2)}</strong>;
    if (part.startsWith("`")) return <code key={i}>{part.slice(1, -1)}</code>;
    const link = part.match(/^\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)$/);
    return link ? <a key={i} href={link[2]} target="_blank" rel="noopener noreferrer">{link[1]}</a> : part;
  });
}
/** Small Markdown subset rendered as React text; raw HTML is always escaped. */
export function Markdown({ text }: { text?: string | null }) {
  return <div className="rc-markdown">{(text || "").split(/\r?\n/).map((line, i) => {
    if (/^###? /.test(line)) return <h3 key={i}>{inline(line.replace(/^#+ /, ""))}</h3>;
    if (/^# /.test(line)) return <h2 key={i}>{inline(line.slice(2))}</h2>;
    if (/^[-*] /.test(line)) return <p className="rc-bullet" key={i}>• {inline(line.slice(2))}</p>;
    return line ? <p key={i}>{inline(line)}</p> : <br key={i} />;
  })}</div>;
}
