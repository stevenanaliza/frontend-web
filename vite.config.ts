import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
export default defineConfig(({ mode, command, isPreview }) => {
  const env = loadEnv(mode, process.cwd(), "VITE_");
  const usarProxy =
    command === "serve" &&
    !isPreview &&
    mode !== "prueba" &&
    env.VITE_API_PROXY === "true";
  if (usarProxy || command === "build") {
    if (!env.VITE_API_URL?.trim())
      throw new Error(
        "Falta VITE_API_URL. Configura el origen del backend Corporate antes de compilar y vuelve a desplegar.",
      );
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
    if (process.env.VERCEL === "1" && destino.protocol !== "https:")
      throw new Error(
        "VITE_API_URL debe usar HTTPS para publicar el panel en Vercel.",
      );
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
