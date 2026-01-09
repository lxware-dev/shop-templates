<script lang="ts">
  import type { PaymentInitiateResponse } from '@halo-dev/api-client';
  let { paymentResponse }: { paymentResponse: PaymentInitiateResponse } = $props();

  let responseType = $derived(paymentResponse.payload?.responseType);
  let stripe = $derived(paymentResponse.payload?.payload?.stripe);
</script>

{#if stripe}
  {#if responseType === 'REDIRECT_URL'}
    <div class="shop-redirect-container">
      <a href={stripe.checkoutUrl} target="_blank" class="shop-redirect-link">
        点击跳转至 Stripe
      </a>
      <p class="shop-redirect-tip">点击链接后将在新窗口打开支付页面</p>
    </div>
  {:else}
    <div>暂无 Stripe 支付信息，请联系管理员</div>
  {/if}
{:else}
  <div>暂无 Stripe 支付信息，请联系管理员</div>
{/if}
