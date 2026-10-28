import { describe, expect, it } from "vitest";
import {
  limitesMotoristasSchema,
  puedeConfigurarLimites,
} from "../src/limites-motoristas";
import { perfil } from "./fixtures";

const empresa = {
  alcance: "EMPRESA" as const,
  empresa_id: perfil.empresa.id,
  limite_tubos: 20,
  limite_solicitudes: 5,
};
const red = {
  alcance: "RED" as const,
  limite_tubos: 25,
  limite_solicitudes: 3,
};
describe("Límites compartidos 0.41.0", () => {
  it("distingue empresa y red sin valores de reserva ni empresa inventada", () => {
    expect(limitesMotoristasSchema.parse(empresa)).toEqual(empresa);
    expect(limitesMotoristasSchema.parse(red)).toEqual(red);
    expect(
      limitesMotoristasSchema.safeParse({ ...empresa, empresa_id: undefined })
        .success,
    ).toBe(false);
    expect(
      limitesMotoristasSchema.safeParse({ ...red, alcance: "GLOBAL" }).success,
    ).toBe(false);
  });
  it("rechaza booleanos, fracciones, cero y límites de solicitudes superiores a cinco", () => {
    for (const limite_tubos of [true, false, 0, -1, 1.5, 2147483648])
      expect(
        limitesMotoristasSchema.safeParse({ ...empresa, limite_tubos }).success,
      ).toBe(false);
    for (const limite_solicitudes of [true, 0, 1.5, 6])
      expect(
        limitesMotoristasSchema.safeParse({ ...empresa, limite_solicitudes })
          .success,
      ).toBe(false);
  });
  it("empresa requiere permiso de empresa y alcance completo, no administración de motorista", () => {
    expect(puedeConfigurarLimites(perfil, empresa)).toBe(false);
    const admin = {
      ...perfil,
      permisos: [...perfil.permisos, "empresa.administrar"],
    };
    expect(puedeConfigurarLimites(admin, empresa)).toBe(true);
    expect(
      puedeConfigurarLimites(
        {
          ...admin,
          roles: admin.roles.map((r) => ({
            ...r,
            tipo_alcance: "SUCURSAL" as const,
          })),
        },
        empresa,
      ),
    ).toBe(false);
    expect(
      puedeConfigurarLimites(admin, { ...empresa, empresa_id: "otra-empresa" }),
    ).toBe(false);
  });
  it("red exige configuración global y no concede el permiso por ser administrador de cliente", () => {
    const admin = {
      ...perfil,
      permisos: [
        ...perfil.permisos,
        "empresa.administrar",
        "configuracion.administrar",
      ],
    };
    expect(puedeConfigurarLimites(admin, red)).toBe(false);
    expect(
      puedeConfigurarLimites(
        {
          ...admin,
          roles: admin.roles.map((r) => ({
            ...r,
            tipo_alcance: "GLOBAL" as const,
            empresa_id: null,
          })),
        },
        red,
      ),
    ).toBe(true);
  });
});
