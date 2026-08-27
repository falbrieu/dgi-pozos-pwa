// Unica funcion que sabe que existe una hoja "Historial" en Sheets.
// Auditoria pura, append-only: nunca se lee para decidir nada en caliente
// (eso es responsabilidad de AuthService/CacheService, no de esta hoja).
// Columnas: timestamp | email | accion | wellId | resultado
var HISTORIAL_COLUMNA_WELL_ID = 4;

function sheetHistoryRepository_logEvent(email, accion, wellId, resultado) {
  var spreadsheet = SpreadsheetApp.openById(getSpreadsheetId());
  var sheet = spreadsheet.getSheetByName('Historial');
  if (!sheet) {
    throw new Error('No existe una hoja llamada "Historial" en el spreadsheet configurado');
  }

  var wellIdValue = wellId || '';
  sheet.appendRow([new Date(), email, accion, wellIdValue, resultado]);

  // Sheets puede reinterpretar "01-0012" como fecha/numero (le pierde el
  // cero inicial o lo convierte a fecha) aunque se escriba como string,
  // si la celda queda en formato "Automatico". Se fuerza texto plano en
  // la celda recien escrita para que el identificador canonico DD-PPPP
  // se vea siempre igual, sin depender del formato previo de la hoja.
  //
  // Nota: si dos ejecuciones concurrentes escriben al historial casi al
  // mismo tiempo, getLastRow() podria no ser exactamente la fila de esta
  // llamada - limitacion conocida y aceptada a esta escala (mismo tipo
  // de no-atomicidad ya documentado para CacheService), no justifica
  // agregar LockService para una columna cosmetica.
  var newRow = sheet.getLastRow();
  var wellIdCell = sheet.getRange(newRow, HISTORIAL_COLUMNA_WELL_ID);
  wellIdCell.setNumberFormat('@');
  wellIdCell.setValue(wellIdValue);
}
