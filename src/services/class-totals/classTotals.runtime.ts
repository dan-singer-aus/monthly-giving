import { subscriptionPaymentsRepo } from '@/src/repos/subscriptionPayments.repo';
import { makeClassTotalsHandler } from './classTotals.handler';

export const classTotalsHandler = makeClassTotalsHandler({
  subscriptionPaymentsRepo,
});
