import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import { PrismaClient } from '@prisma/client';
import apiRoutes from './routes/api.routes.js';
import { startDataCollectionScheduler } from './scheduler/index.js';

// 환경 변수 로드
dotenv.config();

const app = express();
const port = process.env.PORT || 3001;
const prisma = new PrismaClient();

// 미들웨어 설정
app.use(helmet());
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  credentials: true
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// API 라우트
app.use('/api', apiRoutes);

// 루트 엔드포인트
app.get('/', (req, res) => {
  res.json({
    message: 'KB 부동산 데이터 분석 서버',
    version: '1.0.0',
    status: 'running',
    endpoints: {
      health: '/api/health',
      collectData: 'POST /api/collect-data',
      timeSeries: 'GET /api/regions/:regionCode/timeseries',
      statistics: 'GET /api/regions/:regionCode/statistics',
      settings: 'GET|PUT /api/settings',
      status: 'GET /api/collection-status'
    }
  });
});

// 404 핸들러
app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    error: '요청한 엔드포인트를 찾을 수 없습니다.',
    availableEndpoints: [
      'GET /',
      'GET /api/health',
      'POST /api/collect-data',
      'GET /api/regions/:regionCode/timeseries',
      'GET /api/regions/:regionCode/statistics',
      'GET /api/settings',
      'PUT /api/settings',
      'GET /api/collection-status'
    ]
  });
});

// 글로벌 에러 핸들러
app.use((error: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('서버 오류:', error);
  
  res.status(500).json({
    success: false,
    error: process.env.NODE_ENV === 'production' 
      ? '내부 서버 오류가 발생했습니다.' 
      : error.message
  });
});

// 서버 시작
async function startServer() {
  try {
    // 데이터베이스 연결 확인
    await prisma.$connect();
    console.log('✅ 데이터베이스 연결 성공');

    // 서버 시작
    app.listen(port, () => {
      console.log(`🚀 KB 부동산 데이터 서버가 포트 ${port}에서 시작되었습니다.`);
      console.log(`📡 프론트엔드 연결: ${process.env.FRONTEND_URL || 'http://localhost:5173'}`);
      console.log(`🔗 API 문서: http://localhost:${port}/`);
      
      // 스케줄러 시작
      if (process.env.ENABLE_SCHEDULER !== 'false') {
        startDataCollectionScheduler();
      }
    });
  } catch (error) {
    console.error('❌ 서버 시작 실패:', error);
    process.exit(1);
  }
}

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('\\n⏹️  서버 종료 신호 수신...');
  
  try {
    await prisma.$disconnect();
    console.log('✅ 데이터베이스 연결 종료');
    process.exit(0);
  } catch (error) {
    console.error('❌ 서버 종료 중 오류:', error);
    process.exit(1);
  }
});

// 서버 시작
startServer();