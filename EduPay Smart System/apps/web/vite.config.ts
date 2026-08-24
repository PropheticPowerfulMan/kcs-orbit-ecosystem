import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

const disablePwa =
  (process.env.VITE_DISABLE_PWA ?? "").trim().toLowerCase() === "true";
const appBasePath = process.env.VITE_BASE_PATH || "/EduPay-Smart-System/";

export default defineConfig({
  base: appBasePath,
  plugins: [
    react(),
    !disablePwa && VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["favicon.ico", "logo-school.png", "kcs.jpg", "apple-touch-icon.png", "icons/edupay-192.png", "icons/edupay-512.png", "icons/edupay-maskable-512.png"],
      manifest: {
        id: appBasePath,
        name: "EduPay KCS",
        short_name: "EduPay KCS",
        lang: "fr",
        description: "Application mobile et tablette de paiement scolaire pour Kinshasa Christian School",
        theme_color: "#031b34",
        background_color: "#020817",
        display: "standalone",
        display_override: ["window-controls-overlay", "standalone", "minimal-ui"],
        orientation: "any",
        scope: appBasePath,
        start_url: appBasePath + "#/dashboard",
        categories: ["education", "finance", "productivity"],
        icons: [
          { src: "icons/edupay-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
          { src: "icons/edupay-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
          { src: "icons/edupay-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" }
        ],
        shortcuts: [
          {
            name: "Dashboard",
            short_name: "Dashboard",
            url: appBasePath + "#/dashboard",
            icons: [{ src: "icons/edupay-192.png", sizes: "192x192", type: "image/png" }]
          },
          {
            name: "Paiements",
            short_name: "Paiements",
            url: appBasePath + "#/payments",
            icons: [{ src: "icons/edupay-192.png", sizes: "192x192", type: "image/png" }]
          },
          {
            name: "Parents",
            short_name: "Parents",
            url: appBasePath + "#/parents",
            icons: [{ src: "icons/edupay-192.png", sizes: "192x192", type: "image/png" }]
          }
        ]
      },
      workbox: {
        navigateFallback: appBasePath + "index.html",
        globPatterns: ["**/*.{js,css,html,ico,png,jpg,svg,woff2}"]
      }
    })
  ],
  server: {
    port: 5174,
    proxy: {
      "/api": "http://localhost:4000"
    }
  },
  build: {
    chunkSizeWarningLimit: 1000
  }
});
