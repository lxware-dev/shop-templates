<svelte:options
  customElement={{
    tag: 'shop-page-checkout',
    shadow: 'none',
    props: {
      contextId: { reflect: true, type: 'String', attribute: 'contextid' },
      csrfToken: { reflect: true, type: 'String', attribute: 'csrftoken' },
    },
  }}
/>

<script lang="ts">
  import { createQuery, createMutation, QueryClient } from '@tanstack/svelte-query';
  import ky from 'ky';
  import {
    type CheckoutContextResponse,
    type UserAddressResponse,
    type CustomerCouponResponse,
    type ApplyCouponsRequest,
  } from '@halo-dev/api-client';
  import { formatPrice } from '../utils/price';
  import { fade } from 'svelte/transition';

  interface AppliedCoupon {
    customerCouponId?: number;
    couponName?: string;
    discountAmount?: number;
  }

  interface RejectedCoupon {
    customerCouponId?: number;
    couponName?: string;
    reasonCode?: string;
    reasonMessage?: string;
  }
  import CheckoutOrderItem from './components/CheckoutOrderItem.svelte';
  import AddressForm from './components/AddressForm.svelte';
  import { toast, Toaster } from 'svelte-sonner';
  import { get } from 'svelte/store';
  import i18n from '../i18n';

  let { contextId, csrfToken }: { contextId: string; csrfToken: string } = $props();

  const queryClient = new QueryClient();

  // Context
  const contextQuery = createQuery(
    () => ({
      queryKey: ['shop:checkout:context', contextId],
      queryFn: async () => {
        return await ky
          .get<CheckoutContextResponse>(
            `/apis/uc.api.ecommerce.halo.run/v1alpha1/checkout/${contextId}`
          )
          .json();
      },
    }),
    () => queryClient
  );

  const addressQuery = createQuery(
    () => ({
      queryKey: ['shop:user:addresses'],
      queryFn: async () => {
        return await ky
          .get<UserAddressResponse[]>('/apis/uc.api.ecommerce.halo.run/v1alpha1/user-addresses')
          .json();
      },
    }),
    () => queryClient
  );

  let selectedAddressId = $state<number | undefined>(undefined);

  let discountCodeInput = $state('');
  let discountCodeInitialized = $state(false);

  $effect(() => {
    const data = contextQuery.data as any;
    const code = data?.calculateResult?.discountCode;
    console.log('[discount-effect]', {
      isFetching: contextQuery.isFetching,
      discountCodeInitialized,
      code,
      hasData: !!data,
    });
    if (!contextQuery.isFetching && data?.calculateResult && !discountCodeInitialized) {
      discountCodeInitialized = true;
      if (code) {
        discountCodeInput = code;
      }
    }
  });

  // Coupons
  const myCouponsQuery = createQuery(
    () => ({
      queryKey: ['shop:coupons:mine'],
      queryFn: async () => {
        return await ky.get<CustomerCouponResponse[]>('/shop/coupons/mine').json();
      },
      staleTime: 30_000,
    }),
    () => queryClient
  );

  const availableCoupons = $derived(
    (myCouponsQuery.data ?? []).filter((c) => c.status === 'AVAILABLE')
  );

  let selectedCouponIds = $state<number[]>([]);
  let couponSelectionInitialized = $state(false);
  let couponError = $state('');

  const selectedHasNonCombinableCoupon = $derived(
    selectedCouponIds.some((sid) => {
      const coupon = availableCoupons.find((c) => c.id === sid);
      return coupon?.combineWithCoupons === false;
    })
  );

  $effect(() => {
    if (couponSelectionInitialized || contextQuery.isFetching) return;
    const data = contextQuery.data as any;
    if (data?.calculateResult) {
      selectedCouponIds =
        data.calculateResult.appliedCoupons?.map((c: AppliedCoupon) => c.customerCouponId!) ?? [];
      couponSelectionInitialized = true;
    }
  });

  function toggleCoupon(id: number) {
    couponError = '';
    const coupon = availableCoupons.find((c) => c.id === id);

    if (selectedCouponIds.includes(id)) {
      selectedCouponIds = selectedCouponIds.filter((i) => i !== id);
      return;
    }

    if (coupon?.combineWithCoupons === false) {
      if (selectedCouponIds.length > 0) {
        toast.info(get(i18n).t('checkout.couponSelectionReplaced'));
      }
      selectedCouponIds = [id];
      if (coupon?.combineWithOrderDiscount === false && hasDiscount) {
        couponError = get(i18n).t('checkout.couponDiscountCombinableError');
      }
      return;
    }

    if (selectedHasNonCombinableCoupon) {
      toast.info(get(i18n).t('checkout.couponSelectionReplaced'));
      selectedCouponIds = [id];
      if (coupon?.combineWithOrderDiscount === false && hasDiscount) {
        couponError = get(i18n).t('checkout.couponDiscountCombinableError');
      }
      return;
    }

    if (coupon?.combineWithOrderDiscount === false && hasDiscount) {
      couponError = get(i18n).t('checkout.couponDiscountCombinableError');
    }

    selectedCouponIds = [...selectedCouponIds, id];
  }

  function couponWillReplaceSelection(coupon: CustomerCouponResponse) {
    return (
      !selectedCouponIds.includes(coupon.id!) &&
      selectedCouponIds.length > 0 &&
      (coupon.combineWithCoupons === false || selectedHasNonCombinableCoupon)
    );
  }

  const applyCouponsMutation = createMutation(
    () => ({
      mutationFn: async (ids: number[]) => {
        const body: ApplyCouponsRequest = { customerCouponIds: ids };
        return await ky
          .put(`/apis/uc.api.ecommerce.halo.run/v1alpha1/checkout/${contextId}/coupons`, {
            json: body,
            headers: { 'X-XSRF-TOKEN': csrfToken },
          })
          .json<CheckoutContextResponse>();
      },
      onSuccess: (data, ids) => {
        const rejected = data.calculateResult?.rejectedCoupons ?? [];
        selectedCouponIds = [...ids];
        couponError = rejected.length > 0 ? get(i18n).t('checkout.couponPartialApply') : '';
        queryClient.setQueryData(['shop:checkout:context', contextId], data);
        if (rejected.length > 0) {
          toast.warning(get(i18n).t('checkout.couponPartialApply'));
        } else {
          toast.success(get(i18n).t('checkout.couponApplySuccess'));
        }
        queryClient.invalidateQueries({ queryKey: ['shop:checkout:context', contextId] });
      },
      onError: async (error) => {
        try {
          const body = await (error as any)?.response?.json();
          couponError = body?.detail || get(i18n).t('checkout.couponApplyError');
        } catch {
          couponError = get(i18n).t('checkout.couponApplyError');
        }
        toast.error(couponError);
      },
    }),
    () => queryClient
  );

  function applyCoupons() {
    applyCouponsMutation.mutate(selectedCouponIds);
  }

  const applyDiscountMutation = createMutation(
    () => ({
      mutationFn: async (code: string) => {
        return await ky
          .post(`/shop/checkout/${contextId}/discount`, {
            json: { code },
            headers: { 'X-XSRF-TOKEN': csrfToken },
          })
          .json();
      },
      onSuccess: () => {
        toast.success(get(i18n).t('checkout.discountApplySuccess'));
        discountCodeInput = '';
        queryClient.invalidateQueries({ queryKey: ['shop:checkout:context', contextId] });
      },
      onError: () => {
        toast.error(get(i18n).t('checkout.discountApplyError'));
      },
    }),
    () => queryClient
  );

  const removeDiscountMutation = createMutation(
    () => ({
      mutationFn: async () => {
        return await ky
          .delete(`/shop/checkout/${contextId}/discount`, {
            headers: { 'X-XSRF-TOKEN': csrfToken },
          })
          .json();
      },
      onSuccess: () => {
        toast.success(get(i18n).t('checkout.discountRemoveSuccess'));
        queryClient.invalidateQueries({ queryKey: ['shop:checkout:context', contextId] });
      },
    }),
    () => queryClient
  );

  function applyDiscount() {
    const code = discountCodeInput.trim();
    if (!code) return;
    applyDiscountMutation.mutate(code);
  }

  function handleDiscountCodeKeydown(event: KeyboardEvent) {
    if (event.key !== 'Enter') return;
    event.preventDefault();
    applyDiscount();
  }

  function removeDiscount() {
    removeDiscountMutation.mutate(undefined);
    discountCodeInput = '';
    discountCodeInitialized = false;
  }

  const hasDiscount = $derived(
    ((contextQuery.data as any)?.calculateResult?.discountAmount ?? 0) > 0
  );

  const discountLabel = $derived.by(() => {
    const result = (contextQuery.data as any)?.calculateResult;
    if (!result?.discountName) return get(i18n).t('payments.discount');
    return result.discountCode
      ? `${result.discountName} (${result.discountCode})`
      : result.discountName;
  });

  const appliedCoupons = $derived(
    ((contextQuery.data as any)?.calculateResult?.appliedCoupons ?? []) as AppliedCoupon[]
  );

  const rejectedCoupons = $derived(
    ((contextQuery.data as any)?.calculateResult?.rejectedCoupons ?? []) as RejectedCoupon[]
  );

  const hasCoupons = $derived(appliedCoupons.length > 0);

  const rejectedCouponMap = $derived(
    new Map<number, RejectedCoupon>(rejectedCoupons.map((rc) => [rc.customerCouponId!, rc]))
  );

  const hasCouponChanges = $derived.by(() => {
    const appliedIds = new Set(appliedCoupons.map((c: AppliedCoupon) => c.customerCouponId!));
    const selectedSet = new Set(selectedCouponIds);
    return (
      appliedIds.size !== selectedSet.size || [...appliedIds].some((id) => !selectedSet.has(id))
    );
  });

  function couponLabel(c: AppliedCoupon) {
    return c.couponName ?? get(i18n).t('checkout.coupons');
  }

  function couponDescription(coupon: CustomerCouponResponse) {
    const parts: string[] = [];

    if (coupon.calculationType === 'AMOUNT') {
      parts.push(
        get(i18n).t('checkout.couponAmountOff', {
          amount: formatPrice(coupon.discountValue ?? 0),
        })
      );
    } else if (coupon.calculationType === 'PERCENTAGE') {
      const percentage = get(i18n).t('checkout.couponPercentageOff', {
        value: coupon.discountValue ?? 0,
      });
      parts.push(
        coupon.maxDiscountAmount
          ? `${percentage} (${get(i18n).t('checkout.couponMaxDiscount', {
              amount: formatPrice(coupon.maxDiscountAmount),
            })})`
          : percentage
      );
    }

    if (coupon.minOrderAmount) {
      parts.push(
        get(i18n).t('checkout.couponMinOrder', {
          amount: formatPrice(coupon.minOrderAmount),
        })
      );
    }

    return parts.join(' · ');
  }

  function formatCouponDate(value: string, locale?: string) {
    return new Intl.DateTimeFormat(locale || undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    }).format(new Date(value));
  }

  function rejectedCouponReason(coupon: RejectedCoupon) {
    return (
      coupon.reasonMessage || coupon.reasonCode || get(i18n).t('checkout.couponRejectedFallback')
    );
  }

  $effect(() => {
    if (addressQuery.isFetched) {
      const addresses = addressQuery.data ?? [];
      const defaultAddress = addresses.find((address) => address.isDefault);
      selectedAddressId = defaultAddress?.id || addresses[0]?.id;
    }
  });
</script>

<Toaster richColors position="top-center" />

<div class="shop-entry">
  <div class="shop-entry__header">
    <h1 class="shop-entry__title">{$i18n.t('checkout.title')}</h1>
  </div>

  <form action={`/shop/checkout/${contextId}/submit`} method="POST" class="shop-checkout">
    <input type="hidden" name="_csrf" value={csrfToken} />

    {#if contextQuery.data?.isShippingRequired}
      <input type="hidden" name="saveAsNewAddress" value={!selectedAddressId} />
    {/if}

    {#each contextQuery.data?.items as item, index}
      <input type="hidden" name="items[{index}].productVariantId" value={item.productVariant?.id} />
      <input type="hidden" name="items[{index}].quantity" value={item.quantity} />
      <!-- TODO: 选择配送方式 -->
      <!-- <input type="hidden" name="items[{index}].selectedShippingRateId" value=0 /> -->
    {/each}

    <div class="shop-checkout__form">
      {#if contextQuery.data?.isShippingRequired}
        <div class="shop-card">
          <h2 class="shop-card__title">{$i18n.t('checkout.shippingAddress')}</h2>
          {#if addressQuery.isLoading}
            {$i18n.t('common.loading')}
          {:else}
            <div class="shop-address-form" in:fade={{ duration: 200 }}>
              <div class="shop-form-group">
                <label class="shop-label" for="address-selector">
                  {$i18n.t('checkout.selectShippingAddress')}
                </label>
                <select
                  class="shop-select"
                  id="address-selector"
                  name="selectedAddressId"
                  bind:value={selectedAddressId}
                >
                  {#each addressQuery.data ?? [] as address (address.id)}
                    <option value={address.id}>
                      {[address.lastName, address.firstName].filter(Boolean).join(' ')}
                      {address.contactPhone}
                      {[address.province, address.city, address.district, address.streetAddress]
                        .filter(Boolean)
                        .join('')}{address.isDefault ? $i18n.t('common.defaultAddressSuffix') : ''}
                    </option>
                  {/each}
                  <option value="">{$i18n.t('checkout.fillNewAddress')}</option>
                </select>
              </div>
              {#if !selectedAddressId}
                <AddressForm />
              {/if}
            </div>
          {/if}
        </div>
      {/if}

      <div class="shop-card shop-checkout-discount-card">
        <h2 class="shop-card__title">{$i18n.t('checkout.discountCode')}</h2>
        <div class="shop-checkout-discount-card__controls">
          <input
            class="shop-input"
            type="text"
            bind:value={discountCodeInput}
            placeholder={$i18n.t('checkout.discountCodePlaceholder')}
            aria-label={$i18n.t('checkout.discountCode')}
            name="discountCode"
            autocomplete="off"
            spellcheck="false"
            onkeydown={handleDiscountCodeKeydown}
          />
          <button
            type="button"
            class="shop-btn shop-btn-secondary"
            disabled={applyDiscountMutation.isPending || !discountCodeInput.trim()}
            onclick={applyDiscount}
          >
            {#if applyDiscountMutation.isPending}
              <span class="shop-loading-spinner"></span>
            {:else}
              {$i18n.t('checkout.apply')}
            {/if}
          </button>
          {#if hasDiscount}
            <button
              type="button"
              class="shop-btn shop-btn-secondary"
              disabled={removeDiscountMutation.isPending}
              onclick={removeDiscount}
            >
              {#if removeDiscountMutation.isPending}
                <span class="shop-loading-spinner"></span>
              {:else}
                {$i18n.t('checkout.remove')}
              {/if}
            </button>
          {/if}
        </div>
        <p class="shop-checkout-discount-card__tip">{$i18n.t('checkout.discountTip')}</p>
      </div>

      <div class="shop-card shop-checkout-discount-card">
        <h2 class="shop-card__title">{$i18n.t('checkout.coupons')}</h2>
        {#if myCouponsQuery.isLoading}
          <p class="shop-checkout-discount-card__state">{$i18n.t('common.loading')}</p>
        {:else if myCouponsQuery.isError}
          <p class="shop-checkout-discount-card__error shop-checkout-discount-card__state">
            {$i18n.t('checkout.couponLoadError')}
          </p>
          <div class="shop-checkout-discount-card__actions">
            <button
              type="button"
              class="shop-btn shop-btn-secondary"
              onclick={() => myCouponsQuery.refetch()}
            >
              {$i18n.t('checkout.retryCoupons')}
            </button>
          </div>
        {:else if availableCoupons.length === 0}
          <p class="shop-checkout-discount-card__tip">
            {hasCoupons ? $i18n.t('checkout.couponsAppliedOnly') : $i18n.t('checkout.couponsEmpty')}
          </p>
        {:else}
          <div class="shop-coupon-list">
            {#each availableCoupons as coupon (coupon.id)}
              {@const isNonCombinable = coupon.combineWithCoupons === false}
              {@const isNonCombinableWithDiscount = coupon.combineWithOrderDiscount === false}
              {@const couponRejection = rejectedCouponMap.get(coupon.id!)}
              {@const willReplaceSelection = couponWillReplaceSelection(coupon)}
              <label
                class="shop-coupon-item"
                class:shop-coupon-item--selected={selectedCouponIds.includes(coupon.id!)}
                class:shop-coupon-item--non-combinable={isNonCombinable}
                class:shop-coupon-item--rejected={!!couponRejection}
              >
                <input
                  type="checkbox"
                  class="shop-coupon-item__checkbox"
                  checked={selectedCouponIds.includes(coupon.id!)}
                  onchange={() => toggleCoupon(coupon.id!)}
                />
                <div class="shop-coupon-item__info">
                  <span class="shop-coupon-item__name">
                    {coupon.couponName}
                    {#if isNonCombinable}
                      <span class="shop-coupon-item__tag shop-coupon-item__tag--warn">
                        {$i18n.t('checkout.couponNotCombinableLabel')}
                      </span>
                    {/if}
                    {#if isNonCombinableWithDiscount}
                      <span class="shop-coupon-item__tag shop-coupon-item__tag--warn">
                        {$i18n.t('checkout.couponNotCombinableWithDiscountLabel')}
                      </span>
                    {/if}
                  </span>
                  {#if couponDescription(coupon)}
                    <span class="shop-coupon-item__desc">{couponDescription(coupon)}</span>
                  {/if}
                  {#if coupon.expiresAt}
                    <span class="shop-coupon-item__expires">
                      {$i18n.t('checkout.couponExpiresAt', {
                        date: formatCouponDate(coupon.expiresAt, $i18n.language),
                      })}
                    </span>
                  {/if}
                  {#if willReplaceSelection}
                    <span class="shop-coupon-item__notice">
                      {$i18n.t('checkout.couponSelectionWillReplace')}
                    </span>
                  {/if}
                  {#if couponRejection}
                    <span class="shop-coupon-item__error">
                      {rejectedCouponReason(couponRejection)}
                    </span>
                  {/if}
                </div>
              </label>
            {/each}
          </div>
          {#if couponError}
            <p class="shop-checkout-discount-card__error">{couponError}</p>
          {/if}
          <div class="shop-checkout-discount-card__actions">
            <button
              type="button"
              class="shop-btn shop-btn-secondary"
              disabled={applyCouponsMutation.isPending || !hasCouponChanges}
              onclick={applyCoupons}
            >
              {#if applyCouponsMutation.isPending}
                <span class="shop-loading-spinner"></span>
              {:else}
                {$i18n.t('checkout.apply')}
              {/if}
            </button>
          </div>
        {/if}
      </div>

      <div class="shop-card">
        <h2 class="shop-card__title">{$i18n.t('checkout.notes')}</h2>
        <div>
          <div class="shop-form-group">
            <textarea class="shop-textarea" name="customerNotes" id="customer-notes" rows="3"
            ></textarea>
          </div>
        </div>
      </div>
    </div>

    <div class="shop-checkout__summary">
      <div class="shop-card">
        <h2 class="shop-card__title">{$i18n.t('checkout.orderItems')}</h2>
        <div class="shop-order-items">
          {#each contextQuery.data?.items ?? [] as item}
            <CheckoutOrderItem {item} />
          {/each}
        </div>
      </div>

      <div class="shop-card">
        <h2 class="shop-card__title">{$i18n.t('checkout.summaryTitle')}</h2>
        <div class="shop-order-summary">
          <div class="shop-order-summary__row">
            <span>{$i18n.t('checkout.subtotal')}</span>
            <span>{formatPrice(contextQuery.data?.calculateResult?.originalTotalAmount || 0)}</span>
          </div>
          <div class="shop-order-summary__row">
            <span>{$i18n.t('checkout.shipping')}</span>
            <span>{formatPrice(contextQuery.data?.calculateResult?.shippingFeeAmount || 0)}</span>
          </div>
          {#if hasDiscount}
            <div class="shop-order-summary__row shop-order-summary__row--discount">
              <span>{discountLabel}</span>
              <span
                >-{formatPrice(
                  (contextQuery.data as any)?.calculateResult?.discountAmount || 0
                )}</span
              >
            </div>
          {/if}
          {#each appliedCoupons as coupon (coupon.customerCouponId)}
            <div class="shop-order-summary__row shop-order-summary__row--discount">
              <span>{couponLabel(coupon)}</span>
              <span>-{formatPrice(coupon.discountAmount ?? 0)}</span>
            </div>
          {/each}
          <div class="shop-divider"></div>
          <div class="shop-order-summary__row shop-order-summary__row--total">
            <span>{$i18n.t('checkout.payableTotal')}</span>
            <span>{formatPrice(contextQuery.data?.calculateResult?.payableAmount || 0)}</span>
          </div>
        </div>
      </div>

      <div class="shop-checkout__actions">
        <button type="submit" class="shop-btn shop-btn-primary shop-btn-lg">
          {$i18n.t('checkout.goToPay')}
        </button>
        <a href="/shop/cart" class="shop-btn shop-btn-secondary shop-btn-lg">
          {$i18n.t('checkout.backToCart')}
        </a>
      </div>
    </div>
  </form>
</div>
