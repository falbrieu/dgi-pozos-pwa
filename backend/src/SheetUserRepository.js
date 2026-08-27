// Unica funcion que sabe que existe una hoja "Usuarios" en Sheets. Espera
// columnas, con encabezado en la fila 1:
//   email | nombre | estado | fecha_alta
// "estado" debe valer exactamente "activo" (sin mayusculas/espacios extra
// importan, se normaliza) para considerarse habilitado. Cualquier otro
// valor, o el email ausente de la hoja, se trata como no habilitado.
function sheetUserRepository_getUserStatus(email) {
  var spreadsheet = SpreadsheetApp.openById(getSpreadsheetId());
  var sheet = spreadsheet.getSheetByName('Usuarios');
  if (!sheet) {
    throw new Error('No existe una hoja llamada "Usuarios" en el spreadsheet configurado');
  }

  var data = sheet.getDataRange().getValues();
  var normalizedEmail = String(email).trim().toLowerCase();

  for (var i = 1; i < data.length; i++) {
    var rowEmail = String(data[i][0]).trim().toLowerCase();
    if (rowEmail === normalizedEmail) {
      var estado = String(data[i][2]).trim().toLowerCase();
      return { found: true, active: estado === 'activo' };
    }
  }

  return { found: false, active: false };
}
