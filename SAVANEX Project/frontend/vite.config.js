import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  base: '/Syst-me-de-gestion-scolaire/',
  plugins: [react()],
  server: {
    port: 3000,
  },
});
