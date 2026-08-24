import path from 'path';
import { defineConfig } from 'vite';

export default defineConfig(() => {
  return {
    base: './',
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      host: true,
      hmr: true,
      allowedHosts: true as const,
    },
    build: {
      target: 'esnext',
      reportCompressedSize: false,
      rollupOptions: {
        input: {
          main: path.resolve(__dirname, 'index.html'),
          low_power: path.resolve(__dirname, 'low_power.html'),
        },
      },
    },
  };
});

