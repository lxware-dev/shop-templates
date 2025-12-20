<script lang="ts">
  import { fade } from 'svelte/transition';
  import { getThumbnailUrl } from '../../utils/thumbnail';
  import { type OrderItemResponse } from '@halo-dev/api-client';
  import { formatPrice } from '../../utils/price';
  import Decimal from 'decimal.js';

  let { item }: { item: OrderItemResponse } = $props();

  let specValueText = $derived(
    item.productVariantSnapshot?.specValues
      ?.map((specValue) => specValue.name + ': ' + specValue.value)
      .join(' / ')
  );
  let total = $derived.by(() => {
    const price = new Decimal(item.unitPrice || 0);
    const quantity = new Decimal(item.quantity || 1);
    return price.times(quantity).toNumber();
  });
</script>

<div class="ec-order-item" in:fade={{ duration: 200 }}>
  {#if item.itemImageUrl}
    <img
      src={getThumbnailUrl(item.itemImageUrl, 'M')}
      alt={item.itemTitle}
      class="ec-order-item__image"
    />
  {/if}
  <div class="ec-order-item__info">
    <a href={`/shop/product/${item.productId}`} target="_blank" class="ec-order-item__name">
      {item.itemTitle}
    </a>
    {#if specValueText}
      <span class="ec-order-item__variant">{specValueText}</span>
    {/if}
    <span class="ec-order-item__quantity">x {item.quantity || 1}</span>
  </div>
  <span class="ec-order-item__price">
    {formatPrice(total)}
  </span>
</div>
