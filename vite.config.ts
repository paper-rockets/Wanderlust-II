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
      host: true,
      hmr: true,
      allowedHosts: true as const,
    },
    build: {
      target: 'esnext',
      rollupOptions: {
        input: {
          main: path.resolve(__dirname, 'index.html'),
          model_viewer: path.resolve(__dirname, 'model_viewer.html'),
          tree_viewer: path.resolve(__dirname, 'tree_viewer.html'),
          mobile_test: path.resolve(__dirname, 'mobile_test.html'),
          archipelago_studio: path.resolve(__dirname, 'archipelago_studio.html'),
        },
      },
    },
  };
});
