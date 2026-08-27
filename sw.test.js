const fs = require('fs');
const path = require('path');
const { SHELL_FILES } = require('./sw');

// Chequeo barato que evita una clase real de bug: si SHELL_FILES tiene un
// path con un typo, o alguien borra/renombra un archivo del shell sin
// actualizar la lista, cache.addAll() falla por completo en el install
// del Service Worker (no cachea nada, ni siquiera los archivos que si
// estaban bien). Esto no requiere un entorno de navegador/SW, solo
// verifica que los archivos existan en el repo.
describe('sw.js: SHELL_FILES apunta a archivos reales del repo', () => {
  const archivos = SHELL_FILES.filter((f) => f !== './');

  test.each(archivos)('%s existe', (relativePath) => {
    const limpio = relativePath.replace(/^\.\//, '');
    const rutaCompleta = path.join(__dirname, limpio);
    expect(fs.existsSync(rutaCompleta)).toBe(true);
  });
});
