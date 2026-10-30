import type { z } from "zod";
import {
  cantidad,
  type cargaFrascosSchema,
  type conteosResumenSchema,
} from "./carga";
import { Metrica } from "./componentes";

export function CargaFrascos({
  carga,
}: {
  carga: z.infer<typeof cargaFrascosSchema>;
}) {
  return (
    <>
      {(
        [
          ["Frascos comprometidos", "frascos_comprometidos"],
          ["Límite de frascos", "limite_frascos"],
          ["Frascos en transporte", "frascos_en_transporte"],
          ["Frascos reservados", "frascos_reservados"],
          ["Frascos disponibles", "frascos_disponibles"],
          [
            "Solicitudes sin frascos registrados",
            "solicitudes_sin_cantidad_frascos",
          ],
        ] as const
      ).map(([titulo, campo]) => (
        <div key={campo}>
          <dt>{titulo}</dt>
          <dd>{cantidad(carga[campo])}</dd>
        </div>
      ))}
    </>
  );
}
export function ResumenFrascos({
  frascos,
}: {
  frascos?: z.infer<typeof conteosResumenSchema>;
}) {
  return (
    <div className="metricas dos borde-arriba">
      <Metrica
        etiqueta="Frascos recogidos conocidos"
        valor={cantidad(frascos?.recogidos_conocidos)}
        nota={`${cantidad(frascos?.recolecciones_sin_cantidad)} recolecciones sin cantidad registrada`}
      />
      <Metrica
        etiqueta="Frascos entregados conocidos"
        valor={cantidad(frascos?.entregados_conocidos)}
        nota={`${cantidad(frascos?.entregas_sin_cantidad)} entregas sin cantidad registrada`}
      />
    </div>
  );
}
