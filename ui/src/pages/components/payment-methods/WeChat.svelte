<script lang="ts">
  import type { PaymentInitiateResponse } from '@halo-dev/api-client';
  import QRCode from 'qrcode';

  let { paymentResponse }: { paymentResponse: PaymentInitiateResponse } = $props();

  let responseType = $derived(paymentResponse.payload?.responseType);
  let wechatPay = $derived(paymentResponse.payload?.payload?.wechatPay);
</script>

{#if wechatPay}
  {#if responseType === 'QRCODE_URL'}
    <div class="shop-qrcode-container">
      <div class="shop-qrcode-wrapper">
        {#await QRCode.toDataURL(wechatPay.nativePay?.codeUrl!) then qrcodeUrl}
          <img src={qrcodeUrl} alt="支付二维码" class="shop-qrcode-image" />
        {/await}
      </div>
      <div class="shop-qrcode-info">
        <p class="shop-qrcode-tip">请使用微信扫描二维码完成支付</p>
        <div class="shop-qrcode-status">
          <div class="shop-loading-spinner"></div>
          <span>等待支付中...</span>
        </div>
      </div>
    </div>
  {:else}
    <div>暂无微信支付信息，请联系管理员</div>
  {/if}
{:else}
  <div>暂无微信支付信息，请联系管理员</div>
{/if}
