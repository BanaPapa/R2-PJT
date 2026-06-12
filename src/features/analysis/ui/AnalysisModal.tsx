import React, { useEffect, useRef, useState } from 'react';
import { useAppStore } from '../../../shared/lib/store';
import { useMonthlyStore } from '../../../shared/lib/monthly-store';
import { runAnalysis, type AnalysisRequest, type AnalysisScope, type AnalysisTab, type TokenUsage } from '../../../entities/analysis';
import { collectCurrentView, collectFor, selectedRegionUnion } from '../lib/collect';
import { summarizeScope, formatUsage } from '../lib/saved';
import { useSavedStore } from '../model/saved-store';
import type { SavedAnalysis } from '../model/saved.types';
import { MetricTree } from './MetricTree';
import { AnalysisRegionPicker, type PickedRegion } from './AnalysisRegionPicker';
import { SlotPickerList } from './SlotPickerList';
import { SavedAnalysisList } from './SavedAnalysisList';
import type { ChartSetSnapshot } from '../../chart-slots';
import { Markdown } from './AnalysisResult';
import { ProviderSelector } from './ProviderSelector';
import { ProviderManager } from './ProviderManager';
import { getProvider, useProviderStore } from '../../../entities/provider';

type Phase = 'idle' | 'loading' | 'done' | 'error';
type Panel = 'current' | 'custom' | 'slot';

interface AnalysisModalProps {
  open: boolean;
  onClose: () => void;
}

interface PeriodOverride {
  from: string;
  to: string;
  base: string;
}

const TAB_LABEL: Record<'price' | 'trade' | 'market', string> = {
  price: '시세지표',
  trade: '거래지표',
  market: '시장지표',
};

export const AnalysisModal: React.FC<AnalysisModalProps> = ({ open, onClose }) => {
  const mode = useMonthlyStore(s => s.mode);
  const weeklyTab = useMonthlyStore(s => s.weeklyTab);

  const wSel = useAppStore(s => s.selectedRegions);
  const wLabels = useAppStore(s => s.regionLabels);
  const wFrom = useAppStore(s => s.fromDate);
  const wTo = useAppStore(s => s.toDate);
  const mSel = useMonthlyStore(s => s.selectedRegions);
  const mLabels = useMonthlyStore(s => s.regionLabels);
  const mFrom = useMonthlyStore(s => s.fromDate);
  const mTo = useMonthlyStore(s => s.toDate);

  const isWeekly = mode === 'weekly';
  const curRegions = isWeekly ? wSel : mSel;
  const curLabels = isWeekly ? wLabels : mLabels;
  const curFrom = isWeekly ? wFrom : mFrom;
  const curTo = isWeekly ? wTo : mTo;

  const [panel, setPanel] = useState<Panel>('current');
  const [phase, setPhase] = useState<Phase>('idle');
  const [result, setResult] = useState('');
  const [resultModel, setResultModel] = useState('');
  const [resultUsage, setResultUsage] = useState<TokenUsage | undefined>();
  const [resultScope, setResultScope] = useState<AnalysisScope | null>(null);
  const [savedId, setSavedId] = useState<string | null>(null); // 현재 결과가 이미 저장됨(또는 저장된 항목을 연 경우)
  const [showSaved, setShowSaved] = useState(false);
  const [error, setError] = useState('');
  const saveAnalysis = useSavedStore(s => s.save);
  const savedCount = useSavedStore(s => s.items.length);
  const [selTabs, setSelTabs] = useState<Set<AnalysisTab>>(new Set());
  const [pickedRegions, setPickedRegions] = useState<PickedRegion[]>([]);
  const [weeklyOverride, setWeeklyOverride] = useState<PeriodOverride | undefined>();
  const [monthlyOverride, setMonthlyOverride] = useState<PeriodOverride | undefined>();
  const abortRef = useRef<AbortController | null>(null);
  const [showManager, setShowManager] = useState(false);
  const selectedProviderId = useProviderStore(s => s.selectedProviderId);
  const selectedModelId = useProviderStore(s => s.selectedModelId);

  // 모달 열릴 때 초기화
  useEffect(() => {
    if (!open) return;
    const union = selectedRegionUnion();
    setPickedRegions(union.map(u => ({ key: u.region, label: u.label })));
    const curTab = `${mode}-${weeklyTab}` as AnalysisTab;
    setSelTabs(new Set([curTab]));
    setWeeklyOverride(undefined);
    setMonthlyOverride(undefined);
    setPanel('current');
    setShowManager(false);
    setShowSaved(false);
    setPhase('idle');
    setResult('');
    setResultModel('');
    setResultUsage(undefined);
    setResultScope(null);
    setSavedId(null);
    setError('');
    // 월간 거래지표 가용 지역 목록 확보(지역 선택기 availability용)
    void useMonthlyStore.getState().loadTradeRegions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // 닫힐 때 진행 중 요청 취소
  useEffect(() => {
    if (!open) abortRef.current?.abort();
  }, [open]);

  if (!open) return null;

  const runWith = async (build: () => Promise<AnalysisRequest> | AnalysisRequest) => {
    setPhase('loading');
    setError('');
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    try {
      const payload = await build();
      payload.provider = selectedProviderId;
      payload.model = selectedModelId;
      if (ctrl.signal.aborted) return;
      if (payload.datasets.length === 0) {
        setError('분석할 데이터가 없습니다. 지역·기간·지표를 확인해주세요.');
        setPhase('error');
        return;
      }
      const res = await runAnalysis(payload, { signal: ctrl.signal });
      if (ctrl.signal.aborted) return;
      setResult(res.result ?? '');
      setResultModel(res.model ?? '');
      setResultUsage(res.usage);
      setResultScope(payload.scope);
      setSavedId(null);
      setPhase('done');
    } catch (e) {
      if (ctrl.signal.aborted) return;
      setError(e instanceof Error ? e.message : '분석에 실패했습니다.');
      setPhase('error');
    }
  };

  const analyzeCurrent = () => runWith(() => collectCurrentView());

  const analyzeCustom = () =>
    runWith(() => {
      const weekly = useAppStore.getState();
      const monthly = useMonthlyStore.getState();
      const regionLabels: Record<string, string> = {};
      for (const r of pickedRegions) regionLabels[r.key] = r.label;
      return collectFor({
        tabs: Array.from(selTabs),
        regions: pickedRegions.map(r => r.key),
        regionLabels,
        weeklyPeriod: weeklyOverride ?? { from: weekly.fromDate, to: weekly.toDate },
        monthlyPeriod: monthlyOverride ?? { from: monthly.fromDate, to: monthly.toDate },
        weeklyBaseDate: weeklyOverride?.base ?? weekly.baseDate,
        monthlyBaseDate: monthlyOverride?.base ?? monthly.baseDate,
      });
    });

  // 슬롯 선택 → 직접 선택 폼을 슬롯 내용으로 채우고 custom 패널로 전환.
  const handleSlotPick = (snap: ChartSetSnapshot) => {
    setPickedRegions(snap.selectedRegions.map(k => ({ key: k, label: snap.regionLabels[k] ?? k })));
    setSelTabs(new Set([`${snap.mode}-${snap.weeklyTab}` as AnalysisTab]));
    const ov: PeriodOverride = { from: snap.fromDate, to: snap.toDate, base: snap.baseDate };
    if (snap.mode === 'weekly') {
      setWeeklyOverride(ov);
      setMonthlyOverride(undefined);
    } else {
      setMonthlyOverride(ov);
      setWeeklyOverride(undefined);
    }
    setPanel('custom');
  };

  const cancel = () => {
    abortRef.current?.abort();
    setPhase('idle');
  };

  // 현재 결과를 저장 슬롯에 보관.
  const saveCurrent = () => {
    if (!result || savedId) return;
    const scopeLabel = resultScope ? summarizeScope(resultScope) : '분석 결과';
    const id = saveAnalysis({
      name: scopeLabel,
      scopeLabel,
      provider: selectedProviderId,
      model: resultModel,
      usage: resultUsage,
      markdown: result,
    });
    setSavedId(id);
  };

  // 저장된 항목을 결과 화면으로 열기.
  const openSaved = (item: SavedAnalysis) => {
    setResult(item.markdown);
    setResultModel(item.model);
    setResultUsage(item.usage);
    setResultScope(null);
    setSavedId(item.id);
    setShowSaved(false);
    setPhase('done');
  };

  const customDisabled = selTabs.size === 0 || pickedRegions.length === 0;

  const wEff = weeklyOverride ?? { from: wFrom, to: wTo };
  const mEff = monthlyOverride ?? { from: mFrom, to: mTo };
  const overridden = !!weeklyOverride || !!monthlyOverride;

  // 로딩 안내는 프로바이더에 맞게. claude-bridge만 Claude 세션이 필요하다.
  const activeProvider = getProvider(selectedProviderId);
  const isBridgeProvider = !activeProvider || activeProvider.apiShape === 'claude-bridge';
  const loadingHint = isBridgeProvider
    ? '앱과 Claude 세션이 함께 켜져 있어야 결과가 도착합니다.'
    : `${activeProvider.label}에 직접 요청하고 있습니다. 잠시만 기다려주세요.`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="flex h-[640px] max-h-[85vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl bg-white shadow-xl">
        {/* 헤더 */}
        <div className="flex flex-none items-center justify-between border-b border-gray-200 px-5 py-3.5">
          <h2 className="flex items-center gap-2 text-base font-bold text-gray-900">
            <span className="inline-flex h-6 w-6 items-center justify-center rounded-md bg-blue-600 text-white text-xs">AI</span>
            데이터 분석
          </h2>
          <button onClick={onClose} className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600" aria-label="닫기">
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>

        {/* 본문 */}
        <div className="min-h-0 flex-1 overflow-auto px-5 py-4">
          {phase === 'idle' && (
            showManager ? (
              <ProviderManager onBack={() => setShowManager(false)} />
            ) : showSaved ? (
              <SavedAnalysisList onBack={() => setShowSaved(false)} onOpen={openSaved} />
            ) : (
              <>
                <ProviderSelector onManage={() => setShowManager(true)} />
                {/* 방법 선택 탭 + 저장된 분석 진입 */}
                <div className="mb-4 flex items-center justify-between">
                  <div className="inline-flex rounded-lg bg-gray-100 p-0.5">
                    {(['current', 'custom', 'slot'] as Panel[]).map(p => (
                      <button
                        key={p}
                        onClick={() => setPanel(p)}
                        className={`px-3 py-1 text-sm font-semibold rounded-md transition-colors ${
                          panel === p ? 'bg-white text-blue-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'
                        }`}
                      >
                        {p === 'current' ? '현재 화면' : p === 'custom' ? '직접 선택' : '슬롯'}
                      </button>
                    ))}
                  </div>
                  <button
                    onClick={() => setShowSaved(true)}
                    className="rounded-lg border border-gray-300 px-3 py-1 text-sm text-gray-600 hover:bg-gray-50"
                  >
                    저장된 분석{savedCount ? ` (${savedCount})` : ''}
                  </button>
                </div>

                {panel === 'current' && (
                  <div className="space-y-3">
                    <p className="text-sm text-gray-500">지금 보고 있는 화면을 그대로 분석합니다.</p>
                    <dl className="space-y-2 rounded-xl border border-gray-200 bg-gray-50 p-4 text-sm">
                      <Row label="모드 · 지표">{isWeekly ? '주간' : '월간'} · {TAB_LABEL[weeklyTab]}</Row>
                      <Row label="기간">{curFrom} ~ {curTo}</Row>
                      <Row label="지역">
                        {curRegions.length ? curRegions.map(r => curLabels[r] ?? r).join(', ') : <span className="text-gray-400">선택된 지역 없음</span>}
                      </Row>
                    </dl>
                    <button
                      onClick={analyzeCurrent}
                      disabled={curRegions.length === 0}
                      className="w-full rounded-lg bg-blue-600 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:bg-gray-300"
                    >
                      분석하기
                    </button>
                  </div>
                )}

                {panel === 'custom' && (
                  <div className="space-y-4">
                    <MetricTree selected={selTabs} onChange={setSelTabs} />
                    <AnalysisRegionPicker value={pickedRegions} onChange={setPickedRegions} />

                    <p className="text-xs text-gray-400">
                      기간: 주간 {wEff.from}~{wEff.to} · 월간 {mEff.from}~{mEff.to}{' '}
                      {overridden ? '(슬롯 기간 적용)' : '(현재 설정 사용)'}
                    </p>

                    <button
                      onClick={analyzeCustom}
                      disabled={customDisabled}
                      className="w-full rounded-lg bg-blue-600 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:bg-gray-300"
                    >
                      분석하기
                    </button>
                  </div>
                )}

                {panel === 'slot' && <SlotPickerList onPick={handleSlotPick} />}
              </>
            )
          )}

          {phase === 'loading' && (
            <div className="flex flex-col items-center justify-center py-16">
              <div className="mb-4 h-9 w-9 animate-spin rounded-full border-2 border-blue-500 border-t-transparent" />
              <p className="text-sm text-gray-600">AI가 데이터를 분석하고 있습니다…</p>
              <p className="mt-1 text-xs text-gray-400">{loadingHint}</p>
              <button onClick={cancel} className="mt-5 rounded-lg border border-gray-300 px-4 py-1.5 text-sm text-gray-600 hover:bg-gray-50">
                취소
              </button>
            </div>
          )}

          {phase === 'error' && (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <p className="mb-4 text-sm text-red-600">{error}</p>
              <button onClick={() => setPhase('idle')} className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700">
                다시 시도
              </button>
            </div>
          )}

          {phase === 'done' && <Markdown text={result} />}
        </div>

        {/* 푸터 (결과 화면) */}
        {phase === 'done' && (
          <div className="flex flex-none items-center gap-2 border-t border-gray-200 px-5 py-3">
            {(resultModel || resultUsage) && (
              <span className="mr-auto min-w-0 truncate text-xs text-gray-400">
                {resultModel && `응답 모델: ${resultModel}`}
                {resultUsage && formatUsage(resultUsage) ? `  ·  ${formatUsage(resultUsage)}` : ''}
              </span>
            )}
            <button
              onClick={saveCurrent}
              disabled={!!savedId}
              className="flex-none rounded-lg border border-gray-300 px-4 py-1.5 text-sm text-gray-700 hover:bg-gray-50 disabled:border-green-200 disabled:bg-green-50 disabled:text-green-600"
            >
              {savedId ? '저장됨 ✓' : '결과 저장'}
            </button>
            <button onClick={() => setPhase('idle')} className="flex-none rounded-lg border border-gray-300 px-4 py-1.5 text-sm text-gray-600 hover:bg-gray-50">
              다시 분석
            </button>
            <button onClick={onClose} className="flex-none rounded-lg bg-blue-600 px-4 py-1.5 text-sm font-semibold text-white hover:bg-blue-700">
              닫기
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

const Row: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
  <div className="flex gap-3">
    <dt className="w-16 flex-none font-medium text-gray-500">{label}</dt>
    <dd className="flex-1 text-gray-800">{children}</dd>
  </div>
);
