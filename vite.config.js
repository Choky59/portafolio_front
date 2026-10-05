import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

export default defineConfig({
  plugins: [vue()],
  server: {
    port: 5173,
    // In dev the API is reached through the same origin, so no CORS and no VITE_API_URL needed
    proxy: {
      '/api': 'http://localhost:3000',
    },
  },
})
