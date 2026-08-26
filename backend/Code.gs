// V0 - prueba tecnica minima. Descartable: NO es la arquitectura en capas de V1.
// Unico proposito: verificar que un POST cross-origin desde GitHub Pages llega
// intacto a Apps Script, que se puede validar un ID token de Google contra
// tokeninfo, y que a partir de ahi se puede emitir y validar una sesion propia
// (HMAC) sin volver a llamar a Google en cada request. Todavia sin Drive,
// Sheets, historial ni rate limiting.

var GOOGLE_CLIENT_ID = '970817103867-q30tnqqqcc9lhtaamqplbs28nglcj7q3.apps.googleusercontent.com';

// Ya se probo la expiracion con 60s. Para las pruebas de Drive que siguen,
// conviene una sesion mas comoda; en V1 esto sube a algo como 12 horas.
var SESSION_TTL_SECONDS = 1800;

function doPost(e) {
  var response;
  try {
    if (!e || !e.postData || !e.postData.contents) {
      response = { status: 'error', code: 'SERVICE_UNAVAILABLE', message: 'sin body en el request' };
    } else {
      var body = JSON.parse(e.postData.contents);
      if (body.action === 'login') {
        response = handleLogin(body.idToken);
      } else if (body.action === 'checkSession') {
        response = handleCheckSession(body.sessionToken);
      } else if (body.action === 'getProfile') {
        response = handleGetProfile(body.sessionToken, body.wellId);
      } else {
        response = { status: 'error', code: 'SERVICE_UNAVAILABLE', message: 'accion desconocida: ' + body.action };
      }
    }
  } catch (err) {
    // TEMPORAL, solo V0/debug: ver nota en handleGetProfile.
    response = { status: 'error', code: 'SERVICE_UNAVAILABLE', message: err.toString(), debug: String(err) };
  }

  return ContentService
    .createTextOutput(JSON.stringify(response))
    .setMimeType(ContentService.MimeType.JSON);
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

function getSessionSecret() {
  var secret = PropertiesService.getScriptProperties().getProperty('SESSION_SECRET');
  if (!secret) {
    throw new Error('SESSION_SECRET no configurado. Corre setupSessionSecret() primero.');
  }
  return secret;
}

function signPayload(payloadB64) {
  var rawSignature = Utilities.computeHmacSha256Signature(payloadB64, getSessionSecret());
  return Utilities.base64EncodeWebSafe(rawSignature);
}

function createSessionToken(email) {
  var now = Math.floor(Date.now() / 1000);
  var payload = JSON.stringify({ email: email, iat: now, exp: now + SESSION_TTL_SECONDS });
  var payloadB64 = Utilities.base64EncodeWebSafe(payload);
  return payloadB64 + '.' + signPayload(payloadB64);
}

function verifySessionToken(token) {
  if (!token || token.indexOf('.') === -1) {
    return { valid: false, reason: 'formato invalido' };
  }
  var parts = token.split('.');
  if (parts.length !== 2) {
    return { valid: false, reason: 'formato invalido' };
  }
  var payloadB64 = parts[0];
  var signature = parts[1];

  if (signPayload(payloadB64) !== signature) {
    return { valid: false, reason: 'firma invalida' };
  }

  var payload;
  try {
    payload = JSON.parse(Utilities.newBlob(Utilities.base64DecodeWebSafe(payloadB64)).getDataAsString());
  } catch (err) {
    return { valid: false, reason: 'payload corrupto' };
  }

  var now = Math.floor(Date.now() / 1000);
  if (!payload.exp || now > payload.exp) {
    return { valid: false, reason: 'expirado' };
  }

  return { valid: true, email: payload.email };
}

function handleCheckSession(sessionToken) {
  var result = verifySessionToken(sessionToken);
  if (!result.valid) {
    return { status: 'error', code: 'UNAUTHORIZED', message: 'sessionToken invalido: ' + result.reason };
  }
  return {
    status: 'ok',
    data: { email: result.email, message: 'sesion validada localmente, sin llamar a Google' }
  };
}

function handleGetProfile(sessionToken, wellId) {
  var session = verifySessionToken(sessionToken);
  if (!session.valid) {
    return { status: 'error', code: 'UNAUTHORIZED', message: 'sessionToken invalido: ' + session.reason };
  }

  if (!wellId || !/^\d{2}-\d{4}$/.test(wellId)) {
    return { status: 'error', code: 'INVALID_WELL_ID', message: 'formato invalido: ' + wellId };
  }

  var startTime = Date.now();
  var profile;
  try {
    profile = profileService_getProfile(wellId);
  } catch (err) {
    // TEMPORAL, solo V0/debug: exponer el error real para poder diagnosticar
    // desde el frontend, ya que la UI de ejecuciones de Apps Script no deja
    // ver el detalle. Sacar este campo "debug" antes de V1.
    return { status: 'error', code: 'SERVICE_UNAVAILABLE', message: err.toString(), debug: String(err) };
  }
  var elapsedMs = Date.now() - startTime;

  if (!profile.found) {
    return { status: 'error', code: 'PROFILE_NOT_FOUND', message: 'no se encontro perfil para ' + wellId };
  }

  var bytes = profile.blob.getBytes();
  var imageBase64 = Utilities.base64Encode(bytes);

  return {
    status: 'ok',
    data: {
      wellId: wellId,
      mimeType: profile.blob.getContentType(),
      imageBase64: imageBase64,
      originalSizeBytes: bytes.length,
      base64SizeBytes: imageBase64.length,
      elapsedMsEnDrive: elapsedMs
    }
  };
}

// ProfileService: logica de negocio pura. No sabe si el resultado se va a
// mandar como base64, como link, o de cualquier otra forma - eso lo decide
// handleGetProfile (capa API), no esta funcion.
function profileService_getProfile(wellId) {
  return driveProfileRepository_getFile(wellId);
}

// DriveProfileRepository: la unica funcion que sabe que existe Drive y
// getFilesByName(). Si el dia de manana cambia el mecanismo de busqueda
// (por ejemplo, un indice), se cambia solo aca.
function driveProfileRepository_getFile(wellId) {
  var folderId = PropertiesService.getScriptProperties().getProperty('FOLDER_ID');
  if (!folderId) {
    throw new Error('FOLDER_ID no configurado en Script Properties');
  }
  var folder = DriveApp.getFolderById(folderId);
  var files = folder.getFilesByName(wellId + '.jpg');
  if (!files.hasNext()) {
    return { found: false };
  }
  var file = files.next();
  return { found: true, blob: file.getBlob() };
}

function handleLogin(idToken) {
  if (!idToken) {
    return { status: 'error', code: 'UNAUTHORIZED', message: 'falta idToken' };
  }

  var url = 'https://oauth2.googleapis.com/tokeninfo?id_token=' + encodeURIComponent(idToken);
  var httpResponse;
  try {
    httpResponse = UrlFetchApp.fetch(url, { muteHttpExceptions: true });
  } catch (err) {
    return { status: 'error', code: 'SERVICE_UNAVAILABLE', message: 'no se pudo contactar a Google: ' + err.toString() };
  }

  if (httpResponse.getResponseCode() !== 200) {
    return { status: 'error', code: 'UNAUTHORIZED', message: 'tokeninfo rechazo el token: ' + httpResponse.getContentText() };
  }

  var tokenInfo = JSON.parse(httpResponse.getContentText());

  if (tokenInfo.aud !== GOOGLE_CLIENT_ID) {
    return { status: 'error', code: 'UNAUTHORIZED', message: 'aud no coincide con nuestro client id' };
  }

  return {
    status: 'ok',
    data: {
      email: tokenInfo.email,
      name: tokenInfo.name || null,
      emailVerified: tokenInfo.email_verified === 'true' || tokenInfo.email_verified === true,
      sessionToken: createSessionToken(tokenInfo.email)
    }
  };
}
