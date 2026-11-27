import {mandatoryUpdatePlugin} from './client-runtime/vite.mjs'
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  base: "./",
  plugins: [react(),mandatoryUpdatePlugin('KCS_EDUSYNC')],
  server: {
    port: 5173,
  },
});
