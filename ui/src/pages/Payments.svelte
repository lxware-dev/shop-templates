<svelte:options
  customElement={{
    tag: 'shop-page-payments',
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
  import MingcuteCheckLine from '~icons/mingcute/check-line?raw';
  import {
    OrderResponsePaymentStatusEnum,
    PaymentInitiateRequestPreferredResponseTypeEnum,
    PaymentInitiateResponsePaymentProviderEnum,
    PaymentMethodPublicResponseProviderEnum,
    type OrderResponse,
    type PaymentInitiateResponse,
    type PaymentMethodPublicResponse,
    type PaymentSessionUcResponseStatusEnum,
  } from '@halo-dev/api-client';
  import PaymentOrderItem from './components/PaymentOrderItem.svelte';
  import { toast, Toaster } from 'svelte-sonner';
  import Manual from './components/payment-methods/Manual.svelte';
  import Alipay from './components/payment-methods/Alipay.svelte';
  import PaymentQrcode from './components/payment-methods/PaymentQrcode.svelte';
  import BankTransfer from './components/payment-methods/BankTransfer.svelte';
  import WeChat from './components/payment-methods/WeChat.svelte';
  import Stripe from './components/payment-methods/Stripe.svelte';

  let { orderCode, csrfToken }: { orderCode: string; csrfToken: string } = $props();

  const queryClient = new QueryClient();

  const orderQuery = createQuery(
    () => ({
      queryKey: ['shop:order', orderCode],
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
      queryKey: ['shop:payment:methods', orderCode],
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
      queryKey: ['shop:payment:response', orderCode, selectedPaymentMethodId],
      queryFn: async () => {
        let preferredResponseType: PaymentInitiateRequestPreferredResponseTypeEnum =
          PaymentInitiateRequestPreferredResponseTypeEnum.RedirectUrl;

        if (selectedPaymentMethod?.provider === PaymentMethodPublicResponseProviderEnum.WechatPay) {
          preferredResponseType = PaymentInitiateRequestPreferredResponseTypeEnum.QrcodeUrl;
        }

        return await ky
          .post<PaymentInitiateResponse>(
            `/apis/uc.api.ecommerce.halo.run/v1alpha1/orders/${orderCode}/initiate-payment`,
            {
              json: {
                paymentMethodId: selectedPaymentMethodId,
                returnUrl: window.location.href,
                preferredResponseType,
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
        'shop:payment:status',
        orderCode,
        selectedPaymentMethodId,
        paymentResponseQuery.data?.sessionCode,
      ],
      queryFn: async () => {
        return await ky
          .get<PaymentSessionUcResponseStatusEnum>(
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
        window.location.href = `/uc/shop/orders/${orderCode}`;
      }, 1000);
    }
  });

  const PaymentMethodComponents = {
    [PaymentInitiateResponsePaymentProviderEnum.Manual]: Manual,
    [PaymentInitiateResponsePaymentProviderEnum.Alipay]: Alipay,
    [PaymentInitiateResponsePaymentProviderEnum.PaymentQrcode]: PaymentQrcode,
    [PaymentInitiateResponsePaymentProviderEnum.BankTransfer]: BankTransfer,
    [PaymentInitiateResponsePaymentProviderEnum.WechatPay]: WeChat,
    [PaymentInitiateResponsePaymentProviderEnum.Stripe]: Stripe,
  };

  let PaymentMethodComponent = $derived(
    PaymentMethodComponents[
      paymentResponseQuery.data?.paymentProvider as keyof typeof PaymentMethodComponents
    ]
  );
</script>

<Toaster richColors position="top-center" />

<div class="shop-entry">
  <div class="shop-entry__header">
    <h1 class="shop-entry__title">支付订单</h1>
    <p class="shop-entry__subtitle">订单号：{orderCode}</p>
  </div>

  {#if orderQuery.isLoading}
    <div>加载中...</div>
  {:else if orderQuery.isError}
    <div>加载订单信息失败，请刷新重试</div>
  {:else if !isPendingPayment}
    <div>当前订单不可支付，点击<a href={`/uc/shop/orders/${orderCode}`}>查看订单详情</a></div>
  {:else if orderQuery.data}
    <div class="shop-payments" transition:fade={{ duration: 200 }}>
      <div class="shop-payments__left">
        <div class="shop-card">
          <h2 class="shop-card__title">选择支付方式</h2>
          <div class="shop-payment-methods">
            {#if paymentMethodsQuery.isLoading}
              <div>加载中...</div>
            {:else if paymentMethodsQuery.isError}
              <div>加载支付方式失败，请刷新重试</div>
            {:else if paymentMethodsQuery.data?.length === 0}
              <div>暂无支付方式，请联系管理员</div>
            {:else}
              {#each paymentMethodsQuery.data ?? [] as paymentMethod}
                <label
                  class="shop-payment-method"
                  class:shop-payment-method--active={selectedPaymentMethodId === paymentMethod.id}
                >
                  <input
                    type="radio"
                    name="paymentMethod"
                    value={paymentMethod.id}
                    bind:group={selectedPaymentMethodId}
                    class="shop-payment-method__radio"
                  />
                  <div class="shop-payment-method__content">
                    {#if paymentMethod.providerIconUrl}
                      <div class="shop-payment-method__icon">
                        <img src={paymentMethod.providerIconUrl} alt={paymentMethod.name} />
                      </div>
                    {/if}
                    <div class="shop-payment-method__info">
                      <span class="shop-payment-method__name">{paymentMethod.name}</span>
                      <span class="shop-payment-method__desc">使用{paymentMethod.name}支付</span>
                    </div>
                    <div class="shop-payment-method__check">
                      {@html MingcuteCheckLine}
                    </div>
                  </div>
                </label>
              {/each}
            {/if}
          </div>
        </div>

        <div class="shop-card">
          <h2 class="shop-card__title">商品清单</h2>
          <div class="shop-order-items">
            {#each orderQuery.data.items ?? [] as item}
              <PaymentOrderItem {item} />
            {/each}
          </div>
        </div>

        <div class="shop-card">
          <h2 class="shop-card__title">费用汇总</h2>
          <div class="shop-order-summary">
            <div class="shop-order-summary__row">
              <span>商品小计</span>
              <span>{formatPrice(orderQuery.data.totalAmount || 0)}</span>
            </div>
            <div class="shop-order-summary__row">
              <span>运费</span>
              <span>{formatPrice(0)}</span>
            </div>
            <div class="shop-divider"></div>
            <div class="shop-order-summary__row shop-order-summary__row--total">
              <span>应付总额</span>
              <span class="shop-order-summary__amount">
                {formatPrice(orderQuery.data.totalAmount || 0)}
              </span>
            </div>
          </div>
        </div>
      </div>

      <div class="shop-payments__right">
        <div class="shop-card">
          <h2 class="shop-card__title">支付</h2>

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

        <div class="shop-payments__actions">
          {#if selectedPaymentMethod?.provider === 'BANK_TRANSFER' || selectedPaymentMethod?.provider === 'PAYMENT_QRCODE'}
            <form
              action={`/apis/api.ecommerce.halo.run/v1alpha1/payment-sessions/${paymentResponseQuery.data?.sessionCode}/callback`}
              method="POST"
              style="display: contents;"
            >
              <div class="shop-form-group">
                <label class="shop-label" for="outTradeNo">支付交易号 *</label>
                <input type="text" class="shop-input" id="outTradeNo" name="outTradeNo" required />
              </div>
              <input type="hidden" name="_csrf" value={csrfToken} />
              <button type="submit" class="shop-btn shop-btn-primary shop-btn-lg">
                已确认支付
              </button>
              <a
                href={`/uc/shop/orders/${orderCode}`}
                class="shop-btn shop-btn-secondary shop-btn-lg"
              >
                查看订单详情
              </a>
            </form>
          {:else}
            <a
              href={`/uc/shop/orders/${orderCode}`}
              class="shop-btn shop-btn-secondary shop-btn-lg"
            >
              查看订单详情
            </a>
          {/if}
        </div>
      </div>
    </div>
  {/if}
</div>
