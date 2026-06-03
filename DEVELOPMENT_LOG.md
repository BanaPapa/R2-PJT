# 부동산 데이터 분석 플랫폼 개발 기록

## 📅 개발 세션: 2025년 7월 20일

### 🎯 **프로젝트 목표**
KB 부동산 시계열 데이터를 매주 자동 수집하여 동적 기준일 기반으로 재계산하는 분석 플랫폼 구축

### 🏗️ **시스템 아키텍처**

#### **백엔드 (Node.js + TypeScript + Prisma)**
- **위치**: `/server/`
- **데이터베이스**: SQLite (프로덕션에서 PostgreSQL 권장)
- **주요 서비스**:
  - `KBDataCollectorService`: KB 사이트 데이터 수집
  - `IndexCalculatorService`: 동적 기준일 지수 재계산
  - 자동 스케줄러: 매주 월요일 09:00 수집

#### **프론트엔드 (React + TypeScript + Tailwind CSS + FSD)**
- **아키텍처**: Feature-Sliced Design (FSD)
- **상태관리**: Zustand
- **UI 라이브러리**: Tailwind CSS + Lucide React
- **차트**: Recharts

### 📊 **핵심 기능**

#### **1. 동적 기준일 재계산**
- **KB 원본 기준**: 2022년 1월 10일 = 100
- **사용자 정의**: 검색 기준일에서 N년 전 = 100 (1-10년 선택 가능)
- **실시간 지수 변환**: 원본 데이터를 사용자 설정에 맞게 재계산

#### **2. 자동 데이터 수집**
- **URL**: https://www.kbland.kr/webview.html#/main/statistics?channel=kbland&tab=0
- **파일 형식**: `YYYYMMDD_주간시계열.xlsx`
- **수집 주기**: 매주 월요일 09:00 (KST)
- **처리 과정**: 다운로드 → 파싱 → 중복 제거 → DB 저장

#### **3. 사용자 설정 관리**
- **설정 패널**: 헤더 우측 ⚙️ 버튼
- **기준일 타입**: KB 원본 vs 동적 기준일
- **기간 설정**: 1-10년 슬라이더 + 프리셋 버튼
- **실시간 미리보기**: 설정 변경 시 즉시 반영

### 🗂️ **파일 구조 (FSD 기반)**

```
src/
├── entities/
│   ├── settings/           # 설정 관리 엔티티
│   │   ├── model/         # 타입, 스토어
│   │   ├── api/           # API 통신
│   │   └── index.ts
│   └── kb-data/           # KB 데이터 엔티티
│       ├── model/         # 데이터 타입
│       ├── api/           # KB API 통신
│       └── index.ts
├── features/
│   └── settings-panel/    # 설정 패널 기능
│       ├── ui/
│       └── index.ts
├── widgets/
│   ├── header/            # 헤더 (설정 버튼 포함)
│   ├── chart-dashboard/   # 차트 대시보드
│   ├── region-selector/   # 지역 선택기
│   └── statistics-tray/   # 통계 트레이
└── shared/
    ├── ui/                # 공통 UI 컴포넌트
    ├── lib/               # 유틸리티, 스토어
    └── config/            # 설정 파일
```

### 🔧 **완성된 구현사항**

#### ✅ **백엔드 API 엔드포인트**
- `GET /api/health` - 서버 상태 확인
- `POST /api/collect-data` - 수동 데이터 수집
- `GET /api/regions/:code/timeseries` - 시계열 데이터 조회
- `GET /api/regions/:code/statistics` - 지역 통계 조회
- `GET /api/settings` - 사용자 설정 조회
- `PUT /api/settings` - 사용자 설정 변경
- `GET /api/collection-status` - 수집 상태 확인

#### ✅ **프론트엔드 컴포넌트**
- **설정 패널**: 모달 형태, 동적 기준일 설정
- **헤더 통합**: 설정 버튼 추가
- **데이터 업데이트**: 2025년 7월까지 현실적 시뮬레이션
- **TypeScript 완전 지원**: 타입 안전성 보장

#### ✅ **데이터베이스 스키마**
```sql
-- KB 시계열 데이터
KBTimeSeries {
  id, week, regionCode, regionName, 
  saleIndex, leaseIndex, baseDate, 
  dataSource, createdAt, updatedAt
}

-- 사용자 설정
UserSettings {
  id, userId, basePeriodYears, useCustomBase, 
  createdAt, updatedAt
}

-- 수집 로그
DataCollectionLog {
  id, week, fileName, status, recordCount, 
  errorMessage, createdAt
}
```

### 🚀 **서버 실행 방법**

#### **백엔드 서버**
```bash
cd server
npm install
npx prisma generate
npx prisma db push
npm run dev  # 포트 3001
```

#### **프론트엔드 서버**
```bash
npm run dev  # 포트 5173
```

#### **스케줄러**
```bash
cd server
npm run scheduler start
```

### 📋 **현재 상태**

#### ✅ **완료된 작업**
1. KB 시계열 데이터 자동 수집 시스템 설계 및 구현
2. 백엔드 API 서버 구축 (데이터 저장/조회)
3. 동적 기준일 설정 및 지수 재계산 로직 구현
4. 사용자 설정 관리 시스템 (기간 설정창)
5. 프론트엔드 실제 데이터 연동 및 차트 업데이트

#### 🔄 **진행중/미완료 작업**
1. **설정 저장 버튼 오류 수정** (API 연동 이슈)
2. **데이터 업데이트 기록 시스템** (마지막 업데이트 일시 표시)
3. **실제 KB 데이터 수집 연동** (Playwright/Puppeteer 필요)

### 🐛 **알려진 이슈**

#### **1. 설정 저장 버튼 미작동**
- **증상**: 설정 패널에서 저장 버튼 클릭 시 반응 없음
- **원인**: 백엔드 API 연동 오류 추정
- **해결 방법**: API 요청/응답 로그 확인 필요

#### **2. 데이터 업데이트 기록 부재**
- **증상**: 마지막 업데이트 일시 표시 없음
- **원인**: UI 컴포넌트 미구현
- **해결 방법**: 헤더 또는 대시보드에 업데이트 시간 표시

#### **3. 샘플 데이터 사용 중**
- **증상**: 실제 KB 데이터 대신 시뮬레이션 데이터 사용
- **원인**: 웹 스크래핑 모듈 미구현
- **해결 방법**: Playwright/Puppeteer로 자동 다운로드 구현

### 🔮 **다음 단계**

#### **우선순위 높음**
1. **설정 저장 API 디버깅**: 네트워크 탭 확인, 에러 로그 분석
2. **실제 KB 데이터 연동**: 웹 스크래핑 자동화
3. **데이터 업데이트 알림**: 실시간 업데이트 상태 표시

#### **우선순위 보통**
1. **에러 핸들링 강화**: 사용자 친화적 에러 메시지
2. **로딩 상태 표시**: 데이터 수집 중 스피너
3. **모바일 반응형 최적화**: 설정 패널 모바일 UI

#### **우선순위 낮음**
1. **데이터 내보내기 기능**: Excel/CSV 다운로드
2. **차트 고도화**: 더 많은 시각화 옵션
3. **알림 시스템**: 새 데이터 수집 완료 알림

### 🔧 **기술 스택**

#### **Backend**
- Node.js + TypeScript
- Express.js (웹 프레임워크)
- Prisma (ORM)
- SQLite (개발용 DB)
- node-cron (스케줄러)
- xlsx (엑셀 파싱)

#### **Frontend**
- React 19 + TypeScript
- Vite (빌드 도구)
- Tailwind CSS (스타일링)
- Zustand (상태 관리)
- Recharts (차트)
- Lucide React (아이콘)

#### **Infrastructure**
- 개발: localhost:3001 (백엔드), localhost:5173 (프론트엔드)
- 배포: 미정 (Docker + PostgreSQL 권장)

### 📝 **참고 자료**

#### **KB 데이터 소스**
- **메인 페이지**: https://data.kbland.kr/
- **시계열 다운로드**: https://www.kbland.kr/webview.html#/main/statistics?channel=kbland&tab=0
- **파일 형식**: Excel (.xlsx)
- **업데이트 주기**: 매주 (보통 월요일)

#### **개발 규칙**
- **Git 워크플로우**: feature 브랜치 → main 브랜치
- **커밋 규칙**: `[타입]: [설명]` (feat, fix, style, refactor, docs)
- **태그 규칙**: `v[메이저].[마이너]-[상태]` (예: v1.1-mvp-fixed)

---

## 💡 **다음 개발 세션을 위한 가이드**

### **개발 재시작 시 체크리스트**
1. **서버 상태 확인**: `ps aux | grep vite`, `curl localhost:3001/api/health`
2. **설정 저장 이슈 우선 해결**: 브라우저 네트워크 탭 확인
3. **실제 데이터 연동 계획**: Playwright 설치 및 KB 사이트 분석
4. **데이터 업데이트 시간 표시**: UI 컴포넌트 추가

### **중요 파일 위치**
- **백엔드 메인**: `server/src/index.ts`
- **설정 API**: `server/src/routes/api.routes.ts`
- **설정 패널**: `src/features/settings-panel/ui/SettingsPanel.tsx`
- **헤더**: `src/widgets/header/Header.tsx`
- **설정 스토어**: `src/entities/settings/model/settings.store.ts`

---

**개발 완료일**: 2025년 7월 20일  
**다음 세션**: 설정 저장 버튼 수정 및 실제 데이터 연동