<script lang="ts">
  import type { PaymentInitiateResponse } from '@halo-dev/api-client';
  import QRCode from 'qrcode';
  import i18n from '../../../i18n';

  let { paymentResponse }: { paymentResponse: PaymentInitiateResponse } = $props();

  let responseType = $derived(paymentResponse.payload?.responseType);
  let alipay = $derived(paymentResponse.payload?.payload?.alipay);
</script>

{#if alipay}
  {#if responseType === 'QRCODE_URL'}
    <div class="shop-qrcode-container">
      <div class="shop-qrcode-wrapper">
        {#await QRCode.toDataURL(alipay?.qrCode?.url!) then qrcodeUrl}
          <img src={qrcodeUrl} alt={$i18n.t('common.qrCodeAlt')} class="shop-qrcode-image" />
        {/await}
      </div>
      <div class="shop-qrcode-info">
        <p class="shop-qrcode-tip">
          {$i18n.t('paymentMethods.scanToPay', {
            provider: $i18n.t('common.providers.alipay'),
          })}
        </p>
        <div class="shop-qrcode-status">
          <div class="shop-loading-spinner"></div>
          <span>{$i18n.t('common.paymentWaiting')}</span>
        </div>
      </div>
    </div>
  {:else if responseType === 'FORM'}
    <div class="shop-qrcode-container">
      <div class="shop-qrcode-wrapper">
        <iframe
          title={$i18n.t('paymentMethods.alipayTitle')}
          srcdoc={alipay.pageRedirectionData}
          style="width: 200px; height: 205px;border: none;"
        ></iframe>
      </div>
      <div class="shop-qrcode-info">
        <p class="shop-qrcode-tip">
          {$i18n.t('paymentMethods.scanToPay', {
            provider: $i18n.t('common.providers.alipay'),
          })}
        </p>
        <div class="shop-qrcode-status">
          <div class="shop-loading-spinner"></div>
          <span>{$i18n.t('common.paymentWaiting')}</span>
        </div>
      </div>
    </div>
  {:else if responseType === 'REDIRECT_URL'}
    <div class="shop-redirect-container">
      <a href={alipay.redirectUrl} target="_blank" class="shop-redirect-link">
        {$i18n.t('paymentMethods.redirectToProvider', {
          provider: $i18n.t('common.providers.alipay'),
        })}
      </a>
      <p class="shop-redirect-tip">{$i18n.t('common.redirectTip')}</p>
    </div>
  {:else}
    <div>{$i18n.t('paymentMethods.alipayUnavailable')}</div>
  {/if}
{:else}
  <div>{$i18n.t('paymentMethods.alipayUnavailable')}</div>
{/if}
