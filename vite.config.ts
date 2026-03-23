import { resolve } from 'node:path';
import { defineConfig } from 'vite-plus';

export default defineConfig({
  pack: {
    entry: resolve(__dirname, 'src/index.ts'),
    name: 'main',
    globalName: 'main',
    format: 'iife',
    outDir: 'shop-dist',
    deps: {
      alwaysBundle: ['medium-zoom', 'swiper/**', '@halo-dev/shop-ui/**'],
    },
    outputOptions: {
      minify: true,
      entryFileNames: 'main.iife.js',
    },
    platform: 'browser',
    css: {
      minify: true,
    },
  },
  staged: {
    '*': 'prettier --check .',
  },
  lint: { options: { typeAware: true, typeCheck: true } },
});
