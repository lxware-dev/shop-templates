<script lang="ts">
  import { getThumbnailUrl } from '../utils/thumbnail';
  import MingcuteSearch3Line from '~icons/mingcute/search-3-line?raw';
  import type { HTMLButtonAttributes } from 'svelte/elements';
  import mediumZoom, { type Zoom } from 'medium-zoom';

  const {
    isSelected,
    isAvailable,
    imageUrl,
    value,
    ...rest
  }: {
    isSelected: boolean;
    isAvailable: boolean;
    imageUrl?: string;
    value?: string;
  } & HTMLButtonAttributes = $props();

  let imgEl: HTMLImageElement | undefined = $state();

  function handleZoomClick(e: Event) {
    e.stopPropagation();

    const zoom = mediumZoom(imgEl);
    zoom?.open();

    zoom?.on('close', () => {
      zoom?.detach();
    });
  }
</script>

<button
  class="buy-box__spec-option"
  class:buy-box__spec-option--selected={isSelected}
  class:buy-box__spec-option--disabled={!isAvailable}
  class:buy-box__spec-option--with-image={imageUrl}
  disabled={!isAvailable}
  {...rest}
>
  {#if imageUrl}
    <img
      bind:this={imgEl}
      src={getThumbnailUrl(imageUrl, 'S')}
      data-zoom-src={imageUrl}
      alt={value}
      class="buy-box__spec-option-image"
    />
    <div
      role="button"
      tabindex="0"
      class="buy-box__spec-option-zoom"
      aria-label="查看大图"
      onclick={handleZoomClick}
      onkeydown={(e) => e.key === 'Enter' && handleZoomClick(e)}
    >
      {@html MingcuteSearch3Line}
    </div>
  {/if}
  <span class="buy-box__spec-option-text">{value}</span>
</button>
