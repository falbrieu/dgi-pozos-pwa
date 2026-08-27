// Tabla code -> mensaje en espanol. La UI nunca muestra el "message"
// tecnico que devuelve el backend, siempre pasa por aca.
var ERROR_MESSAGES = {
  INVALID_WELL_ID: 'Formato inválido. Usá DD-PPPP (ej: 03-0123).',
  UNAUTHORIZED: 'Tu sesión venció. Iniciá sesión de nuevo.',
  USER_DISABLED: 'Tu cuenta no tiene acceso habilitado. Contactá al administrador.',
  PROFILE_NOT_FOUND: 'No se encontró información para el pozo {wellId}.',
  SERVICE_UNAVAILABLE: 'No se pudo completar la consulta. Intentá nuevamente.',
  OFFLINE: 'No tenés conexión a internet.'
};

function getErrorMessage(code, wellId) {
  var template = ERROR_MESSAGES[code] || 'Ocurrió un error inesperado. Intentá nuevamente.';
  return template.replace('{wellId}', wellId || '');
}
