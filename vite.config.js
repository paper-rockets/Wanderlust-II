import { defineConfig } from 'vite';

export default defineConfig({
  base: '/Wanderlust/',
  server: {
    port: 3000
  },
  optimizeDeps: {
    entries: ['index.html']
  },
  build: {
    target: 'esnext'
  },
  esbuild: {
    supported: {
      'top-level-await': true
    }
  }
});
