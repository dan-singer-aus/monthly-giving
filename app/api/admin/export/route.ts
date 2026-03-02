import { makeAdminExportHandler } from '@/src/services/export/adminExport.handler';
import { auth } from '@/src/services/auth/auth.runtime';
import { usersRepo } from '@/src/repos/users.repo';
import { billingSubscriptionsRepo } from '@/src/repos/billingSubscriptions.repo';

export const GET = makeAdminExportHandler({
  auth,
  usersRepo,
  billingSubscriptionsRepo,
});
