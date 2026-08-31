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
    if (line.billingPeriod) {
      return String(
        $i18n.t('subscription.billingPeriod.' + line.billingPeriod, {
          defaultValue: line.billingPeriod,
        })
      );
    }
    if (line.billingMode === 'LIFETIME' || line.billingMode === 'ONE_TIME') {
      return String(
        $i18n.t('subscription.billingMode.' + line.billingMode, {
          defaultValue: line.billingMode,
        })
      );
    }
    return '';
  });
</script>

{#if line}
  <span class="shop-subscription-line">
    <span class="shop-subscription-line__badge">{$i18n.t('subscription.badge')}</span>
    <span class="shop-subscription-line__detail">
      {#if line.kind === 'addon'}
        {$i18n.t('subscription.addonLabel', { name: line.name })}
      {:else}
        {line.name}
      {/if}
      {#if periodLabel}
        <span class="shop-subscription-line__period">{periodLabel}</span>
      {/if}
    </span>
  </span>
{/if}
