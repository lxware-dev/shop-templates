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
  import { createQuery, QueryClient, setQueryClientContext } from '@tanstack/svelte-query';
  import Decimal from 'decimal.js';
  import ky from 'ky';
  import CartItem from './components/CartItem.svelte';
  import { formatPrice } from '../utils/price';
  import { Toaster } from 'svelte-sonner';
  import { fade } from 'svelte/transition';
  import i18n from '../i18n';

  let { csrfToken } = $props<{ csrfToken: string }>();

  const queryClient = new QueryClient();
  setQueryClientContext(queryClient);

  const query = createQuery(
    () => ({
      queryKey: ['shop:cart:items'],
      queryFn: async () => {
        return await ky.get<CartItemResponse[]>('/shop/cart/items').json();
      },
    }),
    () => queryClient
  );

  function isCheckoutable(item: CartItemResponse) {
    return item.productVariant?.pricingType !== 'INQUIRY';
  }

  const checkoutableItems = $derived((query.data ?? []).filter(isCheckoutable));
  const excludedCount = $derived((query.data ?? []).length - checkoutableItems.length);

  function calculateItemTotal(item: CartItemResponse) {
    const price = new Decimal(item.productVariant?.price || 0);
    const quantity = new Decimal(item.quantity || 1);
    return price.times(quantity).toNumber();
  }

  const total = $derived.by(() => {
    let result = new Decimal(0);
    for (const item of checkoutableItems) {
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

  {#if query.isLoading}
    <div class="shop-empty">
      <span>{$i18n.t('common.loading')}</span>
    </div>
  {:else if query.isError}
    <div class="shop-empty">
      <p class="shop-empty__title">{$i18n.t('cart.loadFailed')}</p>
      <div class="shop-empty__actions">
        <button class="shop-btn shop-btn-secondary" onclick={() => query.refetch()}>
          {$i18n.t('common.retry')}
        </button>
      </div>
    </div>
  {:else if query.data?.length === 0}
    <div class="shop-empty">
      <div class="shop-empty__icon">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="1.5"
          stroke-linecap="round"
          stroke-linejoin="round"
          aria-hidden="true"
        >
          <circle cx="8" cy="21" r="1"></circle>
          <circle cx="19" cy="21" r="1"></circle>
          <path d="M2.05 2.05h2l2.66 12.42a2 2 0 0 0 2 1.58h9.78a2 2 0 0 0 1.95-1.57l1.65-7.43H5.12"
          ></path>
        </svg>
      </div>
      <p class="shop-empty__title">{$i18n.t('cart.emptyTitle')}</p>
      <p class="shop-empty__desc">{$i18n.t('cart.emptyDesc')}</p>
      <div class="shop-empty__actions">
        <a href="/shop/products" class="shop-btn shop-btn-primary">
          {$i18n.t('cart.emptyAction')}
        </a>
      </div>
    </div>
  {:else}
    <div class="shop-cart">
      <div class="shop-cart__items" transition:fade={{ duration: 200 }}>
        {#each query.data ?? [] as item (item.id)}
          <CartItem {item} {csrfToken} />
        {/each}
      </div>

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
        {#if excludedCount > 0}
          <p class="shop-cart-summary__hint">
            {$i18n.t('cart.inquiryExcluded', { count: excludedCount })}
          </p>
        {/if}
        <div class="shop-cart-summary__actions">
          <form action="/shop/checkout/prepare" method="POST">
            <input type="hidden" name="_csrf" value={csrfToken} />
            <input type="hidden" name="source" value="CART" />
            {#each checkoutableItems as item, index (item.id)}
              <input type="hidden" name="items[{index}].cartItemId" value={item.id} />
              <input type="hidden" name="items[{index}].quantity" value={item.quantity} />
            {/each}
            <button
              class="shop-btn shop-btn-primary shop-btn-lg"
              disabled={!checkoutableItems.length || query.isLoading || query.isFetching}
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
  {/if}
</div>
