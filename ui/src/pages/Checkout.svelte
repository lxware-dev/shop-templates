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
  import { createQuery, QueryClient } from '@tanstack/svelte-query';
  import ky from 'ky';
  import { type CheckoutContextResponse, type UserAddressResponse } from '@halo-dev/api-client';
  import { formatPrice } from '../utils/price';
  import { fade } from 'svelte/transition';
  import CheckoutOrderItem from './components/CheckoutOrderItem.svelte';
  import AddressForm from './components/AddressForm.svelte';

  let { contextId, csrfToken }: { contextId: string; csrfToken: string } = $props();

  const queryClient = new QueryClient();

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

  $effect(() => {
    if (addressQuery.isFetched) {
      const addresses = addressQuery.data ?? [];
      const defaultAddress = addresses.find((address) => address.isDefault);
      selectedAddressId = defaultAddress?.id || addresses[0]?.id;
    }
  });

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
</script>

<div class="shop-entry">
  <div class="shop-entry__header">
    <h1 class="shop-entry__title">结算</h1>
  </div>

  <form action={`/shop/checkout/${contextId}/submit`} method="POST" class="shop-checkout">
    <input type="hidden" name="_csrf" value={csrfToken} />
    <input type="hidden" name="saveAsNewAddress" value={!selectedAddressId} />

    {#each contextQuery.data?.items as item, index}
      <input type="hidden" name="items[{index}].productVariantId" value={item.productVariant?.id} />
      <input type="hidden" name="items[{index}].quantity" value={item.quantity} />
      <!-- TODO: 选择配送方式 -->
      <!-- <input type="hidden" name="items[{index}].selectedShippingRateId" value=0 /> -->
    {/each}

    <div class="shop-checkout__form">
      <div class="shop-card">
        <h2 class="shop-card__title">收货地址</h2>
        {#if addressQuery.isLoading}
          加载中...
        {:else}
          <div class="shop-address-form" in:fade={{ duration: 200 }}>
            <div class="shop-form-group">
              <label class="shop-label" for="address-selector">选择收货地址</label>
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
                      .join('')}{address.isDefault ? ' (默认)' : ''}
                  </option>
                {/each}
                <option value="">填写新地址</option>
              </select>
            </div>
            {#if !selectedAddressId}
              <AddressForm />
            {/if}
          </div>
        {/if}
      </div>

      <div class="shop-card">
        <h2 class="shop-card__title">备注</h2>
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
        <h2 class="shop-card__title">商品清单</h2>
        <div class="shop-order-items">
          {#each contextQuery.data?.items ?? [] as item}
            <CheckoutOrderItem {item} />
          {/each}
        </div>
      </div>

      <div class="shop-card">
        <h2 class="shop-card__title">费用汇总</h2>
        <div class="shop-order-summary">
          <div class="shop-order-summary__row">
            <span>小计</span>
            <span>{formatPrice(contextQuery.data?.calculateResult?.originalTotalAmount || 0)}</span>
          </div>
          <div class="shop-order-summary__row">
            <span>运费</span>
            <span>{formatPrice(contextQuery.data?.calculateResult?.shippingFeeAmount || 0)}</span>
          </div>
          <div class="shop-divider"></div>
          <div class="shop-order-summary__row shop-order-summary__row--total">
            <span>应付总额</span>
            <span>{formatPrice(contextQuery.data?.calculateResult?.payableAmount || 0)}</span>
          </div>
        </div>
      </div>

      <div class="shop-checkout__actions">
        <button type="submit" class="shop-btn shop-btn-primary shop-btn-lg">去支付</button>
        <a href="/shop/cart" class="shop-btn shop-btn-secondary shop-btn-lg">返回购物车</a>
      </div>
    </div>
  </form>
</div>
