/**
 * Renders the content text format used by lessons and questions: paragraphs, "- " and "1. " lists,
 * **bold**, *italic*, `code`, inline maths $...$ and display maths $$...$$ (KaTeX, rendered locally).
 * Text is never injected as HTML; only KaTeX's own escaped output is.
 */
import katex from 'katex';
import { Fragment, type ReactNode } from 'react';

function Math({ tex, display = false }: { tex: string; display?: boolean }) {
  const html = katex.renderToString(tex, { throwOnError: false, displayMode: display, output: 'html', strict: 'ignore', trust: false });
  return display ? (
    <div className="my-1.5 overflow-x-auto overflow-y-hidden py-0.5" dangerouslySetInnerHTML={{ __html: html }} />
  ) : (
    <span dangerouslySetInnerHTML={{ __html: html }} />
  );
}

/** Inline formatting inside one line of text. */
function inline(text: string, key = 0): ReactNode[] {
  const out: ReactNode[] = [];
  const re = /(\$[^$\n]+?\$)|(\*\*[^*]+?\*\*)|(\*[^*\s][^*]*?\*)|(`[^`]+?`)/g;
  let last = 0;
  let m: RegExpExecArray | null;
  let i = 0;
  while ((m = re.exec(text))) {
    if (m.index > last) out.push(text.slice(last, m.index));
    const t = m[0];
    const k = `${key}-${i++}`;
    if (m[1]) out.push(<Math key={k} tex={t.slice(1, -1)} />);
    else if (m[2]) out.push(<strong key={k} className="font-semibold">{inline(t.slice(2, -2), i)}</strong>);
    else if (m[3]) out.push(<em key={k}>{inline(t.slice(1, -1), i)}</em>);
    else out.push(<code key={k} className="rounded bg-zinc-100 px-1 text-[0.9em]">{t.slice(1, -1)}</code>);
    last = m.index + t.length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

const lines = (block: string) => block.split('\n');

export function Rich({ text, className = '', inline: asInline = false }: { text: string | null | undefined; className?: string; inline?: boolean }) {
  if (!text) return null;
  // Short single-paragraph text (options, table cells, answers) renders inline.
  if (asInline && !/\n\s*\n|^\s*([-*•]|\d+[.)])\s|\$\$/m.test(text)) return <span className={className}>{inline(text.replace(/\n/g, ' '))}</span>;
  // Display maths first, so $$ blocks may contain blank lines.
  const parts = text.split(/(\$\$[\s\S]+?\$\$)/g);
  const blocks: ReactNode[] = [];
  parts.forEach((part, pi) => {
    if (part.startsWith('$$') && part.endsWith('$$')) {
      blocks.push(<Math key={`d${pi}`} tex={part.slice(2, -2).trim()} display />);
      return;
    }
    part
      .split(/\n{2,}/)
      .map((b) => b.trim())
      .filter(Boolean)
      .forEach((b, bi) => {
        const ls = lines(b);
        const key = `${pi}-${bi}`;
        if (ls.every((l) => /^\s*[-*•]\s+/.test(l))) {
          blocks.push(
            <ul key={key} className="list-disc space-y-0.5 pl-5">
              {ls.map((l, i) => <li key={i}>{inline(l.replace(/^\s*[-*•]\s+/, ''), i)}</li>)}
            </ul>,
          );
        } else if (ls.every((l) => /^\s*\d+[.)]\s+/.test(l))) {
          blocks.push(
            <ol key={key} className="list-decimal space-y-0.5 pl-5">
              {ls.map((l, i) => <li key={i}>{inline(l.replace(/^\s*\d+[.)]\s+/, ''), i)}</li>)}
            </ol>,
          );
        } else {
          blocks.push(
            <p key={key}>
              {ls.map((l, i) => (
                <Fragment key={i}>
                  {i > 0 && <br />}
                  {inline(l, i)}
                </Fragment>
              ))}
            </p>,
          );
        }
      });
  });
  return <div className={`space-y-1.5 leading-relaxed ${className}`}>{blocks}</div>;
}

export function DisplayMath({ tex }: { tex: string }) {
  return <Math tex={tex} display />;
}

/** Parses a JSON block body; returns null for legacy plain-text bodies. */
export function parseBody<T>(body: string): T | null {
  if (!body.startsWith('{') && !body.startsWith('[')) return null;
  try {
    return JSON.parse(body) as T;
  } catch {
    return null;
  }
}
