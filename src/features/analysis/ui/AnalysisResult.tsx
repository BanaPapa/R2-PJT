import React, { useEffect, useMemo, useState } from 'react';

// 경량 마크다운 렌더러 (외부 의존성 없음).
// 지원: #/##/### 제목, 굵게(**), 순서없는 목록(- / *), 번호 목록(1. 2.), 문단.
// 분석 결과는 docs/analysis-prompt.md 형식을 따른다.

type Block =
  | { kind: 'h'; level: 1 | 2 | 3; text: string }
  | { kind: 'ul'; items: string[] }
  | { kind: 'ol'; items: string[] }
  | { kind: 'p'; text: string };

function parseBlocks(md: string): Block[] {
  const lines = md.replace(/\r\n/g, '\n').split('\n');
  const blocks: Block[] = [];
  let para: string[] = [];
  let ul: string[] = [];
  let ol: string[] = [];

  const flushPara = () => {
    if (para.length) {
      blocks.push({ kind: 'p', text: para.join(' ') });
      para = [];
    }
  };
  const flushUl = () => {
    if (ul.length) {
      blocks.push({ kind: 'ul', items: ul });
      ul = [];
    }
  };
  const flushOl = () => {
    if (ol.length) {
      blocks.push({ kind: 'ol', items: ol });
      ol = [];
    }
  };
  const flushLists = () => {
    flushUl();
    flushOl();
  };

  for (const raw of lines) {
    const line = raw.trimEnd();
    const h = /^(#{1,3})\s+(.*)$/.exec(line);
    const oli = /^\d+\.\s+(.*)$/.exec(line);
    const uli = /^[-*]\s+(.*)$/.exec(line);
    if (h) {
      flushPara();
      flushLists();
      blocks.push({ kind: 'h', level: h[1]!.length as 1 | 2 | 3, text: h[2]! });
    } else if (oli) {
      flushPara();
      flushUl();
      ol.push(oli[1]!);
    } else if (uli) {
      flushPara();
      flushOl();
      ul.push(uli[1]!);
    } else if (line.trim() === '') {
      flushPara();
      flushLists();
    } else {
      flushLists();
      para.push(line.trim());
    }
  }
  flushPara();
  flushLists();
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

// "~다." 로 끝나는 문장마다 줄바꿈해 가독성을 높인다(문단·목록 항목 내부).
function renderRich(text: string): React.ReactNode {
  const sentences = text.split(/(?<=다\.)\s+/).filter(s => s.trim().length > 0);
  if (sentences.length <= 1) return renderInline(text);
  return sentences.map((s, i) => (
    <React.Fragment key={i}>
      {i > 0 && <br />}
      {renderInline(s)}
    </React.Fragment>
  ));
}

// scale: 결과 글자 배율(1 = 기본 0.875rem). 제목은 em 기준이라 함께 확대/축소된다.
export const Markdown: React.FC<{ text: string; scale?: number }> = ({ text, scale = 1 }) => {
  const blocks = useMemo(() => parseBlocks(text), [text]);
  return (
    <div className="leading-relaxed text-gray-700" style={{ fontSize: `${0.875 * scale}rem` }}>
      {blocks.map((b, i) => {
        if (b.kind === 'h') {
          const cls =
            b.level === 1
              ? 'mt-4 mb-2 text-[1.29em] font-bold text-gray-900'
              : b.level === 2
                ? 'mt-4 mb-1.5 text-[1.14em] font-bold text-gray-800'
                : 'mt-3 mb-1 text-[1em] font-semibold text-gray-800';
          return <p key={i} className={i === 0 ? cls.replace('mt-4', 'mt-0').replace('mt-3', 'mt-0') : cls}>{renderInline(b.text)}</p>;
        }
        if (b.kind === 'ul') {
          return (
            <ul key={i} className="my-1.5 ml-4 list-disc space-y-1">
              {b.items.map((it, j) => (
                <li key={j}>{renderRich(it)}</li>
              ))}
            </ul>
          );
        }
        if (b.kind === 'ol') {
          return (
            <ol key={i} className="my-1.5 ml-5 list-decimal space-y-1.5">
              {b.items.map((it, j) => (
                <li key={j} className="pl-1">{renderRich(it)}</li>
              ))}
            </ol>
          );
        }
        return <p key={i} className="my-1.5">{renderRich(b.text)}</p>;
      })}
    </div>
  );
};

// ── 지역별 탭 보고서 ────────────────────────────────────────
// 모델 출력의 `===TAB: 라벨===` 구분선으로 본문을 탭 단위로 나눈다.
// 구분선이 없으면 전체를 단일 보고서로 본다(구버전·자유 모델 호환).

export interface ReportTab {
  label: string;
  body: string;
}

const TAB_RE = /^={2,}\s*TAB\s*:\s*(.+?)\s*={2,}\s*$/gim;

export function parseReportTabs(md: string): ReportTab[] {
  const text = md.replace(/\r\n/g, '\n');
  const matches = [...text.matchAll(TAB_RE)];
  if (matches.length === 0) return [{ label: '분석', body: text.trim() }];

  const tabs: ReportTab[] = [];
  for (let i = 0; i < matches.length; i++) {
    const cur = matches[i]!;
    const start = cur.index! + cur[0].length;
    const end = i + 1 < matches.length ? matches[i + 1]!.index! : text.length;
    const body = text.slice(start, end).trim();
    if (body) tabs.push({ label: cur[1]!.trim(), body });
  }
  return tabs.length ? tabs : [{ label: '분석', body: text.trim() }];
}

export const AnalysisReport: React.FC<{
  text: string;
  scale?: number;
  onActiveChange?: (tab: ReportTab) => void;
}> = ({ text, scale = 1, onActiveChange }) => {
  const tabs = useMemo(() => parseReportTabs(text), [text]);
  const [active, setActive] = useState(0);
  useEffect(() => {
    setActive(0);
  }, [text]);

  const idx = Math.min(active, tabs.length - 1);
  const cur = tabs[idx]!;

  // 활성 탭이 바뀌면 부모에 알린다(Q&A 컨텍스트를 현재 탭으로 좁히기 위함).
  useEffect(() => {
    onActiveChange?.(cur);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cur.label, cur.body]);

  return (
    <div>
      {tabs.length > 1 && (
        <div className="sticky top-0 z-10 -mx-5 mb-3 flex gap-1 overflow-x-auto border-b border-gray-200 bg-white/95 px-5 pb-0 backdrop-blur">
          {tabs.map((t, i) => (
            <button
              key={i}
              onClick={() => setActive(i)}
              className={`-mb-px whitespace-nowrap border-b-2 px-3 py-2 text-sm font-semibold transition-colors ${
                i === idx
                  ? 'border-blue-600 text-blue-700'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      )}
      <Markdown text={cur.body} scale={scale} />
    </div>
  );
};
