import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

export default defineConfig({
  plugins: [vue()],
  // Pre-bundle three and its addons together; otherwise, in dev, a lazily found addon
  // (MapControls) gets its own copy of three ("Multiple instances of Three.js")
  optimizeDeps: {
    include: ['three', 'three/examples/jsm/controls/MapControls.js'],
  },
  server: {
    port: 5173,
    // In dev the API is reached through the same origin, so no CORS and no VITE_API_URL needed
    proxy: {
      '/api': 'http://localhost:3000',
    },
  },
})
