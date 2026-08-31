import type { SubscriptionProductResponse } from '@halo-dev/api-client';

export type SubscriptionLineKind = 'plan' | 'addon';

export interface SubscriptionLine {
  kind: SubscriptionLineKind;
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
      kind: 'plan',
      name: plan.name,
      billingPeriod: plan.billingPeriod,
      billingMode: plan.billingMode,
    };
  }

  const addon = (data.addons ?? []).find((item) => item.variantId === variantId);
  if (addon?.name) {
    return {
      kind: 'addon',
      name: addon.name,
      billingPeriod: addon.billingPeriod,
    };
  }

  return null;
}
