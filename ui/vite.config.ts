import { svelte } from '@sveltejs/vite-plugin-svelte';
import Icons from 'unplugin-icons/vite';
import { defineConfig } from 'vite';

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    svelte(),
    Icons({
      compiler: 'svelte',
    }),
  ],
  server: {
    proxy: {
      '/apis': {
        target: 'http://localhost:8090',
        changeOrigin: true,
      },
      '/upload': {
        target: 'http://localhost:8090',
        changeOrigin: true,
      },
    },
  },
});
