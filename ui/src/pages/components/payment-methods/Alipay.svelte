<script lang="ts">
  import type { PaymentInitiateResponse } from '@halo-dev/api-client';
  import QRCode from 'qrcode';

  let { paymentResponse }: { paymentResponse: PaymentInitiateResponse } = $props();

  let responseType = $derived(paymentResponse.payload?.responseType);
  let alipay = $derived(paymentResponse.payload?.payload?.alipay);
</script>

{#if alipay}
  {#if responseType === 'QRCODE_URL'}
    <div class="shop-qrcode-container">
      <div class="shop-qrcode-wrapper">
        {#await QRCode.toDataURL(alipay?.qrCode?.url!) then qrcodeUrl}
          <img src={qrcodeUrl} alt="支付二维码" class="shop-qrcode-image" />
        {/await}
      </div>
      <div class="shop-qrcode-info">
        <p class="shop-qrcode-tip">请使用支付宝扫描二维码完成支付</p>
        <div class="shop-qrcode-status">
          <div class="shop-loading-spinner"></div>
          <span>等待支付中...</span>
        </div>
      </div>
    </div>
  {:else if responseType === 'FORM'}
    <div class="shop-qrcode-container">
      <div class="shop-qrcode-wrapper">
        <iframe
          title="支付宝支付"
          srcdoc={alipay.pageRedirectionData}
          style="width: 200px; height: 205px;border: none;"
        ></iframe>
      </div>
      <div class="shop-qrcode-info">
        <p class="shop-qrcode-tip">请使用支付宝扫描二维码完成支付</p>
        <div class="shop-qrcode-status">
          <div class="shop-loading-spinner"></div>
          <span>等待支付中...</span>
        </div>
      </div>
    </div>
  {:else}
    <div>暂无支付宝支付信息，请联系管理员</div>
  {/if}
{:else}
  <div>暂无支付宝支付信息，请联系管理员</div>
{/if}
