import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
    host: true,
  },
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
