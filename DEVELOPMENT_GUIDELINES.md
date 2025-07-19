# 부동산 데이터 비교 분석 플랫폼 - 개발 지침서

## 📋 문서 목적
이 문서는 부동산 데이터 비교 분석 플랫폼 개발 시 따라야 할 표준 가이드라인을 정의합니다. 일관된 코드 품질과 효율적인 개발 워크플로우를 보장하기 위한 실무 지침을 제공합니다.

## 🎯 핵심 개발 원칙

### 1. 문서 우선 개발 (Documentation-First)
- **순서**: PRD → FSD → UI/UX → 코드 구현
- **검증**: 각 단계에서 이전 문서와의 일관성 확인
- **업데이트**: 구현 과정에서 문서 동기화 유지

### 2. 점진적 개발 (Incremental Development)
- **작은 단위**: 하나의 기능을 완전히 구현 후 다음 단계 진행
- **검증 주기**: 각 단위 완료 시 즉시 품질 검증 실시
- **피드백 반영**: 발견된 문제점 즉시 수정 및 문서 업데이트

### 3. 품질 우선 (Quality First)
- **테스트 주도**: 구현 전 테스트 케이스 작성
- **코드 리뷰**: 모든 코드 변경사항 검증 필수
- **성능 모니터링**: 실시간 성능 지표 추적

## 🛠️ MCP 서버 활용 가이드

### 1. Context7 활용 패턴

#### 언제 사용하는가?
- 새로운 라이브러리 도입 시
- 기존 라이브러리 업데이트 시
- 베스트 프랙티스 확인 시
- API 사용법 참조 시

#### 사용 방법
```bash
# 라이브러리 문서 조회
/mcp context7 resolve-library-id "react"
/mcp context7 get-library-docs "/facebook/react" --topic "hooks"

# 예시: Recharts 차트 라이브러리 사용법 확인
/mcp context7 resolve-library-id "recharts"
/mcp context7 get-library-docs "/recharts/recharts" --topic "line-chart"
```

#### 활용 시나리오
- **차트 구현**: Recharts LineChart 사용법 확인
- **상태 관리**: Zustand 스토어 패턴 학습
- **스타일링**: Tailwind CSS 클래스 참조
- **테스팅**: Jest/RTL 테스트 패턴 확인

### 2. Sequential Thinking 활용 패턴

#### 언제 사용하는가?
- 복잡한 로직 구현 전 설계 시
- 버그 분석 및 해결 시
- 성능 최적화 전략 수립 시
- 아키텍처 결정 시

#### 사용 방법
```bash
# 복잡한 문제 분석
/mcp sequential-thinking --total-thoughts 5
# 각 단계별 사고 과정 기록
```

#### 활용 시나리오
- **데이터 플로우 설계**: 지역 선택 → 차트 업데이트 로직
- **성능 최적화**: 메모이제이션 전략 수립
- **에러 처리**: 예외 상황 대응 로직 설계
- **사용자 경험**: 인터랙션 시나리오 분석

### 3. Shrimp Task Manager 활용 패턴

#### 태스크 분할 원칙
- **단일 책임**: 하나의 태스크는 하나의 기능만 담당
- **독립성**: 다른 태스크에 의존하지 않고 실행 가능
- **검증 가능**: 완료 기준이 명확하고 측정 가능
- **적절한 크기**: 2-8시간 내 완료 가능

#### 태스크 단계별 프로세스
```bash
# 1. 기능 분석
/mcp shrimp analyze-task "지역 선택 컴포넌트 구현"

# 2. 태스크 분할
/mcp shrimp split-tasks --update-mode clearAllTasks

# 3. 태스크 실행
/mcp shrimp execute-task [task-id]

# 4. 검증
/mcp shrimp verify-task [task-id] --score 90

# 5. 완료 확인
/mcp shrimp list-tasks "completed"
```

#### 표준 태스크 템플릿
```markdown
## 태스크: [기능명]

### 목표
- 구체적이고 측정 가능한 완료 기준

### 구현 범위
- 포함 사항: 명확한 기능 리스트
- 제외 사항: 이번 태스크에서 다루지 않는 내용

### 검증 기준
- 기능 테스트 통과
- 코드 품질 기준 만족
- 성능 요구사항 충족

### 관련 파일
- 수정할 파일 목록
- 생성할 파일 목록
- 참조 문서 목록
```

## 🔍 코드 검증 워크플로우

### 1. SuperClaude Analyzer 활용

#### 검증 시점
- 컴포넌트 구현 완료 시
- 기능 통합 완료 시
- 성능 최적화 적용 시
- 버그 수정 완료 시

#### 검증 명령어
```bash
# 코드 품질 분석
/sc:analyze --focus code-quality --scope component

# 성능 분석
/sc:analyze --focus performance --scope system

# 보안 분석
/sc:analyze --focus security --scope api

# 접근성 분석
/sc:analyze --focus accessibility --scope ui
```

### 2. 품질 검증 체크리스트

#### 코드 품질 (90점 이상)
- [ ] TypeScript 타입 안정성
- [ ] ESLint 규칙 준수
- [ ] 코드 중복 최소화
- [ ] 함수 단일 책임 원칙
- [ ] 명확한 변수명 사용

#### 성능 (목표 지표 달성)
- [ ] 컴포넌트 렌더링 최적화
- [ ] 메모리 누수 방지
- [ ] 번들 크기 최적화
- [ ] 로딩 시간 < 2초

#### 접근성 (WCAG 2.1 AA)
- [ ] 키보드 네비게이션
- [ ] 스크린 리더 지원
- [ ] 색상 대비 기준 충족
- [ ] 의미론적 HTML 사용

#### 사용자 경험
- [ ] 인터랙션 반응성
- [ ] 에러 처리 및 피드백
- [ ] 로딩 상태 표시
- [ ] 모바일 최적화

## 📁 프로젝트 구조 규칙

### 1. FSD 아키텍처 준수
```
src/
├── app/         # 애플리케이션 초기화
├── pages/       # 페이지 컴포넌트
├── widgets/     # 복합 UI 블록
├── features/    # 비즈니스 기능
├── entities/    # 비즈니스 엔티티
└── shared/      # 공통 모듈
```

### 2. 파일 명명 규칙
```typescript
// 컴포넌트: PascalCase
RegionSelector.tsx
ChartDashboard.tsx

// 훅: camelCase + use 접두사
useRegionData.ts
useChartInteraction.ts

// 유틸리티: camelCase
formatPrice.ts
validateRegion.ts

// 타입: PascalCase + 접미사
types.ts (내부: RegionData, ChartConfig)
```

### 3. 임포트 순서
```typescript
// 1. 외부 라이브러리
import React from 'react';
import { LineChart } from 'recharts';

// 2. 내부 모듈 (FSD 계층 순서)
import { useRegionData } from 'entities/region';
import { RegionSelector } from 'features/region-selection';
import { Button } from 'shared/ui';

// 3. 상대 경로
import './styles.css';
```

## 🎨 스타일링 가이드

### 1. Tailwind CSS 규칙
```typescript
// 조건부 클래스: clsx 사용
import clsx from 'clsx';

const buttonClasses = clsx(
  'px-4 py-2 rounded-lg font-medium',
  {
    'bg-blue-600 text-white': variant === 'primary',
    'bg-gray-200 text-gray-800': variant === 'secondary',
    'opacity-50 cursor-not-allowed': disabled,
  }
);
```

### 2. 컴포넌트 스타일링 패턴
```typescript
// 스타일 객체 분리
const styles = {
  container: 'flex flex-col space-y-4',
  header: 'text-xl font-semibold text-gray-900',
  content: 'flex-1 overflow-auto',
  footer: 'mt-auto pt-4 border-t border-gray-200'
};

// 반응형 클래스
const responsiveContainer = `
  w-full px-4 
  md:px-6 md:max-w-2xl 
  lg:px-8 lg:max-w-4xl 
  xl:max-w-6xl 
  mx-auto
`;
```

## 🧪 테스트 전략

### 1. 테스트 피라미드
```
E2E Tests (5%)     - 핵심 사용자 플로우
Integration (25%)  - 컴포넌트 간 상호작용
Unit Tests (70%)   - 개별 함수/컴포넌트
```

### 2. 테스트 작성 규칙
```typescript
// 테스트 파일 명명: [파일명].test.ts
RegionSelector.test.tsx
useRegionData.test.ts

// 테스트 구조
describe('RegionSelector', () => {
  describe('when rendering', () => {
    it('should display search input', () => {
      // 테스트 코드
    });
  });
  
  describe('when selecting region', () => {
    it('should add region to selected list', () => {
      // 테스트 코드
    });
  });
});
```

## 📊 성능 최적화 가이드

### 1. React 최적화 패턴
```typescript
// 메모이제이션
const MemoizedChart = memo(({ data, config }) => {
  return <LineChart data={data} config={config} />;
});

// 콜백 최적화
const handleRegionSelect = useCallback(
  (region: Region) => {
    setSelectedRegions(prev => [...prev, region]);
  },
  []
);

// 계산 최적화
const processedData = useMemo(() => {
  return data.map(item => ({
    ...item,
    normalizedValue: item.value / baseValue * 100
  }));
}, [data, baseValue]);
```

### 2. 번들 최적화
```typescript
// 코드 스플리팅
const LazyChart = lazy(() => import('./components/Chart'));

// 동적 임포트
const loadChartLibrary = async () => {
  const { LineChart } = await import('recharts');
  return LineChart;
};
```

## 🔄 Git 워크플로우

### 1. 브랜치 전략
```bash
main              # 프로덕션 브랜치
├── develop       # 개발 브랜치
│   ├── feature/region-selector
│   ├── feature/chart-dashboard
│   └── feature/comparison-tray
└── hotfix/       # 긴급 수정
```

### 2. 커밋 메시지 규칙
```bash
feat: 새로운 기능 추가
fix: 버그 수정
docs: 문서 수정
style: 스타일 변경
refactor: 코드 리팩토링
test: 테스트 추가/수정
chore: 빌드 설정 등

# 예시
feat: 지역 선택 컴포넌트 구현
fix: 차트 렌더링 오류 수정
docs: API 문서 업데이트
```

## 📋 일일 개발 루틴

### 1. 개발 시작 시
```bash
# 1. 세션 메모리 확인
cat SESSION_MEMORY.md

# 2. 태스크 상태 확인
/mcp shrimp list-tasks "all"

# 3. 현재 작업 태스크 실행
/mcp shrimp execute-task [task-id]
```

### 2. 개발 중
```bash
# 1. 문서 참조 (Context7)
/mcp context7 get-library-docs [library-id] --topic [topic]

# 2. 복잡한 로직 설계 (Sequential Thinking)
/mcp sequential-thinking --total-thoughts 5

# 3. 주기적 품질 검사
/sc:analyze --focus code-quality
```

### 3. 개발 완료 시
```bash
# 1. 코드 검증
/sc:analyze --focus performance --scope component

# 2. 태스크 검증
/mcp shrimp verify-task [task-id] --score 90

# 3. 세션 메모리 업데이트
# SESSION_MEMORY.md 파일 업데이트
```

## 🚨 트러블슈팅 가이드

### 1. 일반적인 문제 해결
```bash
# 타입 오류 해결
/mcp context7 get-library-docs "/microsoft/typescript" --topic "types"

# 성능 문제 분석
/sc:analyze --focus performance --detailed

# 접근성 문제 해결
/sc:analyze --focus accessibility --scope ui
```

### 2. 빈발 오류 패턴
- **상태 업데이트 오류**: 불변성 원칙 위반
- **메모리 누수**: useEffect 정리 함수 누락
- **성능 저하**: 불필요한 리렌더링
- **타입 오류**: 올바른 타입 추론 실패

## 📚 참고 자료

### 1. 프로젝트 문서
- [PRD](./PRD.md) - 제품 요구사항
- [FSD 아키텍처 가이드](./FSD_ARCHITECTURE_GUIDE.md) - 구조 설계
- [UI/UX 명세서](./UI_UX_DESIGN_SPECIFICATION.md) - 디자인 가이드
- [기술 명세서](./TECHNICAL_SPECIFICATION.md) - 시스템 설계

### 2. 외부 참고 자료
- [React 공식 문서](https://react.dev/)
- [TypeScript 핸드북](https://www.typescriptlang.org/docs/)
- [Tailwind CSS 문서](https://tailwindcss.com/docs)
- [Recharts 문서](https://recharts.org/en-US/)

---

**이 가이드라인을 따라 개발하면 일관된 품질과 효율적인 개발 프로세스를 보장할 수 있습니다.**