# Roadmap

## V0 — Prueba técnica (CERRADA — GO)

Objetivo cumplido: validar la cadena `GitHub Pages → Google Sign-In → Apps Script → sesión propia → Drive → imagen real` en Android y iPhone (incluida la PWA instalada en modo standalone), antes de construir el producto.

Resultado: **GO de arquitectura**. Ningún eslabón obligó a cambiar de plataforma ni a introducir Cloudflare. El único punto que no cumplía el objetivo de performance (entrega de imagen vía base64 para archivos grandes) tiene una causa raíz identificada y una solución acotada en curso (ver V1 más abajo) que no requiere rediseñar nada de lo ya validado.

Descartado explícitamente durante V0: entrega de imagen vía `doGet` + `Blob` directo — no soportado por la plataforma (Apps Script Web Apps solo puede devolver `HtmlOutput`/`TextOutput`). Código eliminado del proyecto; detalle en `docs/architecture.md`.

## V1 — Consulta de perfiles ITF (CERRADA — tag `v1.0.0`, 2026-08-27)

**Optimización de imágenes**: decisión tomada el 2026-08-27 — se descarta por ahora. V1 usa la carpeta `THUMB` actual tal cual (no `THUMB_WEB`), sin reprocesar el corpus, porque los archivos reales ya son livianos (37-170 KB). Queda documentado como mejora opcional/no bloqueante para más adelante si el corpus crece con archivos más pesados.

**Backend (migrado en pasos, cada uno verificado en dispositivo real antes de avanzar) — completo:**
1. ✅ Reestructuración en capas (`Api`/`AuthService`/`ProfileService`/`DriveProfileRepository`/`Config`), sin cambiar comportamiento.
2. ✅ Allowlist real (`SheetUserRepository` + `USER_DISABLED`, cache de 5 min).
3. ✅ Historial de auditoría (`SheetHistoryRepository`/`HistoryService`) para `login` y `getProfile`.

**Rate limiting: NO forma parte de V1.0.** Decisión explícita y ratificada (2026-08-27): no se implementa `RateLimiter.js`, no hay contadores en `CacheService`, no se emite `RATE_LIMITED`. Queda únicamente como mejora opcional para una V1.x futura — no es un pendiente de `v1.0.0` ni bloquea el tag.

**Frontend:**
- ✅ Máquina de estados completa (8 estados, incluida pantalla de "sin conexión" en el arranque), sin restos de la UI de diagnóstico de V0.
- ✅ `manifest.json` + `sw.js` (app shell, estrategia network-first con fallback a cache, offline verificado en dispositivo real).
- ✅ Validación/normalización de `wellId` sin ambigüedad + rango de departamento 01-19 (frontend y backend) — corrige bugs detectados en pruebas de campo (`112`→ambiguo, `000012`→departamento inválido, etc.), ver `docs/architecture.md`.
- ✅ Enmascarado de input consistente en Android/iPhone, con preservación de la posición del cursor.
- ✅ Google Identity Services con init programático — corrige el prompt de "One Tap" apareciendo aun con sesión ya recuperada.
- ✅ Botón de limpiar (`×`) en el input, botón "Guardar/Compartir" en iOS (Web Share API con fallback), UX de arranque medida y validada (~1.3-2.2s según plataforma).

**Tests: completo.** 76 tests (Jest) — `wellIdValidator` (41), `sw.js`/lista de archivos cacheados (9), `AuthService` (15), `ProfileService`/`Api.handleGetProfile` (11).

**Documentación: completa.** `README.md` actualizado para V1 (antes describía V0), `CHANGELOG.md` creado, este roadmap y `docs/architecture.md` al día.

**Fix final antes del tag**: la celda `wellId` de "Historial" se forzaba a texto plano (`setNumberFormat('@')`) porque Sheets reinterpretaba `01-0012` como fecha/número — confirmado con una fila real antes de cerrar V1.

Los 21 criterios de aceptación quedaron verificados (checklist en `docs/architecture.md`). Próxima etapa: **diseño visual/estético y UX**, sin tocar la lógica ya validada de V1.

## V1.1 — Historial visible

Pantalla "mis consultas" para el usuario. Sin fuentes de datos nuevas.

## V2 — Información registral

`well.registry` como módulo nuevo (`RegistryService`/`RegistryRepository`), sin tocar el módulo ITF.

## V3 — Niveles estáticos

Última medición + serie histórica (tabla y gráfico).

## V4+ (backlog, no comprometido)

Ubicación/mapas, panel admin real, exportación PDF/CSV, comparación entre pozos, favoritos, búsqueda avanzada, etc.
