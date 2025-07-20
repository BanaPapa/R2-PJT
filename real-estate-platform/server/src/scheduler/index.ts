import cron from 'node-cron';
import { KBDataCollectorService } from '../services/kb-data-collector.service.js';

const dataCollector = new KBDataCollectorService();

/**
 * KB 데이터 자동 수집 스케줄러
 * 매주 월요일 오전 9시에 실행 (KB 데이터 업데이트 시간 고려)
 */
export function startDataCollectionScheduler() {
  console.log('📅 KB 데이터 수집 스케줄러 시작...');
  
  // 매주 월요일 09:00에 실행
  cron.schedule('0 9 * * 1', async () => {
    console.log('🔄 주간 KB 데이터 수집 시작...');
    
    try {
      const result = await dataCollector.collectData();
      
      if (result.success) {
        console.log('✅ 자동 데이터 수집 완료:', result.message);
        console.log('📊 수집된 데이터:', result.data);
      } else {
        console.error('❌ 자동 데이터 수집 실패:', result.error);
      }
    } catch (error) {
      console.error('💥 스케줄러 실행 중 오류:', error);
    }
  }, {
    scheduled: true,
    timezone: "Asia/Seoul"
  });

  // 테스트용: 매 시간마다 새 데이터 확인 (개발 환경에서만)
  if (process.env.NODE_ENV === 'development') {
    cron.schedule('0 * * * *', async () => {
      console.log('🔍 [개발] 새 데이터 확인 중...');
      
      try {
        const { hasNewData, fileName, week } = await dataCollector.checkForNewData();
        
        if (hasNewData) {
          console.log(`📋 [개발] 새 데이터 발견: ${fileName} (${week})`);
        } else {
          console.log('📋 [개발] 새 데이터 없음');
        }
      } catch (error) {
        console.error('💥 [개발] 데이터 확인 중 오류:', error);
      }
    }, {
      scheduled: true,
      timezone: "Asia/Seoul"
    });
  }

  console.log('⏰ 스케줄러 등록 완료:');
  console.log('  - 주간 수집: 매주 월요일 09:00 (KST)');
  if (process.env.NODE_ENV === 'development') {
    console.log('  - 개발 확인: 매시간 00분');
  }
}

/**
 * 수동 스케줄러 실행 (테스트용)
 */
export async function runManualCollection() {
  console.log('🔧 수동 데이터 수집 실행...');
  
  try {
    const result = await dataCollector.collectData();
    console.log('결과:', result);
    return result;
  } catch (error) {
    console.error('수동 수집 중 오류:', error);
    throw error;
  }
}

// 스케줄러 CLI 실행 지원
if (import.meta.url === `file://${process.argv[1]}`) {
  const command = process.argv[2];
  
  switch (command) {
    case 'start':
      startDataCollectionScheduler();
      console.log('📡 스케줄러가 백그라운드에서 실행 중...');
      break;
    case 'manual':
      runManualCollection()
        .then(result => {
          console.log('✅ 수동 수집 완료');
          process.exit(0);
        })
        .catch(error => {
          console.error('❌ 수동 수집 실패');
          process.exit(1);
        });
      break;
    default:
      console.log('사용법:');
      console.log('  npm run scheduler start  - 스케줄러 시작');
      console.log('  npm run scheduler manual - 수동 수집 실행');
      process.exit(1);
  }
}