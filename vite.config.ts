import { defineConfig } from 'vite'
import laravel from 'laravel-vite-plugin'
import react from '@vitejs/plugin-react'

// Dev: `php artisan serve` (app) + `pnpm dev` (assets/HMR). Build output: public/build (manifest read by @vite).
export default defineConfig({
  plugins: [
    laravel({ input: ['resources/js/main.tsx'], refresh: true }),
    react(),
  ],
  build: {
    rollupOptions: {
      output: {
        // Vendor code changes rarely; keeping it out of the app chunk keeps the entry small and cacheable.
        manualChunks(id) {
          if (!id.includes('node_modules')) return undefined
          if (/node_modules\/(react|react-dom|scheduler)\//.test(id)) return 'react'
          if (id.includes('react-router')) return 'router'
          if (id.includes('@radix-ui') || id.includes('@floating-ui') || id.includes('aria-hidden') || id.includes('react-remove-scroll')) return 'radix'
          if (id.includes('date-fns')) return 'date-fns'
          return 'vendor'
        },
      },
    },
  },
})
