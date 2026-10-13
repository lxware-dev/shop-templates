<script lang="ts">
  import { type SubscriptionProductResponse } from '@halo-dev/api-client';
  import { createQuery, getQueryClientContext, QueryClient } from '@tanstack/svelte-query';
  import ky from 'ky';
  import i18n from '../../i18n';
  import { resolveSubscriptionLine } from '../../utils/subscription-line';

  let {
    productId,
    variantId,
    enabled = true,
  }: {
    productId?: number;
    variantId?: number;
    enabled?: boolean;
  } = $props();

  function resolveQueryClient(): QueryClient {
    try {
      return getQueryClientContext();
    } catch {
      return new QueryClient();
    }
  }

  const queryClient = resolveQueryClient();

  const query = createQuery(
    () => ({
      queryKey: ['shop:subscription-product', productId],
      queryFn: async () => {
        return await ky
          .get<SubscriptionProductResponse>(
            `/apis/uc.api.ecommerce.halo.run/v1alpha1/subscription-products/${productId}`
          )
          .json();
      },
      enabled: enabled && !!productId,
      retry: false,
    }),
    () => queryClient
  );

  const line = $derived(resolveSubscriptionLine(query.data, variantId));

  const periodLabel = $derived.by(() => {
    if (!line) return '';
    const modeLabel = line.billingMode
      ? String(
          $i18n.t('subscription.billingMode.' + line.billingMode, {
            defaultValue: line.billingMode,
          })
        )
      : '';
    const period = line.billingPeriod
      ? String(
          $i18n.t('subscription.billingPeriod.' + line.billingPeriod, {
            defaultValue: line.billingPeriod,
          })
        )
      : '';
    if (!period || line.billingMode === 'LIFETIME') {
      return modeLabel;
    }
    // 单期购买需要和连续购买区分开（两者都按月/按年）
    if (line.billingMode === 'ONE_TIME') {
      return [modeLabel, period].filter(Boolean).join(' ');
    }
    return period;
  });
</script>

{#if line}
  <span class="shop-subscription-line">
    {line.name}
    {#if periodLabel}
      <span class="shop-subscription-line__period">{periodLabel}</span>
    {/if}
  </span>
{/if}
