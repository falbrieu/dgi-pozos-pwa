// Unica funcion que sabe que existe una hoja "Historial" en Sheets.
// Auditoria pura, append-only: nunca se lee para decidir nada en caliente
// (eso es responsabilidad de AuthService/CacheService, no de esta hoja).
// Columnas: timestamp | email | accion | wellId | resultado
function sheetHistoryRepository_logEvent(email, accion, wellId, resultado) {
  var spreadsheet = SpreadsheetApp.openById(getSpreadsheetId());
  var sheet = spreadsheet.getSheetByName('Historial');
  if (!sheet) {
    throw new Error('No existe una hoja llamada "Historial" en el spreadsheet configurado');
  }
  sheet.appendRow([new Date(), email, accion, wellId || '', resultado]);
}
