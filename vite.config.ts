import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      // Permite imports como:
      //   import { Button } from '@/components/ui'
      //   import { useCheckin } from '@/hooks/useCheckin'
      //   import type { StepId } from '@/types'
      '@': path.resolve(__dirname, './src'),
    },
  },
    server: {
    host: true,
    port: 5173,
    allowedHosts: true,
  },
});