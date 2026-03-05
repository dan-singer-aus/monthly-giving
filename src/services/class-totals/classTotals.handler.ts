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
  return async function GET() {
    const totalsByGraduationYear =
      await props.subscriptionPaymentsRepo.getTotalPaymentsByGraduationYear();

    return Response.json(totalsByGraduationYear, { status: 200 });
  };
}
