import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { analysisBridge } from './vite-plugins/analysis-bridge'
import { providerBridge } from './vite-plugins/provider-bridge'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), analysisBridge(), providerBridge()],
  css: {
    postcss: './postcss.config.js'
  },
  server: {
    host: '0.0.0.0',
    port: 5174
  }
})
