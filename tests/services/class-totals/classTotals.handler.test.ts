import { describe, it, expect } from 'vitest';
import { makeClassTotalsHandler } from '@/src/services/class-totals/classTotals.handler';

function makeRequest() {
  return new Request('http://test/api/public/class-totals');
}

describe('GET /api/public/class-totals', () => {
  it('returns 200 with an array of graduation year totals', async () => {
    const handler = makeClassTotalsHandler({
      subscriptionPaymentsRepo: {
        getTotalPaymentsByGraduationYear: async () => [
          {
            graduationYear: 2020,
            totalAmountCents: '5000',
            contributorCount: 1,
          },
        ],
      },
    });

    const res = await handler(makeRequest());
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual([
      { graduationYear: 2020, totalAmountDollars: 50, contributorCount: 1 },
    ]);
  });

  it('returns an empty array when no payments exist', async () => {
    const handler = makeClassTotalsHandler({
      subscriptionPaymentsRepo: {
        getTotalPaymentsByGraduationYear: async () => [],
      },
    });

    const res = await handler(makeRequest());
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual([]);
  });

  it('converts null totalAmountCents to zero dollars', async () => {
    const handler = makeClassTotalsHandler({
      subscriptionPaymentsRepo: {
        getTotalPaymentsByGraduationYear: async () => [
          { graduationYear: 2020, totalAmountCents: null, contributorCount: 0 },
        ],
      },
    });

    const res = await handler(makeRequest());
    expect(res.status).toBe(200);
    expect((await res.json())[0].totalAmountDollars).toBe(0);
  });

  it('returns multiple rows sorted as provided by the repo', async () => {
    const handler = makeClassTotalsHandler({
      subscriptionPaymentsRepo: {
        getTotalPaymentsByGraduationYear: async () => [
          {
            graduationYear: 2000,
            totalAmountCents: '2600',
            contributorCount: 2,
          },
          {
            graduationYear: 2010,
            totalAmountCents: '1500',
            contributorCount: 1,
          },
        ],
      },
    });

    const res = await handler(makeRequest());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveLength(2);
    expect(body[0].graduationYear).toBe(2000);
    expect(body[1].graduationYear).toBe(2010);
  });
});
