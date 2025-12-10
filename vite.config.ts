import path from 'path';
import { defineConfig } from 'vite';

export default defineConfig({
  experimental: {
    enableNativePlugin: true,
  },
  build: {
    outDir: 'ec-dist',
    lib: {
      entry: path.resolve(__dirname, 'src/index.ts'),
      name: 'main',
      fileName: 'main',
      formats: ['iife'],
      cssFileName: 'style',
    },
  },
});
