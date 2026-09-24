import tailwindcss from "@tailwindcss/vite";
import { tanstackRouter } from "@tanstack/router-plugin/vite";
import react from "@vitejs/plugin-react";
import { defineConfig, loadEnv } from "vite";

export default defineConfig(({ mode }) => {
  const env = { ...loadEnv(mode, "../..", ""), ...process.env };
  return {
    plugins: [
      tanstackRouter({ target: "react", autoCodeSplitting: true }), // must come before react()
      react(),
      tailwindcss(),
    ],
    server: {
      port: Number(env.WEB_PORT ?? 5173),
      strictPort: true,
      proxy: { "/api": { target: env.API_PROXY_TARGET ?? "http://localhost:8787" } },
    },
    preview: { port: Number(env.WEB_PORT ?? 5173) },
  };
});
