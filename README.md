## Halo 商城基础模板

此仓库为 Halo 商业版的商城前台默认模板，已经包含在了 Halo 商业版程序中，可以在主题没有适配商城页面时使用。

除此之外，主题开发者可以复用这一套默认模板，对其进行增强开发或者样式修改。

## 共识

- 此模板采用混合开发的模式，只有在需要 SEO 的页面采用了后端渲染（Thymeleaf）的方式，其他可交互页面均采用 [Svelte](https://svelte.dev/) 框架构建为了 Web Component
- 通常情况下推荐主题引用 Halo 中提供的预设模板，进行样式修改即可，这样会更简单
- 如果需要对商城页面进行高度的定制化（比如对页面元素结构进行调整），可以考虑直接在主题中集成此仓库的源码，完全接管后续的界面开发，但这需要对 Halo 商城的 API 有足够的了解

## 复用模板

此仓库的 `templates/shop` 目录已经包含在了 Halo 程序中，所以主题可以直接使用 Thymeleaf 的导入语法复用这些模板，比如：

在主题中新建 `templates/shop/products.html`：

```html
<!-- 基础样式导入，可以在此基础上自定义 -->
<th:block th:replace="~{shop/modules/style}" />
<!-- JavaScript 导入，包含 Web Components -->
<th:block th:replace="~{shop/modules/script}" />
<!-- 产品列表模板，即当前仓库中的 templates/shop/modules/products -->
<th:block th:replace="~{shop/modules/products}" />
```

其他模板根据 `templates/shop` 目录在主题中创建即可，以下是所有模板的具体作用：

1. `shop/products.html`：产品列表页面，完全采用 Thymeleaf 渲染
2. `shop/product.html`：产品详情页面
3. `shop/cart.html`：购物车页面
4. `shop/checkout.html`：结算页面
5. `shop/payments.html`：支付页面

示例仓库：[lxware-dev/theme-shop-starter](https://github.com/lxware-dev/theme-shop-starter)

## 二次开发

除了复用预设模板之外，如果你的主题需要更高程度的定制化，也可以直接在主题中集成当前仓库的源码。

技术要求：

1. 主题使用 pnpm 管理依赖
2. 主题包含静态资源构建工具，比如 Vite
3. 对 Halo 商城的 API 有足够了解
4. 对 Svelte 框架有足够了解，或者可以根据 API 自行选用框架重新实现界面

简要集成步骤：

1. 将此仓库的 ui 目录复制到主题的根目录
2. 在主题中创建 `pnpm-workspace.yaml`，编写以下配置：

   ```yaml
   packages:
     - ui
   ```

3. 执行 `pnpm -r run build` 编译 UI
4. 在主题的 js 或者 ts 入口文件中添加：

   ```ts
   import '@halo-dev/shop-ui';
   import '@halo-dev/shop-ui/dist/index.css';
   ```

5. 编译主题静态资源
6. 在 `templates/shop` 目录创建上述的模板，内容可参考当前仓库