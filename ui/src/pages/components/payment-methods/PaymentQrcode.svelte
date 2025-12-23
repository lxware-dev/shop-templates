<script lang="ts">
  import type { PaymentInitiateResponse } from '@halo-dev/api-client';

  let { paymentResponse }: { paymentResponse: PaymentInitiateResponse } = $props();

  let paymentQrcode = $derived(paymentResponse.payload?.payload?.paymentQrcode);
</script>

{#if paymentQrcode}
  <div class="shop-qrcode-container">
    <div class="shop-qrcode-wrapper">
      <img src={paymentQrcode.qrcodeImageUrl} class="shop-qrcode-image" />
    </div>
    <div class="shop-qrcode-info">
      <p class="shop-qrcode-tip">{paymentQrcode.instructions}</p>
    </div>
  </div>
{/if}
