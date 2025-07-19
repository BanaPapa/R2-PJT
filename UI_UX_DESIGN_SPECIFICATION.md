# 부동산 데이터 비교 분석 플랫폼 - UI/UX 디자인 명세서

## 📋 프로젝트 개요

### 디자인 목표
- **직관적인 사용자 경험**: 복잡한 데이터를 간단하게 비교하고 분석할 수 있는 인터페이스
- **반응형 디자인**: 모바일부터 데스크톱까지 일관된 경험 제공
- **실시간 인터랙션**: 사용자 액션에 즉각적으로 반응하는 인터페이스
- **접근성**: 모든 사용자가 쉽게 사용할 수 있는 포용적 디자인

### 차별화 포인트
🎯 **국내 프롭테크 한계점 극복**
- 정보 과부하 → 핵심 데이터만 직관적으로 표현
- 복잡한 네비게이션 → 한 화면에서 모든 기능 완료
- 모바일 최적화 부족 → 터치 퍼스트 인터랙션 설계
- 인터랙션 피드백 부족 → 실시간 반응 및 마이크로 인터랙션 강화

## 🎨 디자인 시스템

### 1. 컬러 팔레트

#### 브랜드 컬러
```css
/* Primary Colors */
--primary-blue: #2563eb;      /* 메인 브랜드 색상 */
--primary-blue-dark: #1d4ed8; /* 호버/액티브 상태 */
--primary-blue-light: #dbeafe; /* 배경/보조 요소 */

/* Secondary Colors */
--secondary-gray: #6b7280;    /* 보조 텍스트 */
--secondary-gray-light: #f9fafb; /* 배경 */
--secondary-gray-dark: #374151; /* 진한 텍스트 */
```

#### 데이터 시각화 컬러 (4개 지역 지원)
```css
/* Chart Color Palette */
--chart-color-1: #3b82f6;   /* 파란색 - 기준 지역 */
--chart-color-2: #ef4444;   /* 빨간색 - 비교 지역 1 */
--chart-color-3: #10b981;   /* 초록색 - 비교 지역 2 */
--chart-color-4: #f59e0b;   /* 주황색 - 비교 지역 3 */

/* Semantic Colors */
--success: #10b981;         /* 상승, 성공 */
--danger: #ef4444;          /* 하락, 위험 */
--warning: #f59e0b;         /* 주의, 경고 */
--info: #3b82f6;           /* 정보, 중성 */
```

#### 다크 모드 지원
```css
/* Dark Mode Colors */
--dark-bg-primary: #111827;
--dark-bg-secondary: #1f2937;
--dark-text-primary: #f9fafb;
--dark-text-secondary: #d1d5db;
```

### 2. 타이포그래피

#### 폰트 패밀리
```css
/* Korean + English */
--font-family: 'Pretendard', 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;

/* Numbers (Data) */
--font-family-mono: 'JetBrains Mono', 'Fira Code', monospace;
```

#### 폰트 크기 스케일
```css
--text-xs: 0.75rem;    /* 12px - 캡션, 라벨 */
--text-sm: 0.875rem;   /* 14px - 보조 텍스트 */
--text-base: 1rem;     /* 16px - 본문 */
--text-lg: 1.125rem;   /* 18px - 부제목 */
--text-xl: 1.25rem;    /* 20px - 제목 */
--text-2xl: 1.5rem;    /* 24px - 큰 제목 */
--text-3xl: 1.875rem;  /* 30px - 헤드라인 */
```

### 3. 스페이싱 시스템 (8px 기준)

```css
--spacing-1: 0.25rem;  /* 4px */
--spacing-2: 0.5rem;   /* 8px */
--spacing-3: 0.75rem;  /* 12px */
--spacing-4: 1rem;     /* 16px */
--spacing-5: 1.25rem;  /* 20px */
--spacing-6: 1.5rem;   /* 24px */
--spacing-8: 2rem;     /* 32px */
--spacing-12: 3rem;    /* 48px */
--spacing-16: 4rem;    /* 64px */
```

### 4. 브레이크포인트

```css
/* Mobile First Approach */
--breakpoint-sm: 640px;   /* 모바일 가로 */
--breakpoint-md: 768px;   /* 태블릿 세로 */
--breakpoint-lg: 1024px;  /* 태블릿 가로 */
--breakpoint-xl: 1280px;  /* 데스크톱 */
--breakpoint-2xl: 1536px; /* 큰 데스크톱 */
```

## 📱 반응형 레이아웃 설계

### 1. 데스크톱 (1280px+)
```
┌─────────────────────────────────────────────────────────────┐
│ Header: Logo + 토글 버튼들 (높이: 64px)                     │
├─────────────────────────────────────────────────────────────┤
│ 지역 선택 패널 (300px) │ 메인 차트 영역 (나머지 전체)     │
│                        │                                   │
│ • 검색 입력창          │ • 라인 차트 (반응형)             │
│ • 지역 트리 (스크롤)   │ • 범례 (우측 상단)               │
│ • 선택 카운터          │ • 상승률 토글 (차트 내부)        │
│                        │ • 인사이트 요약 (하단)           │
│                        │ • 미니맵 브러시 (최하단)         │
├─────────────────────────────────────────────────────────────┤
│ 비교 트레이: 선택된 지역 카드들 (높이: 80px)                │
└─────────────────────────────────────────────────────────────┘
```

### 2. 태블릿 (768px - 1279px)
```
┌─────────────────────────────────────────────────────────────┐
│ Header: Logo + 햄버거 메뉴 + 토글들                         │
├─────────────────────────────────────────────────────────────┤
│ 메인 차트 영역 (전체 너비)                                  │
│                                                             │
│ • 터치 최적화된 줌/팬 제스처                               │
│ • 큰 터치 타겟 (최소 44px)                                 │
│ • 자동 범례 위치 조정                                       │
│                                                             │
├─────────────────────────────────────────────────────────────┤
│ 인사이트 요약 (접기/펼치기 가능)                            │
├─────────────────────────────────────────────────────────────┤
│ 비교 트레이 (가로 스크롤)                                   │
├─────────────────────────────────────────────────────────────┤
│ 지역 선택 (슬라이드 업 패널)                                │
└─────────────────────────────────────────────────────────────┘
```

### 3. 모바일 (320px - 767px)
```
┌─────────────────────────────────────┐
│ Header: Logo + 메뉴 + 토글 (컴팩트)  │
├─────────────────────────────────────┤
│ 차트 영역 (전체 너비, 세로 최적화)   │
│                                     │
│ • 세로 모드 차트 비율 조정           │
│ • 터치 제스처 (핀치 줌, 팬)         │
│ • 간소화된 범례 (하단 또는 숨김)     │
│                                     │
├─────────────────────────────────────┤
│ 인사이트 요약 (기본 접힘)            │
├─────────────────────────────────────┤
│ 비교 트레이 (가로 스크롤, 스와이프)  │
├─────────────────────────────────────┤
│ 지역 선택 FAB (플로팅 액션 버튼)     │
└─────────────────────────────────────┘
```

## 🎯 핵심 컴포넌트 설계

### 1. 헤더 (Header)
**목적**: 브랜드 식별 및 주요 데이터 필터 제공

**구성 요소**:
- **로고**: 클릭 시 전체 초기화
- **데이터 기간 토글**: [월간] / [주간] (세그먼트 컨트롤)
- **지표 종류 토글**: [매매지수] / [전세지수] (세그먼트 컨트롤)
- **메뉴 버튼**: 모바일/태블릿에서 지역 선택 패널 열기

**인터랙션**:
```typescript
// 토글 상태 변경 시 전체 데이터 리로드
const handlePeriodChange = (period: 'monthly' | 'weekly') => {
  setDataPeriod(period);
  // 차트 데이터 갱신 트리거
  refetchChartData();
};
```

### 2. 지역 선택 패널 (RegionSelector)
**목적**: 직관적인 지역 검색 및 선택 인터페이스

**구성 요소**:
- **검색 입력창**: 
  - 플레이스홀더: "지역명을 입력하세요"
  - 자동완성 (2글자 이상)
  - 디바운스 300ms 적용
- **지역 트리**: 
  - 시/도 → 시/군/구 계층 구조
  - 아코디언 UI (한 번에 하나만 펼침)
  - 체크박스 상태 표시
- **선택 제한 표시**: "3/4개 지역 선택됨"

**인터랙션 패턴**:
```typescript
// 지역 선택 시 즉시 차트 업데이트
const handleRegionSelect = (region: Region) => {
  if (selectedRegions.length >= 4) {
    showToast('최대 4개 지역까지 선택할 수 있습니다.');
    return;
  }
  
  setSelectedRegions([...selectedRegions, region]);
  // 차트 데이터 즉시 반영
  updateChartData();
};
```

### 3. 메인 차트 (InteractiveChart)
**목적**: 다중 지역 데이터를 직관적으로 비교 시각화

**차트 라이브러리**: Recharts
**차트 타입**: ResponsiveContainer + LineChart

**핵심 기능**:
- **실시간 데이터 바인딩**: 지역 선택 시 즉시 반영
- **인터랙티브 툴팁**: 
  - 수직 가이드라인
  - 모든 지역 데이터 동시 표시
  - 날짜 포맷팅: "2024년 6월"
- **상승률 비교 모드**: 
  - 토글 스위치로 절대값 ↔ 상대값 전환
  - 부드러운 애니메이션 전환
- **확대/축소**: 
  - 데스크톱: 마우스 휠
  - 모바일: 핀치 제스처

**성능 최적화**:
```typescript
// 메모이제이션으로 불필요한 리렌더링 방지
const ChartComponent = memo(({ data, normalized }) => {
  const processedData = useMemo(() => {
    return normalized ? normalizeData(data) : data;
  }, [data, normalized]);
  
  return (
    <ResponsiveContainer width="100%" height={400}>
      <LineChart data={processedData}>
        {/* 차트 구성 요소 */}
      </LineChart>
    </ResponsiveContainer>
  );
});
```

### 4. 비교 트레이 (ComparisonTray)
**목적**: 선택된 지역들의 시각적 관리

**구성 요소**:
- **지역 카드**: 
  - 기준 지역: 파란색 테두리 + "기준" 배지
  - 비교 지역: 각각 고유 색상 테두리
  - 삭제 버튼 (X): 호버 시 표시
- **드래그 앤 드롭**: 순서 변경 가능
- **기준 지역 변경**: 카드 더블클릭

**모바일 최적화**:
```css
/* 가로 스크롤 최적화 */
.comparison-tray {
  display: flex;
  gap: 12px;
  overflow-x: auto;
  scroll-snap-type: x mandatory;
  -webkit-overflow-scrolling: touch;
}

.region-card {
  flex: none;
  scroll-snap-align: start;
  min-width: 160px;
}
```

### 5. 인사이트 요약 (InsightSummary)
**목적**: 복잡한 데이터를 자연어로 요약 제공

**자동 생성 로직**:
```typescript
const generateInsight = (data: RegionData[]) => {
  const baseRegion = data[0];
  const period = calculatePeriod(data);
  const growth = calculateGrowth(baseRegion);
  
  return `${period} 동안 ${baseRegion.name}은 ${growth.toFixed(1)}% ${growth > 0 ? '상승' : '하락'}했습니다.`;
};
```

## 🎨 인터랙션 설계

### 1. 마이크로 인터랙션

#### 버튼 상태
```css
/* 기본 버튼 */
.btn {
  transition: all 0.2s ease;
  transform: scale(1);
}

.btn:hover {
  transform: scale(1.02);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
}

.btn:active {
  transform: scale(0.98);
}
```

#### 카드 호버 효과
```css
.region-card {
  transition: all 0.3s ease;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.region-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.15);
}
```

### 2. 로딩 상태

#### 스켈레톤 UI
```jsx
const ChartSkeleton = () => (
  <div className="animate-pulse">
    <div className="h-4 bg-gray-300 rounded w-1/4 mb-4"></div>
    <div className="h-64 bg-gray-200 rounded mb-4"></div>
    <div className="h-4 bg-gray-300 rounded w-3/4"></div>
  </div>
);
```

#### 프로그레스 인디케이터
```jsx
const LoadingProgress = ({ progress }) => (
  <div className="w-full bg-gray-200 rounded-full h-1">
    <div 
      className="bg-blue-600 h-1 rounded-full transition-all duration-300"
      style={{ width: `${progress}%` }}
    />
  </div>
);
```

### 3. 피드백 시스템

#### 토스트 메시지
```typescript
const showToast = (message: string, type: 'success' | 'error' | 'warning' = 'info') => {
  toast({
    title: message,
    status: type,
    duration: 3000,
    isClosable: true,
    position: 'top-right'
  });
};
```

## 📱 모바일 최적화

### 1. 터치 인터랙션

#### 최소 터치 타겟
```css
/* 모든 터치 가능한 요소 */
.touch-target {
  min-height: 44px;
  min-width: 44px;
  padding: 12px;
}
```

#### 제스처 지원
```typescript
// 차트 줌/팬 제스처
const useChartGestures = () => {
  const handlePinch = (event: PinchEvent) => {
    const { scale } = event;
    setZoomLevel(scale);
  };
  
  const handlePan = (event: PanEvent) => {
    const { deltaX } = event;
    setChartOffset(prev => prev + deltaX);
  };
  
  return { handlePinch, handlePan };
};
```

### 2. 화면 회전 지원

```css
/* 가로 모드 최적화 */
@media (orientation: landscape) and (max-height: 600px) {
  .header {
    height: 48px; /* 더 컴팩트한 헤더 */
  }
  
  .chart-container {
    height: calc(100vh - 48px - 80px); /* 전체 높이 활용 */
  }
}
```

## ♿ 접근성 (Accessibility)

### 1. 키보드 네비게이션

```typescript
// 키보드 이벤트 핸들러
const handleKeyDown = (event: KeyboardEvent) => {
  switch (event.key) {
    case 'Tab':
      // 포커스 이동
      break;
    case 'Enter':
    case ' ':
      // 선택/해제
      handleSelect();
      break;
    case 'Escape':
      // 모달/패널 닫기
      closePanel();
      break;
  }
};
```

### 2. 스크린 리더 지원

```jsx
// 차트 데이터 테이블 버전
const ChartDataTable = ({ data }) => (
  <table aria-label="지역별 부동산 가격 지수 데이터">
    <thead>
      <tr>
        <th>날짜</th>
        {regions.map(region => (
          <th key={region.id}>{region.name}</th>
        ))}
      </tr>
    </thead>
    <tbody>
      {data.map(row => (
        <tr key={row.date}>
          <td>{row.date}</td>
          {row.values.map(value => (
            <td key={value.regionId}>{value.index}</td>
          ))}
        </tr>
      ))}
    </tbody>
  </table>
);
```

### 3. 색상 접근성

```css
/* 색맹 친화적 차트 색상 */
:root {
  --chart-color-1: #0173b2; /* 파란색 */
  --chart-color-2: #de8f05; /* 주황색 */
  --chart-color-3: #029e73; /* 청록색 */
  --chart-color-4: #cc78bc; /* 분홍색 */
}

/* 높은 대비 모드 */
@media (prefers-contrast: high) {
  :root {
    --chart-color-1: #000080;
    --chart-color-2: #ff4500;
    --chart-color-3: #008000;
    --chart-color-4: #800080;
  }
}
```

## 🎭 다크 모드 지원

### 1. 테마 전환

```typescript
// 테마 컨텍스트
const ThemeContext = createContext({
  theme: 'light',
  toggleTheme: () => {}
});

// 시스템 설정 감지
const useSystemTheme = () => {
  const [theme, setTheme] = useState(() => {
    return window.matchMedia('(prefers-color-scheme: dark)').matches
      ? 'dark'
      : 'light';
  });
  
  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleChange = (e) => setTheme(e.matches ? 'dark' : 'light');
    
    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, []);
  
  return theme;
};
```

### 2. 다크 모드 색상

```css
/* 다크 모드 CSS 변수 */
[data-theme="dark"] {
  --bg-primary: #111827;
  --bg-secondary: #1f2937;
  --bg-tertiary: #374151;
  --text-primary: #f9fafb;
  --text-secondary: #d1d5db;
  --text-tertiary: #9ca3af;
  --border-color: #4b5563;
  
  /* 차트 배경 */
  --chart-bg: #1f2937;
  --chart-grid: #374151;
}
```

## 📊 성능 최적화

### 1. 코드 스플리팅

```typescript
// 차트 라이브러리 지연 로딩
const LazyChart = lazy(() => import('./components/InteractiveChart'));

// 사용 시점에 로딩
const ChartWrapper = () => (
  <Suspense fallback={<ChartSkeleton />}>
    <LazyChart />
  </Suspense>
);
```

### 2. 메모이제이션 전략

```typescript
// 복잡한 계산 결과 캐싱
const useProcessedData = (rawData: RawData[], normalized: boolean) => {
  return useMemo(() => {
    return normalized 
      ? normalizeData(rawData)
      : rawData;
  }, [rawData, normalized]);
};

// 컴포넌트 메모이제이션
const RegionCard = memo(({ region, onRemove }) => {
  // 컴포넌트 로직
});
```

### 3. 가상화 (Virtualization)

```typescript
// 큰 목록 가상화
import { FixedSizeList as List } from 'react-window';

const VirtualizedRegionList = ({ items }) => (
  <List
    height={400}
    itemCount={items.length}
    itemSize={48}
    itemData={items}
  >
    {({ index, style, data }) => (
      <div style={style}>
        <RegionItem region={data[index]} />
      </div>
    )}
  </List>
);
```

## 🚀 구현 가이드라인

### 1. 기술 스택 권장사항

```typescript
// 프론트엔드 스택
const techStack = {
  framework: 'React 18 + TypeScript',
  styling: 'Tailwind CSS + CSS-in-JS (Emotion)',
  charts: 'Recharts',
  state: 'Zustand',
  ui: 'Headless UI + Radix UI',
  animations: 'Framer Motion',
  gestures: 'React Use Gesture',
  testing: 'Jest + React Testing Library',
  accessibility: 'axe-core'
};
```

### 2. 컴포넌트 구조 예시

```typescript
// FSD 아키텍처 기반 컴포넌트
interface RegionSelectorProps {
  selectedRegions: Region[];
  onRegionSelect: (region: Region) => void;
  onRegionRemove: (regionId: string) => void;
  maxSelections: number;
}

const RegionSelector: React.FC<RegionSelectorProps> = ({
  selectedRegions,
  onRegionSelect,
  onRegionRemove,
  maxSelections = 4
}) => {
  // 컴포넌트 구현
};
```

### 3. 상태 관리 패턴

```typescript
// Zustand 스토어 예시
interface AppState {
  selectedRegions: Region[];
  dataPeriod: 'monthly' | 'weekly';
  indicatorType: 'sale' | 'rent';
  chartNormalized: boolean;
  
  // Actions
  addRegion: (region: Region) => void;
  removeRegion: (regionId: string) => void;
  setDataPeriod: (period: 'monthly' | 'weekly') => void;
  setIndicatorType: (type: 'sale' | 'rent') => void;
  toggleNormalization: () => void;
}

const useAppStore = create<AppState>((set) => ({
  selectedRegions: [],
  dataPeriod: 'monthly',
  indicatorType: 'sale',
  chartNormalized: false,
  
  addRegion: (region) => set((state) => ({
    selectedRegions: [...state.selectedRegions, region]
  })),
  
  removeRegion: (regionId) => set((state) => ({
    selectedRegions: state.selectedRegions.filter(r => r.id !== regionId)
  })),
  
  setDataPeriod: (period) => set({ dataPeriod: period }),
  setIndicatorType: (type) => set({ indicatorType: type }),
  toggleNormalization: () => set((state) => ({
    chartNormalized: !state.chartNormalized
  }))
}));
```

## 📋 구현 우선순위

### Phase 1: 핵심 기능 (2주)
- [x] 기본 레이아웃 구조
- [x] 헤더 컴포넌트 + 토글 기능
- [x] 지역 선택 패널 (검색 + 트리)
- [x] 기본 차트 구현

### Phase 2: 인터랙션 (2주)
- [x] 실시간 지역 선택 반영
- [x] 차트 호버 인터랙션
- [x] 비교 트레이 구현
- [x] 상승률 비교 모드

### Phase 3: 모바일 최적화 (1주)
- [x] 반응형 레이아웃 구현
- [x] 터치 제스처 지원
- [x] 모바일 전용 인터랙션

### Phase 4: 고급 기능 (1주)
- [x] 인사이트 자동 생성
- [x] 다크 모드 지원
- [x] 접근성 개선
- [x] 성능 최적화

## 🎯 성공 지표

### 사용자 경험 지표
- **첫 화면 로드 시간**: < 2초
- **인터랙션 응답 시간**: < 200ms
- **모바일 사용성 점수**: 90점 이상
- **접근성 점수**: WCAG 2.1 AA 준수

### 비즈니스 지표
- **사용자 체류 시간**: 평균 5분 이상
- **기능 완료율**: 80% 이상
- **모바일 사용 비율**: 60% 이상
- **재방문율**: 40% 이상

---

이 UI/UX 디자인 명세서는 사용자 중심의 직관적인 부동산 데이터 분석 플랫폼을 구현하기 위한 완전한 가이드입니다. 각 컴포넌트와 인터랙션은 실제 사용자의 니즈와 행동 패턴을 반영하여 설계되었습니다.