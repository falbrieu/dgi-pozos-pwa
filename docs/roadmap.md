# Roadmap

## V0 — Prueba técnica (CERRADA — GO)

Objetivo cumplido: validar la cadena `GitHub Pages → Google Sign-In → Apps Script → sesión propia → Drive → imagen real` en Android y iPhone (incluida la PWA instalada en modo standalone), antes de construir el producto.

Resultado: **GO de arquitectura**. Ningún eslabón obligó a cambiar de plataforma ni a introducir Cloudflare. El único punto que no cumplía el objetivo de performance (entrega de imagen vía base64 para archivos grandes) tiene una causa raíz identificada y una solución acotada en curso (ver V1 más abajo) que no requiere rediseñar nada de lo ya validado.

Descartado explícitamente durante V0: entrega de imagen vía `doGet` + `Blob` directo — no soportado por la plataforma (Apps Script Web Apps solo puede devolver `HtmlOutput`/`TextOutput`). Código eliminado del proyecto; detalle en `docs/architecture.md`.

## V1 — Consulta de perfiles ITF (en preparación)

**Paso 0 (en curso, antes de tocar el resto de V1)**: experimento controlado de optimización de imagen sobre un único archivo real (`01-0012.jpg`), generando 3 versiones de prueba (~300/500/800 KB) sin tocar el corpus completo de ~2GB ni el original. Objetivo: medir con el mismo mecanismo base64 ya validado si una versión más liviana del JPG acerca el tiempo total al objetivo de "<2s", antes de decidir el parámetro de compresión definitivo para procesar el corpus completo.

Resto del alcance de V1: sin cambios respecto a la especificación ya acordada — login con Google + allowlist, búsqueda de pozo con validación/normalización de formato, los 5 estados de UI (inicial/buscando/encontrado/no encontrado/error/sin conexión), capas Servicios/Repositorios separadas en archivos, historial de consultas registrado (no visible todavía), tests de validación/`AuthService`/`ProfileService`, documentación (README, este roadmap, architecture.md, CHANGELOG.md), y tag `v1.0.0` una vez verificados los 21 criterios de aceptación.

No se pasa a V1.1 hasta que V1 se declare estable.

## V1.1 — Historial visible

Pantalla "mis consultas" para el usuario. Sin fuentes de datos nuevas.

## V2 — Información registral

`well.registry` como módulo nuevo (`RegistryService`/`RegistryRepository`), sin tocar el módulo ITF.

## V3 — Niveles estáticos

Última medición + serie histórica (tabla y gráfico).

## V4+ (backlog, no comprometido)

Ubicación/mapas, panel admin real, exportación PDF/CSV, comparación entre pozos, favoritos, búsqueda avanzada, etc.
