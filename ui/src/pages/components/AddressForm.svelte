<script lang="ts">
  import type { AddressEntryResponse } from '@halo-dev/api-client';
  import { createQuery, QueryClient } from '@tanstack/svelte-query';
  import ky from 'ky';
  import i18n from '../../i18n';

  const queryClient = new QueryClient();

  let provinceCode = $state<string>();
  let cityCode = $state<string>();
  let areaCode = $state<string>();

  const provinceQuery = createQuery(
    () => ({
      queryKey: ['shop:address:provinces'],
      queryFn: async () => {
        return await ky
          .get<AddressEntryResponse[]>('/apis/api.ecommerce.halo.run/v1alpha1/provinces')
          .json();
      },
    }),
    () => queryClient
  );

  const cityQuery = createQuery(
    () => ({
      queryKey: ['shop:address:cities', provinceCode],
      queryFn: async () => {
        return await ky
          .get<
            AddressEntryResponse[]
          >(`/apis/api.ecommerce.halo.run/v1alpha1/provinces/${provinceCode}/cities`)
          .json();
      },
      enabled: !!provinceCode,
    }),
    () => queryClient
  );

  const areaQuery = createQuery(
    () => ({
      queryKey: ['shop:address:areas', cityCode],
      queryFn: async () => {
        return await ky
          .get<
            AddressEntryResponse[]
          >(`/apis/api.ecommerce.halo.run/v1alpha1/cities/${cityCode}/areas`)
          .json();
      },
      enabled: !!cityCode,
    }),
    () => queryClient
  );

  $effect(() => {
    if (provinceCode) {
      cityCode = undefined;
      areaCode = undefined;
    }
  });

  $effect(() => {
    if (cityCode) {
      areaCode = undefined;
    }
  });
</script>

<div class="shop-checkout__form-row">
  <div class="shop-form-group">
    <label class="shop-label" for="lastName">{$i18n.t('addressForm.lastName')}</label>
    <input type="text" class="shop-input" id="lastName" name="userAddress.lastName" required />
  </div>
  <div class="shop-form-group">
    <label class="shop-label" for="firstName">{$i18n.t('addressForm.firstName')}</label>
    <input type="text" class="shop-input" id="firstName" name="userAddress.firstName" required />
  </div>
</div>
<div class="shop-form-group">
  <label class="shop-label" for="contactPhone">{$i18n.t('addressForm.contactPhone')}</label>
  <input type="tel" class="shop-input" id="contactPhone" name="userAddress.contactPhone" required />
</div>
<div class="shop-checkout__form-row">
  <div class="shop-form-group">
    <label class="shop-label" for="province">{$i18n.t('addressForm.province')}</label>
    <select
      id="province"
      class="shop-select"
      name="userAddress.provinceCode"
      bind:value={provinceCode}
      required
    >
      {#each provinceQuery.data ?? [] as province (province.code)}
        <option value={province.code}>{province.name}</option>
      {/each}
    </select>
  </div>
  <div class="shop-form-group">
    <label class="shop-label" for="city">{$i18n.t('addressForm.city')}</label>
    <select
      id="city"
      class="shop-select"
      name="userAddress.cityCode"
      bind:value={cityCode}
      required
    >
      {#each cityQuery.data ?? [] as city (city.code)}
        <option value={city.code}>{city.name}</option>
      {/each}
    </select>
  </div>
</div>
<div class="shop-checkout__form-row">
  <div class="shop-form-group">
    <label class="shop-label" for="district">{$i18n.t('addressForm.district')}</label>
    <select
      id="district"
      class="shop-select"
      name="userAddress.districtCode"
      bind:value={areaCode}
      required
    >
      {#each areaQuery.data ?? [] as area (area.code)}
        <option value={area.code}>{area.name}</option>
      {/each}
    </select>
  </div>
  <div class="shop-form-group">
    <label class="shop-label" for="postalCode">{$i18n.t('addressForm.postalCode')}</label>
    <input
      type="text"
      class="shop-input"
      id="postalCode"
      name="userAddress.postalCode"
      required
      placeholder={$i18n.t('addressForm.postalCodePlaceholder')}
    />
  </div>
</div>
<div class="shop-form-group">
  <label class="shop-label" for="address">{$i18n.t('addressForm.address')}</label>
  <textarea
    class="shop-textarea"
    id="address"
    rows="3"
    placeholder={$i18n.t('addressForm.addressPlaceholder')}
    name="userAddress.streetAddress"
    required
  ></textarea>
</div>
