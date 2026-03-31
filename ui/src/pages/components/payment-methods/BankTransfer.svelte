<script lang="ts">
  import type { PaymentInitiateResponse } from '@halo-dev/api-client';
  import i18n from '../../../i18n';

  let { paymentResponse }: { paymentResponse: PaymentInitiateResponse } = $props();

  let bankTransfer = $derived(paymentResponse.payload?.payload?.bankTransfer);
</script>

{#if bankTransfer}
  <ul>
    <li>{$i18n.t('paymentMethods.bankName', { value: bankTransfer?.bankName ?? '-' })}</li>
    <li>{$i18n.t('paymentMethods.bankAddress', { value: bankTransfer?.bankAddress ?? '-' })}</li>
    <li>{$i18n.t('paymentMethods.accountName', { value: bankTransfer?.accountName ?? '-' })}</li>
    <li>
      {$i18n.t('paymentMethods.accountNumber', { value: bankTransfer?.accountNumber ?? '-' })}
    </li>
    <li>{$i18n.t('paymentMethods.notes', { value: bankTransfer?.instructions ?? '-' })}</li>
  </ul>
{:else}
  <div>{$i18n.t('paymentMethods.bankTransferUnavailable')}</div>
{/if}
