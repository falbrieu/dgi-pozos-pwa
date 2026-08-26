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

**Contrato de errores**: `{status, code, message}`, con `debug` agregado temporalmente en V0 para diagnóstico (a eliminar antes de V1). Códigos definidos: `INVALID_WELL_ID`, `UNAUTHORIZED`, `USER_DISABLED`, `PROFILE_NOT_FOUND`, `RATE_LIMITED`, `SERVICE_UNAVAILABLE`.

**Configuración/secretos**: `GOOGLE_CLIENT_ID` es público por diseño (vive en el código, tanto frontend como backend). `SESSION_SECRET` y `FOLDER_ID` viven únicamente en Script Properties de Apps Script, nunca en el código fuente.

## Pendiente para V1 (no implementado ni probado en V0)

- Allowlist de usuarios (hoja "Usuarios") + cache de estado con `CacheService` (freshness objetivo: ≤5 minutos).
- Rate limiting con `CacheService` (contadores por hora; no es atómico, limitación conocida y aceptada a esta escala).
- Historial de consultas (hoja "Historial"), como auditoría pura — nunca se lee para decidir nada en caliente.
- Eliminar el campo `debug` temporal de las respuestas de error.
- UI final, normalización completa de `wellId` (`3-123` → `03-0123`, guion unicode, espacios).
- Separación real en archivos (`AuthService.js`, `ProfileService.js`, etc.) con el patrón de export condicional para poder testear con Jest sin duplicar código (ver especificación de V1 acordada antes de V0).

## Riesgos conocidos, documentados y aceptados

- Toda la infraestructura (Drive, Apps Script, Sheets) depende de cuentas de Google personales (`falbrieu@gmail.com`, `dgiperfiles@gmail.com`), no de un dominio institucional Workspace. Riesgo de continuidad institucional, fuera del alcance técnico de este proyecto.
- `CacheService` no garantiza persistencia (Google puede desalojar entradas antes de tiempo); nunca debe ser la única fuente de verdad de nada crítico — ver Script CacheService quotas.
- `tokeninfo` de Google no está pensado por Google para uso intensivo en producción (riesgo de throttling); se usa solo en el login, no en cada consulta, para minimizar ese riesgo.
