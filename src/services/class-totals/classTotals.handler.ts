type SubscriptionPaymentsRepo = {
  getTotalPaymentsByGraduationYear: () => Promise<
    {
      graduationYear: number;
      totalAmountCents: string | null;
      contributorCount: number;
    }[]
  >;
};

type ClassTotalsHandlerProps = {
  subscriptionPaymentsRepo: SubscriptionPaymentsRepo;
};

export function makeClassTotalsHandler(props: ClassTotalsHandlerProps) {
  return async function GET(_req: Request) {
    const totalsByGraduationYear =
      await props.subscriptionPaymentsRepo.getTotalPaymentsByGraduationYear();

    const totalsByGraduationYearWithDollars = totalsByGraduationYear.map(
      ({ graduationYear, totalAmountCents, contributorCount }) => ({
        graduationYear,
        totalAmountDollars: totalAmountCents
          ? parseInt(totalAmountCents) / 100
          : 0,
        contributorCount,
      })
    );

    return Response.json(totalsByGraduationYearWithDollars, { status: 200 });
  };
}
