<svelte:options
  customElement={{
    tag: 'shop-page-cart',
    shadow: 'none',
    props: {
      csrfToken: { reflect: true, type: 'String', attribute: 'csrftoken' },
    },
  }}
/>

<script lang="ts">
  import { type CartItemResponse } from '@halo-dev/api-client';
  import { createQuery, QueryClient } from '@tanstack/svelte-query';
  import Decimal from 'decimal.js';
  import ky from 'ky';
  import CartItem from './components/CartItem.svelte';
  import { formatPrice } from '../utils/price';
  import { Toaster } from 'svelte-sonner';
  import { fade } from 'svelte/transition';
  import i18n from '../i18n';

  let { csrfToken } = $props<{ csrfToken: string }>();

  const queryClient = new QueryClient();

  const query = createQuery(
    () => ({
      queryKey: ['shop:cart:items'],
      queryFn: async () => {
        return await ky
          .get<CartItemResponse[]>('/apis/uc.api.ecommerce.halo.run/v1alpha1/cart-items')
          .json();
      },
    }),
    () => queryClient
  );

  function calculateItemTotal(item: CartItemResponse) {
    const price = new Decimal(item.productVariant?.price || 0);
    const quantity = new Decimal(item.quantity || 1);
    return price.times(quantity).toNumber();
  }

  const total = $derived.by(() => {
    let result = new Decimal(0);
    for (const item of query.data ?? []) {
      result = result.add(calculateItemTotal(item));
    }
    return result.toNumber();
  });
</script>

<Toaster richColors position="top-center" />

<div class="shop-entry">
  <div class="shop-entry__header">
    <h1 class="shop-entry__title">{$i18n.t('cart.title')}</h1>
    <p class="shop-entry__subtitle">
      {$i18n.t('cart.subtitle', { count: query.data?.length ?? 0 })}
    </p>
  </div>

  <div class="shop-cart">
    {#if query.isLoading}
      <span>{$i18n.t('common.loading')}</span>
    {:else if query.isError}
      <span>{$i18n.t('cart.loadError', { message: query.error.message })}</span>
    {:else if query.data?.length === 0}
      <span>{$i18n.t('cart.empty')}</span>
    {:else}
      <div class="shop-cart__items" transition:fade={{ duration: 200 }}>
        {#each query.data ?? [] as item}
          <CartItem {item} {queryClient} />
        {/each}
      </div>
    {/if}

    <div class="shop-cart-summary shop-card">
      <h2 class="shop-card__title">{$i18n.t('cart.summaryTitle')}</h2>
      <div class="shop-cart-summary__row">
        <span>{$i18n.t('cart.itemsTotal')}</span>
        <span>{formatPrice(total || 0)}</span>
      </div>
      <div class="shop-cart-summary__row">
        <span>{$i18n.t('cart.shipping')}</span>
        <span>{$i18n.t('cart.pendingCalculation')}</span>
      </div>
      <div class="shop-divider"></div>
      <div class="shop-cart-summary__row shop-cart-summary__row--total">
        <span>{$i18n.t('cart.total')}</span>
        <span>{formatPrice(total || 0)}</span>
      </div>
      <div class="shop-cart-summary__actions">
        <form action="/shop/checkout/prepare" method="POST">
          <input type="hidden" name="_csrf" value={csrfToken} />
          <input type="hidden" name="source" value="CART" />
          {#each query.data ?? [] as item, index}
            <input type="hidden" name="items[{index}].cartItemId" value={item.id} />
            <input type="hidden" name="items[{index}].quantity" value={item.quantity} />
          {/each}
          <button
            class="shop-btn shop-btn-primary shop-btn-lg"
            disabled={!query.data?.length || query.isLoading || query.isFetching}
          >
            {$i18n.t('cart.proceedToCheckout')}
          </button>
        </form>
        <a href="/shop/products" class="shop-btn shop-btn-secondary shop-btn-lg">
          {$i18n.t('cart.continueShopping')}
        </a>
      </div>
    </div>
  </div>
</div>
