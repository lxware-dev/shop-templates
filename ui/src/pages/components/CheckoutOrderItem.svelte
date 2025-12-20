<script lang="ts">
  import { fade } from 'svelte/transition';
  import { getThumbnailUrl } from '../../utils/thumbnail';
  import { type CheckoutItemResponse } from '@halo-dev/api-client';
  import { formatPrice } from '../../utils/price';
  import Decimal from 'decimal.js';

  let { item }: { item: CheckoutItemResponse } = $props();

  let imageUrl = $derived(item.productVariant?.imageUrl || item.product?.coverImageUrl);
  let specValueText = $derived(
    item.productVariant?.specValues
      ?.map((specValue) => specValue.name + ': ' + specValue.value)
      .join(' / ')
  );
  let total = $derived.by(() => {
    const price = new Decimal(item.price || 0);
    const quantity = new Decimal(item.quantity || 1);
    return price.times(quantity).toNumber();
  });
</script>

<div class="shop-order-item" in:fade={{ duration: 200 }}>
  {#if imageUrl}
    <img
      src={getThumbnailUrl(imageUrl, 'M')}
      alt={item.product?.title}
      class="shop-order-item__image"
    />
  {/if}
  <div class="shop-order-item__info">
    <a href={`/shop/product/${item.product?.id}`} target="_blank" class="shop-order-item__name">
      {item.product?.title}
    </a>
    {#if specValueText}
      <span class="shop-order-item__variant">{specValueText}</span>
    {/if}
    <span class="shop-order-item__quantity">x {item.quantity || 1}</span>
  </div>
  <span class="shop-order-item__price">
    {formatPrice(total)}
  </span>
</div>
