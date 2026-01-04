import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@components': path.resolve(__dirname, './src/components'),
      '@pages': path.resolve(__dirname, './src/pages'),
      '@utils': path.resolve(__dirname, './src/utils'),
      '@hooks': path.resolve(__dirname, './src/hooks'),
      '@stores': path.resolve(__dirname, './src/stores'),
      '@wailsjs': path.resolve(__dirname, './wailsjs'),
      '@models': path.resolve(__dirname, './wailsjs/go/models'),
      '@runtime': path.resolve(__dirname, './wailsjs/runtime'),
    },
  },
  server: {
    hmr: {
      host: 'localhost',
    },
  },
});
