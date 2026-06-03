import cron from 'node-cron';
import { collectWeekly, collectMonthly } from '../services/data-collector.service.js';

export function startDataCollectionScheduler() {
  console.log('[Scheduler] Starting KB data collection scheduler...');

  // Weekly: Every Monday at 9am KST
  cron.schedule('0 9 * * 1', async () => {
    console.log('[Scheduler] Running weekly collection...');
    try {
      const result = await collectWeekly();
      if (result.success) {
        console.log('[Scheduler] Weekly collection done:', result.message);
      } else {
        console.error('[Scheduler] Weekly collection failed:', result.error);
      }
    } catch (error) {
      console.error('[Scheduler] Weekly collection error:', error);
    }
  }, {
    scheduled: true,
    timezone: 'Asia/Seoul',
  });

  // Monthly: 1st of each month at 9am KST
  cron.schedule('0 9 1 * *', async () => {
    console.log('[Scheduler] Running monthly collection...');
    try {
      const result = await collectMonthly('monthly-housing');
      if (result.success) {
        console.log('[Scheduler] Monthly collection done:', result.message);
      } else {
        console.error('[Scheduler] Monthly collection failed:', result.error);
      }
    } catch (error) {
      console.error('[Scheduler] Monthly collection error:', error);
    }
  }, {
    scheduled: true,
    timezone: 'Asia/Seoul',
  });

  console.log('[Scheduler] Scheduled:');
  console.log('  - Weekly collection: every Monday 09:00 KST');
  console.log('  - Monthly collection: 1st of month 09:00 KST');
}
