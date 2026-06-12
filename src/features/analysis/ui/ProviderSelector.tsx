import React, { useEffect, useMemo, useState } from 'react';
import { Settings, RefreshCw } from 'lucide-react';
import {
  PROVIDERS, getProvider, useProviderStore,
  sortModels, modelOptionLabel, MODEL_SORTS, DEFAULT_MODEL_SORT, type ModelSort,
} from '../../../entities/provider';

interface ProviderSelectorProps {
  onManage: () => void;
}

export const ProviderSelector: React.FC<ProviderSelectorProps> = ({ onManage }) => {
  const selectedProviderId = useProviderStore(s => s.selectedProviderId);
  const selectedModelId = useProviderStore(s => s.selectedModelId);
  const models = useProviderStore(s => s.models[selectedProviderId]) ?? [];
  const loading = useProviderStore(s => s.loadingModels[selectedProviderId] ?? false);
  const modelError = useProviderStore(s => s.modelErrors[selectedProviderId] ?? null);
  const select = useProviderStore(s => s.select);
  const refreshModels = useProviderStore(s => s.refreshModels);

  const [sort, setSort] = useState<ModelSort>(DEFAULT_MODEL_SORT);
  const sortedModels = useMemo(() => sortModels(models, sort), [models, sort]);

  const def = getProvider(selectedProviderId);
  const isBridge = def?.apiShape === 'claude-bridge';

  useEffect(() => {
    if (!isBridge) void refreshModels(selectedProviderId);
  }, [selectedProviderId, isBridge, refreshModels]);

  return (
    <div className="mb-4 space-y-1">
    <div className="flex items-center gap-2">
      <label className="sr-only" htmlFor="prov">프로바이더</label>
      <select
        id="prov"
        aria-label="프로바이더"
        value={selectedProviderId}
        onChange={e => select(e.target.value, null)}
        className="rounded-lg border border-gray-300 px-2 py-1.5 text-sm"
      >
        {PROVIDERS.map(p => (
          <option key={p.id} value={p.id}>{p.label}</option>
        ))}
      </select>

      {!isBridge && (
        <>
          <label className="sr-only" htmlFor="model">모델</label>
          <select
            id="model"
            aria-label="모델"
            value={selectedModelId ?? ''}
            onChange={e => select(selectedProviderId, e.target.value || null)}
            className="min-w-40 rounded-lg border border-gray-300 px-2 py-1.5 text-sm"
          >
            <option value="">{loading ? '불러오는 중…' : '모델 선택'}</option>
            {sortedModels.map(m => (
              <option key={m.id} value={m.id}>{modelOptionLabel(m)}</option>
            ))}
          </select>
          <label className="sr-only" htmlFor="model-sort">정렬</label>
          <select
            id="model-sort"
            aria-label="모델 정렬"
            value={sort}
            onChange={e => setSort(e.target.value as ModelSort)}
            className="rounded-lg border border-gray-300 px-2 py-1.5 text-sm text-gray-600"
          >
            {MODEL_SORTS.map(s => (
              <option key={s.value} value={s.value}>{s.label}</option>
            ))}
          </select>
          <button
            aria-label="모델 새로고침"
            onClick={() => void refreshModels(selectedProviderId, true)}
            className="rounded-lg border border-gray-300 p-1.5 text-gray-500 hover:bg-gray-50"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </>
      )}

      <button
        aria-label="프로바이더 관리"
        onClick={onManage}
        className="ml-auto rounded-lg border border-gray-300 p-1.5 text-gray-500 hover:bg-gray-50"
      >
        <Settings className="h-4 w-4" />
      </button>
    </div>
      {!isBridge && modelError && !loading && (
        <p role="alert" className="text-xs text-red-600">
          모델 목록을 불러오지 못했습니다: {modelError}
        </p>
      )}
    </div>
  );
};
