import '@testing-library/jest-dom/vitest';

// jsdom에는 matchMedia가 없어 recharts/일부 컴포넌트가 참조 시 실패 → 스텁.
// node 환경(vite-plugins 테스트)에서는 window가 없으므로 가드.
if (typeof window !== 'undefined' && !window.matchMedia) {
  window.matchMedia = (query: string) =>
    ({
      matches: false,
      media: query,
      onchange: null,
      addEventListener: () => {},
      removeEventListener: () => {},
      addListener: () => {},
      removeListener: () => {},
      dispatchEvent: () => false,
    }) as unknown as MediaQueryList;
}
