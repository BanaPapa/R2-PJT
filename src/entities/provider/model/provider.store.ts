import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { AuthMethod, ModelInfo, ProviderStatus } from './provider.types';
import * as api from '../api/provider.api';

interface ProviderStore {
  selectedProviderId: string;
  selectedModelId: string | null;
  statuses: Record<string, { connected: boolean; method?: AuthMethod }>;
  models: Record<string, ModelInfo[]>;
  loadingModels: Record<string, boolean>;

  refreshProviders: () => Promise<void>;
  refreshModels: (id: string, force?: boolean) => Promise<void>;
  saveApiKey: (id: string, key: string) => Promise<void>;
  saveSessionToken: (id: string, token: string) => Promise<void>;
  startOAuth: (id: string) => Promise<void>;
  disconnect: (id: string) => Promise<void>;
  select: (providerId: string, modelId: string | null) => void;
}

export const useProviderStore = create<ProviderStore>()(
  persist(
    (set, get) => ({
      selectedProviderId: 'claude-bridge',
      selectedModelId: null,
      statuses: {},
      models: {},
      loadingModels: {},

      refreshProviders: async () => {
        const list: ProviderStatus[] = await api.fetchProviders();
        const statuses: ProviderStore['statuses'] = {};
        for (const s of list) statuses[s.id] = { connected: s.connected, method: s.method };
        set({ statuses });
      },

      refreshModels: async (id, force = false) => {
        if (!force && get().models[id]?.length) return;
        set(s => ({ loadingModels: { ...s.loadingModels, [id]: true } }));
        try {
          const models = await api.fetchModels(id, force);
          set(s => ({ models: { ...s.models, [id]: models } }));
        } finally {
          set(s => ({ loadingModels: { ...s.loadingModels, [id]: false } }));
        }
      },

      saveApiKey: async (id, key) => {
        await api.saveApiKey(id, key);
        await get().refreshProviders();
      },

      saveSessionToken: async (id, token) => {
        await api.saveSessionToken(id, token);
        await get().refreshProviders();
      },

      startOAuth: async (id) => {
        const { authUrl } = await api.startOAuth(id);
        window.open(authUrl, '_blank', 'width=520,height=720');
      },

      disconnect: async (id) => {
        await api.disconnect(id);
        await get().refreshProviders();
      },

      select: (providerId, modelId) => set({ selectedProviderId: providerId, selectedModelId: modelId }),
    }),
    {
      name: 'kb-provider',
      partialize: s => ({ selectedProviderId: s.selectedProviderId, selectedModelId: s.selectedModelId }),
    },
  ),
);
