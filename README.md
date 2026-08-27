# Consulta de Pozos — Departamento General de Irrigación

PWA para consultar el perfil constructivo (ITF) de un pozo de agua subterránea a partir de su identificador `DD-PPPP` (departamento-pozo). Reemplaza al bot de Telegram original como canal principal de consulta.

Estado: **V1 en cierre** — funcionalmente completa, en verificación final antes de etiquetar `v1.0.0`. Ver [docs/roadmap.md](docs/roadmap.md) para el detalle de versiones.

## Qué hace

1. El usuario inicia sesión con su cuenta de Google (whitelist de emails habilitados).
2. Escribe un número de pozo (`03-0123`).
3. Si existe un perfil para ese pozo, lo ve en pantalla y puede guardarlo/descargarlo.
4. Si no existe, o el formato/departamento es inválido, recibe un mensaje claro — nunca un error técnico.

## Arquitectura

Ver [docs/architecture.md](docs/architecture.md) para el detalle completo (decisiones, capas, riesgos conocidos). En resumen:

```
PWA (GitHub Pages, estático)
  → Apps Script Web App (API, una sola capa de entrada HTTP)
    → Servicios (AuthService, ProfileService, HistoryService)
      → Repositorios (Drive para perfiles, Sheets para usuarios/historial)
```

Costo de operación: **$0** — GitHub Pages, Google Apps Script y Google Drive/Sheets dentro de sus cuotas gratuitas.

## Estructura del repositorio

```
index.html, manifest.json, sw.js     PWA (entry point en la raíz, requerido por GitHub Pages)
css/, js/                             Frontend
backend/src/                          Backend (Apps Script — se pega manualmente en el editor, ver "Desplegar")
backend/test/                         Tests del backend (Jest, con fakes de Apps Script)
scripts/                              Herramientas locales de un solo uso (compresión de imágenes, no forman parte del producto)
docs/                                 architecture.md, roadmap.md
```

## Cómo correr los tests

```bash
npm install
npm test
```

76 tests (Jest): validación/normalización de `wellId`, lógica de sesión y allowlist (`AuthService`), búsqueda de perfil (`ProfileService`/`Api`), y que el Service Worker liste solo archivos que existen de verdad en el repo.

## Desarrollo local del frontend

No requiere build ni servidor: es HTML/CSS/JS plano. Basta con abrir `index.html` con un servidor estático simple (por ejemplo `npx serve .`) — abrirlo como `file://` directo no funciona porque el Service Worker y el `fetch` al backend requieren un origen `http(s)`.

## Desplegar

### Backend (Google Apps Script)

1. Crear un proyecto en [script.google.com](https://script.google.com) (o abrir el existente).
2. Pegar el contenido de cada archivo de `backend/src/` como un archivo de script con el mismo nombre (`Config`, `AuthService`, `ProfileService`, `DriveProfileRepository`, `SheetUserRepository`, `SheetHistoryRepository`, `HistoryService`, `Api`).
3. Configurar las **Propiedades del script** (⚙️ Configuración del proyecto → Propiedades del script):
   - `FOLDER_ID`: ID de la carpeta de Drive con los perfiles (`THUMB`).
   - `SPREADSHEET_ID`: ID del Google Sheet con las hojas `Usuarios` e `Historial` (ver estructura en `docs/architecture.md`).
   - `SESSION_SECRET`: se genera solo — correr la función `setupSessionSecret` una vez desde el editor (Ejecutar → seleccionar la función → Ejecutar). No la pises a mano.
4. **Implementar → Nueva implementación → Aplicación web**. "Ejecutar como": vos mismo. "Quién tiene acceso": Cualquier usuario.
5. Copiar la URL `/exec` resultante.

Para actualizar el backend después de un cambio: pegar el archivo modificado en el editor y **Implementar → Administrar implementaciones → editar (lápiz) → Nueva versión → Implementar** — guardar el archivo solo no alcanza, hay que crear una versión nueva de la implementación para que el `/exec` sirva el código actualizado.

### Frontend (GitHub Pages)

Cualquier push a `main` se publica solo (GitHub Pages configurado para servir desde la raíz de `main`). Si se cambia la URL del backend, actualizar la constante `APPS_SCRIPT_URL` en `js/api.js`.

### Google Cloud (Client ID de Google Sign-In)

Un Client ID de tipo "Web" en Google Cloud Console, con el origen de GitHub Pages (`https://<usuario>.github.io`) autorizado como "Origen de JavaScript autorizado", y la pantalla de consentimiento OAuth en modo "Testing" con cada email autorizado agregado como usuario de prueba (evita el proceso de verificación de Google para esta escala). El Client ID es público por diseño — vive hardcodeado tanto en `js/app.js` como en `backend/src/Config.js`.

## Configuración de usuarios y perfiles (sin panel de administración en V1)

- **Habilitar/deshabilitar un usuario**: editar directamente la hoja `Usuarios` (columna `estado` = `activo` para habilitar, cualquier otro valor para deshabilitar). Tarda hasta 5 minutos en tener efecto por el cache.
- **Agregar un perfil**: subir el archivo `DD-PPPP.jpg` a la carpeta de Drive configurada en `FOLDER_ID`. No hace falta ningún otro paso.
