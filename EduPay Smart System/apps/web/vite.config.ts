import {createHash} from "node:crypto";
import {readdirSync,readFileSync} from "node:fs";
import {join} from "node:path";
import {fileURLToPath} from "node:url";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

const disablePwa =
  (process.env.VITE_DISABLE_PWA ?? "").trim().toLowerCase() === "true";
const appBasePath = process.env.VITE_BASE_PATH || "/EduPay-Smart-System/";

const appRoot=fileURLToPath(new URL(".",import.meta.url));
const hash=createHash("sha256");
function includeVersion(directory:string,all=false){for(const entry of readdirSync(directory,{withFileTypes:true}).sort((a,b)=>a.name.localeCompare(b.name))){const p=join(directory,entry.name);if(entry.isDirectory())includeVersion(p,all);else if(all||/\.(tsx?|jsx?|css)$/.test(entry.name)){hash.update(p.slice(appRoot.length));hash.update(readFileSync(p));}}}
includeVersion(join(appRoot,"src"));includeVersion(join(appRoot,"public"),true);hash.update(readFileSync(join(appRoot,"../../pnpm-lock.yaml")));hash.update(readFileSync(join(appRoot,"vite.config.ts")));hash.update(readFileSync(join(appRoot,"package.json")));
const buildId=hash.digest("hex").slice(0,20);
export default defineConfig({
  define:{"import.meta.env.VITE_APP_VERSION":JSON.stringify(buildId)},
  base: appBasePath,
  plugins: [
    react(),
    {name:"edupay-public-version",generateBundle(){this.emitFile({type:"asset",fileName:"app-version.json",source:JSON.stringify({app:"KCS_EDUPAY",id:buildId})});}},
    !disablePwa && VitePWA({
      registerType: "autoUpdate",
      injectRegister:false,
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
        start_url: appBasePath + "#/",
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
            url: appBasePath + "#/",
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
        cleanupOutdatedCaches: true,
        clientsClaim: true,
        skipWaiting: true,
        navigateFallbackDenylist: [/^\/api\//],
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
