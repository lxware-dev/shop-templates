<script lang="ts">
  import Decimal from 'decimal.js';
  import { fade } from 'svelte/transition';
  import MingcuteAddLine from '~icons/mingcute/add-line?raw';
  import MingcuteMinimizeLine from '~icons/mingcute/minimize-line?raw';
  import {
    type SubscriptionAddonResponse,
    type SubscriptionPlanResponse,
    type SubscriptionResponse,
  } from '@halo-dev/api-client';
  import i18n from '../i18n';
  import { formatPrice } from '../utils/price';

  interface SummaryRow {
    label: string;
    amount: string;
    muted?: boolean;
    total?: boolean;
  }

  let {
    csrfToken = '',
    plans = [],
    addons = [],
    currentSubscription = null,
  }: {
    csrfToken?: string;
    plans?: SubscriptionPlanResponse[];
    addons?: SubscriptionAddonResponse[];
    currentSubscription?: SubscriptionResponse | null;
  } = $props();

  // 按计费周期聚合分组；预付一期计划并入对应周期分组（月/年），顺序与后台保持一致
  const GROUP_KEYS = ['MONTHLY', 'YEARLY', 'LIFETIME', 'OTHER'];

  function billingGroupKey(plan: SubscriptionPlanResponse): string {
    if (plan.billingMode === 'LIFETIME') return 'LIFETIME';
    if (plan.billingPeriod === 'MONTHLY') return 'MONTHLY';
    if (plan.billingPeriod === 'YEARLY') return 'YEARLY';
    return 'OTHER';
  }

  function groupLabel(key: string): string {
    return $i18n.t('subscription.group.' + key, { defaultValue: key });
  }

  function periodSuffix(plan: SubscriptionPlanResponse): string {
    if (plan.billingPeriod === 'MONTHLY') return $i18n.t('subscription.perMonth');
    if (plan.billingPeriod === 'YEARLY') return $i18n.t('subscription.perYear');
    return '';
  }

  function billingModeLabel(plan: SubscriptionPlanResponse): string {
    return plan.billingMode
      ? String(
          $i18n.t('subscription.billingMode.' + plan.billingMode, {
            defaultValue: plan.billingMode,
          })
        )
      : '';
  }

  function billingLabel(plan: SubscriptionPlanResponse): string {
    const periodLabel = plan.billingPeriod
      ? String(
          $i18n.t('subscription.billingPeriod.' + plan.billingPeriod, {
            defaultValue: plan.billingPeriod,
          })
        )
      : '';
    return [billingModeLabel(plan), periodLabel].filter(Boolean).join(' ');
  }

  function addonMax(addon: SubscriptionAddonResponse): number {
    return addon.maxQuantity ?? Number.POSITIVE_INFINITY;
  }

  function formatDateTime(instant: string): string {
    const date = new Date(instant);
    if (Number.isNaN(date.getTime())) return instant;
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
  }

  const isSwitch = $derived(
    !!currentSubscription &&
      ['TRIALING', 'ACTIVE', 'PAST_DUE'].includes(currentSubscription.status ?? '')
  );
  const resubscribable = $derived(
    !!currentSubscription && ['EXPIRED', 'CANCELLED'].includes(currentSubscription.status ?? '')
  );
  const currentPlanId = $derived(currentSubscription?.planId ?? null);
  const currentSubscriptionId = $derived(currentSubscription?.id ?? null);

  const planGroups = $derived.by(() => {
    const groups = new Map<string, SubscriptionPlanResponse[]>();
    for (const plan of plans) {
      const key = billingGroupKey(plan);
      const groupPlans = groups.get(key);
      if (groupPlans) {
        groupPlans.push(plan);
      } else {
        groups.set(key, [plan]);
      }
    }
    return GROUP_KEYS.filter((key) => groups.has(key)).map((key) => ({
      key,
      plans: groups.get(key) as SubscriptionPlanResponse[],
    }));
  });

  const allPlans = $derived(planGroups.flatMap((group) => group.plans));
  const activeGroup = $derived(planGroups.find((group) => group.key === activeGroupKey) ?? null);
  const selectedPlan = $derived(allPlans.find((plan) => plan.id === selectedPlanId) ?? null);

  const planMin = $derived(Math.max(1, selectedPlan?.minQuantity ?? 1));
  const planMax = $derived(Math.max(planMin, selectedPlan?.maxQuantity ?? planMin));

  const visibleAddons = $derived(
    selectedPlan ? addons.filter((addon) => addon.billingPeriod === selectedPlan.billingPeriod) : []
  );

  let activeGroupKey = $state<string | null>(null);
  let selectedPlanId = $state<number | null>(null);
  let quantity = $state(1);
  let addonQties = $state<Record<number, number>>({});
  let submitting = $state(false);
  let error = $state<string | null>(null);

  const lastPlanByGroup: Record<string, number> = {};

  const currentPlanName = $derived.by(() => {
    if (!currentSubscription) return '';
    const name = currentSubscription.planName;
    if (name && name.trim().length > 0) return name;
    const plan = allPlans.find((p) => p.id === currentSubscription.planId);
    return plan?.name ?? String(currentSubscription.planId ?? '');
  });

  const periodEndLabel = $derived.by(() => {
    if (!currentSubscription) return '';
    const instant = currentSubscription.paidThroughAt ?? currentSubscription.currentPeriodEndAt;
    if (!instant) return $i18n.t('subscription.forever');
    return formatDateTime(instant);
  });

  // 有当前订阅时默认展开其所在分组，否则展开第一组
  $effect(() => {
    if (activeGroupKey === null && planGroups.length > 0) {
      const matched = planGroups.find((group) =>
        group.plans.some((plan) => plan.id === currentPlanId)
      );
      activeGroupKey = matched?.key ?? planGroups[0]?.key ?? null;
    }
  });

  // 选中计划不在当前分组时，回落到该组上次选择或第一个计划
  $effect(() => {
    if (isSwitch || !activeGroup) return;
    if (!activeGroup.plans.some((plan) => plan.id === selectedPlanId)) {
      const remembered = lastPlanByGroup[activeGroup.key];
      selectedPlanId = activeGroup.plans.some((plan) => plan.id === remembered)
        ? (remembered as number)
        : (activeGroup.plans[0]?.id ?? null);
    }
  });

  // 切换计划时把数量收拢到新计划的区间
  let lastSelectedPlanId: number | null | undefined = undefined;
  $effect(() => {
    if (selectedPlanId === lastSelectedPlanId) return;
    lastSelectedPlanId = selectedPlanId;
    if (!isSwitch && selectedPlan) {
      const value = Number.isFinite(quantity) && quantity > 0 ? quantity : 1;
      quantity = Math.min(planMax, Math.max(planMin, value));
    }
  });

  // 切换计费周期时清空不匹配的加购数量
  let lastAddonPeriod: string | null | undefined = undefined;
  $effect(() => {
    const period = selectedPlan?.billingPeriod ?? null;
    if (lastAddonPeriod !== undefined && period !== lastAddonPeriod) {
      for (const addon of addons) {
        if (addon.billingPeriod !== period && (addonQties[addon.id as number] ?? 0) !== 0) {
          addonQties[addon.id as number] = 0;
        }
      }
    }
    lastAddonPeriod = period;
  });

  function switchGroup(key: string) {
    if (key === activeGroupKey) return;
    if (
      activeGroupKey &&
      selectedPlanId != null &&
      activeGroup?.plans.some((plan) => plan.id === selectedPlanId)
    ) {
      lastPlanByGroup[activeGroupKey] = selectedPlanId;
    }
    activeGroupKey = key;
  }

  function setAddonQty(addon: SubscriptionAddonResponse, raw: string) {
    const key = addon.id as number;
    const parsed = Number(raw);
    let value = Number.isFinite(parsed) ? Math.floor(parsed) : 0;
    if (value < 0) {
      value = 0;
    } else if (value > 0) {
      const min = Math.max(1, addon.minQuantity ?? 1);
      if (value < min) value = min;
    }
    const max = addonMax(addon);
    if (Number.isFinite(max) && value > max) value = max;
    addonQties[key] = value;
  }

  function stepAddon(addon: SubscriptionAddonResponse, delta: number) {
    const key = addon.id as number;
    const current = addonQties[key] ?? 0;
    const min = Math.max(1, addon.minQuantity ?? 1);
    const max = addonMax(addon);
    let value = current;
    if (delta > 0) {
      value = value <= 0 ? min : value + 1;
    } else {
      value = value <= min ? 0 : value - 1;
    }
    if (Number.isFinite(max) && value > max) value = max;
    addonQties[key] = value;
  }

  const cartLines = $derived.by(() => {
    if (!selectedPlan) return [];
    const qty = Number.isFinite(quantity) && quantity > 0 ? quantity : 1;
    const lines: { productVariantId: number; quantity: number }[] = [
      { productVariantId: selectedPlan.variantId ?? 0, quantity: qty },
    ];
    for (const addon of visibleAddons) {
      const addonQty = addonQties[addon.id as number] ?? 0;
      if (addonQty > 0) {
        lines.push({ productVariantId: addon.variantId ?? 0, quantity: addonQty });
      }
    }
    return lines;
  });

  const summaryRows = $derived.by(() => {
    if (isSwitch || !selectedPlan) return null;
    const qty = Number.isFinite(quantity) && quantity > 0 ? quantity : 1;
    const planAmount = new Decimal(selectedPlan.price ?? 0).times(qty);
    const trial = !!selectedPlan.trialEnabled && !resubscribable;
    const nowPlanAmount = trial ? new Decimal(selectedPlan.trialPrice ?? 0).times(qty) : planAmount;
    const rows: SummaryRow[] = [];
    let addonTotal = new Decimal(0);
    for (const addon of visibleAddons) {
      const addonQty = addonQties[addon.id as number] ?? 0;
      if (addonQty <= 0) continue;
      const amount = new Decimal(addon.price ?? 0).times(addonQty);
      addonTotal = addonTotal.add(amount);
      rows.push({ label: `${addon.name} × ${addonQty}`, amount: formatPrice(amount.toNumber()) });
    }
    const nowTotal = nowPlanAmount.add(addonTotal);
    const laterTotal = planAmount.add(addonTotal);
    const recurring = selectedPlan.billingMode === 'SUBSCRIPTION' && !!periodSuffix(selectedPlan);
    if (trial) {
      rows.push({
        label: $i18n.t('subscription.summaryTrialNow', { days: selectedPlan.trialDays ?? '' }),
        amount: formatPrice(nowTotal.toNumber()),
        total: true,
      });
      if (recurring) {
        rows.push({
          label: $i18n.t('subscription.summaryAfterTrial'),
          amount: formatPrice(laterTotal.toNumber()),
          muted: true,
        });
      }
    } else {
      rows.push({
        label: $i18n.t('subscription.summaryDueNow'),
        amount: formatPrice(nowTotal.toNumber()),
        total: true,
      });
      if (recurring) {
        rows.push({
          label: $i18n.t('subscription.summaryAfterEach'),
          amount: formatPrice(laterTotal.toNumber()),
          muted: true,
        });
      }
    }
    return rows;
  });

  async function handleAddToCart() {
    if (submitting || !selectedPlan) return;
    error = null;
    submitting = true;
    try {
      for (const line of cartLines) {
        let res = await fetch('/apis/uc.api.ecommerce.halo.run/v1alpha1/cart-items', {
          method: 'POST',
          credentials: 'include',
          headers: {
            'X-CSRF-TOKEN': csrfToken,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(line),
        });
        if (res.status === 415) {
          res = await fetch('/apis/uc.api.ecommerce.halo.run/v1alpha1/cart-items', {
            method: 'POST',
            credentials: 'include',
            headers: {
              'X-CSRF-TOKEN': csrfToken,
              'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: new URLSearchParams({
              productVariantId: String(line.productVariantId),
              quantity: String(line.quantity),
            }),
          });
        }
        if (res.status === 401) {
          window.location.href =
            '/login?redirect_uri=' + encodeURIComponent(window.location.pathname);
          return;
        }
        if (!res.ok) {
          throw new Error($i18n.t('subscription.addCartFailed'));
        }
      }
      window.location.href = '/shop/cart';
    } catch (e) {
      error = e instanceof Error && e.message ? e.message : $i18n.t('subscription.addCartFailed');
      submitting = false;
    }
  }
</script>

{#snippet planBody(plan: SubscriptionPlanResponse, groupKey: string)}
  <span class="shop-subscription__plan-body">
    <span class="shop-subscription__plan-main">
      <span class="shop-subscription__plan-name">
        {plan.name}
        {#if plan.tier}
          <span class="shop-subscription__plan-tier">{plan.tier}</span>
        {/if}
      </span>
      {#if groupKey === 'OTHER'}
        <span class="shop-subscription__plan-billing">{billingLabel(plan)}</span>
      {:else if plan.billingMode === 'ONE_TIME'}
        <span class="shop-subscription__plan-billing">{billingModeLabel(plan)}</span>
      {/if}
    </span>
    <span class="shop-subscription__plan-aside">
      <span class="shop-subscription__plan-price">
        {formatPrice(plan.price ?? 0)}
        {#if plan.billingMode === 'SUBSCRIPTION' && periodSuffix(plan)}
          <span class="shop-subscription__plan-interval">{periodSuffix(plan)}</span>
        {/if}
      </span>
      {#if plan.originalPrice != null}
        <span class="shop-subscription__plan-original">{formatPrice(plan.originalPrice)}</span>
      {/if}
      {#if !isSwitch && plan.trialEnabled && !resubscribable}
        <span class="shop-subscription__plan-trial">
          {$i18n.t('subscription.trial', { days: plan.trialDays ?? '' })}
        </span>
      {/if}
      {#if isSwitch}
        {#if plan.id === currentPlanId}
          <span class="shop-subscription__plan-current">{$i18n.t('subscription.currentPlan')}</span>
        {:else}
          <span class="shop-subscription__plan-action">{$i18n.t('subscription.goSwitch')}</span>
        {/if}
      {/if}
    </span>
  </span>
{/snippet}

<div class="buy-box shop-subscription" transition:fade={{ duration: 200 }}>
  {#if isSwitch && currentSubscription}
    <section class="shop-subscription-manage">
      <h2 class="shop-subscription-manage__title">{$i18n.t('subscription.manageTitle')}</h2>
      <dl class="shop-subscription-manage__meta">
        <div class="shop-subscription-manage__row">
          <dt>{$i18n.t('subscription.managePlan')}</dt>
          <dd>{currentPlanName}</dd>
        </div>
        <div class="shop-subscription-manage__row">
          <dt>{$i18n.t('subscription.manageStatus')}</dt>
          <dd>
            <span
              class="shop-subscription-status"
              class:shop-subscription-status--warning={currentSubscription.status === 'PAST_DUE'}
            >
              {$i18n.t('subscription.status.' + (currentSubscription.status ?? ''), {
                defaultValue: currentSubscription.status ?? '',
              })}
            </span>
          </dd>
        </div>
        <div class="shop-subscription-manage__row">
          <dt>{$i18n.t('subscription.managePeriodEnd')}</dt>
          <dd>{periodEndLabel}</dd>
        </div>
      </dl>
      <a
        class="shop-btn shop-btn-primary"
        href={`/uc/shop/subscriptions/${currentSubscription.id}`}
      >
        {$i18n.t('subscription.manageGoUc')}
      </a>
    </section>
  {/if}

  <div class="buy-box__spec-label">
    {isSwitch ? $i18n.t('subscription.allPlans') : $i18n.t('subscription.selectPlan')}
  </div>

  {#if planGroups.length === 0}
    <div class="shop-subscription__empty">{$i18n.t('subscription.noPlans')}</div>
  {:else}
    {#if planGroups.length > 1}
      <div
        class="shop-subscription__tabs"
        role="tablist"
        aria-label={$i18n.t('subscription.billingTabsLabel')}
      >
        {#each planGroups as group (group.key)}
          <button
            type="button"
            class="shop-subscription__tab"
            class:is-active={group.key === activeGroupKey}
            role="tab"
            aria-selected={group.key === activeGroupKey}
            onclick={() => switchGroup(group.key)}
          >
            {groupLabel(group.key)}
          </button>
        {/each}
      </div>
    {/if}

    <div class="shop-subscription__periods">
      {#each planGroups as group (group.key)}
        <div
          class="shop-subscription__period"
          hidden={planGroups.length > 1 && group.key !== activeGroupKey}
        >
          {#if planGroups.length === 1}
            <div class="shop-subscription__period-name">{groupLabel(group.key)}</div>
          {/if}
          <div class="shop-subscription__plans">
            {#each group.plans as plan (plan.id)}
              {#if isSwitch}
                {#if currentSubscriptionId && plan.id !== currentPlanId}
                  <a
                    class="shop-subscription__plan"
                    href={`/uc/shop/subscriptions/${currentSubscriptionId}/change?planId=${plan.id}`}
                  >
                    {@render planBody(plan, group.key)}
                  </a>
                {:else}
                  <div class="shop-subscription__plan is-selected is-current">
                    {@render planBody(plan, group.key)}
                  </div>
                {/if}
              {:else}
                <label
                  class="shop-subscription__plan"
                  class:is-selected={selectedPlanId === plan.id}
                >
                  <input type="radio" name="plan" value={plan.id} bind:group={selectedPlanId} />
                  <span class="shop-subscription__plan-radio" aria-hidden="true"></span>
                  {@render planBody(plan, group.key)}
                </label>
              {/if}
            {/each}
          </div>
        </div>
      {/each}
    </div>
  {/if}

  {#if isSwitch}
    <p class="shop-subscription__switch-hint">{$i18n.t('subscription.switchHint')}</p>
  {:else if planGroups.length > 0}
    {#if planMin !== planMax}
      <div class="shop-subscription__qty">
        <span class="shop-subscription__qty-label">{$i18n.t('buyBox.quantity')}</span>
        <div class="shop-quantity">
          <button
            type="button"
            class="shop-quantity__btn"
            onclick={() => (quantity = Math.max(planMin, quantity - 1))}
            disabled={quantity <= planMin}
            aria-label={$i18n.t('subscription.decreaseQuantity')}
          >
            {@html MingcuteMinimizeLine}
          </button>
          <input
            type="number"
            class="shop-quantity__input"
            bind:value={quantity}
            min={planMin}
            max={planMax}
          />
          <button
            type="button"
            class="shop-quantity__btn"
            onclick={() => (quantity = Math.min(planMax, quantity + 1))}
            disabled={quantity >= planMax}
            aria-label={$i18n.t('subscription.increaseQuantity')}
          >
            {@html MingcuteAddLine}
          </button>
        </div>
        <span class="shop-subscription__qty-hint">
          {$i18n.t('subscription.quantityRange', { min: planMin, max: planMax })}
        </span>
      </div>
    {/if}

    {#if visibleAddons.length > 0}
      <div class="shop-subscription__addons">
        <div class="shop-subscription__addons-title">{$i18n.t('subscription.addonsTitle')}</div>
        <div class="shop-subscription__addon-rows">
          {#each visibleAddons as addon (addon.id)}
            <div class="shop-subscription__addon">
              <span class="shop-subscription__addon-info">
                <span class="shop-subscription__addon-name">{addon.name}</span>
                {#if addon.price != null}
                  <span class="shop-subscription__addon-price">{formatPrice(addon.price)}</span>
                {:else}
                  <span
                    class="shop-subscription__addon-price shop-subscription__addon-price--empty"
                  >
                    {$i18n.t('subscription.addonPriceUnset')}
                  </span>
                {/if}
              </span>
              <div class="shop-quantity">
                <button
                  type="button"
                  class="shop-quantity__btn"
                  onclick={() => stepAddon(addon, -1)}
                  disabled={(addonQties[addon.id as number] ?? 0) <= 0}
                  aria-label={$i18n.t('subscription.decreaseAddonQuantity')}
                >
                  {@html MingcuteMinimizeLine}
                </button>
                <input
                  type="number"
                  class="shop-quantity__input"
                  min="0"
                  max={addon.maxQuantity ?? ''}
                  value={addonQties[addon.id as number] ?? 0}
                  onchange={(event) => setAddonQty(addon, event.currentTarget.value)}
                />
                <button
                  type="button"
                  class="shop-quantity__btn"
                  onclick={() => stepAddon(addon, 1)}
                  disabled={(addonQties[addon.id as number] ?? 0) >= addonMax(addon)}
                  aria-label={$i18n.t('subscription.increaseAddonQuantity')}
                >
                  {@html MingcuteAddLine}
                </button>
              </div>
            </div>
          {/each}
        </div>
      </div>
    {/if}

    {#if resubscribable}
      <p class="shop-subscription__notice">{$i18n.t('subscription.resubscribeNotice')}</p>
    {/if}

    {#if error}
      <p class="shop-subscription__error">{error}</p>
    {/if}

    {#if summaryRows}
      <div class="shop-subscription__summary">
        {#each summaryRows as row}
          <div
            class="shop-subscription__summary-row"
            class:shop-subscription__summary-row--muted={row.muted}
            class:shop-subscription__summary-row--total={row.total}
          >
            <span>{row.label}</span>
            <span>{row.amount}</span>
          </div>
        {/each}
      </div>
    {/if}

    <div class="buy-box__actions shop-subscription__actions">
      <button
        type="button"
        class="shop-btn shop-btn-secondary"
        onclick={handleAddToCart}
        disabled={submitting || !selectedPlan}
      >
        {submitting ? $i18n.t('subscription.addingToCart') : $i18n.t('buyBox.addToCart')}
      </button>
      <form action={`/shop/checkout/prepare?redirect_uri=${window.location.href}`} method="post">
        <input type="hidden" name="_csrf" value={csrfToken} />
        <input type="hidden" name="source" value="BUY_NOW" />
        {#each cartLines as line, index}
          <input
            type="hidden"
            name={`items[${index}].productVariantId`}
            value={line.productVariantId}
          />
          <input type="hidden" name={`items[${index}].quantity`} value={line.quantity} />
        {/each}
        <button
          type="submit"
          class="shop-btn shop-btn-primary"
          disabled={submitting || !selectedPlan}
        >
          {$i18n.t('buyBox.buyNow')}
        </button>
      </form>
    </div>
  {/if}
</div>
