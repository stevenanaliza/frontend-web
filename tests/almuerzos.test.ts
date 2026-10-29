import { describe, expect, it } from "vitest";
import {
  coincideAlmuerzo,
  horaInicioAlmuerzo,
  textoAlmuerzo,
} from "../src/almuerzos";
import { motoristaSchema } from "../src/contratos-admin";
import { motorista } from "./fixtures";

describe("consulta administrativa de almuerzos 0.42.0", () => {
  it("conserva el indicador y la hora enviados por Django", () => {
    const actual = motoristaSchema.parse({
      ...motorista,
      estado_operativo: "PAUSED",
      en_almuerzo: true,
      almuerzo_iniciado_en: "2026-10-29T12:00:00-06:00",
    });
    expect(actual.en_almuerzo).toBe(true);
    expect(actual.almuerzo_iniciado_en).toBe("2026-10-29T12:00:00-06:00");
    expect(textoAlmuerzo(actual)).toBe("En almuerzo");
    expect(coincideAlmuerzo(actual, "true")).toBe(true);
    expect(coincideAlmuerzo(actual, "false")).toBe(false);
  });
  it("distingue una pausa genérica de un almuerzo", () => {
    const actual = motoristaSchema.parse({
      ...motorista,
      estado_operativo: "PAUSED",
      en_almuerzo: false,
      almuerzo_iniciado_en: null,
    });
    expect(textoAlmuerzo(actual)).toBe("Fuera de almuerzo");
    expect(coincideAlmuerzo(actual, "true")).toBe(false);
    expect(coincideAlmuerzo(actual, "false")).toBe(true);
  });
  it("no convierte una respuesta anterior al despliegue en fuera de almuerzo", () => {
    const anterior = motoristaSchema.parse({
      ...motorista,
      estado_operativo: "PAUSED",
    });
    expect(anterior.en_almuerzo).toBeUndefined();
    expect(textoAlmuerzo(anterior)).toBe("Sin información de almuerzo");
    expect(coincideAlmuerzo(anterior, "")).toBe(true);
    expect(coincideAlmuerzo(anterior, "false")).toBe(false);
    expect(coincideAlmuerzo(anterior, "true")).toBe(false);
    expect(coincideAlmuerzo(anterior, "sin_dato")).toBe(true);
  });
  it("mantiene la fecha, hora y offset del servidor aunque cambie la zona del navegador", () => {
    expect(horaInicioAlmuerzo("2026-10-29T12:03:00-06:00")).toBe(
      "29/10/2026, 12:03 (UTC-06:00)",
    );
    expect(horaInicioAlmuerzo("2026-10-29T23:15:00.123+02:00")).toBe(
      "29/10/2026, 23:15 (UTC+02:00)",
    );
    expect(horaInicioAlmuerzo("2026-10-29T18:00:00Z")).toBe(
      "29/10/2026, 18:00 (UTC)",
    );
  });
  it.each([{ en_almuerzo: "true" }, { almuerzo_iniciado_en: "no-es-fecha" }])(
    "rechaza campos incompatibles",
    (campos) => {
      expect(
        motoristaSchema.safeParse({ ...motorista, ...campos }).success,
      ).toBe(false);
    },
  );
});
