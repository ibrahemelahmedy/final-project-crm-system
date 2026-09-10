import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    // Story 26 (WIS-22), Decision 10. The chat widget iframe calls /api
    // SAME-ORIGIN so no CORS change is needed in production (web/vercel.json
    // proxies /api/(.*)). Dev needs the same shape or the widget 404s locally.
    // The staff SPA is unaffected — it uses the absolute VITE_API_URL.
    proxy: { '/api': { target: 'http://localhost:8000', changeOrigin: true } },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './src/test/setup.ts',
  },
});
