import { describe, it, expect } from 'vitest';
import { computeYearsOut, computeMonthlyAmount } from '@/src/domain/billing';

describe('computeYearsOut', () => {
  it('returns the difference between current year and graduation year', () => {
    expect(computeYearsOut(2010, 2026)).toBe(16);
  });

  it('returns 1 when graduation year equals current year', () => {
    expect(computeYearsOut(2026, 2026)).toBe(1);
  });

  it('returns 1 when graduation year is in the future', () => {
    expect(computeYearsOut(2027, 2026)).toBe(1);
  });
});

describe('computeMonthlyAmount', () => {
  it('returns years out as the dollar amount', () => {
    expect(computeMonthlyAmount(16)).toBe(16);
  });

  it('returns 1 when years out is 0', () => {
    expect(computeMonthlyAmount(0)).toBe(1);
  });
});
