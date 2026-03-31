<script lang="ts">
  import type { PaymentInitiateResponse } from '@halo-dev/api-client';
  import i18n from '../../../i18n';
  let { paymentResponse }: { paymentResponse: PaymentInitiateResponse } = $props();

  let responseType = $derived(paymentResponse.payload?.responseType);
  let stripe = $derived(paymentResponse.payload?.payload?.stripe);
</script>

{#if stripe}
  {#if responseType === 'REDIRECT_URL'}
    <div class="shop-redirect-container">
      <a href={stripe.checkoutUrl} target="_blank" class="shop-redirect-link">
        {$i18n.t('paymentMethods.redirectToProvider', {
          provider: $i18n.t('common.providers.stripe'),
        })}
      </a>
      <p class="shop-redirect-tip">{$i18n.t('common.redirectTip')}</p>
    </div>
  {:else}
    <div>{$i18n.t('paymentMethods.stripeUnavailable')}</div>
  {/if}
{:else}
  <div>{$i18n.t('paymentMethods.stripeUnavailable')}</div>
{/if}
