import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: { '@': '/src' }
  },
  optimizeDeps: {
    exclude: ['fsevents'],
  },
  server: {
    port: 3000,
    strictPort: true,
    host: true,
  },
  build: {
    // Never ship source maps — they expose full source code to anyone with DevTools
    sourcemap: false,
    // Minify aggressively in production
    minify: 'terser',
    terserOptions: {
      compress: {
        drop_console: true,   // strip all console.log/error in production
        drop_debugger: true,
      },
    },
  },
})
