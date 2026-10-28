import { useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "./auth";
import { api, ApiError, consulta, parsear } from "./api";
import { detalleSolicitudSchema } from "./contratos-admin";
import { catalogoSchema, opcionesSolicitudSchema } from "./contratos-gestion";
import { Cabecera, Campo } from "./admin-comunes";
import {
  Cargando,
  ErrorCampo,
  ErrorVista,
  Vacio,
  useConsulta,
} from "./componentes";
import { EmpresaCampo, Formulario, useOperacion } from "./formularios";

export function NuevaSolicitud() {
  const { perfil } = useAuth();
  const [empresa, setEmpresa] = useState(perfil?.empresa?.id ?? "");
  return (
    <>
      <Link to="/solicitudes" className="enlace-volver">
        Volver a solicitudes
      </Link>
      <Cabecera
        titulo="Crear solicitud"
        texto="Registra el traslado, sus tubos y los artículos que transportará el motorista."
      />
      <EmpresaCampo valor={empresa} cambiar={setEmpresa} />
      {empresa && <DatosSolicitud key={empresa} empresa={empresa} />}
    </>
  );
}
function DatosSolicitud({ empresa }: { empresa: string }) {
  const navegar = useNavigate();
  const operacion = useOperacion();
  const [modalidad, setModalidad] = useState("");
  const [origen, setOrigen] = useState("");
  const [destino, setDestino] = useState("");
  const [articulos, setArticulos] = useState([1]);
  const secuencia = useRef(1);
  const ruta = `/api/v1/solicitudes/opciones-creacion/${consulta({ empresa_id: empresa, modalidad, origen_id: origen })}`;
  const opciones = useConsulta(
    async (signal) =>
      parsear(opcionesSolicitudSchema, await api.solicitar(ruta, { signal })),
    ruta,
  );
  const servicios = useConsulta(
    async (signal) =>
      parsear(
        catalogoSchema,
        await api.solicitar("/api/v1/solicitudes/tipos-servicio/", { signal }),
      ),
    "servicios",
  );
  const datos = opciones.datos;
  const especial = modalidad === "ESPECIAL";
  const origenElegido = datos?.origenes.find((o) => o.ubicacion.id === origen);
  const listo = Boolean(
    !opciones.cargando &&
    !opciones.error &&
    !servicios.cargando &&
    !servicios.error &&
    datos?.modalidades.some((m) => m.codigo === modalidad) &&
    origenElegido &&
    (especial
      ? datos?.puede_crear_envio_especial
      : datos?.destinos.some((d) => d.ubicacion.id === destino)),
  );
  return (
    <Formulario
      titulo="Datos del traslado"
      operacion={operacion}
      cancelar={() => navegar("/solicitudes")}
      textoGuardar="Crear solicitud"
      enviar={async (form) => {
        if (!listo || !datos)
          throw new ApiError(400, {
            origen_id: [
              "Selecciona una ruta disponible antes de crear la solicitud.",
            ],
          });
        if (
          !servicios.datos?.resultados.some(
            (s) => s.id === form.get("tipo_servicio_id"),
          )
        )
          throw new ApiError(400, {
            tipo_servicio_id: ["Selecciona un servicio disponible."],
          });
        try {
          const nueva = parsear(
            detalleSolicitudSchema,
            await api.solicitar("/api/v1/solicitudes/", {
              method: "POST",
              body: JSON.stringify({
                empresa_id: empresa,
                sucursal_id: origenElegido!.sucursal_id,
                modalidad,
                prioridad: form.get("prioridad"),
                tipo_servicio_id: form.get("tipo_servicio_id"),
                origen_id: origen,
                destino_id: especial ? null : destino,
                destino_especial: especial
                  ? String(form.get("destino_especial")).trim()
                  : null,
                cantidad_tubos: Number(form.get("cantidad_tubos")),
                notas: String(form.get("notas")).trim() || null,
                articulos: articulos.map((id) =>
                  Object.fromEntries(
                    [
                      "tipo_articulo",
                      "descripcion",
                      "cantidad",
                      "codigo_referencia",
                      "condicion_transporte",
                      "notas",
                    ].map((campo) => [
                      campo,
                      String(
                        form.get(`articulos-${id}-${campo}`) ?? "",
                      ).trim() || null,
                    ]),
                  ),
                ),
              }),
            }),
          );
          navegar(`/solicitudes/${nueva.id}`, {
            replace: true,
            state: {
              mensaje: `Solicitud ${nueva.numero} creada. ${nueva.estado === "ASSIGNED" ? "El servidor ya asignó un motorista." : "Quedó pendiente de asignación."}`,
            },
          });
        } catch (error) {
          if (
            error instanceof ApiError &&
            Array.isArray(error.campos.articulos)
          ) {
            const campos = { ...error.campos };
            delete campos.articulos;
            error.campos.articulos.forEach((item, i) => {
              if (item && typeof item === "object" && articulos[i])
                Object.entries(item).forEach(([campo, valor]) => {
                  campos[`articulos-${articulos[i]}-${campo}`] = valor;
                });
              else if (typeof item === "string") campos.articulos = item;
            });
            throw new ApiError(error.status, campos, error.espera);
          }
          throw error;
        }
      }}
    >
      {opciones.cargando && <Cargando texto="Consultando rutas autorizadas…" />}
      {opciones.error != null && (
        <ErrorVista error={opciones.error} reintentar={opciones.recargar} />
      )}
      {servicios.error != null && (
        <ErrorVista error={servicios.error} reintentar={servicios.recargar} />
      )}
      <div className="form-grid">
        <label className="campo-form" htmlFor="modalidad">
          Modalidad
          <select
            id="modalidad"
            required
            value={modalidad}
            onChange={(e) => {
              setModalidad(e.target.value);
              setOrigen("");
              setDestino("");
            }}
            aria-describedby="modalidad-error"
          >
            <option value="">Selecciona una modalidad</option>
            {datos?.modalidades.map((m) => (
              <option key={m.codigo} value={m.codigo}>
                {m.nombre}
              </option>
            ))}
          </select>
          <ErrorCampo campo="modalidad" error={operacion.error} />
        </label>
        <label className="campo-form" htmlFor="prioridad">
          Prioridad
          <select id="prioridad" name="prioridad" defaultValue="NORMAL">
            <option value="NORMAL">Normal</option>
            <option value="PRIORITY">Prioritaria</option>
          </select>
          <ErrorCampo campo="prioridad" error={operacion.error} />
        </label>
        <label className="campo-form" htmlFor="origen_id">
          Sucursal de origen
          <select
            id="origen_id"
            required
            disabled={!modalidad || opciones.cargando}
            value={origen}
            onChange={(e) => {
              setOrigen(e.target.value);
              setDestino("");
            }}
            aria-describedby="origen_id-error"
          >
            <option value="">Selecciona un origen</option>
            {datos?.origenes.map((o) => (
              <option key={o.ubicacion.id} value={o.ubicacion.id}>
                {o.sucursal_nombre ?? o.ubicacion.nombre} ·{" "}
                {o.ubicacion.direccion}
              </option>
            ))}
          </select>
          <ErrorCampo campo="origen_id" error={operacion.error} />
          <ErrorCampo campo="sucursal_id" error={operacion.error} />
        </label>
        {especial ? (
          <Campo
            nombre="destino_especial"
            etiqueta="Descripción del destino especial"
            required
            error={operacion.error}
          />
        ) : (
          <label className="campo-form" htmlFor="destino_id">
            Destino
            <select
              id="destino_id"
              required
              disabled={!origen || opciones.cargando}
              value={destino}
              onChange={(e) => setDestino(e.target.value)}
              aria-describedby="destino_id-error"
            >
              <option value="">Selecciona un destino</option>
              {datos?.destinos.map((d) => (
                <option key={d.ubicacion.id} value={d.ubicacion.id}>
                  {d.sucursal_nombre ?? d.ubicacion.nombre} ·{" "}
                  {d.ubicacion.direccion}
                </option>
              ))}
            </select>
            <ErrorCampo campo="destino_id" error={operacion.error} />
          </label>
        )}
        <label className="campo-form" htmlFor="tipo_servicio_id">
          Tipo de servicio
          <select
            id="tipo_servicio_id"
            name="tipo_servicio_id"
            required
            defaultValue=""
            disabled={servicios.cargando}
            aria-describedby="tipo_servicio_id-error"
          >
            <option value="">Selecciona un servicio</option>
            {servicios.datos?.resultados.map((s) => (
              <option key={s.id} value={s.id}>
                {s.nombre}
              </option>
            ))}
          </select>
          <ErrorCampo campo="tipo_servicio_id" error={operacion.error} />
        </label>
        <Campo
          nombre="cantidad_tubos"
          etiqueta="Cantidad de tubos"
          type="number"
          min={1}
          max={2147483647}
          step={1}
          required
          error={operacion.error}
        />
      </div>
      {datos?.mensaje_disponibilidad && (
        <p className="aviso" role="status">
          {datos.mensaje_disponibilidad}
        </p>
      )}
      {datos && !datos.modalidades.length && (
        <Vacio
          titulo="Sin modalidades disponibles"
          texto="No hay modalidades autorizadas en esta empresa."
        />
      )}
      <p className="ayuda-form">
        Los tubos determinan la capacidad. Las cantidades de los artículos se
        registran por separado. La asignación automática la realiza el servidor.
      </p>
      <Campo
        nombre="notas"
        etiqueta="Notas del traslado"
        error={operacion.error}
      />
      <div className="subform" id="articulos" tabIndex={-1}>
        <h3>Artículos del traslado</h3>
        <ErrorCampo campo="articulos" error={operacion.error} />
        {articulos.map((id, i) => (
          <fieldset className="articulo-form" key={id}>
            <legend>Artículo {i + 1}</legend>
            <div className="form-grid">
              <Campo
                nombre={`articulos-${id}-tipo_articulo`}
                etiqueta={`Tipo de artículo ${i + 1}`}
                maxLength={100}
                required
                error={operacion.error}
              />
              <Campo
                nombre={`articulos-${id}-cantidad`}
                etiqueta={`Cantidad del artículo ${i + 1}`}
                type="number"
                min="0.01"
                max="9999999999.99"
                step="0.01"
                defaultValue="1"
                required
                error={operacion.error}
              />
              <Campo
                nombre={`articulos-${id}-descripcion`}
                etiqueta={`Descripción del artículo ${i + 1}`}
                error={operacion.error}
              />
              <Campo
                nombre={`articulos-${id}-codigo_referencia`}
                etiqueta={`Referencia del artículo ${i + 1}`}
                maxLength={120}
                error={operacion.error}
              />
              <Campo
                nombre={`articulos-${id}-condicion_transporte`}
                etiqueta={`Condición de transporte del artículo ${i + 1}`}
                maxLength={200}
                error={operacion.error}
              />
              <Campo
                nombre={`articulos-${id}-notas`}
                etiqueta={`Notas del artículo ${i + 1}`}
                error={operacion.error}
              />
            </div>
            <button
              type="button"
              className="boton texto"
              disabled={articulos.length === 1}
              onClick={() =>
                setArticulos((actual) => actual.filter((a) => a !== id))
              }
            >
              Quitar artículo {i + 1}
            </button>
          </fieldset>
        ))}
        <button
          type="button"
          className="boton secundario"
          onClick={() => {
            const id = ++secuencia.current;
            setArticulos((actual) => [...actual, id]);
          }}
        >
          Añadir artículo
        </button>
      </div>
    </Formulario>
  );
}
