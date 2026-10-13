<script lang="ts">
  import { ProductResponseProductTypeEnum, type CartItemResponse } from '@halo-dev/api-client';
  import { createMutation, getQueryClientContext, useIsFetching } from '@tanstack/svelte-query';
  import { getThumbnailUrl } from '../../utils/thumbnail';
  import Decimal from 'decimal.js';
  import MingcuteAddLine from '~icons/mingcute/add-line?raw';
  import MingcuteMinimizeLine from '~icons/mingcute/minimize-line?raw';
  import ky from 'ky';
  import { formatPrice } from '../../utils/price';
  import { toast } from 'svelte-sonner';
  import { get } from 'svelte/store';
  import i18n from '../../i18n';
  import SubscriptionLineMeta from './SubscriptionLineMeta.svelte';

  let { item, csrfToken }: { item: CartItemResponse; csrfToken: string } = $props();

  const queryClient = getQueryClientContext();

  let imageUrl = $derived(item.productVariant?.imageUrl || item.product?.coverImageUrl);
  let isSubscription = $derived(
    item.product?.productType === ProductResponseProductTypeEnum.Subscription
  );
  let isInquiry = $derived(item.productVariant?.pricingType === 'INQUIRY');
  let specValueText = $derived(
    item.productVariant?.specValues
      ?.map((specValue) => specValue.name + ': ' + specValue.value)
      .join(' / ')
  );
  let total = $derived.by(() => {
    const price = new Decimal(item.productVariant?.price || 0);
    const quantity = new Decimal(item.quantity || 1);
    return price.times(quantity).toNumber();
  });

  let deleting = $state(false);

  async function handleDelete(item: CartItemResponse) {
    if (!window.confirm(get(i18n).t('cartItem.removeConfirm'))) {
      return;
    }
    deleting = true;
    try {
      await ky.delete(`/shop/cart/items/${item.id}`, {
        headers: { 'X-XSRF-TOKEN': csrfToken },
      });
      queryClient.invalidateQueries({ queryKey: ['shop:cart:items'] });
    } catch {
      toast.error(get(i18n).t('cartItem.removeFailed'));
    } finally {
      deleting = false;
    }
  }

  const updateQuantityMutation = createMutation(
    () => ({
      mutationKey: ['shop:cart:items:update'],
      mutationFn: async (quantity: number) => {
        return await ky
          .put(`/shop/cart/items/${item.id}`, {
            json: { quantity },
            headers: { 'X-XSRF-TOKEN': csrfToken },
          })
          .json();
      },
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ['shop:cart:items'] });
      },
      onError: () => {
        toast.error(get(i18n).t('cartItem.updateQuantityFailed'));
        queryClient.invalidateQueries({ queryKey: ['shop:cart:items'] });
      },
    }),
    () => queryClient
  );

  const fetchingCount = useIsFetching({ queryKey: ['shop:cart:items'] }, queryClient);
  let isBusy = $derived(fetchingCount.current > 0 || updateQuantityMutation.isPending || deleting);

  let maxQuantity = $derived.by(() => {
    const limits: number[] = [];
    if (item.productVariant?.trackInventory) {
      limits.push(item.productVariant.stock || 0);
    }
    if (item.productVariant?.maxPerOrder && item.productVariant.maxPerOrder > 0) {
      limits.push(item.productVariant.maxPerOrder);
    }
    return limits.length > 0 ? Math.min(...limits) : Number.POSITIVE_INFINITY;
  });

  let canIncreaseQuantity = $derived.by(() => {
    return (item.quantity || 1) < maxQuantity;
  });

  let canDecreaseQuantity = $derived.by(() => {
    return (item.quantity || 1) > 1;
  });

  function handleQuantityInput(event: Event) {
    const next = Number((event.currentTarget as HTMLInputElement).value);
    if (Number.isNaN(next)) {
      return;
    }
    const clamped = Math.min(Math.max(1, next), maxQuantity);
    if (clamped !== (item.quantity || 1)) {
      updateQuantityMutation.mutate(clamped);
    }
  }
</script>

<div class="shop-cart-item" class:shop-cart-item--inquiry={isInquiry}>
  {#if imageUrl}
    <img
      src={getThumbnailUrl(imageUrl, 'M')}
      alt={item.product?.title}
      class="shop-cart-item__image"
    />
  {:else}
    <div class="shop-cart-item__image shop-cart-item__image--placeholder" aria-hidden="true">
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="1.5"
      >
        <rect x="3" y="3" width="18" height="18" rx="2"></rect>
        <circle cx="9" cy="9" r="2"></circle>
        <path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"></path>
      </svg>
    </div>
  {/if}
  <div class="shop-cart-item__info">
    <a href={`/shop/product/${item.product?.id}`} class="shop-cart-item__name">
      {item.product?.title}
    </a>
    {#if isSubscription}
      <SubscriptionLineMeta
        productId={item.product?.id}
        variantId={item.productVariant?.id}
        enabled={isSubscription}
      />
    {:else if specValueText}
      <p class="shop-cart-item__variant">{specValueText}</p>
    {/if}
    {#if isInquiry}
      <span class="shop-cart-item__inquiry-badge">{$i18n.t('cartItem.inquiryBadge')}</span>
    {:else}
      <div>
        <span class="shop-cart-item__price">
          {formatPrice(item.productVariant?.price || 0)}
        </span>
        {#if item.productVariant?.originalPrice}
          <s class="shop-cart-item__price-original">
            {formatPrice(item.productVariant?.originalPrice || 0)}
          </s>
        {/if}
      </div>
    {/if}
  </div>
  {#if !isInquiry}
    <div class="shop-quantity">
      <button
        class="shop-quantity__btn"
        aria-label={$i18n.t('cartItem.decreaseQuantity')}
        onclick={() => updateQuantityMutation.mutate((item.quantity ?? 1) - 1)}
        disabled={isBusy || !canDecreaseQuantity}
      >
        {@html MingcuteMinimizeLine}
      </button>
      <input
        type="number"
        class="shop-quantity__input"
        aria-label={$i18n.t('cartItem.quantity')}
        value={item.quantity || 1}
        min="1"
        max={Number.isFinite(maxQuantity) ? maxQuantity : undefined}
        onchange={handleQuantityInput}
        disabled={isBusy}
      />
      <button
        class="shop-quantity__btn"
        aria-label={$i18n.t('cartItem.increaseQuantity')}
        onclick={() => updateQuantityMutation.mutate((item.quantity ?? 1) + 1)}
        disabled={isBusy || !canIncreaseQuantity}
      >
        {@html MingcuteAddLine}
      </button>
    </div>
    <div class="shop-cart-item__total">{formatPrice(total || 0)}</div>
  {:else}
    <div class="shop-cart-item__inquiry-note">{$i18n.t('cartItem.inquiryNote')}</div>
  {/if}
  <button class="shop-cart-item__remove" onclick={() => handleDelete(item)} disabled={isBusy}>
    {$i18n.t('cartItem.remove')}
  </button>
</div>
