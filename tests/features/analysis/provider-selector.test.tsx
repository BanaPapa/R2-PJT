import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ProviderSelector } from '../../../src/features/analysis/ui/ProviderSelector';
import { useProviderStore } from '../../../src/entities/provider';

vi.spyOn(useProviderStore.getState(), 'refreshModels').mockResolvedValue();

beforeEach(() => {
  useProviderStore.setState({
    selectedProviderId: 'openai', selectedModelId: 'gpt-4o',
    statuses: { openai: { connected: true, method: 'apiKey' } },
    models: { openai: [{ id: 'gpt-4o' }, { id: 'o1' }] },
    loadingModels: {},
  });
});

describe('ProviderSelector', () => {
  it('프로바이더·모델 드롭다운을 렌더한다', () => {
    render(<ProviderSelector onManage={() => {}} />);
    expect(screen.getByLabelText('프로바이더')).toHaveValue('openai');
    expect(screen.getByLabelText('모델')).toHaveValue('gpt-4o');
  });

  it('모델 변경 시 select가 호출된다', () => {
    const selectSpy = vi.spyOn(useProviderStore.getState(), 'select');
    render(<ProviderSelector onManage={() => {}} />);
    fireEvent.change(screen.getByLabelText('모델'), { target: { value: 'o1' } });
    expect(selectSpy).toHaveBeenCalledWith('openai', 'o1');
  });

  it('관리 버튼 클릭 시 onManage 호출', () => {
    const onManage = vi.fn();
    render(<ProviderSelector onManage={onManage} />);
    fireEvent.click(screen.getByLabelText('프로바이더 관리'));
    expect(onManage).toHaveBeenCalled();
  });
});
