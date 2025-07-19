# 부동산 데이터 비교 분석 플랫폼 - FSD 아키텍처 가이드

## 📋 FSD(Feature-Sliced Design) 개요

### FSD란 무엇인가?
FSD는 현대 프론트엔드 애플리케이션을 위한 아키텍처 방법론으로, **기능별로 코드를 슬라이스(조각)하여 관리**하는 방식입니다. 복잡한 프로젝트에서 코드의 **가독성, 유지보수성, 확장성**을 높이는 것을 목표로 합니다.

### 핵심 원칙
1. **명확한 계층 구조**: 각 계층이 명확한 역할과 책임을 가짐
2. **단방향 종속성**: 상위 계층은 하위 계층에만 의존
3. **기능별 슬라이싱**: 비즈니스 로직을 기능 단위로 분리
4. **재사용 가능한 구조**: 공통 요소는 shared 계층에서 관리

## 🏗️ FSD 계층 구조 (7개 계층)

### 1. **app** - 애플리케이션 초기화
- 전역 설정, 라우터, 상태 관리 초기화
- 모든 계층에서 가져올 수 있음

### 2. **pages** - 페이지 컴포넌트
- 라우팅, 페이지별 컴포넌트
- widgets, features, entities, shared 사용 가능

### 3. **widgets** - 독립적인 UI 블록
- 복합 컴포넌트, 완성된 UI 블록
- features, entities, shared 사용 가능

### 4. **features** - 사용자 액션과 비즈니스 기능
- 사용자 액션, 비즈니스 로직
- entities, shared 사용 가능

### 5. **entities** - 비즈니스 엔티티
- 도메인 모델, 비즈니스 엔티티
- shared만 사용 가능

### 6. **shared** - 공통 모듈
- 공통 컴포넌트, 유틸리티, 라이브러리
- 다른 계층에 의존하지 않음

## 🏢 부동산 플랫폼 FSD 구조 설계

### 전체 폴더 구조
```
src/
├── app/                          # 애플리케이션 초기화
│   ├── providers/               # 전역 프로바이더 (테마, 상태관리)
│   ├── store/                   # 전역 상태 관리 (Zustand/RTK)
│   ├── router/                  # 라우팅 설정
│   └── index.tsx               # 앱 엔트리 포인트
├── pages/                       # 페이지 컴포넌트
│   ├── main/                   # 메인 대시보드 페이지
│   │   ├── ui/                 # MainPage 컴포넌트
│   │   └── model/              # 페이지별 상태 관리
│   └── admin/                  # 관리자 페이지 (데이터 업로드)
│       ├── ui/                 # AdminPage 컴포넌트
│       └── model/              # 관리자 상태 관리
├── widgets/                    # 복합 UI 위젯
│   ├── header/                 # GNB (전역 네비게이션 바)
│   ├── region-selector/        # 지역 선택 패널
│   ├── chart-dashboard/        # 데이터 시각화 패널
│   └── comparison-tray/        # 비교 트레이
├── features/                   # 비즈니스 기능
│   ├── region-selection/       # 지역 선택 기능
│   ├── data-filtering/         # 데이터 필터링 (기간, 지표)
│   ├── chart-visualization/    # 차트 시각화 기능
│   ├── data-comparison/        # 지역 간 데이터 비교
│   └── data-collection/        # 데이터 수집 및 업로드
├── entities/                   # 비즈니스 엔티티
│   ├── region/                 # 지역 정보 엔티티
│   ├── real-estate-indicator/  # 부동산 지표 엔티티
│   └── time-series-data/       # 시계열 데이터 엔티티
└── shared/                     # 공통 모듈
    ├── ui/                     # 공통 UI 컴포넌트
    ├── api/                    # API 클라이언트
    ├── lib/                    # 유틸리티 함수
    ├── types/                  # 타입 정의
    └── config/                 # 설정 및 상수
```

## 🔧 각 슬라이스 내부 구조 (Segments)

### 표준 세그먼트
- **ui** - 사용자 인터페이스 컴포넌트
- **model** - 비즈니스 로직, 상태 관리
- **lib** - 헬퍼 함수, 유틸리티
- **api** - 백엔드 연동 로직
- **config** - 설정, 상수

### 예시: `features/region-selection/` 구조
```
features/region-selection/
├── ui/                         # UI 컴포넌트
│   ├── RegionSearch.tsx       # 지역 검색 컴포넌트
│   ├── RegionTree.tsx         # 지역 트리 컴포넌트
│   ├── RegionCheckbox.tsx     # 지역 체크박스 컴포넌트
│   └── index.ts               # 컴포넌트 exports
├── model/                      # 비즈니스 로직
│   ├── store.ts               # 지역 선택 상태 관리
│   ├── selectors.ts           # 선택자 함수
│   └── types.ts               # 로컬 타입 정의
├── lib/                        # 헬퍼 함수
│   ├── region-utils.ts        # 지역 관련 유틸리티
│   └── validation.ts          # 유효성 검사
├── api/                        # API 연동
│   └── region-api.ts          # 지역 API 호출
└── index.ts                   # 기능 exports
```

## 🔄 상호작용 및 의존성 관리

### 계층 간 의존성 규칙
```typescript
// ✅ 올바른 임포트 예시
// pages/main/ui/MainPage.tsx
import { Header } from 'widgets/header'
import { RegionSelector } from 'widgets/region-selector'
import { ChartDashboard } from 'widgets/chart-dashboard'

// widgets/chart-dashboard/ui/ChartDashboard.tsx
import { useChartVisualization } from 'features/chart-visualization'
import { useDataComparison } from 'features/data-comparison'

// features/region-selection/ui/RegionSearch.tsx
import { useRegions } from 'entities/region'
import { SearchInput } from 'shared/ui/SearchInput'
import { debounce } from 'shared/lib/utils'

// ❌ 잘못된 임포트 예시
// entities/region/model/store.ts
import { ChartDashboard } from 'widgets/chart-dashboard' // 금지!
```

### 데이터 흐름 패턴
```
1. entities/region → 지역 데이터 관리
2. entities/real-estate-indicator → 부동산 지표 데이터
3. features/region-selection → 지역 선택 로직
4. features/data-comparison → 비교 로직
5. widgets/chart-dashboard → 완성된 차트 제공
```

## 📊 상세기능명세서 → FSD 매핑

### 1. GNB (Global Navigation Bar) → `widgets/header`
```typescript
// widgets/header/ui/Header.tsx
import { DataPeriodToggle } from 'features/data-filtering'
import { Logo } from 'shared/ui/Logo'

export const Header = () => {
  return (
    <header>
      <Logo />
      <DataPeriodToggle />
    </header>
  )
}
```

### 2. 지역 선택 패널 → `widgets/region-selector`
```typescript
// widgets/region-selector/ui/RegionSelector.tsx
import { RegionSearch } from 'features/region-selection'
import { RegionTree } from 'features/region-selection'

export const RegionSelector = () => {
  return (
    <aside>
      <RegionSearch />
      <RegionTree />
    </aside>
  )
}
```

### 3. 데이터 시각화 패널 → `widgets/chart-dashboard`
```typescript
// widgets/chart-dashboard/ui/ChartDashboard.tsx
import { LineChart } from 'features/chart-visualization'
import { PeriodFilter } from 'features/data-filtering'
import { InsightSummary } from 'features/data-comparison'

export const ChartDashboard = () => {
  return (
    <main>
      <LineChart />
      <InsightSummary />
      <PeriodFilter />
    </main>
  )
}
```

### 4. 비교 트레이 → `widgets/comparison-tray`
```typescript
// widgets/comparison-tray/ui/ComparisonTray.tsx
import { SelectedRegionCard } from 'features/region-selection'
import { useSelectedRegions } from 'entities/region'

export const ComparisonTray = () => {
  const selectedRegions = useSelectedRegions()
  
  return (
    <section>
      {selectedRegions.map(region => (
        <SelectedRegionCard key={region.id} region={region} />
      ))}
    </section>
  )
}
```

## 🚀 FSD 적용 시 이점

### 1. 명확한 책임 분리
- 각 계층과 슬라이스가 명확한 역할을 가짐
- 코드 위치를 쉽게 파악 가능

### 2. 재사용성 향상
- 공통 컴포넌트와 로직의 재사용
- 새로운 기능 개발 시 기존 코드 활용

### 3. 유지보수성
- 기능별로 분리되어 수정 영향 범위 최소화
- 버그 수정 시 관련 코드만 확인

### 4. 확장성
- 새로운 기능 추가 시 기존 구조에 영향 없음
- 점진적 개선 가능

### 5. 팀 협업
- 각자 담당 영역이 명확하여 병렬 개발 가능
- 코드 충돌 최소화

## 🎯 부동산 플랫폼 특화 구현 가이드

### 1. 상태 관리 전략
```typescript
// entities/region/model/store.ts
interface RegionState {
  selectedRegions: Region[]
  availableRegions: Region[]
  isLoading: boolean
}

// features/region-selection/model/store.ts
interface RegionSelectionState {
  searchQuery: string
  expandedNodes: string[]
  maxSelections: number
}
```

### 2. 타입 안정성
```typescript
// shared/types/region.ts
export interface Region {
  id: string
  name: string
  code: string
  parentId?: string
  level: 1 | 2 | 3 // 전국, 시도, 시군구
}

// shared/types/real-estate.ts
export interface RealEstateIndicator {
  regionId: string
  date: string
  value: number
  indicatorType: 'sale' | 'rent'
  periodType: 'weekly' | 'monthly'
}
```

### 3. 성능 최적화
```typescript
// features/chart-visualization/ui/LineChart.tsx
import { memo, useMemo } from 'react'
import { VirtualizedChart } from 'shared/ui/VirtualizedChart'

export const LineChart = memo(() => {
  const chartData = useMemo(() => {
    // 대량 데이터 처리 로직
  }, [selectedRegions, dateRange])

  return <VirtualizedChart data={chartData} />
})
```

### 4. 데이터 수집 자동화
```typescript
// features/data-collection/model/crawler.ts
export class KBDataCrawler {
  async collectData(): Promise<void> {
    // 크롤링 로직
  }
}

// features/data-collection/api/upload.ts
export const uploadDataFile = async (file: File) => {
  // 파일 업로드 로직
}
```

## 📝 결론

FSD 아키텍처를 적용하면 부동산 데이터 비교 플랫폼의 복잡한 요구사항을 체계적으로 구현할 수 있습니다. 각 계층의 책임을 명확히 분리하고, 의존성 규칙을 준수하여 유지보수가 용이하고 확장 가능한 코드 구조를 만들 수 있습니다.

**다음 단계**: 이 FSD 구조를 바탕으로 실제 컴포넌트 구현을 시작하겠습니다.