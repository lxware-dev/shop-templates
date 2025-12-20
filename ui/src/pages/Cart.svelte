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
  <!-- 页面头部 -->
  <div class="shop-entry__header">
    <h1 class="shop-entry__title">购物车</h1>
    <p class="shop-entry__subtitle">共 {query.data?.length ?? 0} 件商品</p>
  </div>

  <!-- 购物车内容 -->
  <div class="shop-cart">
    <!-- 购物车列表 -->
    {#if query.isLoading}
      <span>加载中...</span>
    {:else if query.isError}
      <span>加载错误：{query.error.message}</span>
    {:else if query.data?.length === 0}
      <span>购物车为空</span>
    {:else}
      <div class="shop-cart__items" transition:fade={{ duration: 200 }}>
        {#each query.data ?? [] as item}
          <CartItem {item} {queryClient} />
        {/each}
      </div>
    {/if}

    <!-- 结算区域 -->
    <div class="shop-cart-summary shop-card">
      <h2 class="shop-card__title">订单摘要</h2>
      <div class="shop-cart-summary__row">
        <span>商品总计</span>
        <span>{formatPrice(total || 0)}</span>
      </div>
      <div class="shop-cart-summary__row">
        <span>运费</span>
        <span>待计算</span>
      </div>
      <div class="shop-divider"></div>
      <div class="shop-cart-summary__row shop-cart-summary__row--total">
        <span>总计</span>
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
            前往结算
          </button>
        </form>
        <a href="/shop/products" class="shop-btn shop-btn-secondary shop-btn-lg">继续购物</a>
      </div>
    </div>
  </div>
</div>
