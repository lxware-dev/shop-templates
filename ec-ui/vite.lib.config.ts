import { svelte } from '@sveltejs/vite-plugin-svelte';
import autoprefixer from 'autoprefixer';
import Icons from 'unplugin-icons/vite';
import { defineConfig } from 'vite';

export default defineConfig({
  experimental: {
    enableNativePlugin: true,
  },
  plugins: [
    svelte(),
    Icons({
      compiler: 'svelte',
    }),
  ],
  define: {
    'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV),
  },
  build: {
    lib: {
      entry: 'src/main.ts',
      name: 'ec-components',
      fileName: 'index',
      cssFileName: 'index',
    },
    rollupOptions: {
      output: {
        extend: true,
      },
    },
  },
  css: {
    postcss: {
      plugins: [autoprefixer()],
    },
  },
});
