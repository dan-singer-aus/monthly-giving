import { makeHealthHandler } from '@/src/services/health/health.handler';
import { dbPing } from '@/src/services/health/health.runtime';

export const GET = makeHealthHandler({ db: dbPing });
