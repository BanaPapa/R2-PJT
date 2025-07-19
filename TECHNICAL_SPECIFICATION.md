# 부동산 데이터 비교 분석 플랫폼 - 기술 명세서

## 1. 시스템 아키텍처 개요

### 1.1 전체 시스템 구조
```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Frontend      │    │   Backend API   │    │   Database      │
│   (React/Vue)   │←→│   (Node.js/     │←→│   (PostgreSQL/  │
│                 │    │    Python)      │    │   TimescaleDB)  │
└─────────────────┘    └─────────────────┘    └─────────────────┘
                                ↓
                       ┌─────────────────┐
                       │  Data Pipeline  │
                       │   (ETL Process) │
                       └─────────────────┘
```

### 1.2 핵심 구성 요소
- **Frontend**: 사용자 인터페이스 (지역 선택, 차트 시각화)
- **Backend API**: RESTful API 서버 (데이터 조회, 비교 로직)
- **Database**: 시계열 데이터 저장소 (지역별 부동산 지수)
- **Data Pipeline**: 엑셀 파일 처리 및 데이터 업데이트 자동화

## 2. 데이터 모델 설계

### 2.1 데이터베이스 스키마
```sql
-- 지역 정보 (계층 구조)
CREATE TABLE regions (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    code VARCHAR(20) UNIQUE,
    parent_id INTEGER REFERENCES regions(id),
    level INTEGER NOT NULL, -- 1=전국, 2=시도, 3=시군구
    created_at TIMESTAMP DEFAULT NOW()
);

-- 시계열 데이터 (가격 지수)
CREATE TABLE price_indices (
    id SERIAL PRIMARY KEY,
    region_id INTEGER REFERENCES regions(id),
    date DATE NOT NULL,
    price_index DECIMAL(10,2) NOT NULL,
    data_type VARCHAR(20) NOT NULL, -- 'weekly', 'monthly'
    source_file VARCHAR(255),
    created_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(region_id, date, data_type)
);

-- 데이터 처리 로그
CREATE TABLE data_imports (
    id SERIAL PRIMARY KEY,
    filename VARCHAR(255) NOT NULL,
    import_date TIMESTAMP DEFAULT NOW(),
    status VARCHAR(20) NOT NULL, -- 'processing', 'completed', 'failed'
    records_processed INTEGER,
    errors_count INTEGER,
    error_details TEXT
);
```

### 2.2 인덱스 전략
```sql
-- 시계열 조회 최적화
CREATE INDEX idx_price_indices_region_date ON price_indices (region_id, date, data_type);
CREATE INDEX idx_price_indices_date ON price_indices (date);

-- 지역 계층 조회 최적화
CREATE INDEX idx_regions_parent ON regions (parent_id, level);
```

## 3. API 설계

### 3.1 REST API 엔드포인트
```
GET /api/regions                    # 지역 계층 구조 조회
GET /api/regions/{id}/children      # 하위 지역 목록 조회
GET /api/data/compare               # 다중 지역 비교 데이터
  ?regions=1,2,3&start_date=2020-01-01&end_date=2024-01-01&type=monthly
GET /api/data/region/{id}           # 단일 지역 시계열 데이터
POST /api/admin/import              # 엑셀 파일 업로드
GET /api/admin/import/{id}/status   # 처리 상태 확인
```

### 3.2 API 응답 형식
```json
{
  "success": true,
  "data": {
    "regions": [
      {
        "id": 1,
        "name": "서울특별시",
        "code": "11000",
        "data_points": [
          {
            "date": "2024-01-01",
            "price_index": 108.5
          }
        ]
      }
    ]
  },
  "meta": {
    "total_points": 120,
    "date_range": {
      "start": "2020-01-01",
      "end": "2024-01-01"
    }
  }
}
```

## 4. 데이터 처리 파이프라인

### 4.1 데이터 수집 자동화
**설명**: 지정된 스케줄에 따라 파이썬 기반 웹 크롤러가 KB부동산 데이터허브에서 자동으로 최신 데이터를 수집하는 시스템

**동작 프로세스**:
1. **스케줄링 실행**: 매일 오전 4시에 데이터 수집 스크립트 실행
2. **웹사이트 접속**: Selenium/BeautifulSoup로 KB 데이터허브 접속
3. **최신 버전 확인**: 현재 저장된 버전과 웹사이트 버전 비교
4. **신규 파일 다운로드**: 새로운 파일 발견 시 자동 다운로드
5. **데이터 처리 실행**: 다운로드된 파일의 데이터 처리
6. **기존 파일 관리**: 처리 완료 후 아카이브 폴더로 이동

**예외 처리**:
- 웹사이트 구조 변경 시 관리자 알림
- 파일 처리 오류 시 작업 중단 및 알림

### 4.2 엑셀 파일 처리 워크플로우
```
1. 파일 업로드 → 2. 스키마 검증 → 3. 데이터 파싱 → 4. 변환 및 정규화 
     ↓
5. 데이터베이스 업데이트 → 6. 캐시 무효화 → 7. 처리 완료 알림
```

### 4.3 데이터 변환 로직
```python
# 엑셀 데이터 처리 예시
def process_excel_file(file_path):
    df = pd.read_excel(file_path, sheet_name='매매APT')
    
    # 데이터 정규화
    df['date'] = pd.to_datetime(df['기간'])
    df['region_name'] = df['지역명'].str.strip()
    df['price_index'] = pd.to_numeric(df['가격지수'], errors='coerce')
    
    # 지역 매핑
    df['region_id'] = df['region_name'].map(region_mapping)
    
    # 유효성 검사
    invalid_rows = df[df['region_id'].isna() | df['price_index'].isna()]
    if not invalid_rows.empty:
        raise ValidationError(f"Invalid data found: {len(invalid_rows)} rows")
    
    return df[['region_id', 'date', 'price_index']]
```

## 5. 프론트엔드 구조

### 5.1 컴포넌트 아키텍처
```
App
├── RegionSelector
│   ├── SearchableDropdown
│   └── SelectedRegionsList
├── ChartContainer
│   ├── LineChart
│   ├── ChartControls
│   └── TimeRangeSelector
└── DataSummary
    ├── RegionStats
    └── ComparisonInsights
```

### 5.2 상태 관리
```javascript
// 전역 상태 구조
const initialState = {
  selectedRegions: {
    base: null,
    comparisons: []
  },
  timeRange: {
    start: '2020-01-01',
    end: '2024-01-01',
    type: 'monthly'
  },
  chartData: {
    loading: false,
    data: [],
    error: null
  }
};
```

## 6. 성능 최적화

### 6.1 캐싱 전략
```
- Redis 캐시: 자주 조회되는 지역 데이터 (TTL: 1시간)
- 브라우저 캐시: 정적 자원 및 지역 메타데이터
- 데이터베이스 캐시: 쿼리 결과 캐싱, 연결 풀링
```

### 6.2 데이터 로딩 최적화
```javascript
// 지연 로딩 및 배치 처리
const loadRegionData = async (regionIds, dateRange) => {
  const cacheKey = `regions:${regionIds.join(',')}:${dateRange.start}:${dateRange.end}`;
  
  let data = await cache.get(cacheKey);
  if (!data) {
    data = await api.getComparisonData(regionIds, dateRange);
    await cache.set(cacheKey, data, { ttl: 3600 });
  }
  
  return data;
};
```

## 7. 확장성 고려사항

### 7.1 플러그인 시스템
```javascript
// 데이터 소스 추상화
class DataSource {
  async fetchData(params) {
    throw new Error('Must implement fetchData method');
  }
}

class KBDataSource extends DataSource {
  async fetchData(params) {
    // KB 데이터 처리 로직
  }
}

class ECOSDataSource extends DataSource {
  async fetchData(params) {
    // 한국은행 ECOS API 연동
  }
}
```

### 7.2 메트릭 확장 프레임워크
```javascript
// 지표 계산 엔진
class MetricCalculator {
  static calculations = {
    'price_index': (data) => data.price_index,
    'rental_rate': (data) => data.rental_price / data.sale_price,
    'transaction_volume': (data) => data.transaction_count
  };
  
  static addMetric(name, calculation) {
    this.calculations[name] = calculation;
  }
}
```

## 8. 보안 및 품질 관리

### 8.1 보안 조치
- SQL 인젝션 방지: 매개변수화된 쿼리 사용
- 입력 검증: 모든 사용자 입력 검증 및 정화
- 접근 제어: 관리자 전용 데이터 업로드 기능
- 속도 제한: API 호출 빈도 제한

### 8.2 품질 관리
```javascript
// 데이터 품질 검사
const validateData = (data) => {
  const checks = [
    { name: 'date_format', test: (row) => isValidDate(row.date) },
    { name: 'price_range', test: (row) => row.price_index > 0 && row.price_index < 1000 },
    { name: 'region_exists', test: (row) => regions.has(row.region_id) }
  ];
  
  return checks.map(check => ({
    ...check,
    passed: data.every(check.test),
    failures: data.filter(row => !check.test(row))
  }));
};
```

## 9. 구현 로드맵

### 9.1 MVP 단계별 구현
```
Phase 1 (2주): 데이터 모델, 기본 API, 엑셀 처리
Phase 2 (2주): 지역 선택 UI, 기본 차트 시각화
Phase 3 (1주): 인터랙티브 차트, 필터링 기능
Phase 4 (1주): 데이터 업로드 인터페이스, 모니터링
Phase 5 (1주): 성능 최적화, 에러 핸들링
```

### 9.2 기술 스택 권장사항
- **Frontend**: React + TypeScript + Recharts/D3.js
- **Backend**: Node.js + Express + TypeScript
- **Database**: PostgreSQL + TimescaleDB (시계열 최적화)
- **Processing**: Python + pandas (엑셀 처리)
- **Cache**: Redis
- **Infrastructure**: Docker + nginx

## 10. 모니터링 및 운영

### 10.1 애플리케이션 모니터링
```javascript
// 메트릭 수집
const metrics = {
  api_response_time: new Histogram('api_response_time_seconds'),
  data_processing_time: new Histogram('data_processing_seconds'),
  cache_hit_rate: new Gauge('cache_hit_rate'),
  active_regions: new Gauge('active_regions_count')
};
```

### 10.2 데이터 품질 모니터링
```python
# 데이터 품질 체크
def monitor_data_quality():
    checks = [
        check_missing_data(),
        check_outliers(),
        check_data_freshness(),
        check_regional_coverage()
    ]
    
    for check in checks:
        if not check.passed:
            alert_manager.send_alert(check.error_message)
```

이 기술 명세서는 MVP 개발을 위한 기반을 제공하며, 향후 확장 계획을 고려한 유연한 아키텍처를 제시합니다.