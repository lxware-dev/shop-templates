# AGENTS.md

## What this repo is

Storefront templates for Halo's commercial shop plugin (Halo 商城). `templates/shop/` holds Thymeleaf templates bundled into Halo itself; `ui/` builds Svelte components into Web Components consumed by those templates. Theme authors can reuse the templates or integrate the source — `README.md` (written in Chinese) documents both flows and links starter repos.

## Layout

- `templates/shop/` — Thymeleaf templates shipped inside Halo. Pages: products, product, cart, checkout, payments. `modules/*.html` are the fragments themes import via `~{shop/modules/...}`.
- `ui/` — `@halo-dev/shop-ui`, a Svelte 5 (runes) library compiled with `customElement: true` into Web Components plus a global CSS bundle (`ui/dist/`, gitignored).
- `src/index.ts` — root storefront entry: registers shop-ui elements, medium-zoom, and Swiper.
- `shop-dist/` — root build output (gitignored), served by Halo under `/shop-dist/` and referenced from `templates/shop/modules/script.html` / `style.html`.

## Commands

pnpm@10 workspace. `vp` is the vite-plus CLI (vite resolves to `@voidzero-dev/vite-plus-core` via the pnpm catalog).

- `pnpm build` (root) — `vp pack` → `shop-dist/main.iife.js` + `style.css`. The root bundles `@halo-dev/shop-ui`, so build `ui` first (`pnpm -r run build` handles topological order).
- `pnpm build` (in `ui/`) — library build to `ui/dist/`.
- `pnpm check` (in `ui/`) — typecheck: `svelte-check` + `tsc`.
- `pnpm dev` (in `ui/`) — Vite dev server; proxies `/apis` and `/upload` to `http://localhost:8090`, so it needs a running Halo instance. `ui/index.html` is the dev harness that mounts custom elements directly.
- `pnpm lint` (in `ui/`) / `pnpm prettier` (root) — Prettier.
- The pre-commit hook (`.vite-hooks/pre-commit`) runs `vp staged` → Prettier check on staged files.

## Architecture rules

- Two render modes. The SEO-critical products list (`templates/shop/modules/products.html`) is fully server-rendered Thymeleaf with inline vanilla JS — no Svelte. Interactive pages (cart, checkout, payments, product buy-box) mount Web Components.
- Web Components are declared in Svelte via `<svelte:options customElement={{ tag: 'shop-...', shadow: 'none', props: {...} }} />`. Shadow DOM is intentionally disabled so global styles apply; keep styles in `ui/src/styles/` (BEM-ish, `shop-` prefixed), not component-scoped.
- Thymeleaf passes data through HTML attributes, e.g. `<shop-page-checkout th:contextId="${context.id}" th:csrfToken="${_csrf.token}">`. HTML attributes are lowercased, so declare lowercase `attribute` names in the customElement props (e.g. `csrftoken`).
- API access via `ky` against `/apis/uc.api.ecommerce.halo.run/v1alpha1/...`. Response types come from `@halo-dev/api-client`, pinned as a local tarball `ui/halo-dev-api-client-2.24.0.tgz` (tracked in git); upgrading the client means replacing the tarball.
- Each interactive component root creates its own `QueryClient` and provides it via `setQueryClientContext` (`@tanstack/svelte-query`).
- Price math must use Decimal.js (see `ui/src/utils/price.ts`), never float arithmetic.
- i18n via i18next + svelte-i18next. Add new UI strings to all four locale files in `ui/src/i18n/locales/`: `en.json`, `es.json`, `zh-cn.json`, `zh-tw.json`. Locale comes from the `language` cookie, else the browser, else `en`.
- Icons: `unplugin-icons` raw SVG imports (`~icons/mingcute/...`) and the `iconify-icon` web component.

## Conventions

- Prettier is the formatter: single quotes, 100 print width, LF, `prettier-plugin-svelte` + `prettier-plugin-organize-imports`.
- Use Svelte 5 runes syntax (`$props`, `$derived`, ...), not legacy store-based component code.
- Conventional commits (`feat:`, `fix:`, `chore:`), `feat/*` branches, PRs into `main`, releases via `release/x.y` branches.
- Thymeleaf template copy is Chinese; keep new server-rendered text consistent with it, and route interactive-UI strings through i18n.
