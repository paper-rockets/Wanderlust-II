import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig } from 'vite';

export default defineConfig(() => {
  return {
    base: '/Wanderlust-II/',
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      hmr: true,
    },
    build: {
      target: 'esnext',
      rollupOptions: {
        input: {
          main: path.resolve(__dirname, 'index.html'),
          wanderlust: path.resolve(__dirname, 'wanderlust.html'),
          model_viewer: path.resolve(__dirname, 'model_viewer.html'),
          tree_viewer: path.resolve(__dirname, 'tree_viewer.html'),
        },
      },
    },
    esbuild: {
      supported: {
        'top-level-await': true,
      },
    },
  };
});

