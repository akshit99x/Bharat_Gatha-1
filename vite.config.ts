import { defineConfig } from 'vite';
import { fileURLToPath, URL } from 'node:url';

export default defineConfig({
  base: './',
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  server: {
    port: 5178,
    strictPort: false,
    // `npm run api:dev` serves the teacher API on :8000; in development the game reaches it through here.
    proxy: { '/api': { target: 'http://127.0.0.1:8000', changeOrigin: false } },
  },
  build: {
    target: 'es2022',
    chunkSizeWarningLimit: 1600,
  },
});
