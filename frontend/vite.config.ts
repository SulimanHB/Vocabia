import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  // PGlite carga su WebAssembly por su cuenta; el preempaquetado de Vite lo rompe en desarrollo.
  optimizeDeps: { exclude: ['@electric-sql/pglite'] },
  server: { port: 5173, strictPort: true, proxy: { '/api': { target: 'http://127.0.0.1:3001', changeOrigin: true } } },
  test: { environment: 'jsdom', setupFiles: ['./src/test-setup.ts'] },
});
