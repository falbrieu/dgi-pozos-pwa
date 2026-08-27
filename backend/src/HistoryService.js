// HistoryService: registra eventos de auditoria (login, getProfile). Un
// problema al escribir en Sheets nunca debe hacer fallar la operacion que
// disparo el registro - el historial es secundario a la funcionalidad
// real, nunca al reves.
function logHistoryEvent(email, accion, wellId, resultado) {
  try {
    sheetHistoryRepository_logEvent(email, accion, wellId, resultado);
  } catch (err) {
    Logger.log('No se pudo registrar en Historial: ' + err.toString());
  }
}
