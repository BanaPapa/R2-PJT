import React, { useMemo } from 'react';

// 경량 마크다운 렌더러 (외부 의존성 없음).
// 지원: #/##/### 제목, 굵게(**), 순서없는 목록(- / *), 문단.
// 분석 결과는 docs/analysis-prompt.md 형식을 따른다.

type Block =
  | { kind: 'h'; level: 1 | 2 | 3; text: string }
  | { kind: 'ul'; items: string[] }
  | { kind: 'p'; text: string };

function parseBlocks(md: string): Block[] {
  const lines = md.replace(/\r\n/g, '\n').split('\n');
  const blocks: Block[] = [];
  let para: string[] = [];
  let list: string[] = [];

  const flushPara = () => {
    if (para.length) {
      blocks.push({ kind: 'p', text: para.join(' ') });
      para = [];
    }
  };
  const flushList = () => {
    if (list.length) {
      blocks.push({ kind: 'ul', items: list });
      list = [];
    }
  };

  for (const raw of lines) {
    const line = raw.trimEnd();
    const h = /^(#{1,3})\s+(.*)$/.exec(line);
    const li = /^[-*]\s+(.*)$/.exec(line);
    if (h) {
      flushPara();
      flushList();
      blocks.push({ kind: 'h', level: h[1]!.length as 1 | 2 | 3, text: h[2]! });
    } else if (li) {
      flushPara();
      list.push(li[1]!);
    } else if (line.trim() === '') {
      flushPara();
      flushList();
    } else {
      flushList();
      para.push(line.trim());
    }
  }
  flushPara();
  flushList();
  return blocks;
}

// 인라인 굵게(**...**) 처리
function renderInline(text: string): React.ReactNode[] {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((p, i) => {
    const m = /^\*\*([^*]+)\*\*$/.exec(p);
    if (m) return <strong key={i} className="font-semibold text-gray-900">{m[1]}</strong>;
    return <React.Fragment key={i}>{p}</React.Fragment>;
  });
}

export const Markdown: React.FC<{ text: string }> = ({ text }) => {
  const blocks = useMemo(() => parseBlocks(text), [text]);
  return (
    <div className="text-sm leading-relaxed text-gray-700">
      {blocks.map((b, i) => {
        if (b.kind === 'h') {
          const cls =
            b.level === 1
              ? 'mt-4 mb-2 text-lg font-bold text-gray-900'
              : b.level === 2
                ? 'mt-4 mb-1.5 text-base font-bold text-gray-800'
                : 'mt-3 mb-1 text-sm font-semibold text-gray-800';
          return <p key={i} className={i === 0 ? cls.replace('mt-4', 'mt-0').replace('mt-3', 'mt-0') : cls}>{renderInline(b.text)}</p>;
        }
        if (b.kind === 'ul') {
          return (
            <ul key={i} className="my-1.5 ml-4 list-disc space-y-0.5">
              {b.items.map((it, j) => (
                <li key={j}>{renderInline(it)}</li>
              ))}
            </ul>
          );
        }
        return <p key={i} className="my-1.5">{renderInline(b.text)}</p>;
      })}
    </div>
  );
};
