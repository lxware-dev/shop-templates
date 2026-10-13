import type { SubscriptionProductResponse } from '@halo-dev/api-client';

export interface SubscriptionLine {
  name: string;
  billingPeriod?: string;
  billingMode?: string;
}

export function resolveSubscriptionLine(
  data: SubscriptionProductResponse | undefined,
  variantId: number | undefined
): SubscriptionLine | null {
  if (!data || variantId == null) {
    return null;
  }

  const plan = (data.plans ?? []).find((item) => item.variantId === variantId);
  if (plan?.name) {
    return {
      name: plan.name,
      billingPeriod: plan.billingPeriod,
      billingMode: plan.billingMode,
    };
  }

  return null;
}
