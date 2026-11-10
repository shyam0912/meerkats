import { execFileSync } from 'node:child_process'
import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { demoNoticeFile, demoNotices } from './build/demo-notices.ts'

export default defineConfig(({ mode, command }) => {
  const plugins = [react(), tailwindcss()]
  if (mode === 'demo') {
    let release = ''
    if (command === 'build') {
      if (process.env.NODE_ENV !== 'production') throw new Error('The demo requires a production build. Unset NODE_ENV or set it to production.')
      const git = (...args: string[]) => execFileSync('git', args, { encoding: 'utf8' }).trim()
      release = git('rev-parse', '--short=12', 'HEAD') + (git('status', '--porcelain') ? '-dirty' : '')
    }
    return {
      plugins: [...plugins, demoNotices()],
      envDir: false,
      envPrefix: [],
      define: {
        'import.meta.env.VITE_API_ENABLED': JSON.stringify('false'),
        'import.meta.env.VITE_DEMO_RELEASE': JSON.stringify(release),
      },
      build: { outDir: 'dist-demo', license: { fileName: demoNoticeFile } },
    }
  }
  const apiEnabled = loadEnv(mode, process.cwd(), '').VITE_API_ENABLED === 'true' || process.env.VITE_API_ENABLED === 'true'
  return { plugins, server: { proxy: apiEnabled ? { '/api': { target: 'http://127.0.0.1:3001', changeOrigin: false } } : undefined } }
})
