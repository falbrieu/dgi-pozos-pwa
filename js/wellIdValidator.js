// Normaliza variantes razonables de DD-PPPP antes de validar: guiones
// unicode, espacios en vez de guion, o el guion faltante. No es la unica
// verificacion - el backend vuelve a validar el formato final igual.
function normalizeWellId(input) {
  if (!input) {
    return '';
  }
  var s = String(input).trim();
  s = s.replace(/[‐-―]/g, '-'); // guiones unicode (en dash, em dash, etc.)
  s = s.replace(/\s+/g, '');

  var match = s.match(/^(\d{1,2})-?(\d{1,4})$/);
  if (match) {
    var departamento = match[1].padStart(2, '0');
    var pozo = match[2].padStart(4, '0');
    s = departamento + '-' + pozo;
  }
  return s;
}

function isValidWellId(wellId) {
  return /^\d{2}-\d{4}$/.test(wellId);
}
