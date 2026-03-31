<script lang="ts">
  import type { PaymentInitiateResponse } from '@halo-dev/api-client';
  import i18n from '../../../i18n';

  let { paymentResponse }: { paymentResponse: PaymentInitiateResponse } = $props();

  let manual = $derived(paymentResponse.payload?.payload?.manual);
</script>

{#if manual}
  <ul>
    <li>{$i18n.t('paymentMethods.bankName', { value: manual?.bankName ?? '-' })}</li>
    <li>{$i18n.t('paymentMethods.bankAddress', { value: manual?.bankAddress ?? '-' })}</li>
    <li>{$i18n.t('paymentMethods.accountName', { value: manual?.accountName ?? '-' })}</li>
    <li>{$i18n.t('paymentMethods.accountNumber', { value: manual?.accountNumber ?? '-' })}</li>
    <li>{$i18n.t('paymentMethods.notes', { value: manual?.instructions ?? '-' })}</li>
  </ul>
{:else}
  <div>{$i18n.t('paymentMethods.manualUnavailable')}</div>
{/if}
