import {mandatoryUpdatePlugin} from './client-runtime/vite.mjs'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
export default defineConfig({ plugins: [react(),mandatoryUpdatePlugin('KCS_KITCHEN')], base: process.env.VITE_BASE_PATH || '/kitchen/' })
