<script lang="ts">
  import type { PaymentInitiateResponse } from '@halo-dev/api-client';

  let { paymentResponse }: { paymentResponse: PaymentInitiateResponse } = $props();

  let responseType = $derived(paymentResponse.payload?.responseType);
  let easyPay = $derived(paymentResponse.payload?.payload?.easyPay);
</script>

{#if easyPay}
  {#if responseType === 'QRCODE_URL'}
    <div class="shop-qrcode-container">
      <div class="shop-qrcode-wrapper">
        {#if easyPay.qrCode?.url}
          <img src={easyPay.qrCode?.url} alt="支付二维码" class="shop-qrcode-image" />
        {/if}
      </div>
      <div class="shop-qrcode-info">
        <p class="shop-qrcode-tip">
          请使用{easyPay?.type === 'ALIPAY' ? '支付宝' : '微信'}扫描二维码完成支付
        </p>
        <div class="shop-qrcode-status">
          <div class="shop-loading-spinner"></div>
          <span>等待支付中...</span>
        </div>
      </div>
    </div>
  {:else if responseType === 'REDIRECT_URL'}
    <div class="shop-redirect-container">
      <a href={easyPay.redirectUrl} target="_blank" class="shop-redirect-link">
        点击跳转至{easyPay?.type === 'ALIPAY' ? '支付宝' : '微信'}
      </a>
      <p class="shop-redirect-tip">点击链接后将在新窗口打开支付页面</p>
    </div>
  {:else}
    <div>暂无支付信息，请联系管理员</div>
  {/if}
{:else}
  <div>暂无支付信息，请联系管理员</div>
{/if}
