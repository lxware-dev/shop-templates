<script lang="ts">
  import type { PaymentInitiateResponse } from '@halo-dev/api-client';

  let { paymentResponse }: { paymentResponse: PaymentInitiateResponse } = $props();

  let bankTransfer = $derived(paymentResponse.payload?.payload?.bankTransfer);
</script>

{#if bankTransfer}
  <ul>
    <li>银行名称：{bankTransfer?.bankName}</li>
    <li>银行地址：{bankTransfer?.bankAddress}</li>
    <li>账户名称：{bankTransfer?.accountName}</li>
    <li>账户号码：{bankTransfer?.accountNumber}</li>
    <li>备注：{bankTransfer?.instructions}</li>
  </ul>
{:else}
  <div>暂无银行转账信息，请联系管理员</div>
{/if}
