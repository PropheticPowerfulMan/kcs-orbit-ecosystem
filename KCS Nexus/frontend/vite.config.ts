import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

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

export default defineConfig({
  plugins: [react()],
  base: getBasePath(),
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 3000,
    proxy: {
      '/api': {
        target: 'http://localhost:5000',
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
