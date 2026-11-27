import {mandatoryUpdatePlugin} from './client-runtime/vite.mjs'
import {createHash} from 'node:crypto'
import {readFileSync,readdirSync} from 'node:fs'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'node:path'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const devApiProxyTarget = process.env.VITE_DEV_API_PROXY_TARGET || 'http://localhost:5000'

const getBasePath = () => {
  if (process.env.VITE_BASE_PATH) {
    return process.env.VITE_BASE_PATH
  }

  if (process.env.GITHUB_PAGES === 'true') {
    const repositoryName = process.env.GITHUB_REPOSITORY?.split('/')[1]

    if (!repositoryName || repositoryName.endsWith('.github.io')) {
      return '/'
    }

    return `/${repositoryName}/`
  }

  return '/'
}

const versionHash=createHash('sha256')
function includeVersion(directory){for(const entry of readdirSync(directory,{withFileTypes:true}).sort((a,b)=>a.name.localeCompare(b.name))){const p=path.join(directory,entry.name);if(entry.isDirectory())includeVersion(p);else{versionHash.update(path.relative(__dirname,p));versionHash.update(readFileSync(p));}}}
includeVersion(path.join(__dirname,'src'));includeVersion(path.join(__dirname,'public'));for(const name of ['package.json','package-lock.json','vite.config.mjs'])versionHash.update(readFileSync(path.join(__dirname,name)));
const buildId=versionHash.digest('hex').slice(0,20)
export default defineConfig({
  define:{'import.meta.env.VITE_APP_VERSION':JSON.stringify(buildId)},
  plugins: [react(),mandatoryUpdatePlugin('KCS_NEXUS')],
  base: getBasePath(),
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 5173,
    strictPort: true,
    headers: {
      'Cache-Control': 'no-store, max-age=0',
      Pragma: 'no-cache',
      Expires: '0',
    },
    proxy: {
      '/api': {
        target: devApiProxyTarget,
        changeOrigin: true,
      },
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom', 'react-router-dom'],
          ui: ['framer-motion', 'lucide-react'],
          charts: ['recharts'],
        },
      },
    },
    sourcemap: false,
    minify: 'terser',
  },
})
