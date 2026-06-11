import type { ApiShape } from '../../src/entities/provider/model/provider.types';
import { openAiCompatible, type Adapter } from './openai-compatible';
import { anthropic } from './anthropic';
import { gemini } from './gemini';

export type { Adapter, ChatInput } from './openai-compatible';

export function getAdapter(shape: ApiShape): Adapter {
  switch (shape) {
    case 'openai-compatible': return openAiCompatible;
    case 'anthropic': return anthropic;
    case 'gemini': return gemini;
    case 'claude-bridge': throw new Error('claude-bridge는 어댑터가 아닌 디스크 흐름으로 처리됩니다.');
  }
}
