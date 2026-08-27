# Arquitectura

Estado: V0 cerrada (GO). V1 en preparación.

## Capas

```
Usuario (celular/PC)
        |
        v
   PWA (GitHub Pages)
   - HTML/CSS/JS estatico, manifest, service worker (pendiente en V1)
   - Login con Google (Google Identity Services)
        |  POST text/plain con el ID token / sessionToken en el body
        v
   API (Apps Script Web App - doPost, un unico entry point)
   - Verifica identidad, nunca expone stack traces al cliente
        |
        v
   Servicios (funciones puras, sin saber de HTTP)
   - AuthService (sesion), ProfileService
        |
        v
   Repositorios (unica capa que sabe de Drive/Sheets)
   - DriveProfileRepository
        |
        v
   Google Drive (carpeta THUMB)
```

Pendiente para V1: SheetUserRepository (allowlist), SheetHistoryRepository (historial), separacion de estas funciones en archivos .gs distintos (en V0 vive todo en un unico `Code.gs`, deliberadamente, por ser descartable).

## Decisiones confirmadas empíricamente en V0

**CORS**: Apps Script Web Apps no manejan el preflight de CORS de forma confiable (no hay garantía documentada de que un `doOptions` funcione siempre). Se evita el problema por diseño: todos los requests autenticados usan `POST` con `Content-Type: text/plain` (nunca headers custom, nunca `application/json` real), lo que el navegador considera "simple" y no dispara preflight. Confirmado funcionando en Chrome (PC) y Safari (iPhone, incluida la PWA instalada en modo standalone), **sin necesidad de Cloudflare**.

**Autenticación**: login con Google Identity Services → el ID token se valida **una sola vez**, contra `https://oauth2.googleapis.com/tokeninfo`, verificando `aud` contra nuestro Client ID. A partir de ahí se emite un `sessionToken` propio firmado con HMAC-SHA256 (`email`, `iat`, `exp`), que se valida **localmente** (sin volver a llamar a Google) en cada request posterior. Confirmado: rechaza correctamente un token alterado (firma inválida) y un token expirado. `SESSION_TTL_SECONDS` definitivo para V1: 12 horas (en V0 se usaron 60s y luego 1800s solo para poder probar la expiración sin esperar horas).

**Persistencia de sesión (iOS standalone)**: `localStorage` **sí persiste correctamente** en una PWA instalada en pantalla de inicio de iPhone. El problema observado inicialmente (la app pedía login de nuevo tras cerrar/reabrir) no era un límite de almacenamiento de iOS: el frontend de V0 nunca revisaba `localStorage` al arrancar. Se corrigió agregando una verificación automática al cargar la página (busca el token guardado, lo valida contra el backend, y si es válido reusa la sesión sin pedir login). Como refuerzo adicional se activó `data-auto_select="true"` en Google Identity Services, para relogin silencioso si la sesión de Google del navegador sigue activa.

**Acceso a Drive**: `DriveApp.getFolderById(...).getFilesByName(wellId + '.jpg')` funciona correctamente y con latencia baja (366-504 ms medidos) para un archivo real de la carpeta `THUMB`. **Decisión confirmada sin cambios**: no se construye un índice separado para V1 — esta llamada ya está indexada por Drive internamente, y el volumen de uso esperado (decenas de usuarios) no lo justifica. Si en el futuro hiciera falta, se reemplaza dentro de `DriveProfileRepository` sin tocar `ProfileService` ni el frontend.

**Entrega de imagen — decisión central de V0**: se probó explícitamente un mecanismo de "ticket firmado + `doGet` + `Blob` directo" para evitar el costo de base64, y **falló**. Causa confirmada con la documentación oficial de Apps Script: un Web App de Apps Script, en `doGet`/`doPost`, **solo puede devolver `HtmlOutput` o `TextOutput`** — no existe una forma soportada de devolver un `Blob` binario como respuesta HTTP. Ese código se eliminó del proyecto (no queda como código muerto).

Mecanismo vigente al cierre de V0: base64 embebido en la respuesta JSON de una única llamada POST. Funciona correctamente en Android y iPhone, pero es lento para archivos grandes: `01-0012.jpg` (2.24 MB original, 2.99 MB en base64) tardó **~5.2-6.2 s de punta a punta**, muy por encima del objetivo de "<2s" de la especificación de V1. El tiempo del lado de Apps Script/Drive es bajo (366-504 ms); el cuello de botella es el tamaño del payload transmitido, no el backend.

Primer paso de V1 (en curso, no forma parte del cierre de V0): reducir el tamaño real de los JPG servidos generando una versión "para pantalla" del corpus, en vez de cambiar el mecanismo de entrega. Se descarta introducir Cloudflare (u otro runtime adicional) a menos que la optimización de imágenes resulte insuficiente una vez medida.

**Decisión confirmada — parámetro de compresión para V1**: se probaron 3 variantes de `01-0012.jpg` (`scripts/resize_experiment.py`, targets ~300/500/800 KB). Resultado:

| Versión | Tamaño real | Base64 | Tiempo total | Evaluación |
|---|---|---|---|---|
| A (calidad JPEG 52, resolución original 2958x2303) | 545 KB | 727 KB | 3.2 s | buena calidad visual |
| B (calidad JPEG, target 500KB) | 575 KB | 766 KB | 3.5 s | sin mejora clara sobre A |
| C (target 800KB) | 937 KB | 1249 KB | 7.0 s | demasiado lenta |

Se adopta **Versión A** como estándar: **recompresión JPEG a calidad 52, sin redimensionar** (cada archivo conserva su resolución nativa). Importante: en la búsqueda de A nunca hizo falta reducir resolución — la calidad 52 sola, a resolución original, ya alcanzó ese tamaño. Por eso el parámetro que se generaliza a todo el corpus es "calidad 52", no una resolución fija en píxeles (los archivos del corpus no son todos de la misma resolución nativa).

Los originales de `THUMB` **no se tocan**. El corpus completo se recomprime con `scripts/batch_compress.py` hacia una carpeta nueva (`THUMB_WEB`), que luego se sube a Drive como una carpeta separada. `DriveProfileRepository` todavía no fue reapuntado a `THUMB_WEB` — eso queda para cuando el lote esté procesado y subido.

**Contrato de errores**: `{status, code, message}`, con `debug` agregado temporalmente en V0 para diagnóstico (a eliminar antes de V1). Códigos definidos: `INVALID_WELL_ID`, `UNAUTHORIZED`, `USER_DISABLED`, `PROFILE_NOT_FOUND`, `RATE_LIMITED`, `SERVICE_UNAVAILABLE`.

**Configuración/secretos**: `GOOGLE_CLIENT_ID` es público por diseño (vive en el código, tanto frontend como backend). `SESSION_SECRET` y `FOLDER_ID` viven únicamente en Script Properties de Apps Script, nunca en el código fuente.

## V1 — implementado hasta el momento

- Backend separado en capas (`backend/src/Api.js`, `AuthService.js`, `ProfileService.js`, `DriveProfileRepository.js`, `SheetUserRepository.js`, `SheetHistoryRepository.js`, `HistoryService.js`, `Config.js`), migrado desde el `Code.gs` único de V0 sin cambiar comportamiento observable.
- Allowlist real (hoja "Usuarios") con cache de 5 minutos en `AuthService.isUserActive`, aplicada en `login`, `checkSession` y `getProfile` — deshabilitar a alguien tarda como máximo 5 minutos en tener efecto, no hasta que expire la sesión.
- Historial de auditoría (hoja "Historial") de `login` y `getProfile` (todos sus resultados), append-only, nunca se lee para decidir nada. `checkSession` no se audita (es recuperación silenciosa, no una acción de negocio).
- Campo `debug` temporal eliminado de las respuestas de error.
- Frontend reescrito con máquina de estados (cargando sesión, no autenticado, listo, buscando, encontrado, no encontrado, usuario deshabilitado, sin conexión/error), sin restos de la UI de diagnóstico de V0. `manifest.json` + `sw.js` (cachea solo el app shell).

**Rate limiting**: diseñado (contador por email/hora vía `CacheService`) pero **diferido explícitamente fuera de V1.0** — decisión del 2026-08-27, queda como mejora V1.x, no bloqueante.

### Validación y normalización de `wellId` — reglas finales

Se separan dos preguntas distintas, cada una con su propia regla:

1. **Normalización de formato** (`js/wellIdValidator.js`, frontend únicamente): solo se normaliza cuando el punto de corte entre departamento y pozo es inequívoco — hay separador explícito (guion, guion unicode, o espacio), o son exactamente 6 dígitos sin separador (2+4, sin ambigüedad posible). Si no se puede determinar el corte sin adivinar (ej. `112`, `3123` sin separador), se deja el valor sin normalizar para que la validación lo rechace — **nunca se adivina un corte ambiguo**.
2. **Validación de rango**: los departamentos válidos van de **01 a 19**. Esta regla existe en **ambos lados**, de forma independiente: `js/wellIdValidator.js` en el frontend y `backend/src/Api.js` en el backend (el backend nunca confía únicamente en la validación del cliente). Un departamento fuera de rango (`00`, `20` o superior) devuelve `INVALID_WELL_ID` sin llegar a consultar Drive.

El input en pantalla tiene además un enmascarado en vivo (`formatWellIdInput`): solo dígitos, guion automático después del segundo dígito, máximo 6 dígitos reales — igual en Android y iPhone, ya que iOS no ofrece el guion cómodamente en el teclado numérico. El pegado de texto usa la normalización completa (acepta variantes con separador), no el enmascarado simple.

### Google Identity Services — init programático, no declarativo

V0 inicializaba Google Sign-In de forma declarativa (`<div id="g_id_onload" data-auto_select="true">`), lo que hacía que el prompt de "One Tap" de Google apareciera **siempre**, apenas cargaba la librería, sin importar si la sesión propia ya se había recuperado con éxito. Corregido: la inicialización (`google.accounts.id.initialize` + `.renderButton` + `.prompt()`) ahora es 100% programática desde `js/app.js`, y solo se dispara si `checkSession` ya determinó que no hay una sesión propia válida. También se llama a `google.accounts.id.disableAutoSelect()` al cerrar sesión, para que "Cerrar sesión" no quede anulado por un re-login silencioso de Google.

### Fuente de imágenes — confirmado

V1 usa la carpeta `THUMB` actual tal cual (no `THUMB_WEB`). No se reprocesa el corpus por ahora — los archivos reales ya son livianos (37-170 KB), muy por debajo del caso de 2.24 MB que motivó la investigación de compresión. Base64 se mantiene como mecanismo de entrega en esta etapa.

## Riesgos conocidos, documentados y aceptados

- Toda la infraestructura (Drive, Apps Script, Sheets) depende de cuentas de Google personales (`falbrieu@gmail.com`, `dgiperfiles@gmail.com`), no de un dominio institucional Workspace. Riesgo de continuidad institucional, fuera del alcance técnico de este proyecto.
- `CacheService` no garantiza persistencia (Google puede desalojar entradas antes de tiempo); nunca debe ser la única fuente de verdad de nada crítico — ver Script CacheService quotas.
- `tokeninfo` de Google no está pensado por Google para uso intensivo en producción (riesgo de throttling); se usa solo en el login, no en cada consulta, para minimizar ese riesgo.
