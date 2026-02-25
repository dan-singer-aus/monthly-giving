const MINIMUM_YEARS_OUT = 1;

export function computeYearsOut(
  graduationYear: number,
  currentYear: number
): number {
  const yearsOut = currentYear - graduationYear;
  return Math.max(MINIMUM_YEARS_OUT, yearsOut);
}

export function computeMonthlyAmount(yearsOut: number): number {
  return Math.max(yearsOut, MINIMUM_YEARS_OUT);
}
