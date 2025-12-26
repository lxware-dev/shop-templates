<svelte:options
  customElement={{
    tag: 'shop-buy-box',
    shadow: 'none',
    props: {
      id: { reflect: true, type: 'Number', attribute: 'id' },
      csrfToken: { reflect: true, type: 'String', attribute: 'csrftoken' },
    },
  }}
/>

<script lang="ts">
  import {
    type ProductResponse,
    type ProductVariantResponse,
    type SpecDefinitionPayload,
    type SpecValuePayload,
  } from '@halo-dev/api-client';
  import { createQuery, QueryClient } from '@tanstack/svelte-query';
  import ky from 'ky';
  import MingcuteAddLine from '~icons/mingcute/add-line?raw';
  import MingcuteMinimizeLine from '~icons/mingcute/minimize-line?raw';
  import { formatPrice } from '../utils/price';
  import { fade } from 'svelte/transition';
  import SpecButton from './SpecButton.svelte';

  let { id, csrfToken }: { id: number; csrfToken: string } = $props();

  const queryClient = new QueryClient();

  const productQuery = createQuery(
    () => ({
      queryKey: ['shop:product', id],
      queryFn: async () => {
        return await ky
          .get<ProductResponse>(
            `/apis/uc.api.ecommerce.halo.run/v1alpha1/products/${id}?includeVariants=true`
          )
          .json();
      },
    }),
    () => queryClient
  );

  let variants = $derived(productQuery.data?.productVariants || []);
  let specDefinitions = $derived(
    (productQuery.data?.specDefinition || []).filter(
      (spec: SpecDefinitionPayload) => spec.usedForSku
    )
  );

  const getInitialSelectedSpecs = (): Record<string, string> => {
    const initial: Record<string, string> = {};
    if (specDefinitions.length > 0 && variants?.length) {
      const firstAvailableVariant =
        variants.find((variant: ProductVariantResponse) => variant.stock && variant.stock > 0) ||
        variants[0];
      if (firstAvailableVariant) {
        specDefinitions.forEach((spec: SpecDefinitionPayload) => {
          const specValue = firstAvailableVariant.specValues?.find(
            (sv: SpecValuePayload) => sv.name === spec.name
          );
          if (specValue && spec.name && specValue.value) {
            initial[spec.name] = specValue.value;
          }
        });
      }
    }
    return initial;
  };

  let selectedSpecs = $state<Record<string, string>>({});
  let quantity = $state(1);

  $effect(() => {
    if (variants.length) {
      const initial = getInitialSelectedSpecs();
      if (Object.keys(initial).length > 0) {
        selectedSpecs = initial;
      }
    }
  });

  let selectedVariant = $derived(
    variants.find((variant: ProductVariantResponse) => {
      return specDefinitions.every((spec: SpecDefinitionPayload) => {
        const specValue = variant.specValues?.find((sv: SpecValuePayload) => sv.name === spec.name);
        return specValue && spec.name && specValue.value === selectedSpecs?.[spec.name];
      });
    })
  );

  let isSelectedVariantAvailable = $derived.by(() => {
    if (!selectedVariant) {
      return false;
    }
    if (!selectedVariant.trackInventory) {
      return true;
    }
    return !!selectedVariant.stock;
  });

  function isSpecValueAvailable(specName?: string, specValue?: string): boolean {
    if (!specName || !specValue) {
      return false;
    }

    const tempSelected = { ...selectedSpecs, [specName]: specValue };

    const hasAvailableVariant = variants.some((variant: ProductVariantResponse) => {
      const matches = Object.entries(tempSelected).every(([name, value]) => {
        const sv = variant.specValues?.find((s: SpecValuePayload) => s.name === name);
        return sv && sv.value === value;
      });

      if (!matches) {
        return false;
      }

      if (!variant.trackInventory) {
        return true;
      }

      return !!variant.stock;
    });

    return hasAvailableVariant;
  }

  function selectSpec(specName?: string, specValue?: string) {
    if (!specName || !specValue) {
      return;
    }

    if (selectedSpecs[specName] === specValue) {
      selectedSpecs = {};
      return;
    }

    selectedSpecs = { ...selectedSpecs, [specName]: specValue };
  }

  let canIncreaseQuantity = $derived.by(() => {
    if (!selectedVariant) {
      return false;
    }
    if (!selectedVariant.trackInventory) {
      return true;
    }
    return quantity < (selectedVariant.stock || 0);
  });

  let canDecreaseQuantity = $derived.by(() => {
    return quantity > 1;
  });

  function increaseQuantity() {
    if (canIncreaseQuantity) {
      quantity++;
    }
  }

  function decreaseQuantity() {
    if (canDecreaseQuantity) {
      quantity--;
    }
  }
</script>

{#if productQuery.isLoading}
  加载中...
{:else if productQuery.isError}
  加载失败: {productQuery.error.message}
{:else}
  <div class="buy-box" transition:fade={{ duration: 200 }}>
    <div class="buy-box__price">
      <div class="buy-box__price-label">价格</div>
      <div class="buy-box__price-value">
        {#if selectedVariant}
          {formatPrice(selectedVariant.price || 0)}
        {:else if variants.length > 0}
          {[
            formatPrice(productQuery.data?.minPrice || 0),
            formatPrice(productQuery.data?.maxPrice || 0),
          ].join(' - ')}
        {:else}
          {formatPrice(0)}
        {/if}
        {#if selectedVariant?.originalPrice}
          <del>{formatPrice(selectedVariant.originalPrice)}</del>
        {/if}
      </div>
    </div>

    {#each specDefinitions as spec}
      <div class="buy-box__spec">
        <div class="buy-box__spec-label">{spec.name}</div>
        <div class="buy-box__spec-options">
          {#each spec.values as specValueObj}
            {@const value = specValueObj.value}
            {@const imageUrl = specValueObj.imageUrl}
            {@const isSelected = !!spec.name && selectedSpecs[spec.name] === value}
            {@const isAvailable = isSpecValueAvailable(spec.name, value)}

            <SpecButton
              {isSelected}
              {isAvailable}
              {imageUrl}
              {value}
              onclick={() => selectSpec(spec.name, value)}
            ></SpecButton>
          {/each}
        </div>
      </div>
    {/each}

    {#if selectedVariant && selectedVariant.trackInventory}
      <div class="buy-box__stock">
        库存：<span class="buy-box__stock-value">{selectedVariant.stock || 0} 件</span>
      </div>
    {/if}

    <div class="buy-box__quantity">
      <span class="buy-box__quantity-label">数量</span>
      <div class="shop-quantity">
        <button class="shop-quantity__btn" onclick={decreaseQuantity} disabled={!canDecreaseQuantity}>
          {@html MingcuteMinimizeLine}
        </button>
        <input
          type="number"
          class="shop-quantity__input"
          bind:value={quantity}
          min="1"
          max={selectedVariant?.stock || 1}
        />
        <button class="shop-quantity__btn" onclick={increaseQuantity} disabled={!canIncreaseQuantity}>
          {@html MingcuteAddLine}
        </button>
      </div>
    </div>

    <div class="buy-box__actions">
      <form action={`/shop/cart?redirect_uri=${window.location.href}`} method="post">
        <input type="hidden" name="_csrf" value={csrfToken} />
        <input type="hidden" name="productVariantId" value={selectedVariant?.id} />
        <input type="hidden" name="quantity" value={quantity} />
        <button
          class="shop-btn shop-btn-primary shop-btn-lg"
          type="submit"
          disabled={!isSelectedVariantAvailable}
        >
          加入购物车
        </button>
      </form>
      <form action={`/shop/checkout/prepare?redirect_uri=${window.location.href}`} method="post">
        <input type="hidden" name="_csrf" value={csrfToken} />
        <input type="hidden" name="source" value="BUY_NOW" />
        <input type="hidden" name="items[0].productVariantId" value={selectedVariant?.id} />
        <input type="hidden" name="items[0].quantity" value={quantity} />
        <button
          class="shop-btn shop-btn-secondary shop-btn-lg"
          type="submit"
          disabled={!isSelectedVariantAvailable}
        >
          立即购买
        </button>
      </form>
    </div>
  </div>
{/if}
