import { build, createServer, preview } from "vite";

// Servidor dentro del proceso de prueba, con cierre explícito en Windows.
// El origen de prueba no se guarda en .env ni sustituye la configuración operativa.
export default async function prepararServidor() {
  const servidor = await createServer({
    mode: "prueba",
    define: {
      "import.meta.env.VITE_API_URL": JSON.stringify("http://api.vitago.test"),
      "import.meta.env.VITE_API_PROXY": JSON.stringify("false"),
    },
    server: { host: "127.0.0.1", port: 5174, strictPort: true },
  });
  await servidor.listen();
  // Compilación estática aislada: las peticiones llegan directamente a la API
  // HTTP de prueba en otro origen y pasan por el CORS real del navegador.
  let compilado: Awaited<ReturnType<typeof preview>> | undefined;
  try {
    const entornoAnterior = process.env.NODE_ENV;
    try {
      // createServer establece development; la compilación debe utilizar las
      // mismas variantes de React y Vite que un despliegue real.
      process.env.NODE_ENV = "production";
      await build({
        mode: "production",
        define: {
          "import.meta.env.VITE_API_URL": JSON.stringify(
            "http://127.0.0.1:5185",
          ),
        },
        build: { outDir: ".playwright/dist", emptyOutDir: true },
      });
    } finally {
      if (entornoAnterior === undefined) delete process.env.NODE_ENV;
      else process.env.NODE_ENV = entornoAnterior;
    }
    compilado = await preview({
      mode: "production",
      build: { outDir: ".playwright/dist" },
      preview: { host: "127.0.0.1", port: 5184, strictPort: true },
    });
  } catch (error) {
    await servidor.close();
    throw error;
  }
  return async () => {
    if (compilado)
      await new Promise<void>((resolve, reject) => {
        compilado!.httpServer.closeAllConnections();
        compilado!.httpServer.close((error) =>
          error ? reject(error) : resolve(),
        );
      });
    await servidor.close();
  };
}
