import type { Page } from "@playwright/test";

// Doble del servicio externo; se ejecuta el SDK React real, sin claves ni mosaicos reales.
export async function simularGoogleMaps(page: Page, fallar = false) {
  await page.addInitScript(
    ({ fallar }) => {
      const eventos = new WeakMap<object, Map<string, Set<() => void>>>();
      const event = {
        addListener(obj: object, nombre: string, callback: () => void) {
          if (!eventos.has(obj)) eventos.set(obj, new Map());
          const mapa = eventos.get(obj)!;
          if (!mapa.has(nombre)) mapa.set(nombre, new Set());
          mapa.get(nombre)!.add(callback);
          return { remove: () => mapa.get(nombre)?.delete(callback) };
        },
        clearInstanceListeners(obj: object) {
          eventos.delete(obj);
        },
        trigger(obj: object, nombre: string) {
          eventos
            .get(obj)
            ?.get(nombre)
            ?.forEach((cb) => cb());
        },
      };
      class Mapa {
        centro = { lat: 0, lng: 0 };
        zoom = 2;
        constructor(
          public div: HTMLElement,
          opciones: Record<string, unknown>,
        ) {
          this.div.dataset.mapaDoble = "true";
          this.div.style.cssText =
            "height:100%;position:relative;background:#edf1f6;display:flex;align-items:center;justify-content:center;gap:18px;flex-wrap:wrap";
          const aviso = document.createElement("small");
          aviso.textContent = "Servicio de mapa simulado · Datos de prueba";
          aviso.style.cssText =
            "position:absolute;bottom:12px;left:12px;color:#626b78";
          div.append(aviso);
          this.setOptions(opciones);
        }
        getDiv() {
          return this.div;
        }
        setOptions(opciones: Record<string, unknown>) {
          if (opciones.center)
            this.centro = opciones.center as typeof this.centro;
          if (typeof opciones.zoom === "number") this.zoom = opciones.zoom;
        }
        getCenter() {
          const centro = this.centro;
          return {
            toJSON: () => centro,
            lat: () => centro.lat,
            lng: () => centro.lng,
          };
        }
        getZoom() {
          return this.zoom;
        }
        getTilt() {
          return 0;
        }
        getHeading() {
          return 0;
        }
        setCenter(centro: typeof this.centro) {
          this.centro = centro;
          event.trigger(this, "bounds_changed");
        }
        panTo(centro: typeof this.centro) {
          this.setCenter(centro);
        }
        setZoom(zoom: number) {
          this.zoom = zoom;
          event.trigger(this, "bounds_changed");
        }
        moveCamera(opciones: Record<string, unknown>) {
          this.setOptions(opciones);
        }
        fitBounds() {
          event.trigger(this, "bounds_changed");
        }
        addListener(nombre: string, callback: () => void) {
          return event.addListener(this, nombre, callback);
        }
      }
      class Marcador extends HTMLElement {
        destino: Mapa | null = null;
        constructor() {
          super();
          this.tabIndex = 0;
          this.setAttribute("role", "button");
          this.addEventListener("click", () =>
            this.dispatchEvent(new Event("gmp-click")),
          );
          this.addEventListener("keydown", (e) => {
            if (e.key === "Enter") this.click();
          });
        }
        set map(mapa: Mapa | null) {
          this.destino = mapa;
          if (mapa) mapa.div.append(this);
          else this.remove();
        }
        get map() {
          return this.destino;
        }
        set content(contenido: Node) {
          this.replaceChildren(contenido);
        }
        get content() {
          return this.firstElementChild;
        }
        set position(posicion: { lat: number; lng: number }) {
          this.dataset.lat = String(posicion.lat);
          this.dataset.lng = String(posicion.lng);
        }
      }
      customElements.define("gmp-marcador-prueba", Marcador);
      const maps = {
        Map: Mapa,
        event,
        version: "3.65.0",
        Settings: { getInstance: () => ({}) },
        importLibrary: async () => {
          if (fallar)
            throw new Error("Servicio de mapas no disponible en esta prueba");
          return { Map: Mapa, AdvancedMarkerElement: Marcador };
        },
      };
      Object.defineProperty(window, "google", {
        value: { maps },
        configurable: true,
      });
    },
    { fallar },
  );
}
