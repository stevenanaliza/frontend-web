import { useState } from "react";
import { useAuth } from "./auth";
import { api, ApiError, parsear } from "./api";
import {
  motoristaSchema,
  sucursalSchema,
  ubicacionEmpresaSchema,
  usuarioSchema,
  vehiculoSchema,
} from "./contratos-admin";
import { Campo, uuidPattern } from "./admin-comunes";
import {
  EmpresaCampo,
  Formulario,
  SelectorRemoto,
  useOperacion,
} from "./formularios";

export function NuevaSucursal({
  empresa,
  cerrar,
  creada,
}: {
  empresa: string;
  cerrar: () => void;
  creada: () => void;
}) {
  const { perfil } = useAuth();
  const operacion = useOperacion();
  const [ubicacion, setUbicacion] = useState(""),
    [relacion, setRelacion] = useState("");
  return (
    <Formulario
      titulo="Crear sucursal"
      operacion={operacion}
      cancelar={cerrar}
      textoGuardar="Crear sucursal"
      enviar={async (datos) => {
        if (!ubicacion)
          throw new ApiError(400, {
            ubicacion_id: ["Selecciona una ubicación aprobada."],
          });
        parsear(
          sucursalSchema,
          await api.solicitar(
            `/api/v1/organizaciones/empresas/${encodeURIComponent(empresa)}/sucursales/`,
            {
              method: "POST",
              body: JSON.stringify({
                nombre: String(datos.get("nombre")).trim(),
                codigo: String(datos.get("codigo")).trim(),
                ubicacion_id: ubicacion,
                telefono: String(datos.get("telefono")).trim() || null,
                correo: String(datos.get("correo")).trim() || null,
              }),
            },
          ),
        );
        creada();
      }}
    >
      <div className="form-grid">
        <Campo
          nombre="nombre"
          etiqueta="Nombre de la sucursal"
          required
          error={operacion.error}
        />
        <Campo
          nombre="codigo"
          etiqueta="Código de sucursal"
          required
          error={operacion.error}
        />
        <Campo
          nombre="telefono"
          etiqueta="Teléfono"
          type="tel"
          error={operacion.error}
        />
        <Campo
          nombre="correo"
          etiqueta="Correo de la sucursal"
          type="email"
          error={operacion.error}
        />
      </div>
      {perfil?.permisos.includes("ubicacion.ver") ? (
        <SelectorRemoto
          ruta="/api/v1/ubicaciones/"
          schema={ubicacionEmpresaSchema}
          filtros={{ empresa_id: empresa }}
          nombre="ubicacion_id"
          etiqueta="Ubicación aprobada"
          valor={relacion}
          cambiar={(id, item) => {
            setRelacion(id);
            setUbicacion(item.ubicacion.id);
          }}
          describir={(u) => `${u.ubicacion.nombre} · ${u.ubicacion.direccion}`}
          permitido={(u) =>
            u.empresa_id === empresa &&
            u.estado === "APROBADO" &&
            u.ubicacion.estado === "ACTIVO"
          }
          error={operacion.error}
        />
      ) : (
        <Campo
          nombre="ubicacion_id"
          etiqueta="ID de una ubicación aprobada de la empresa"
          value={ubicacion}
          onChange={(e) => setUbicacion(e.target.value)}
          pattern={uuidPattern}
          required
          error={operacion.error}
        />
      )}
    </Formulario>
  );
}
export function NuevoVehiculo({
  empresa,
  cerrar,
  creado,
}: {
  empresa: string;
  cerrar: () => void;
  creado: (id: string) => void;
}) {
  const operacion = useOperacion();
  return (
    <Formulario
      titulo="Registrar motocicleta"
      operacion={operacion}
      cancelar={cerrar}
      textoGuardar="Registrar motocicleta"
      enviar={async (datos) => {
        if (!empresa)
          throw new ApiError(400, { empresa_id: ["Selecciona una empresa."] });
        const nuevo = parsear(
          vehiculoSchema,
          await api.solicitar("/api/v1/vehiculos/", {
            method: "POST",
            body: JSON.stringify({
              empresa_id: empresa,
              placa: String(datos.get("placa")).trim(),
              tipo: "MOTOCICLETA",
              marca: String(datos.get("marca")).trim() || null,
              modelo: String(datos.get("modelo")).trim() || null,
              anio: datos.get("anio") ? Number(datos.get("anio")) : null,
              estado: "ACTIVO",
              notas: String(datos.get("notas")).trim() || null,
            }),
          }),
        );
        creado(nuevo.id);
      }}
    >
      <div className="form-grid">
        <Campo
          nombre="placa"
          etiqueta="Placa"
          required
          error={operacion.error}
        />
        <Campo nombre="marca" etiqueta="Marca" error={operacion.error} />
        <Campo nombre="modelo" etiqueta="Modelo" error={operacion.error} />
        <Campo
          nombre="anio"
          etiqueta="Año"
          type="number"
          step={1}
          error={operacion.error}
        />
        <Campo nombre="notas" etiqueta="Notas" error={operacion.error} />
      </div>
    </Formulario>
  );
}
export function NuevoMotorista({
  cerrar,
  creado,
}: {
  cerrar: () => void;
  creado: () => void;
}) {
  const { perfil } = useAuth();
  const [empresa, setEmpresa] = useState(perfil?.empresa?.id ?? "");
  const [usuario, setUsuario] = useState(""),
    [vehiculo, setVehiculo] = useState("");
  const [registrarVehiculo, setRegistrarVehiculo] = useState(false),
    [version, setVersion] = useState(0);
  const operacion = useOperacion();
  if (registrarVehiculo)
    return (
      <NuevoVehiculo
        empresa={empresa}
        cerrar={() => setRegistrarVehiculo(false)}
        creado={(id) => {
          setRegistrarVehiculo(false);
          setVehiculo(id);
          setVersion((v) => v + 1);
        }}
      />
    );
  return (
    <Formulario
      titulo="Crear perfil de motorista"
      operacion={operacion}
      cancelar={cerrar}
      textoGuardar="Crear motorista"
      aviso={
        <p className="ayuda-form">
          La persona debe tener previamente el rol de motorista de la empresa.
          El servidor verifica usuario, rol y vehículo.
        </p>
      }
      enviar={async () => {
        if (!empresa || !usuario)
          throw new ApiError(400, {
            ...(!empresa ? { empresa_id: ["Selecciona una empresa."] } : {}),
            ...(!usuario
              ? { usuario_id: ["Selecciona un usuario elegible."] }
              : {}),
          });
        parsear(
          motoristaSchema,
          await api.solicitar("/api/v1/repartidores/", {
            method: "POST",
            body: JSON.stringify({
              empresa_id: empresa,
              usuario_id: usuario,
              vehiculo_id: vehiculo || null,
            }),
          }),
        );
        creado();
      }}
    >
      <EmpresaCampo
        valor={empresa}
        cambiar={(id) => {
          setEmpresa(id);
          setUsuario("");
          setVehiculo("");
        }}
        error={operacion.error}
      />
      {empresa && (
        <>
          {perfil?.permisos.includes("usuario.ver") ? (
            <SelectorRemoto
              key={`usuarios:${empresa}`}
              ruta="/api/v1/usuarios/"
              schema={usuarioSchema}
              nombre="usuario_id"
              etiqueta="Usuario motorista"
              valor={usuario}
              cambiar={(id) => setUsuario(id)}
              describir={(u) => `${u.nombres} ${u.apellidos} · ${u.correo}`}
              permitido={(u) =>
                u.estado === "ACTIVO" &&
                u.empresa_id === empresa &&
                u.roles.some(
                  (r) =>
                    r.codigo === "REPARTIDOR_CORPORATIVO" &&
                    r.empresa_id === empresa,
                )
              }
              error={operacion.error}
            />
          ) : (
            <Campo
              nombre="usuario_id"
              etiqueta="ID del usuario motorista autorizado"
              value={usuario}
              onChange={(e) => setUsuario(e.target.value)}
              pattern={uuidPattern}
              required
              error={operacion.error}
            />
          )}{" "}
          {perfil?.permisos.includes("vehiculo.ver") ? (
            <SelectorRemoto
              key={`vehiculos:${empresa}:${version}`}
              ruta="/api/v1/vehiculos/"
              schema={vehiculoSchema}
              filtros={{
                empresa_id: empresa,
                estado: "ACTIVO",
                tipo: "MOTOCICLETA",
              }}
              nombre="vehiculo_id"
              etiqueta="Motocicleta activa"
              valor={vehiculo}
              cambiar={(id) => setVehiculo(id)}
              describir={(v) =>
                `${v.placa} · ${[v.marca, v.modelo].filter(Boolean).join(" ")}`
              }
              permitido={(v) =>
                v.empresa_id === empresa &&
                v.estado === "ACTIVO" &&
                v.tipo === "MOTOCICLETA"
              }
              error={operacion.error}
            />
          ) : (
            <Campo
              nombre="vehiculo_id"
              etiqueta="ID de la motocicleta (opcional)"
              value={vehiculo}
              onChange={(e) => setVehiculo(e.target.value)}
              pattern={uuidPattern}
              error={operacion.error}
            />
          )}
          <div className="acciones">
            <button
              type="button"
              className="boton texto"
              onClick={() => setVehiculo("")}
            >
              Crear sin vehículo asignado
            </button>
            {perfil?.permisos.includes("vehiculo.administrar") && (
              <button
                type="button"
                className="boton secundario"
                onClick={() => setRegistrarVehiculo(true)}
              >
                Registrar motocicleta
              </button>
            )}
          </div>
          <p className="ayuda-form">
            Un perfil sin motocicleta activa no podrá operar hasta cumplir los
            requisitos del backend.
          </p>
        </>
      )}
    </Formulario>
  );
}
