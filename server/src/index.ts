import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import { PrismaClient } from '@prisma/client';
import apiRoutes from './routes/api.routes.js';
import { startDataCollectionScheduler } from './scheduler/index.js';

dotenv.config();

const app = express();
const port = process.env.PORT || 3001;
const prisma = new PrismaClient();

app.use(helmet());
app.use(cors({
  origin: [
    'http://localhost:5173',
    'http://localhost:5174',
    'http://localhost:5175',
    'http://localhost:5176',
    'http://localhost:5300',
    process.env.FRONTEND_URL || 'http://localhost:5173',
  ],
  credentials: true,
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

app.use('/api', apiRoutes);

app.get('/', (_req, res) => {
  res.json({
    message: 'KB 부동산 데이터 플랫폼 서버',
    version: '2.0.0',
    status: 'running',
    endpoints: {
      health: 'GET /api/health',
      regions: 'GET /api/regions',
      weeklyData: 'GET /api/data/weekly',
      monthlyData: 'GET /api/data/monthly',
      collectionStatus: 'GET /api/collection/status',
      collectionTrigger: 'POST /api/collection/trigger',
      latestDate: 'GET /api/collection/latest-date',
    },
  });
});

app.use('*', (_req, res) => {
  res.status(404).json({ success: false, error: 'Endpoint not found' });
});

app.use((error: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('[Server] Error:', error);
  res.status(500).json({
    success: false,
    error: process.env.NODE_ENV === 'production' ? 'Internal server error' : error.message,
  });
});

async function startServer() {
  try {
    await prisma.$connect();
    console.log('[Server] Database connected');

    app.listen(port, () => {
      console.log(`[Server] Running on port ${port}`);
      console.log(`[Server] CORS origins: http://localhost:5173, http://localhost:5174`);

      if (process.env.ENABLE_SCHEDULER !== 'false') {
        startDataCollectionScheduler();
      }
    });
  } catch (error) {
    console.error('[Server] Startup failed:', error);
    process.exit(1);
  }
}

process.on('SIGINT', async () => {
  console.log('[Server] Shutting down...');
  await prisma.$disconnect().catch(() => {});
  process.exit(0);
});

startServer();
