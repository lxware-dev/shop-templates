<svelte:options
  customElement={{
    tag: 'shop-page-payments',
    shadow: 'none',
    props: {
      orderCode: { reflect: true, type: 'String', attribute: 'ordercode' },
      csrfToken: { reflect: true, type: 'String', attribute: 'csrftoken' },
      authenticated: { reflect: true, type: 'String', attribute: 'authenticated' },
    },
  }}
/>

<script lang="ts">
  import { createQuery, QueryClient, setQueryClientContext } from '@tanstack/svelte-query';
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
    type CouponDetail,
    type CouponRejection,
  } from '@halo-dev/api-client';

  import PaymentOrderItem from './components/PaymentOrderItem.svelte';
  import { toast, Toaster } from 'svelte-sonner';
  import { get } from 'svelte/store';
  import Manual from './components/payment-methods/Manual.svelte';
  import Alipay from './components/payment-methods/Alipay.svelte';
  import PaymentQrcode from './components/payment-methods/PaymentQrcode.svelte';
  import BankTransfer from './components/payment-methods/BankTransfer.svelte';
  import WeChat from './components/payment-methods/WeChat.svelte';
  import Stripe from './components/payment-methods/Stripe.svelte';
  import EasyPay from './components/payment-methods/EasyPay.svelte';
  import i18n from '../i18n';

  let {
    orderCode,
    csrfToken,
    authenticated,
  }: { orderCode: string; csrfToken: string; authenticated?: string } = $props();

  let isAuthenticated = $derived(authenticated === 'true');
  let orderUrl = $derived(
    isAuthenticated ? `/uc/shop/orders/${orderCode}` : `/shop/order/${orderCode}`
  );
  let accessEmail = $state('');
  let accessLinkSent = $state(false);
  let accessLinkPending = $state(false);

  async function sendAccessLink() {
    accessLinkPending = true;
    try {
      await ky.post(`/shop/order/${orderCode}/access-link`, {
        json: { email: accessEmail },
        headers: {
          Accept: 'application/json',
          'X-XSRF-TOKEN': csrfToken,
        },
      });
      accessLinkSent = true;
    } catch {
      toast.error(get(i18n).t('payments.accessLinkFailed'));
    } finally {
      accessLinkPending = false;
    }
  }

  const queryClient = new QueryClient();
  setQueryClientContext(queryClient);

  const orderQuery = createQuery(
    () => ({
      queryKey: ['shop:order', orderCode],
      queryFn: async () => {
        return await ky
          .get<OrderResponse>(`/shop/order/${orderCode}`, {
            headers: { Accept: 'application/json' },
          })
          .json();
      },
    }),
    () => queryClient
  );

  let isPendingPayment = $derived(
    orderQuery.data?.paymentStatus === OrderResponsePaymentStatusEnum.Pending
  );

  // 游客订单访问令牌失效时后端返回 401/403，此时展示邮箱找回表单；其余错误视为加载失败
  let orderAccessLocked = $derived.by(() => {
    const status = (orderQuery.error as { response?: Response } | null)?.response?.status;
    return status === 401 || status === 403;
  });

  const orderDiscountAmount = $derived(orderQuery.data?.discountAmount ?? 0);

  const hasOrderDiscount = $derived(orderDiscountAmount > 0);

  const orderSubtotalAmount = $derived(
    orderQuery.data?.subtotalAmount ?? orderQuery.data?.totalAmount ?? 0
  );

  const orderShippingAmount = $derived(orderQuery.data?.shippingAmount ?? 0);

  const orderPayableAmount = $derived(
    orderQuery.data?.payableAmount ?? orderQuery.data?.totalAmount ?? 0
  );

  const orderDiscountLabel = $derived.by(() => {
    const order = orderQuery.data;
    if (!order?.discountName) return get(i18n).t('payments.discount');
    return order.discountCode
      ? `${order.discountName} (${order.discountCode})`
      : order.discountName;
  });

  const appliedCoupons = $derived(orderQuery.data?.appliedCoupons ?? []);

  // rejectedCoupons 不在 OrderResponse 契约中，后端可能随计算结果返回
  const rejectedCoupons = $derived(
    ((orderQuery.data as OrderResponse & { rejectedCoupons?: CouponRejection[] })
      ?.rejectedCoupons ?? []) as CouponRejection[]
  );

  const hasRejectedCoupons = $derived(rejectedCoupons.length > 0);

  function couponLabel(c: CouponDetail) {
    return c.couponName ?? get(i18n).t('checkout.coupons');
  }

  async function paymentInitiateError(error: unknown): Promise<Error> {
    const response = (error as { response?: Response }).response;
    if (!response || typeof response.json !== 'function') {
      return new Error(get(i18n).t('payments.loadPaymentResponseFailed'));
    }
    try {
      const body = (await response.json()) as { code?: string; detail?: string } | undefined;
      if (body?.code === 'WECHAT_PAY_REENTRY') {
        return new Error(get(i18n).t('payments.wechatPayReentry'));
      }
      if (body?.detail) {
        return new Error(body.detail);
      }
    } catch {
      // The response was not a problem document.
    }
    return new Error(get(i18n).t('payments.loadPaymentResponseFailed'));
  }

  function rejectedCouponReason(coupon: CouponRejection) {
    return (
      coupon.reasonMessage || coupon.reasonCode || get(i18n).t('checkout.couponRejectedFallback')
    );
  }

  const paymentMethodsQuery = createQuery(
    () => ({
      queryKey: ['shop:payment:methods', orderCode],
      queryFn: async () => {
        return await ky
          .get<PaymentMethodPublicResponse[]>(`/shop/order/${orderCode}/payment-methods`)
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

        // Phone browsers outside WeChat use H5. The WeChat webview cannot open an H5 link, so it
        // keeps the Native QR code for long-press. Desktop also stays on the QR code.
        const wechatH5 =
          selectedPaymentMethod?.provider === PaymentMethodPublicResponseProviderEnum.WechatPay &&
          typeof navigator !== 'undefined' &&
          /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent) &&
          !/MicroMessenger/i.test(navigator.userAgent);

        if (
          !wechatH5 &&
          (selectedPaymentMethod?.provider === PaymentMethodPublicResponseProviderEnum.WechatPay ||
            selectedPaymentMethod?.provider === PaymentMethodPublicResponseProviderEnum.EasyPay)
        ) {
          preferredResponseType = PaymentInitiateRequestPreferredResponseTypeEnum.QrcodeUrl;
        }

        try {
          return await ky
            .post<PaymentInitiateResponse>(`/shop/order/${orderCode}/initiate-payment`, {
              json: {
                paymentMethodId: selectedPaymentMethodId,
                returnUrl: window.location.href,
                preferredResponseType,
              },
              headers: { 'X-XSRF-TOKEN': csrfToken },
            })
            .json();
        } catch (error) {
          throw await paymentInitiateError(error);
        }
      },
      enabled: !!selectedPaymentMethodId,
      staleTime: 60_000,
    }),
    () => queryClient
  );

  // 轮询超时兜底：5 分钟后停止轮询并提示用户手动刷新
  const POLL_TIMEOUT_MS = 5 * 60 * 1000;
  let pollingStartedAt = $state<number | null>(null);
  let pollTimedOut = $state(false);

  $effect(() => {
    if (paymentResponseQuery.data?.sessionCode && pollingStartedAt === null) {
      pollingStartedAt = Date.now();
    }
    if (!paymentResponseQuery.data?.sessionCode) {
      pollingStartedAt = null;
      pollTimedOut = false;
    }
  });

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
            `/shop/order/${orderCode}/payment-sessions/${paymentResponseQuery.data?.sessionCode}/status`
          )
          .json();
      },
      enabled: !!paymentResponseQuery.data?.sessionCode && !pollTimedOut,
      refetchInterval: () => {
        if (pollingStartedAt !== null && Date.now() - pollingStartedAt > POLL_TIMEOUT_MS) {
          pollTimedOut = true;
          return false;
        }
        return 2000;
      },
    }),
    () => queryClient
  );

  $effect(() => {
    if (paymentStatusQuery.data === 'SUCCESS') {
      toast.success(get(i18n).t('payments.paymentSuccess'));
      setTimeout(() => {
        window.location.href = orderUrl;
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
    [PaymentInitiateResponsePaymentProviderEnum.EasyPay]: EasyPay,
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
    <h1 class="shop-entry__title">{$i18n.t('payments.title')}</h1>
    <p class="shop-entry__subtitle">{$i18n.t('payments.orderCode', { code: orderCode })}</p>
  </div>

  {#if orderQuery.isLoading}
    <div>{$i18n.t('common.loading')}</div>
  {:else if orderQuery.isError}
    {#if orderAccessLocked}
      <div class="shop-card shop-order-locked">
        <h2 class="shop-card__title">{$i18n.t('payments.accessEmail')}</h2>
        <p class="shop-tip">{$i18n.t('payments.accessEmailHelp')}</p>
        <form
          class="shop-address-form"
          onsubmit={(event) => {
            event.preventDefault();
            sendAccessLink();
          }}
        >
          <div class="shop-form-group">
            <label class="shop-label" for="access-email">{$i18n.t('payments.accessEmail')}</label>
            <input
              class="shop-input"
              id="access-email"
              type="email"
              required
              autocomplete="email"
              bind:value={accessEmail}
            />
          </div>
          <button
            type="submit"
            class="shop-btn shop-btn-primary"
            disabled={accessLinkPending || !accessEmail}
          >
            {$i18n.t('payments.sendAccessLink')}
          </button>
        </form>
        {#if accessLinkSent}
          <p class="shop-tip">{$i18n.t('payments.accessLinkSent')}</p>
        {/if}
      </div>
    {:else}
      <div class="shop-empty">
        <p class="shop-empty__title">{$i18n.t('payments.loadOrderFailed')}</p>
        <div class="shop-empty__actions">
          <button class="shop-btn shop-btn-secondary" onclick={() => orderQuery.refetch()}>
            {$i18n.t('common.retry')}
          </button>
        </div>
      </div>
    {/if}
  {:else if !isPendingPayment}
    <div>
      {$i18n.t('payments.orderNotPayablePrefix')}
      <a href={orderUrl}>{$i18n.t('common.viewOrderDetails')}</a>
      {$i18n.t('payments.orderNotPayableSuffix')}
    </div>
  {:else if orderQuery.data}
    <div class="shop-payments" transition:fade={{ duration: 200 }}>
      <div class="shop-payments__left">
        <div class="shop-card">
          <h2 class="shop-card__title">{$i18n.t('payments.selectPaymentMethod')}</h2>
          <div class="shop-payment-methods">
            {#if paymentMethodsQuery.isLoading}
              <div>{$i18n.t('common.loading')}</div>
            {:else if paymentMethodsQuery.isError}
              <div>{$i18n.t('payments.loadPaymentMethodsFailed')}</div>
            {:else if paymentMethodsQuery.data?.length === 0}
              <div>{$i18n.t('payments.noPaymentMethods')}</div>
            {:else}
              {#each paymentMethodsQuery.data ?? [] as paymentMethod (paymentMethod.id)}
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
                    {#if paymentMethod.icon}
                      <div class="shop-payment-method__icon">
                        <img src={paymentMethod.icon} alt={paymentMethod.name} />
                      </div>
                    {/if}
                    <div class="shop-payment-method__info">
                      <span class="shop-payment-method__name">{paymentMethod.name}</span>
                      <span class="shop-payment-method__desc">
                        {$i18n.t('payments.usePaymentMethod', { name: paymentMethod.name })}
                      </span>
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
          <h2 class="shop-card__title">{$i18n.t('payments.orderItems')}</h2>
          <div class="shop-order-items">
            {#each orderQuery.data.items ?? [] as item}
              <PaymentOrderItem {item} />
            {/each}
          </div>
        </div>

        <div class="shop-card">
          <h2 class="shop-card__title">{$i18n.t('payments.summaryTitle')}</h2>
          <div class="shop-order-summary">
            <div class="shop-order-summary__row">
              <span>{$i18n.t('payments.itemsSubtotal')}</span>
              <span>{formatPrice(orderSubtotalAmount)}</span>
            </div>
            <div class="shop-order-summary__row">
              <span>{$i18n.t('payments.shipping')}</span>
              <span>{formatPrice(orderShippingAmount)}</span>
            </div>
            {#if hasOrderDiscount}
              <div class="shop-order-summary__row shop-order-summary__row--discount">
                <span>{orderDiscountLabel}</span>
                <span>-{formatPrice(orderDiscountAmount)}</span>
              </div>
            {/if}
            {#each appliedCoupons as coupon (coupon.customerCouponId)}
              <div class="shop-order-summary__row shop-order-summary__row--discount">
                <span>{couponLabel(coupon)}</span>
                <span>-{formatPrice(coupon.discountAmount ?? 0)}</span>
              </div>
            {/each}
            {#if hasRejectedCoupons}
              {#each rejectedCoupons as rc (rc.customerCouponId)}
                <div class="shop-order-summary__row shop-order-summary__row--rejected">
                  <span>{rc.couponName ?? $i18n.t('checkout.coupons')}</span>
                  <span class="shop-order-summary__rejected"
                    >{$i18n.t('checkout.couponsRejected')}</span
                  >
                </div>
                <p class="shop-order-summary__rejected-reason">{rejectedCouponReason(rc)}</p>
              {/each}
            {/if}
            <div class="shop-divider"></div>
            <div class="shop-order-summary__row shop-order-summary__row--total">
              <span>{$i18n.t('payments.payableTotal')}</span>
              <span class="shop-order-summary__amount">
                {formatPrice(orderPayableAmount)}
              </span>
            </div>
          </div>
        </div>
      </div>

      <div class="shop-payments__right">
        <div class="shop-card">
          <h2 class="shop-card__title">{$i18n.t('payments.paymentTitle')}</h2>

          {#if paymentResponseQuery.isLoading}
            <div>{$i18n.t('common.loading')}</div>
          {:else if paymentResponseQuery.isError}
            <div>
              {paymentResponseQuery.error?.message || $i18n.t('payments.loadPaymentResponseFailed')}
            </div>
          {:else if paymentResponseQuery.data}
            {#if PaymentMethodComponent}
              <PaymentMethodComponent paymentResponse={paymentResponseQuery.data} />
            {:else}
              <div>{$i18n.t('payments.unsupportedPaymentMethod')}</div>
            {/if}
            {#if pollTimedOut}
              <p class="shop-tip">
                {$i18n.t('payments.pollTimeout')}
                <button
                  type="button"
                  class="shop-btn shop-btn-secondary shop-btn-sm"
                  onclick={() => {
                    pollingStartedAt = Date.now();
                    pollTimedOut = false;
                  }}
                >
                  {$i18n.t('payments.pollResume')}
                </button>
              </p>
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
                <label class="shop-label" for="outTradeNo">
                  {$i18n.t('payments.paymentTransactionNumber')}
                </label>
                <input type="text" class="shop-input" id="outTradeNo" name="outTradeNo" required />
              </div>
              <input type="hidden" name="_csrf" value={csrfToken} />
              <button type="submit" class="shop-btn shop-btn-primary shop-btn-lg">
                {$i18n.t('payments.paymentConfirmed')}
              </button>
              <a href={orderUrl} class="shop-btn shop-btn-secondary shop-btn-lg">
                {$i18n.t('common.viewOrderDetails')}
              </a>
            </form>
          {:else}
            <a href={orderUrl} class="shop-btn shop-btn-secondary shop-btn-lg">
              {$i18n.t('common.viewOrderDetails')}
            </a>
          {/if}
        </div>
      </div>
    </div>
  {/if}
</div>
