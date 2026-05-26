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
    type CouponDetail,
  } from '@halo-dev/api-client';
  import { formatPrice } from '../utils/price';
  import { fade } from 'svelte/transition';
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

  $effect(() => {
    if (couponSelectionInitialized || contextQuery.isFetching) return;
    const data = contextQuery.data as any;
    if (data?.calculateResult) {
      selectedCouponIds =
        data.calculateResult.appliedCoupons?.map((c: CouponDetail) => c.customerCouponId!) ?? [];
      couponSelectionInitialized = true;
    }
  });

  function toggleCoupon(id: number) {
    if (selectedCouponIds.includes(id)) {
      selectedCouponIds = selectedCouponIds.filter((i) => i !== id);
    } else {
      selectedCouponIds = [...selectedCouponIds, id];
    }
  }

  const applyCouponsMutation = createMutation(
    () => ({
      mutationFn: async (ids: number[]) => {
        return await ky
          .post(`/shop/checkout/${contextId}/coupons`, {
            json: { customerCouponIds: ids },
            headers: { 'X-XSRF-TOKEN': csrfToken },
          })
          .json();
      },
      onSuccess: (_, ids) => {
        selectedCouponIds = [...ids];
        toast.success(get(i18n).t('checkout.couponApplySuccess'));
        queryClient.invalidateQueries({ queryKey: ['shop:checkout:context', contextId] });
      },
      onError: () => {
        toast.error(get(i18n).t('checkout.couponApplyError'));
      },
    }),
    () => queryClient
  );

  const removeCouponMutation = createMutation(
    () => ({
      mutationFn: async (customerCouponId: number) => {
        return await ky
          .delete(`/shop/checkout/${contextId}/coupons/${customerCouponId}`, {
            headers: { 'X-XSRF-TOKEN': csrfToken },
          })
          .json();
      },
      onSuccess: () => {
        couponSelectionInitialized = false;
        toast.success(get(i18n).t('checkout.couponRemoveSuccess'));
        queryClient.invalidateQueries({ queryKey: ['shop:checkout:context', contextId] });
      },
      onError: () => {
        toast.error(get(i18n).t('checkout.couponApplyError'));
      },
    }),
    () => queryClient
  );

  function applyCoupons() {
    applyCouponsMutation.mutate(selectedCouponIds);
  }

  function removeCoupon(customerCouponId: number) {
    removeCouponMutation.mutate(customerCouponId);
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

  function removeDiscount() {
    removeDiscountMutation.mutate(undefined);
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
    ((contextQuery.data as any)?.calculateResult?.appliedCoupons ?? []) as CouponDetail[]
  );

  const couponDiscountAmount = $derived(
    ((contextQuery.data as any)?.calculateResult?.couponDiscountAmount ?? 0) as number
  );

  const hasCoupons = $derived(appliedCoupons.length > 0);

  const hasCouponChanges = $derived.by(() => {
    const appliedIds = new Set(appliedCoupons.map((c: CouponDetail) => c.customerCouponId!));
    const selectedSet = new Set(selectedCouponIds);
    return (
      appliedIds.size !== selectedSet.size || [...appliedIds].some((id) => !selectedSet.has(id))
    );
  });

  function couponLabel(c: CouponDetail) {
    return c.couponName ?? get(i18n).t('checkout.coupons');
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
            onkeydown={(e) => e.key === 'Enter' && applyDiscount()}
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

      {#if availableCoupons.length > 0 || hasCoupons}
        <div class="shop-card shop-checkout-discount-card">
          <h2 class="shop-card__title">{$i18n.t('checkout.coupons')}</h2>
          {#if myCouponsQuery.isLoading}
            <span>{$i18n.t('common.loading')}</span>
          {:else if availableCoupons.length === 0 && !hasCoupons}
            <p class="shop-checkout-discount-card__tip">{$i18n.t('checkout.couponsPlaceholder')}</p>
          {:else}
            {#if availableCoupons.length > 0}
              <div class="shop-coupon-list">
                {#each availableCoupons as coupon (coupon.id)}
                  <label
                    class="shop-coupon-item"
                    class:shop-coupon-item--selected={selectedCouponIds.includes(coupon.id!)}
                  >
                    <input
                      type="checkbox"
                      class="shop-coupon-item__checkbox"
                      checked={selectedCouponIds.includes(coupon.id!)}
                      onchange={() => toggleCoupon(coupon.id!)}
                    />
                    <div class="shop-coupon-item__info">
                      <span class="shop-coupon-item__name">{coupon.couponName}</span>
                      <span class="shop-coupon-item__desc">
                        {#if coupon.calculationType === 'AMOUNT'}
                          {formatPrice(coupon.discountValue ?? 0)} off
                        {:else if coupon.calculationType === 'PERCENTAGE'}
                          {coupon.discountValue}% off
                          {#if coupon.maxDiscountAmount}
                            (max {formatPrice(coupon.maxDiscountAmount)}){/if}
                        {/if}
                        {#if coupon.minOrderAmount}
                          · min order {formatPrice(coupon.minOrderAmount)}
                        {/if}
                      </span>
                      {#if coupon.expiresAt}
                        <span class="shop-coupon-item__expires">
                          {new Date(coupon.expiresAt).toLocaleDateString()}
                        </span>
                      {/if}
                    </div>
                  </label>
                {/each}
              </div>
            {/if}
            <div class="shop-checkout-discount-card__controls">
              {#if availableCoupons.length > 0}
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
              {/if}
              {#each appliedCoupons as coupon (coupon.customerCouponId)}
                <button
                  type="button"
                  class="shop-btn shop-btn-secondary"
                  disabled={removeCouponMutation.isPending}
                  onclick={() => removeCoupon(coupon.customerCouponId!)}
                >
                  {#if removeCouponMutation.isPending}
                    <span class="shop-loading-spinner"></span>
                  {:else}
                    {$i18n.t('checkout.remove')} {couponLabel(coupon)}
                  {/if}
                </button>
              {/each}
            </div>
          {/if}
        </div>
      {/if}

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
