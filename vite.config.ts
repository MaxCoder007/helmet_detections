import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 5173,
    host: true,
    watch: {
      ignored: [
        '**/results/**',
        '**/models/**',
        '**/backend/**',
        '**/tests/**',
        '**/*.db*',
        '**/*.pt',
        '**/.pytest_cache/**',
        '**/__pycache__/**',
      ],
    },
  },
});
