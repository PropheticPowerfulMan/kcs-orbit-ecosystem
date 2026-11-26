import { copyFileSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const dist = join(process.cwd(), "dist");
const indexPath = join(dist, "index.html");
const indexHtml = readFileSync(indexPath, "utf8");
const manifestHref = indexHtml.match(/href="([^"]*manifest\.webmanifest)"/)?.[1] || "/manifest.webmanifest";
const basePath = manifestHref.slice(0, -"manifest.webmanifest".length) || "/";

const manifestPath = join(dist, "manifest.webmanifest");
const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
manifest.id = basePath;
manifest.start_url = basePath;
manifest.scope = basePath;
manifest.launch_handler = { client_mode: "navigate-existing" };
manifest.related_applications = [{ platform: "webapp", url: basePath + "manifest.webmanifest", ...(process.env.VITE_PUBLIC_APP_URL ? { id: new URL(basePath, process.env.VITE_PUBLIC_APP_URL).href } : {}) }];
manifest.prefer_related_applications = false;
manifest.icons = manifest.icons.map((icon) => ({
  ...icon,
  src: basePath + icon.src.split("/").pop()
}));
writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + "\n");

const serviceWorkerPath = join(dist, "sw.js");
const serviceWorker = readFileSync(serviceWorkerPath, "utf8")
  .replace('const BASE_PATH = "/LessonPlanPowerfullyDone/";', "const BASE_PATH = " + JSON.stringify(basePath) + ";");
writeFileSync(serviceWorkerPath, serviceWorker);

copyFileSync(indexPath, join(dist, "404.html"));
writeFileSync(join(dist, ".nojekyll"), "");