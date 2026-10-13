<script lang="ts">
  import type { PaymentInitiateResponse } from '@halo-dev/api-client';
  import QRCode from 'qrcode';
  import i18n from '../../../i18n';

  let { paymentResponse }: { paymentResponse: PaymentInitiateResponse } = $props();

  let responseType = $derived(paymentResponse.payload?.responseType);
  let wechatPay = $derived(paymentResponse.payload?.payload?.wechatPay);
</script>

{#if wechatPay}
  {#if responseType === 'QRCODE_URL'}
    <div class="shop-qrcode-container">
      <div class="shop-qrcode-wrapper">
        {#await QRCode.toDataURL(wechatPay.nativePay?.codeUrl!) then qrcodeUrl}
          <img src={qrcodeUrl} alt={$i18n.t('common.qrCodeAlt')} class="shop-qrcode-image" />
        {/await}
      </div>
      <div class="shop-qrcode-info">
        <p class="shop-qrcode-tip">
          {$i18n.t('paymentMethods.scanToPay', {
            provider: $i18n.t('common.providers.wechat'),
          })}
        </p>
        <div class="shop-qrcode-status">
          <div class="shop-loading-spinner"></div>
          <span>{$i18n.t('common.paymentWaiting')}</span>
        </div>
      </div>
    </div>
  {:else if responseType === 'REDIRECT_URL' && wechatPay.h5?.h5Url}
    <div class="shop-redirect-container">
      <a href={wechatPay.h5.h5Url} target="_self" class="shop-redirect-link">
        {$i18n.t('paymentMethods.redirectToProvider', {
          provider: $i18n.t('common.providers.wechat'),
        })}
      </a>
      <p class="shop-redirect-tip">{$i18n.t('paymentMethods.wechatH5RedirectTip')}</p>
    </div>
  {:else}
    <div>{$i18n.t('paymentMethods.wechatUnavailable')}</div>
  {/if}
{:else}
  <div>{$i18n.t('paymentMethods.wechatUnavailable')}</div>
{/if}
