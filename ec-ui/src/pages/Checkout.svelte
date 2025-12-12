<svelte:options
  customElement={{
    tag: 'ec-page-checkout',
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

  let { contextId, csrfToken }: { contextId: string; csrfToken: string } = $props();

  const queryClient = new QueryClient();

  const addressQuery = createQuery(
    () => ({
      queryKey: ['ec:user:addresses'],
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
      queryKey: ['ec:checkout:context', contextId],
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

<div class="ec-shop">
  <div class="ec-shop__header">
    <h1 class="ec-shop__title">结算</h1>
  </div>

  <form action={`/shop/checkout/${contextId}/submit`} method="POST" class="ec-checkout">
    <input type="hidden" name="_csrf" value={csrfToken} />
    <input type="hidden" name="saveAsNewAddress" value={!selectedAddressId} />

    {#each contextQuery.data?.items as item, index}
      <input type="hidden" name="items[{index}].productVariantId" value={item.productVariant?.id} />
      <input type="hidden" name="items[{index}].quantity" value={item.quantity} />
      <!-- TODO: 选择配送方式 -->
      <!-- <input type="hidden" name="items[{index}].selectedShippingRateId" value=0 /> -->
    {/each}

    <div class="ec-checkout__form">
      <div class="ec-card">
        <h2 class="ec-card__title">收货地址</h2>
        {#if addressQuery.isLoading}
          加载中...
        {:else}
          <div class="ec-address-form" in:fade={{ duration: 200 }}>
            <div class="ec-form-group">
              <label class="ec-label" for="address-selector">选择收货地址</label>
              <select
                class="ec-select"
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
              <div class="ec-checkout__form-row">
                <div class="ec-form-group">
                  <label class="ec-label" for="lastName">姓 *</label>
                  <input type="text" class="ec-input" id="lastName" name="userAddress.lastName" required />
                </div>
                <div class="ec-form-group">
                  <label class="ec-label" for="firstName">名 *</label>
                  <input type="text" class="ec-input" id="firstName" name="userAddress.firstName" required />
                </div>
              </div>
              <div class="ec-form-group">
                <label class="ec-label" for="contactPhone">联系电话 *</label>
                <input type="tel" class="ec-input" id="contactPhone" name="userAddress.contactPhone" required />
              </div>
              <div class="ec-checkout__form-row">
                <div class="ec-form-group">
                  <label class="ec-label" for="province">省份 *</label>
                  <input
                    type="text"
                    class="ec-input"
                    id="province"
                    name="userAddress.province"
                    required
                    placeholder="如：广东省"
                  />
                </div>
                <div class="ec-form-group">
                  <label class="ec-label" for="city">城市 *</label>
                  <input
                    type="text"
                    class="ec-input"
                    id="city"
                    name="userAddress.city"
                    required
                    placeholder="如：深圳市"
                  />
                </div>
              </div>
              <div class="ec-checkout__form-row">
                <div class="ec-form-group">
                  <label class="ec-label" for="district">区县 *</label>
                  <input
                    type="text"
                    class="ec-input"
                    id="district"
                    name="userAddress.district"
                    required
                    placeholder="如：南山区"
                  />
                </div>
                <div class="ec-form-group">
                  <label class="ec-label" for="postalCode">邮编 *</label>
                  <input
                    type="text"
                    class="ec-input"
                    id="postalCode"
                    name="userAddress.postalCode"
                    required
                    placeholder="如：518000"
                  />
                </div>
              </div>
              <div class="ec-form-group">
                <label class="ec-label" for="address">详细地址 *</label>
                <textarea
                  class="ec-textarea"
                  id="address"
                  rows="3"
                  placeholder="请输入详细地址，如街道、门牌号等"
                  name="userAddress.streetAddress"
                  required
                ></textarea>
              </div>
            {/if}
          </div>
        {/if}
      </div>

      <div class="ec-card">
        <h2 class="ec-card__title">备注</h2>
        <div>
          <div class="ec-form-group">
            <textarea class="ec-textarea" name="customerNotes" id="customer-notes" rows="3"
            ></textarea>
          </div>
        </div>
      </div>
    </div>

    <div class="ec-checkout__summary">
      <div class="ec-card">
        <h2 class="ec-card__title">商品清单</h2>
        <div class="ec-order-items">
          {#each contextQuery.data?.items ?? [] as item}
            <CheckoutOrderItem {item} />
          {/each}
        </div>
      </div>

      <div class="ec-card">
        <h2 class="ec-card__title">费用汇总</h2>
        <div class="ec-order-summary">
          <div class="ec-order-summary__row">
            <span>小计</span>
            <span>{formatPrice(contextQuery.data?.calculateResult?.originalTotalAmount || 0)}</span>
          </div>
          <div class="ec-order-summary__row">
            <span>运费</span>
            <span>{formatPrice(contextQuery.data?.calculateResult?.shippingFeeAmount || 0)}</span>
          </div>
          <div class="ec-divider"></div>
          <div class="ec-order-summary__row ec-order-summary__row--total">
            <span>应付总额</span>
            <span>{formatPrice(contextQuery.data?.calculateResult?.payableAmount || 0)}</span>
          </div>
        </div>
      </div>

      <div class="ec-checkout__actions">
        <button type="submit" class="ec-btn ec-btn-primary ec-btn-lg">去支付</button>
        <a href="/shop/cart" class="ec-btn ec-btn-secondary ec-btn-lg">返回购物车</a>
      </div>
    </div>
  </form>
</div>
