import { describe, expect, it } from "vitest";
import { parsear } from "../src/api";
import {
  lecturaSchema,
  paginaSchema,
  perfilSchema,
  resumenSchema,
} from "../src/contratos";
import { puedeEntrar, puedeVerReportes } from "../src/permisos";
import { lecturas, lista, perfil, resumen } from "./fixtures";
describe("Contrato 0.39 y 0.40", () => {
  it("acepta los ejemplos completos del documento oficial", () => {
    expect(parsear(paginaSchema(resumenSchema), lista).conteo).toBe(1);
    expect(
      parsear(paginaSchema(lecturaSchema), lecturas).resultados[0]
        .temperatura_contenedor_c,
    ).toBeNull();
  });
  it("conserva cero, null y datos incompletos sin rellenarlos", () => {
    const ejemplo = {
      ...resumen,
      kilometraje: {
        ...resumen.kilometraje,
        kilometros_medidos: null,
        kilometros_consolidados: "0.000",
        completo: false,
      },
      temperaturas: {
        ...resumen.temperaturas,
        minima_c: null,
        promedio_c: "0.00",
      },
    };
    const datos = parsear(resumenSchema, ejemplo);
    expect(datos.kilometraje.kilometros_medidos).toBeNull();
    expect(datos.kilometraje.kilometros_consolidados).toBe("0.000");
    expect(datos.temperaturas.promedio_c).toBe("0.00");
  });
  it("rechaza respuestas incompletas en lugar de simular datos", () => {
    expect(() =>
      parsear(resumenSchema, { ...resumen, carga_actual: undefined }),
    ).toThrow();
  });
  it("no trata permisos operativos de solicitantes o motoristas como administración", () => {
    const operativo = {
      ...perfil,
      permisos: [
        "solicitud.ver_propias",
        "jornada.ver",
        "evidencia.ver",
        "repartidor.ver",
      ],
    };
    expect(puedeEntrar(operativo)).toBe(false);
    expect(puedeVerReportes(operativo)).toBe(false);
  });
  it("exige todos los permisos del reporte", () => {
    const valido = parsear(perfilSchema, perfil);
    expect(puedeEntrar(valido)).toBe(true);
    expect(puedeVerReportes(valido)).toBe(true);
    for (const permiso of [
      "repartidor.ver",
      "reporte.ver",
      "solicitud.ver",
      "jornada.ver",
      "evidencia.ver",
    ])
      expect(
        puedeVerReportes({
          ...valido,
          permisos: valido.permisos.filter((p) => p !== permiso),
        }),
      ).toBe(false);
  });
});
