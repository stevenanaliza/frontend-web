import { createServer } from "vite";

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
  return async () => {
    await servidor.close();
  };
}
