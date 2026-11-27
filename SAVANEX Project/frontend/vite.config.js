import {mandatoryUpdatePlugin} from './client-runtime/vite.mjs'
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  base: process.env.VITE_BASE_PATH || '/Syst-me-de-gestion-scolaire/',
  plugins: [react(),mandatoryUpdatePlugin('KCS_SAVANEX')],
  server: {
    port: 3000,
  },
});
