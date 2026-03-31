<script lang="ts">
  import type { PaymentInitiateResponse } from '@halo-dev/api-client';
  import i18n from '../../../i18n';

  let { paymentResponse }: { paymentResponse: PaymentInitiateResponse } = $props();

  let responseType = $derived(paymentResponse.payload?.responseType);
  let easyPay = $derived(paymentResponse.payload?.payload?.easyPay);
</script>

{#if easyPay}
  {#if responseType === 'QRCODE_URL'}
    <div class="shop-qrcode-container">
      <div class="shop-qrcode-wrapper">
        {#if easyPay.qrCode?.url}
          <img
            src={easyPay.qrCode?.url}
            alt={$i18n.t('common.qrCodeAlt')}
            class="shop-qrcode-image"
          />
        {/if}
      </div>
      <div class="shop-qrcode-info">
        <p class="shop-qrcode-tip">
          {$i18n.t('paymentMethods.scanToPay', {
            provider:
              easyPay?.type === 'ALIPAY'
                ? $i18n.t('common.providers.alipay')
                : $i18n.t('common.providers.wechat'),
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
      <a href={easyPay.redirectUrl} target="_blank" class="shop-redirect-link">
        {$i18n.t('paymentMethods.redirectToProvider', {
          provider:
            easyPay?.type === 'ALIPAY'
              ? $i18n.t('common.providers.alipay')
              : $i18n.t('common.providers.wechat'),
        })}
      </a>
      <p class="shop-redirect-tip">{$i18n.t('common.redirectTip')}</p>
    </div>
  {:else}
    <div>{$i18n.t('paymentMethods.paymentInfoUnavailable')}</div>
  {/if}
{:else}
  <div>{$i18n.t('paymentMethods.paymentInfoUnavailable')}</div>
{/if}
