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
  // gpt-tokenizer는 BPE 사전 포함으로 무거워, 런타임 동적 import 시 dev 재최적화+풀 리로드를 유발한다.
  // 서버 시작 시 미리 번들해 세션 중 리로드를 방지.
  optimizeDeps: {
    include: ['gpt-tokenizer']
  },
  server: {
    host: '0.0.0.0',
    port: 5174
  }
})
