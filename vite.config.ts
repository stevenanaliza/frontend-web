import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
export default defineConfig(({ mode, command, isPreview }) => {
  const env = loadEnv(mode, process.cwd(), "VITE_");
  const usarProxy =
    command === "serve" &&
    !isPreview &&
    mode !== "prueba" &&
    env.VITE_API_PROXY === "true";
  if (usarProxy) {
    const destino = new URL(env.VITE_API_URL);
    if (
      !["http:", "https:"].includes(destino.protocol) ||
      destino.username ||
      destino.password ||
      destino.pathname !== "/" ||
      destino.search ||
      destino.hash
    ) {
      throw new Error(
        "VITE_API_URL debe ser el origen HTTP(S) del backend, sin rutas ni credenciales.",
      );
    }
  }
  return {
    plugins: [react()],
    server: {
      port: 5173,
      strictPort: true,
      proxy: usarProxy
        ? { "/api/v1/": { target: env.VITE_API_URL, changeOrigin: true } }
        : undefined,
    },
  };
});
