import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { ProviderManager } from '../../../src/features/analysis/ui/ProviderManager';
import { useProviderStore } from '../../../src/entities/provider';

beforeEach(() => {
  useProviderStore.setState({
    statuses: { openai: { connected: false }, xai: { connected: true, method: 'subscription' } },
    models: {}, loadingModels: {},
  });
  vi.restoreAllMocks();
  // 마운트 시 refreshProviders가 실제 fetch를 쏘지 않도록 목 처리(jsdom unhandled rejection 방지)
  vi.spyOn(useProviderStore.getState(), 'refreshProviders').mockResolvedValue();
});

describe('ProviderManager', () => {
  it('각 프로바이더 행과 연결상태를 보여준다', () => {
    render(<ProviderManager onBack={() => {}} />);
    expect(screen.getByText('OpenAI')).toBeInTheDocument();
    expect(screen.getByText('xAI (Grok)')).toBeInTheDocument();
  });

  it('API 키 입력 후 저장 시 saveApiKey 호출', async () => {
    const spy = vi.spyOn(useProviderStore.getState(), 'saveApiKey').mockResolvedValue();
    render(<ProviderManager onBack={() => {}} />);
    fireEvent.click(screen.getAllByText('API 키')[0]!);
    fireEvent.change(screen.getByPlaceholderText('API 키 입력'), { target: { value: 'sk-z' } });
    fireEvent.click(screen.getByText('저장'));
    expect(spy).toHaveBeenCalledWith('openai', 'sk-z');
  });

  it('연결된 프로바이더는 연결해제 버튼을 보인다', () => {
    const spy = vi.spyOn(useProviderStore.getState(), 'disconnect').mockResolvedValue();
    render(<ProviderManager onBack={() => {}} />);
    fireEvent.click(screen.getByLabelText('xai 연결해제'));
    expect(spy).toHaveBeenCalledWith('xai');
  });

  it('xAI 구독 로그인은 새 창을 열고 코드 입력 후 submitOAuthCode를 호출한다', async () => {
    useProviderStore.setState({ statuses: { xai: { connected: false } }, models: {}, loadingModels: {} });
    const startSpy = vi.spyOn(useProviderStore.getState(), 'startOAuthCode').mockResolvedValue('state-xyz');
    const submitSpy = vi.spyOn(useProviderStore.getState(), 'submitOAuthCode').mockResolvedValue();
    render(<ProviderManager onBack={() => {}} />);

    const xaiRow = screen.getByText('xAI (Grok)').closest('li')!;
    fireEvent.click(within(xaiRow).getByText('구독으로 로그인'));
    expect(startSpy).toHaveBeenCalledWith('xai');

    const input = await screen.findByPlaceholderText('발급된 코드 붙여넣기');
    fireEvent.change(input, { target: { value: '  paste-code  ' } });
    fireEvent.click(screen.getByText('저장'));
    expect(submitSpy).toHaveBeenCalledWith('xai', 'state-xyz', 'paste-code');
  });
});
