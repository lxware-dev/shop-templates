<svelte:options
  customElement={{
    tag: 'ec-page-payments',
    shadow: 'none',
    props: {
      orderCode: { reflect: true, type: 'String', attribute: 'ordercode' },
      csrfToken: { reflect: true, type: 'String', attribute: 'csrftoken' },
    },
  }}
/>

<script lang="ts">
  import { createQuery, QueryClient } from '@tanstack/svelte-query';
  import ky from 'ky';
  import { formatPrice } from '../utils/price';
  import { fade } from 'svelte/transition';
  import IconAlipay from '~icons/simple-icons/alipay?raw&color=#1677FF';
  import MingcuteCheckLine from '~icons/mingcute/check-line?raw';
  import {
    OrderResponsePaymentStatusEnum,
    PaymentInitiateRequestPreferredResponseTypeEnum,
    PaymentInitiateResponsePaymentProviderEnum,
    type OrderResponse,
    type PaymentInitiateResponse,
    type PaymentMethodPublicResponse,
    type PaymentSessionResponseStatusEnum,
  } from '@halo-dev/api-client';
  import PaymentOrderItem from './components/PaymentOrderItem.svelte';
  import { toast, Toaster } from 'svelte-sonner';
  import Manual from './components/payment-methods/Manual.svelte';
  import Alipay from './components/payment-methods/Alipay.svelte';

  let { orderCode, csrfToken }: { orderCode: string; csrfToken: string } = $props();

  const queryClient = new QueryClient();

  const orderQuery = createQuery(
    () => ({
      queryKey: ['ec:order', orderCode],
      queryFn: async () => {
        return await ky
          .get<OrderResponse>(`/apis/uc.api.ecommerce.halo.run/v1alpha1/orders/${orderCode}`)
          .json();
      },
    }),
    () => queryClient
  );

  let isPendingPayment = $derived(
    orderQuery.data?.paymentStatus === OrderResponsePaymentStatusEnum.Pending
  );

  const paymentMethodsQuery = createQuery(
    () => ({
      queryKey: ['ec:payment:methods', orderCode],
      queryFn: async () => {
        return await ky
          .get<
            PaymentMethodPublicResponse[]
          >(`/apis/uc.api.ecommerce.halo.run/v1alpha1/orders/${orderCode}/payment-methods`)
          .json();
      },
      enabled: isPendingPayment,
    }),
    () => queryClient
  );

  let selectedPaymentMethodId = $state<number>();

  let selectedPaymentMethod = $derived.by(() => {
    if (!selectedPaymentMethodId) {
      return undefined;
    }
    return paymentMethodsQuery.data?.find((method) => method.id === selectedPaymentMethodId);
  });

  $effect(() => {
    if (paymentMethodsQuery.isFetched) {
      selectedPaymentMethodId = paymentMethodsQuery.data?.[0]?.id;
    }
  });

  const paymentResponseQuery = createQuery(
    () => ({
      queryKey: ['ec:payment:response', orderCode, selectedPaymentMethodId],
      queryFn: async () => {
        return await ky
          .post<PaymentInitiateResponse>(
            `/apis/uc.api.ecommerce.halo.run/v1alpha1/orders/${orderCode}/initiate-payment`,
            {
              json: {
                paymentMethodId: selectedPaymentMethodId,
                returnUrl: window.location.href,
                preferredResponseType: PaymentInitiateRequestPreferredResponseTypeEnum.Form,
              },
            }
          )
          .json();
      },
      enabled: !!selectedPaymentMethodId,
    }),
    () => queryClient
  );

  const paymentStatusQuery = createQuery(
    () => ({
      queryKey: [
        'ec:payment:status',
        orderCode,
        selectedPaymentMethodId,
        paymentResponseQuery.data?.sessionCode,
      ],
      queryFn: async () => {
        return await ky
          .get<PaymentSessionResponseStatusEnum>(
            `/apis/uc.api.ecommerce.halo.run/v1alpha1/payment-sessions/${paymentResponseQuery.data?.sessionCode}/status`
          )
          .json();
      },
      enabled: !!paymentResponseQuery.data?.sessionCode,
      refetchInterval: 2000,
    }),
    () => queryClient
  );

  $effect(() => {
    if (paymentStatusQuery.data === 'SUCCESS') {
      toast.success('支付成功');
      setTimeout(() => {
        window.location.href = `/uc/store/orders/${orderCode}`;
      }, 1000);
    }
  });

  const PaymentMethodComponents = {
    [PaymentInitiateResponsePaymentProviderEnum.Manual]: Manual,
    [PaymentInitiateResponsePaymentProviderEnum.Alipay]: Alipay,
  };

  let PaymentMethodComponent = $derived(
    PaymentMethodComponents[
      paymentResponseQuery.data?.paymentProvider as keyof typeof PaymentMethodComponents
    ]
  );
</script>

<Toaster richColors position="top-center" />

<div class="ec-shop">
  <div class="ec-shop__header">
    <h1 class="ec-shop__title">支付订单</h1>
    <p class="ec-shop__subtitle">订单号：{orderCode}</p>
  </div>

  {#if orderQuery.isLoading}
    <div>加载中...</div>
  {:else if orderQuery.isError}
    <div>加载订单信息失败，请刷新重试</div>
  {:else if !isPendingPayment}
    <div>当前订单不可支付，点击<a href={`/uc/store/orders/${orderCode}`}>查看订单详情</a></div>
  {:else if orderQuery.data}
    <div class="ec-payments" transition:fade={{ duration: 200 }}>
      <div class="ec-payments__left">
        <div class="ec-card">
          <h2 class="ec-card__title">选择支付方式</h2>
          <div class="ec-payment-methods">
            {#if paymentMethodsQuery.isLoading}
              <div>加载中...</div>
            {:else if paymentMethodsQuery.isError}
              <div>加载支付方式失败，请刷新重试</div>
            {:else if paymentMethodsQuery.data?.length === 0}
              <div>暂无支付方式，请联系管理员</div>
            {:else}
              {#each paymentMethodsQuery.data ?? [] as paymentMethod}
                <label
                  class="ec-payment-method"
                  class:ec-payment-method--active={selectedPaymentMethodId === paymentMethod.id}
                >
                  <input
                    type="radio"
                    name="paymentMethod"
                    value={paymentMethod.id}
                    bind:group={selectedPaymentMethodId}
                    class="ec-payment-method__radio"
                  />
                  <div class="ec-payment-method__content">
                    <div class="ec-payment-method__icon">
                      {@html IconAlipay}
                    </div>
                    <div class="ec-payment-method__info">
                      <span class="ec-payment-method__name">{paymentMethod.name}</span>
                      <span class="ec-payment-method__desc">使用{paymentMethod.name}支付</span>
                    </div>
                    <div class="ec-payment-method__check">
                      {@html MingcuteCheckLine}
                    </div>
                  </div>
                </label>
              {/each}
            {/if}
          </div>
        </div>

        <div class="ec-card">
          <h2 class="ec-card__title">商品清单</h2>
          <div class="ec-order-items">
            {#each orderQuery.data.items ?? [] as item}
              <PaymentOrderItem {item} />
            {/each}
          </div>
        </div>

        <div class="ec-card">
          <h2 class="ec-card__title">费用汇总</h2>
          <div class="ec-order-summary">
            <div class="ec-order-summary__row">
              <span>商品小计</span>
              <span>{formatPrice(orderQuery.data.totalAmount || 0)}</span>
            </div>
            <div class="ec-order-summary__row">
              <span>运费</span>
              <span>{formatPrice(0)}</span>
            </div>
            <div class="ec-divider"></div>
            <div class="ec-order-summary__row ec-order-summary__row--total">
              <span>应付总额</span>
              <span class="ec-order-summary__amount">
                {formatPrice(orderQuery.data.totalAmount || 0)}
              </span>
            </div>
          </div>
        </div>
      </div>

      <div class="ec-payments__right">
        <div class="ec-card">
          <h2 class="ec-card__title">支付</h2>

          {#if paymentResponseQuery.isLoading}
            <div>加载中...</div>
          {:else if paymentResponseQuery.isError}
            <div>加载支付响应失败，请刷新重试</div>
          {:else if paymentResponseQuery.data}
            {#if PaymentMethodComponent}
              <PaymentMethodComponent paymentResponse={paymentResponseQuery.data} />
            {:else}
              <div>暂不支持该支付方式，请联系管理员</div>
            {/if}
          {/if}
        </div>

        <div class="ec-payments__actions">
          {#if selectedPaymentMethod}
            <a href={`/uc/store/orders/${orderCode}`} class="ec-btn ec-btn-secondary ec-btn-lg">
              查看订单详情
            </a>
          {:else}
            <form
              action={`/shop/payments/${orderCode}/pay`}
              method="POST"
              style="display: contents;"
            >
              <input type="hidden" name="_csrf" value={csrfToken} />
              <input type="hidden" name="paymentMethod" value={selectedPaymentMethod} />
              <button type="submit" class="ec-btn ec-btn-primary ec-btn-lg">
                立即支付 {formatPrice(orderQuery.data.totalAmount || 0)}
              </button>
              <a href={`/uc/store/orders/${orderCode}`} class="ec-btn ec-btn-secondary ec-btn-lg">
                查看订单详情
              </a>
            </form>
          {/if}
        </div>
      </div>
    </div>
  {/if}
</div>
