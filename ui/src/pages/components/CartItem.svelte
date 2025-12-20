<script lang="ts">
  import { type CartItemResponse } from '@halo-dev/api-client';
  import { createMutation, useIsFetching, type QueryClient } from '@tanstack/svelte-query';
  import { getThumbnailUrl } from '../../utils/thumbnail';
  import Decimal from 'decimal.js';
  import MingcuteAddLine from '~icons/mingcute/add-line?raw';
  import MingcuteMinimizeLine from '~icons/mingcute/minimize-line?raw';
  import ky from 'ky';
  import { formatPrice } from '../../utils/price';
  import { toast } from 'svelte-sonner';

  let { item, queryClient }: { item: CartItemResponse; queryClient: QueryClient } = $props();

  let imageUrl = $derived(item.productVariant?.imageUrl || item.product?.coverImageUrl);
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

  async function handleDelete(item: CartItemResponse) {
    await ky.delete(`/apis/uc.api.ecommerce.halo.run/v1alpha1/cart-items/${item.id}`).json();
    queryClient.invalidateQueries({ queryKey: ['shop:cart:items'] });
  }

  const updateQuantityMutation = createMutation(
    () => ({
      mutationKey: ['shop:cart:items:update'],
      mutationFn: async (quantity: number) => {
        return await ky
          .put(`/apis/uc.api.ecommerce.halo.run/v1alpha1/cart-items/${item.id}`, {
            json: { quantity },
          })
          .json();
      },
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ['shop:cart:items'] });
      },
      onError: () => {
        toast.error('更新数量失败，请重试');
        queryClient.invalidateQueries({ queryKey: ['shop:cart:items'] });
      },
    }),
    () => queryClient
  );

  let fetchingCount = useIsFetching({}, queryClient);
  let isBusy = $derived(fetchingCount.current > 0 || updateQuantityMutation.isPending);

  let canIncreaseQuantity = $derived.by(() => {
    if (!item.productVariant?.trackInventory) {
      return true;
    }
    return (item.quantity || 1) < (item.productVariant?.stock || 0);
  });

  let canDecreaseQuantity = $derived.by(() => {
    return (item.quantity || 1) > 1;
  });
</script>

<div class="shop-cart-item">
  {#if imageUrl}
    <img
      src={getThumbnailUrl(imageUrl, 'M')}
      alt={item.product?.title}
      class="shop-cart-item__image"
    />
  {/if}
  <div class="shop-cart-item__info">
    <a href={`/shop/product/${item.product?.id}`} class="shop-cart-item__name">
      {item.product?.title}
    </a>
    {#if specValueText}
      <p class="shop-cart-item__variant">{specValueText}</p>
    {/if}
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
  </div>
  <div class="shop-quantity">
    <button
      class="shop-quantity__btn"
      onclick={() => updateQuantityMutation.mutate((item.quantity ?? 1) - 1)}
      disabled={isBusy || !canDecreaseQuantity}
    >
      {@html MingcuteMinimizeLine}
    </button>
    <input
      type="number"
      class="shop-quantity__input"
      value={item.quantity || 1}
      min="1"
      max={item.productVariant?.stock || 1}
      onchange={(e) =>
        updateQuantityMutation.mutate(Number((e.target as HTMLInputElement)?.value || 1))}
      disabled={isBusy}
    />
    <button
      class="shop-quantity__btn"
      onclick={() => updateQuantityMutation.mutate((item.quantity ?? 1) + 1)}
      disabled={isBusy || !canIncreaseQuantity}
    >
      {@html MingcuteAddLine}
    </button>
  </div>
  <div class="shop-cart-item__total">{formatPrice(total || 0)}</div>
  <button class="shop-cart-item__remove" onclick={() => handleDelete(item)} disabled={isBusy}>
    删除
  </button>
</div>
