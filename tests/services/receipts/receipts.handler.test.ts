import { describe, it, expect } from 'vitest';
import { makeReceiptsHandler } from '@/src/services/receipts/receipts.handler';

const billingCustomer = {
  userId: 'user-123',
  stripeCustomerId: 'cus_abc123',
};

const stripeInvoice = {
  id: 'in_abc123',
  amount_paid: 1600,
  created: 1740787200, // 2025-03-01T00:00:00Z
  hosted_invoice_url: 'https://invoice.stripe.com/i/abc123',
  period_start: 1738195200, // 2025-01-30
  period_end: 1740787200, // 2025-03-01
};

function makeRequest() {
  return new Request('http://test/api/receipts');
}

describe('GET /api/receipts', () => {
  it('returns 401 when there is no session', async () => {
    const handler = makeReceiptsHandler({
      auth: { getSessionUserId: async () => null },
      billingCustomersRepo: { getByUserId: async () => null },
      stripe: { invoices: { list: async () => ({ data: [] }) } },
    });

    const res = await handler(makeRequest());
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: 'Unauthorized' });
  });

  it('returns empty receipts when no billing customer exists', async () => {
    const handler = makeReceiptsHandler({
      auth: { getSessionUserId: async () => 'user-123' },
      billingCustomersRepo: { getByUserId: async () => null },
      stripe: { invoices: { list: async () => ({ data: [] }) } },
    });

    const res = await handler(makeRequest());
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ receipts: [] });
  });

  it('returns mapped receipts for a billing customer', async () => {
    const handler = makeReceiptsHandler({
      auth: { getSessionUserId: async () => 'user-123' },
      billingCustomersRepo: {
        getByUserId: async (id) => (id === 'user-123' ? billingCustomer : null),
      },
      stripe: {
        invoices: {
          list: async ({ customer }) =>
            customer === 'cus_abc123'
              ? { data: [stripeInvoice] }
              : { data: [] },
        },
      },
    });

    const res = await handler(makeRequest());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.receipts).toHaveLength(1);
    expect(body.receipts[0]).toEqual({
      id: 'in_abc123',
      amountPaid: 1600,
      createdAt: new Date(1740787200 * 1000).toISOString(),
      invoiceUrl: 'https://invoice.stripe.com/i/abc123',
      periodStart: new Date(1738195200 * 1000).toISOString(),
      periodEnd: new Date(1740787200 * 1000).toISOString(),
    });
  });

  it('returns empty receipts when stripe returns no paid invoices', async () => {
    const handler = makeReceiptsHandler({
      auth: { getSessionUserId: async () => 'user-123' },
      billingCustomersRepo: {
        getByUserId: async () => billingCustomer,
      },
      stripe: {
        invoices: { list: async () => ({ data: [] }) },
      },
    });

    const res = await handler(makeRequest());
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ receipts: [] });
  });

  it('handles null invoiceUrl gracefully', async () => {
    const handler = makeReceiptsHandler({
      auth: { getSessionUserId: async () => 'user-123' },
      billingCustomersRepo: { getByUserId: async () => billingCustomer },
      stripe: {
        invoices: {
          list: async () => ({
            data: [{ ...stripeInvoice, hosted_invoice_url: null }],
          }),
        },
      },
    });

    const res = await handler(makeRequest());
    expect(res.status).toBe(200);
    expect((await res.json()).receipts[0].invoiceUrl).toBeNull();
  });
});
