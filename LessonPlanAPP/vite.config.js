import react from "@vitejs/plugin-react";
import { defineConfig, loadEnv } from "vite";
export default defineConfig(function (_a) {
    var mode = _a.mode;
    var env = loadEnv(mode, ".", "");
    return {
        base: env.VITE_BASE_PATH || (mode === "vps" ? "/" : "/LessonPlanPowerfullyDone/"),
        plugins: [react()],
        build: {
            rollupOptions: {
                output: {
                    manualChunks: {
                        react: ["react", "react-dom", "react-router-dom"],
                        animation: ["framer-motion"],
                        pdf: ["html2pdf.js"]
                    }
                }
            }
        },
        server: {
            host: "127.0.0.1",
            port: 5173
        }
    };
});
