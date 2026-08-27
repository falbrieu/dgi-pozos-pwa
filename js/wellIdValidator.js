// Normaliza y valida DD-PPPP, separando explicitamente dos preguntas
// distintas:
//   1. normalizacion de formato: solo procede cuando el punto de corte
//      entre departamento y pozo es inequivoco (hay separador explicito,
//      o son exactamente 6 digitos = 2+4 sin separador). Si no se puede
//      determinar sin adivinar, se deja el valor tal cual para que
//      isValidWellId lo rechace - nunca se adivina un corte ambiguo
//      (ej: "112" o "3123" sin separador).
//   2. validacion de rango: el departamento debe estar entre 01 y 19.
//      Esta regla tambien existe en el backend (Api.js), de forma
//      independiente - el frontend nunca es la unica barrera.

var WELL_ID_MIN_DEPARTAMENTO = 1;
var WELL_ID_MAX_DEPARTAMENTO = 19;

function normalizeWellId(input) {
  if (!input) {
    return '';
  }
  var s = String(input).trim();
  s = s.replace(/[‐-―]/g, '-'); // guiones unicode (en dash, em dash, etc.)
  s = s.replace(/\s+/g, '-'); // un espacio interno se trata igual que un guion

  if (s.indexOf('-') !== -1) {
    var parts = s.split('-');
    if (parts.length !== 2) {
      return s; // mas de un separador: ambiguo, se deja para que falle la validacion
    }
    var deptPart = parts[0];
    var pozoPart = parts[1];
    if (!/^\d{1,2}$/.test(deptPart) || !/^\d{1,4}$/.test(pozoPart)) {
      return s; // alguno de los dos lados no son solo digitos dentro del ancho esperado
    }
    return deptPart.padStart(2, '0') + '-' + pozoPart.padStart(4, '0');
  }

  // Sin separador: solo es inequivoco si son exactamente 6 digitos
  // (2 de departamento + 4 de pozo). Cualquier otra cantidad de digitos
  // sin separador es ambigua y se deja invalida a proposito.
  if (/^\d{6}$/.test(s)) {
    return s.slice(0, 2) + '-' + s.slice(2);
  }

  return s;
}

function isValidWellId(wellId) {
  var match = /^(\d{2})-(\d{4})$/.exec(wellId);
  if (!match) {
    return false;
  }
  var departamento = parseInt(match[1], 10);
  return departamento >= WELL_ID_MIN_DEPARTAMENTO && departamento <= WELL_ID_MAX_DEPARTAMENTO;
}

// Formatea en vivo lo que el usuario va tecleando: solo digitos, insercion
// automatica del guion despues del segundo digito, maximo 6 digitos
// reales. Es un enmascarado simple de UI, no reemplaza normalizeWellId
// (que se sigue aplicando al enviar, y tambien cubre el pegado de texto).
function formatWellIdInput(rawValue) {
  var digits = String(rawValue || '').replace(/\D/g, '').slice(0, 6);
  if (digits.length <= 2) {
    return digits;
  }
  return digits.slice(0, 2) + '-' + digits.slice(2);
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { normalizeWellId, isValidWellId, formatWellIdInput };
}
