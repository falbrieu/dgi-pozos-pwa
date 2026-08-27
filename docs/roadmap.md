# Roadmap

## V0 — Prueba técnica (CERRADA — GO)

Objetivo cumplido: validar la cadena `GitHub Pages → Google Sign-In → Apps Script → sesión propia → Drive → imagen real` en Android y iPhone (incluida la PWA instalada en modo standalone), antes de construir el producto.

Resultado: **GO de arquitectura**. Ningún eslabón obligó a cambiar de plataforma ni a introducir Cloudflare. El único punto que no cumplía el objetivo de performance (entrega de imagen vía base64 para archivos grandes) tiene una causa raíz identificada y una solución acotada en curso (ver V1 más abajo) que no requiere rediseñar nada de lo ya validado.

Descartado explícitamente durante V0: entrega de imagen vía `doGet` + `Blob` directo — no soportado por la plataforma (Apps Script Web Apps solo puede devolver `HtmlOutput`/`TextOutput`). Código eliminado del proyecto; detalle en `docs/architecture.md`.

## V1 — Consulta de perfiles ITF (en curso)

**Optimización de imágenes**: decisión tomada el 2026-08-27 — se descarta por ahora. V1 usa la carpeta `THUMB` actual tal cual (no `THUMB_WEB`), sin reprocesar el corpus, porque los archivos reales ya son livianos (37-170 KB). Queda documentado como mejora opcional/no bloqueante para más adelante si el corpus crece con archivos más pesados.

**Backend (migrado en pasos, cada uno verificado en dispositivo real antes de avanzar):**
1. ✅ Reestructuración en capas (`Api`/`AuthService`/`ProfileService`/`DriveProfileRepository`/`Config`), sin cambiar comportamiento.
2. ✅ Allowlist real (`SheetUserRepository` + `USER_DISABLED`, cache de 5 min).
3. ✅ Historial de auditoría (`SheetHistoryRepository`/`HistoryService`) para `login` y `getProfile`.
4. Rate limiting — **diferido a V1.x, fuera del alcance de V1.0.**

**Frontend:**
- ✅ Máquina de estados completa (8 estados), sin restos de la UI de diagnóstico de V0.
- ✅ `manifest.json` + `sw.js` (app shell).
- ✅ Validación/normalización de `wellId` sin ambigüedad + rango de departamento 01-19 (frontend y backend) — corrige bugs detectados en pruebas de campo (`112`→ambiguo, `000012`→departamento inválido, etc.), ver `docs/architecture.md`.
- ✅ Enmascarado de input consistente en Android/iPhone.
- ✅ Google Identity Services con init programático — corrige el prompt de "One Tap" apareciendo aun con sesión ya recuperada.
- Tests Jest para `wellIdValidator` (26 casos, incluyendo los bugs reportados). Pendiente: tests de `AuthService`/`ProfileService`.

No se pasa a V1.1 hasta que V1 se declare estable con los 21 criterios de aceptación verificados.

## V1.1 — Historial visible

Pantalla "mis consultas" para el usuario. Sin fuentes de datos nuevas.

## V2 — Información registral

`well.registry` como módulo nuevo (`RegistryService`/`RegistryRepository`), sin tocar el módulo ITF.

## V3 — Niveles estáticos

Última medición + serie histórica (tabla y gráfico).

## V4+ (backlog, no comprometido)

Ubicación/mapas, panel admin real, exportación PDF/CSV, comparación entre pozos, favoritos, búsqueda avanzada, etc.
