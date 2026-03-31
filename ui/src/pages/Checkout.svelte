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
  import i18n from '../i18n';

  let { contextId, csrfToken }: { contextId: string; csrfToken: string } = $props();

  const queryClient = new QueryClient();

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
</script>

<div class="shop-entry">
  <div class="shop-entry__header">
    <h1 class="shop-entry__title">{$i18n.t('checkout.title')}</h1>
  </div>

  <form action={`/shop/checkout/${contextId}/submit`} method="POST" class="shop-checkout">
    <input type="hidden" name="_csrf" value={csrfToken} />

    {#if contextQuery.data?.isShippingRequired}
      <input type="hidden" name="saveAsNewAddress" value={!selectedAddressId} />
    {/if}

    {#each contextQuery.data?.items as item, index}
      <input type="hidden" name="items[{index}].productVariantId" value={item.productVariant?.id} />
      <input type="hidden" name="items[{index}].quantity" value={item.quantity} />
      <!-- TODO: 选择配送方式 -->
      <!-- <input type="hidden" name="items[{index}].selectedShippingRateId" value=0 /> -->
    {/each}

    <div class="shop-checkout__form">
      {#if contextQuery.data?.isShippingRequired}
        <div class="shop-card">
          <h2 class="shop-card__title">{$i18n.t('checkout.shippingAddress')}</h2>
          {#if addressQuery.isLoading}
            {$i18n.t('common.loading')}
          {:else}
            <div class="shop-address-form" in:fade={{ duration: 200 }}>
              <div class="shop-form-group">
                <label class="shop-label" for="address-selector">
                  {$i18n.t('checkout.selectShippingAddress')}
                </label>
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
                        .join('')}{address.isDefault ? $i18n.t('common.defaultAddressSuffix') : ''}
                    </option>
                  {/each}
                  <option value="">{$i18n.t('checkout.fillNewAddress')}</option>
                </select>
              </div>
              {#if !selectedAddressId}
                <AddressForm />
              {/if}
            </div>
          {/if}
        </div>
      {/if}

      <div class="shop-card">
        <h2 class="shop-card__title">{$i18n.t('checkout.notes')}</h2>
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
        <h2 class="shop-card__title">{$i18n.t('checkout.orderItems')}</h2>
        <div class="shop-order-items">
          {#each contextQuery.data?.items ?? [] as item}
            <CheckoutOrderItem {item} />
          {/each}
        </div>
      </div>

      <div class="shop-card">
        <h2 class="shop-card__title">{$i18n.t('checkout.summaryTitle')}</h2>
        <div class="shop-order-summary">
          <div class="shop-order-summary__row">
            <span>{$i18n.t('checkout.subtotal')}</span>
            <span>{formatPrice(contextQuery.data?.calculateResult?.originalTotalAmount || 0)}</span>
          </div>
          <div class="shop-order-summary__row">
            <span>{$i18n.t('checkout.shipping')}</span>
            <span>{formatPrice(contextQuery.data?.calculateResult?.shippingFeeAmount || 0)}</span>
          </div>
          <div class="shop-divider"></div>
          <div class="shop-order-summary__row shop-order-summary__row--total">
            <span>{$i18n.t('checkout.payableTotal')}</span>
            <span>{formatPrice(contextQuery.data?.calculateResult?.payableAmount || 0)}</span>
          </div>
        </div>
      </div>

      <div class="shop-checkout__actions">
        <button type="submit" class="shop-btn shop-btn-primary shop-btn-lg">
          {$i18n.t('checkout.goToPay')}
        </button>
        <a href="/shop/cart" class="shop-btn shop-btn-secondary shop-btn-lg">
          {$i18n.t('checkout.backToCart')}
        </a>
      </div>
    </div>
  </form>
</div>
