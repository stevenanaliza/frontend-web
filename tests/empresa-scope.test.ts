import { describe, expect, it } from "vitest";
import { perfilSchema } from "../src/contratos";
import { empresaDeConsulta, puedeElegirEmpresa } from "../src/permisos";
import { perfil as ejemplo } from "./fixtures";

describe("alcance de empresa en el panel", () => {
  it("Corporate usa su empresa aunque la URL solicite otra", () => {
    const perfil = perfilSchema.parse(ejemplo);
    expect(puedeElegirEmpresa(perfil)).toBe(false);
    expect(empresaDeConsulta(perfil, "empresa-ajena")).toBe(perfil.empresa?.id);
  });

  it("el operador de Network puede seleccionar la empresa", () => {
    const perfil = perfilSchema.parse({
      ...ejemplo,
      roles: [
        {
          codigo: "OPERADOR_RED",
          nombre: "Operador de Network",
          tipo_alcance: "GLOBAL",
          empresa_id: null,
          sucursal_id: null,
        },
      ],
    });
    expect(puedeElegirEmpresa(perfil)).toBe(true);
    expect(empresaDeConsulta(perfil, "empresa-elegida")).toBe(
      "empresa-elegida",
    );
  });
  it("un alcance global de Corporate conserva la empresa propia y no habilita el selector de Network", () => {
    const perfil = perfilSchema.parse({
      ...ejemplo,
      roles: ejemplo.roles.map((r) => ({
        ...r,
        tipo_alcance: "GLOBAL",
        empresa_id: null,
      })),
    });
    expect(puedeElegirEmpresa(perfil)).toBe(false);
    expect(empresaDeConsulta(perfil, "empresa-ajena")).toBe(ejemplo.empresa.id);
  });
});
