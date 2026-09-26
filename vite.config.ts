import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig(({ mode }) => ({
  plugins: [
    react(),
    tailwindcss(),
  ],
  server: { proxy: loadEnv(mode, process.cwd(), '').VITE_API_ENABLED === 'true' || process.env.VITE_API_ENABLED === 'true'
    ? { '/api': { target: 'http://127.0.0.1:3001', changeOrigin: false } } : undefined },
}))
