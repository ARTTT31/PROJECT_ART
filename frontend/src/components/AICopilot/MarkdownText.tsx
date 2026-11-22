'use client';

import React from 'react';

/**
 * A deliberately small Markdown subset, rendered as React elements.
 *
 * The drawer used to print every reply with `whitespace-pre-line`, so an answer
 * that used a list or a table arrived as a wall of asterisks and pipes. There is
 * no parser dependency and no `dangerouslySetInnerHTML` here: each block below
 * becomes elements, so a reply can never inject markup.
 *
 * Supported: `#`/`##`/`###` headings, bullet and numbered lists, pipe tables,
 * fenced code, and `**bold**` / `code` inline. Anything else stays literal text.
 */

const INLINE_PATTERN = /(\*\*[^*]+\*\*|`[^`]+`)/g;
const BULLET_LINE = /^\s*[-*]\s+(.*)$/;
const NUMBERED_LINE = /^\s*\d+[.)]\s+(.*)$/;
const HEADING_LINE = /^(#{1,3})\s+(.*)$/;
const QUOTE_LINE = /^\s*>\s?(.*)$/;
const TABLE_ROW = /^\s*\|(.+)\|\s*$/;
const TABLE_DIVIDER = /^\s*\|?[\s:|-]*-[\s:|-]*\|[\s:|-]*$/;

function renderInline(text: string, keyPrefix: string): React.ReactNode[] {
  const nodes: React.ReactNode[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  let index = 0;

  INLINE_PATTERN.lastIndex = 0;
  while ((match = INLINE_PATTERN.exec(text)) !== null) {
    if (match.index > lastIndex) nodes.push(text.slice(lastIndex, match.index));
    const token = match[0];
    if (token.startsWith('**')) {
      nodes.push(
        <strong key={`${keyPrefix}-b${index}`} className="font-bold">
          {token.slice(2, -2)}
        </strong>,
      );
    } else {
      nodes.push(
        <code
          key={`${keyPrefix}-c${index}`}
          className="rounded bg-[var(--surface-chip)] px-1 py-0.5 text-[12px] text-[var(--ink)]"
        >
          {token.slice(1, -1)}
        </code>,
      );
    }
    lastIndex = match.index + token.length;
    index += 1;
  }
  if (lastIndex < text.length) nodes.push(text.slice(lastIndex));
  return nodes;
}

function tableCells(line: string): string[] {
  return line
    .trim()
    .replace(/^\|/, '')
    .replace(/\|$/, '')
    .split('|')
    .map((cell) => cell.trim());
}

const HEADING_CLASS: Record<number, string> = {
  1: 'text-[15px] font-bold',
  2: 'text-[14px] font-bold',
  3: 'text-[13px] font-bold',
};

export default function MarkdownText({
  text,
  className = 'space-y-1.5',
}: {
  text: string;
  className?: string;
}) {
  const lines = (text || '').replace(/\r\n/g, '\n').split('\n');
  const blocks: React.ReactNode[] = [];
  let paragraph: string[] = [];
  let key = 0;

  const flushParagraph = () => {
    if (paragraph.length === 0) return;
    const body = paragraph.join('\n');
    paragraph = [];
    blocks.push(
      <p key={`p${key++}`} className="whitespace-pre-line">
        {renderInline(body, `p${key}`)}
      </p>,
    );
  };

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];

    // Fenced code: everything until the closing fence is literal.
    if (line.trim().startsWith('```')) {
      flushParagraph();
      const code: string[] = [];
      index += 1;
      while (index < lines.length && !lines[index].trim().startsWith('```')) {
        code.push(lines[index]);
        index += 1;
      }
      blocks.push(
        <pre
          key={`code${key++}`}
          className="overflow-x-auto rounded-apple-md bg-[var(--surface-chip)] px-2.5 py-2 text-[12px] leading-relaxed"
        >
          <code>{code.join('\n')}</code>
        </pre>,
      );
      continue;
    }

    // Pipe table: a header row followed by a |---|---| divider.
    if (
      TABLE_ROW.test(line) &&
      index + 1 < lines.length &&
      TABLE_DIVIDER.test(lines[index + 1])
    ) {
      flushParagraph();
      const header = tableCells(line);
      const rows: string[][] = [];
      index += 2;
      while (index < lines.length && TABLE_ROW.test(lines[index])) {
        rows.push(tableCells(lines[index]));
        index += 1;
      }
      index -= 1;
      blocks.push(
        <div key={`table${key++}`} className="overflow-x-auto">
          <table className="w-full border-collapse text-[12px]">
            <thead>
              <tr>
                {header.map((cell, column) => (
                  <th
                    key={`h${column}`}
                    className="border border-[var(--hairline)] px-2 py-1 text-left font-bold"
                  >
                    {renderInline(cell, `h${column}`)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, rowIndex) => (
                <tr key={`r${rowIndex}`}>
                  {row.map((cell, column) => (
                    <td
                      key={`c${rowIndex}-${column}`}
                      className="border border-[var(--hairline)] px-2 py-1 align-top"
                    >
                      {renderInline(cell, `r${rowIndex}c${column}`)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>,
      );
      continue;
    }

    const heading = HEADING_LINE.exec(line);
    if (heading) {
      flushParagraph();
      const level = heading[1].length;
      blocks.push(
        <p key={`h${key++}`} className={`${HEADING_CLASS[level]} text-[var(--ink)]`}>
          {renderInline(heading[2], `h${key}`)}
        </p>,
      );
      continue;
    }

    if (QUOTE_LINE.test(line)) {
      flushParagraph();
      const quoted: string[] = [];
      while (index < lines.length) {
        const quote = QUOTE_LINE.exec(lines[index]);
        if (!quote) break;
        quoted.push(quote[1]);
        index += 1;
      }
      index -= 1;
      blocks.push(
        <blockquote
          key={`q${key++}`}
          className="border-l-2 border-[var(--accent)] pl-2.5 text-[var(--ink-secondary)]"
        >
          {renderInline(quoted.join(' '), `q${key}`)}
        </blockquote>,
      );
      continue;
    }

    if (BULLET_LINE.test(line)) {
      flushParagraph();
      const items: string[] = [];
      while (index < lines.length) {
        const item = BULLET_LINE.exec(lines[index]);
        if (!item) break;
        items.push(item[1]);
        index += 1;
      }
      index -= 1;
      blocks.push(
        <ul key={`ul${key++}`} className="list-disc space-y-0.5 pl-4">
          {items.map((item, itemIndex) => (
            <li key={`li${itemIndex}`}>{renderInline(item, `li${itemIndex}`)}</li>
          ))}
        </ul>,
      );
      continue;
    }

    if (NUMBERED_LINE.test(line)) {
      flushParagraph();
      const items: string[] = [];
      while (index < lines.length) {
        const item = NUMBERED_LINE.exec(lines[index]);
        if (!item) break;
        items.push(item[1]);
        index += 1;
      }
      index -= 1;
      blocks.push(
        <ol key={`ol${key++}`} className="list-decimal space-y-0.5 pl-4">
          {items.map((item, itemIndex) => (
            <li key={`li${itemIndex}`}>{renderInline(item, `li${itemIndex}`)}</li>
          ))}
        </ol>,
      );
      continue;
    }

    if (line.trim() === '') {
      flushParagraph();
      continue;
    }

    paragraph.push(line);
  }

  flushParagraph();

  return <div className={className}>{blocks}</div>;
}
