<script lang="ts">
  import type { PaymentInitiateResponse } from '@halo-dev/api-client';

  let { paymentResponse }: { paymentResponse: PaymentInitiateResponse } = $props();

  let manual = $derived(paymentResponse.payload?.payload?.manual);
</script>

{#if manual}
  <ul>
    <li>银行名称：{manual?.bankName}</li>
    <li>银行地址：{manual?.bankAddress}</li>
    <li>账户名称：{manual?.accountName}</li>
    <li>账户号码：{manual?.accountNumber}</li>
    <li>备注：{manual?.instructions}</li>
  </ul>
{:else}
  <div>暂无手动支付信息，请联系管理员</div>
{/if}
