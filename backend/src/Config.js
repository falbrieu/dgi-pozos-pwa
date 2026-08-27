// Configuracion centralizada. Publico (Client ID) va como constante en el
// codigo; secretos/IDs van siempre a Script Properties, nunca hardcodeados.

var GOOGLE_CLIENT_ID = '970817103867-q30tnqqqcc9lhtaamqplbs28nglcj7q3.apps.googleusercontent.com';

function getSessionSecret() {
  var secret = PropertiesService.getScriptProperties().getProperty('SESSION_SECRET');
  if (!secret) {
    throw new Error('SESSION_SECRET no configurado. Corre setupSessionSecret() primero.');
  }
  return secret;
}

function getFolderId() {
  var folderId = PropertiesService.getScriptProperties().getProperty('FOLDER_ID');
  if (!folderId) {
    throw new Error('FOLDER_ID no configurado en Script Properties');
  }
  return folderId;
}

// Correr esta funcion UNA VEZ manualmente desde el editor de Apps Script
// (Ejecutar > setupSessionSecret) para generar y guardar el secreto HMAC.
// No sobreescribe un secreto ya existente.
function setupSessionSecret() {
  var props = PropertiesService.getScriptProperties();
  if (props.getProperty('SESSION_SECRET')) {
    Logger.log('SESSION_SECRET ya existe, no se modifico.');
    return;
  }
  var secret = Utilities.getUuid() + Utilities.getUuid();
  props.setProperty('SESSION_SECRET', secret);
  Logger.log('SESSION_SECRET generado y guardado en Script Properties.');
}
