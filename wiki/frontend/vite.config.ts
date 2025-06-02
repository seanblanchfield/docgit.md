import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: { // Add server configuration
    proxy: {
      // Proxy API requests
      '/api': {
        target: 'http://backend:8000', // Target the backend service in Docker
        changeOrigin: true, // Recommended for virtual hosted sites
        // secure: false, // Uncomment if your backend is HTTPS with self-signed cert
        // rewrite: (path) => path.replace(/^\/api/, '') // Uncomment if backend doesn't expect /api prefix
      }
    }
  }
})
