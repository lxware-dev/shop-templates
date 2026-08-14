<svelte:options
  customElement={{
    tag: 'shop-buy-box',
    shadow: 'none',
    props: {
      id: { reflect: true, type: 'Number', attribute: 'id' },
      csrfToken: { reflect: true, type: 'String', attribute: 'csrftoken' },
      authenticated: { reflect: true, type: 'Boolean', attribute: 'authenticated' },
    },
  }}
/>

<script lang="ts">
  import {
    type ProductResponse,
    type ProductVariantResponse,
    type SpecDefinitionPayload,
    type SpecValuePayload,
    ProductResponseProductTypeEnum,
  } from '@halo-dev/api-client';
  import { createQuery, QueryClient } from '@tanstack/svelte-query';
  import ky from 'ky';
  import MingcuteAddLine from '~icons/mingcute/add-line?raw';
  import MingcuteMinimizeLine from '~icons/mingcute/minimize-line?raw';
  import { formatPrice } from '../utils/price';
  import { fade } from 'svelte/transition';
  import SpecButton from './SpecButton.svelte';
  import i18n from '../i18n';

  let {
    id,
    csrfToken,
    authenticated = false,
  }: { id: number; csrfToken: string; authenticated?: boolean } = $props();

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

  // Subscription plan types (inline, not in api-client yet)
  interface SubscriptionPlanResponse {
    id: number;
    name: string;
    description?: string;
    productId: number;
    productVariantId?: number;
    intervalCount: number;
    intervalUnit: 'WEEK' | 'MONTH' | 'YEAR';
    price: number;
    originalPrice?: number;
    currency: string;
    trialDays: number;
    maxBillingCycles?: number;
    setupFee?: number;
  }

  interface SubscriptionPlansPage {
    content: SubscriptionPlanResponse[];
    totalElements: number;
  }

  const plansQuery = createQuery(
    () => ({
      queryKey: ['shop:subscription-plans', id],
      queryFn: async () => {
        return await ky
          .get<SubscriptionPlansPage>(
            `/apis/uc.api.ecommerce.halo.run/v1alpha1/products/${id}/subscription-plans?size=50`
          )
          .json();
      },
    }),
    () => queryClient
  );

  interface ContactInformation {
    label: string;
    type: 'LINK' | 'IMAGE';
    icon?: string;
    linkLabel?: string;
    linkUrl?: string;
    image?: string;
    imageHref?: string;
    help?: string;
  }

  const shopConfigQuery = createQuery(
    () => ({
      queryKey: ['shop:config'],
      queryFn: async () => {
        return await ky
          .get<{
            inquiryRedirectUrl?: string;
            contacts?: ContactInformation[];
          }>('/apis/uc.api.ecommerce.halo.run/v1alpha1/ecommerceconfigs/shop')
          .json();
      },
    }),
    () => queryClient
  );

  // Fetch user's active subscriptions for the current product's plans
  interface SubscriptionResponse {
    id: number;
    subscriptionPlanId: number;
  }

  interface SubscriptionsPage {
    content: SubscriptionResponse[];
    totalElements: number;
  }

  // Build planIds query params once plans are loaded; re-fetch when plans change
  let planIdsParams = $derived(
    (plansQuery.data?.content || []).map((p) => `planIds=${p.id}`).join('&')
  );

  const mySubscriptionsQuery = createQuery(
    () => ({
      queryKey: ['shop:my-subscriptions', planIdsParams],
      queryFn: async () => {
        if (!authenticated || !planIdsParams) {
          return { content: [], totalElements: 0 } as SubscriptionsPage;
        }
        return await ky
          .get<SubscriptionsPage>(
            `/apis/uc.api.ecommerce.halo.run/v1alpha1/subscriptions?${planIdsParams}&status=ACTIVE&size=100`
          )
          .json();
      },
    }),
    () => queryClient
  );

  // Map of planId -> subscriptionId for active subscriptions
  let subscribedPlanIds = $derived(
    new Map(
      (mySubscriptionsQuery.data?.content || []).map((sub) => [sub.subscriptionPlanId, sub.id])
    )
  );

  let subscribing = $state(false);
  let subscribeError = $state('');

  async function handleSubscribe(planId: number) {
    if (!authenticated) {
      window.location.href = '/login?redirect_uri=' + encodeURIComponent(window.location.href);
      return;
    }
    subscribing = true;
    subscribeError = '';
    try {
      const subscription = await ky
        .post('/apis/uc.api.ecommerce.halo.run/v1alpha1/subscriptions', {
          json: { subscriptionPlanId: planId },
          headers: { 'X-XSRF-TOKEN': csrfToken },
        })
        .json<{ id: number }>();
      window.location.href = `/uc/shop/subscriptions/${subscription.id}`;
    } catch (err: any) {
      subscribing = false;
      try {
        const body = await err.response?.json();
        subscribeError = body?.detail || $i18n.t('subscription.subscribeError');
      } catch {
        subscribeError = $i18n.t('subscription.subscribeError');
      }
    }
  }

  function getIntervalText(count: number, unit: string): string {
    const key = `subscription.interval.${unit.toLowerCase()}`;
    return $i18n.t(key, { count });
  }

  let variants = $derived(productQuery.data?.productVariants || []);
  let specDefinitions = $derived(
    (productQuery.data?.specDefinition || []).filter(
      (spec: SpecDefinitionPayload) => spec.usedForSku
    )
  );

  let isExternal = $derived(
    productQuery.data?.productType === ProductResponseProductTypeEnum.External
  );
  let externalLinkUrl = $derived(productQuery.data?.externalLinkUrl);
  let hasExternalLink = $derived(!!externalLinkUrl && externalLinkUrl.length > 0);
  let externalLinkButtonText = $derived(productQuery.data?.externalLinkButtonText);

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

  let isInquiry = $derived(selectedVariant?.pricingType === 'INQUIRY');

  let contactSalesUrl = $derived(shopConfigQuery.data?.inquiryRedirectUrl || null);
  let contacts = $derived(shopConfigQuery.data?.contacts || []);

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

  function handleContactSales() {
    if (contactSalesUrl) {
      window.open(contactSalesUrl, '_blank');
    }
  }
</script>

{#if productQuery.isLoading}
  {$i18n.t('common.loading')}
{:else if productQuery.isError}
  {$i18n.t('buyBox.loadFailed', { message: productQuery.error.message })}
{:else}
  <div class="buy-box" transition:fade={{ duration: 200 }}>
    {#if isExternal}
      <div class="buy-box__external-hint">
        {$i18n.t('buyBox.externalRedirectHint')}
      </div>

      <div class="buy-box__actions">
        {#if hasExternalLink}
          <a
            class="shop-btn shop-btn-primary shop-btn-lg"
            href={externalLinkUrl}
            target="_blank"
            rel="noopener noreferrer"
          >
            {externalLinkButtonText || $i18n.t('buyBox.externalBuyNow')}
          </a>
        {:else}
          <button
            class="shop-btn shop-btn-primary shop-btn-lg"
            type="button"
            disabled
            aria-disabled="true"
          >
            {externalLinkButtonText || $i18n.t('buyBox.externalBuyNow')}
          </button>
        {/if}
      </div>
    {:else}
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

      {#if isInquiry}
        {#if contactSalesUrl}
          <div class="buy-box__external-hint">
            {$i18n.t('buyBox.contactSales')}
          </div>
          <div class="buy-box__actions">
            <button class="shop-btn shop-btn-primary shop-btn-lg" onclick={handleContactSales}>
              {$i18n.t('buyBox.contactSales')}
            </button>
          </div>
        {:else if contacts.length > 0}
          <div class="buy-box__contacts">
            {#each contacts as contact}
              <div class="buy-box__contact-item">
                <span class="buy-box__contact-label">
                  {#if contact.icon}
                    <iconify-icon icon={contact.icon}></iconify-icon>
                  {/if}
                  {contact.label}
                </span>
                <div class="buy-box__contact-content">
                  {#if contact.type === 'LINK' && contact.linkUrl}
                    <a
                      class="buy-box__contact-link"
                      href={contact.linkUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      {contact.linkLabel || contact.linkUrl}
                    </a>
                  {:else if contact.type === 'IMAGE' && contact.image}
                    {#if contact.imageHref}
                      <a href={contact.imageHref} target="_blank" rel="noopener noreferrer">
                        <img
                          class="buy-box__contact-image"
                          src={contact.image}
                          alt={contact.label}
                        />
                      </a>
                    {:else}
                      <img class="buy-box__contact-image" src={contact.image} alt={contact.label} />
                    {/if}
                  {/if}
                  {#if contact.help}
                    <span class="buy-box__contact-help">{contact.help}</span>
                  {/if}
                </div>
              </div>
            {/each}
          </div>
        {:else}
          <div class="buy-box__external-hint">
            {$i18n.t('buyBox.contactSales')}
          </div>
          <div class="buy-box__actions">
            <button class="shop-btn shop-btn-primary shop-btn-lg" disabled>
              {$i18n.t('buyBox.contactSales')}
            </button>
          </div>
        {/if}
      {:else}
        <div class="buy-box__price">
          <div class="buy-box__price-label">{$i18n.t('buyBox.price')}</div>
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

        {#if selectedVariant && selectedVariant.trackInventory}
          <div class="buy-box__stock">
            <span class="buy-box__stock-value">
              {$i18n.t('buyBox.stock', { count: selectedVariant.stock || 0 })}
            </span>
          </div>
        {/if}

        <div class="buy-box__quantity">
          <span class="buy-box__quantity-label">{$i18n.t('buyBox.quantity')}</span>
          <div class="shop-quantity">
            <button
              class="shop-quantity__btn"
              onclick={decreaseQuantity}
              disabled={!canDecreaseQuantity}
            >
              {@html MingcuteMinimizeLine}
            </button>
            <input
              type="number"
              class="shop-quantity__input"
              bind:value={quantity}
              min="1"
              max={selectedVariant?.stock || 1}
            />
            <button
              class="shop-quantity__btn"
              onclick={increaseQuantity}
              disabled={!canIncreaseQuantity}
            >
              {@html MingcuteAddLine}
            </button>
          </div>
        </div>

        {#if plansQuery.data?.content?.length}
          <div class="buy-box__subscription-plans">
            <div class="buy-box__subscription-plans-title">
              {$i18n.t('subscription.title')}
            </div>
            {#each plansQuery.data.content as plan}
              {@const existingSubId = subscribedPlanIds.get(plan.id)}
              <div class="buy-box__subscription-plan">
                <div class="buy-box__subscription-plan-info">
                  <div class="buy-box__subscription-plan-name">{plan.name}</div>
                  {#if plan.description}
                    <div class="buy-box__subscription-plan-desc">
                      {plan.description}
                    </div>
                  {/if}
                  <div class="buy-box__subscription-plan-meta">
                    <span>
                      {getIntervalText(plan.intervalCount, plan.intervalUnit)}
                    </span>
                    {#if plan.trialDays > 0}
                      <span class="buy-box__subscription-plan-trial">
                        {$i18n.t('subscription.trialDays', {
                          days: plan.trialDays,
                        })}
                      </span>
                    {/if}
                  </div>
                </div>
                <div class="buy-box__subscription-plan-action">
                  <div class="buy-box__subscription-plan-price">
                    <span class="buy-box__subscription-plan-price-value">
                      {formatPrice(plan.price)}
                    </span>
                    {#if plan.originalPrice}
                      <del class="buy-box__subscription-plan-price-original">
                        {formatPrice(plan.originalPrice)}
                      </del>
                    {/if}
                  </div>
                  {#if existingSubId != null}
                    <a
                      class="shop-btn shop-btn-secondary shop-btn-sm"
                      href={`/uc/shop/subscriptions/${existingSubId}`}
                    >
                      {$i18n.t('subscription.viewSubscription')}
                    </a>
                  {:else}
                    <button
                      class="shop-btn shop-btn-primary shop-btn-sm"
                      onclick={() => handleSubscribe(plan.id)}
                      disabled={subscribing}
                    >
                      {$i18n.t('subscription.subscribe')}
                    </button>
                  {/if}
                </div>
              </div>
            {/each}
            {#if subscribeError}
              <div class="buy-box__subscription-error">{subscribeError}</div>
            {/if}
          </div>
        {/if}

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
              {$i18n.t('buyBox.addToCart')}
            </button>
          </form>
          <form
            action={`/shop/checkout/prepare?redirect_uri=${window.location.href}`}
            method="post"
          >
            <input type="hidden" name="_csrf" value={csrfToken} />
            <input type="hidden" name="source" value="BUY_NOW" />
            <input type="hidden" name="items[0].productVariantId" value={selectedVariant?.id} />
            <input type="hidden" name="items[0].quantity" value={quantity} />
            <button
              class="shop-btn shop-btn-secondary shop-btn-lg"
              type="submit"
              disabled={!isSelectedVariantAvailable}
            >
              {$i18n.t('buyBox.buyNow')}
            </button>
          </form>
        </div>
      {/if}
    {/if}
  </div>
{/if}
