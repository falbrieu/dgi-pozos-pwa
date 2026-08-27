// Api: unico punto de entrada HTTP. Traduce requests a llamadas de
// AuthService/ProfileService y decide como se entrega la respuesta
// (por ejemplo, la codificacion en base64 de la imagen es una decision
// de esta capa, no de ProfileService).

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
    response = { status: 'error', code: 'SERVICE_UNAVAILABLE', message: err.toString() };
  }

  return ContentService
    .createTextOutput(JSON.stringify(response))
    .setMimeType(ContentService.MimeType.JSON);
}

function handleGetProfile(sessionToken, wellId) {
  var session = verifySessionToken(sessionToken);
  if (!session.valid) {
    return { status: 'error', code: 'UNAUTHORIZED', message: 'sessionToken invalido: ' + session.reason };
  }

  if (!isUserActive(session.email)) {
    logHistoryEvent(session.email, 'getProfile', wellId, 'USER_DISABLED');
    return { status: 'error', code: 'USER_DISABLED', message: 'usuario no habilitado: ' + session.email };
  }

  if (!wellId || !/^\d{2}-\d{4}$/.test(wellId)) {
    logHistoryEvent(session.email, 'getProfile', wellId, 'INVALID_WELL_ID');
    return { status: 'error', code: 'INVALID_WELL_ID', message: 'formato invalido: ' + wellId };
  }

  // Los departamentos validos van de 01 a 19. Esta regla existe tambien
  // en el frontend (wellIdValidator.js), pero el backend nunca confia
  // unicamente en esa validacion - por eso se repite aca.
  var departamento = parseInt(wellId.substring(0, 2), 10);
  if (departamento < 1 || departamento > 19) {
    logHistoryEvent(session.email, 'getProfile', wellId, 'INVALID_WELL_ID');
    return { status: 'error', code: 'INVALID_WELL_ID', message: 'departamento fuera de rango: ' + wellId };
  }

  var startTime = Date.now();
  var profile;
  try {
    profile = profileService_getProfile(wellId);
  } catch (err) {
    logHistoryEvent(session.email, 'getProfile', wellId, 'SERVICE_UNAVAILABLE');
    return { status: 'error', code: 'SERVICE_UNAVAILABLE', message: err.toString() };
  }
  var elapsedMs = Date.now() - startTime;

  if (!profile.found) {
    logHistoryEvent(session.email, 'getProfile', wellId, 'PROFILE_NOT_FOUND');
    return { status: 'error', code: 'PROFILE_NOT_FOUND', message: 'no se encontro perfil para ' + wellId };
  }

  var bytes = profile.blob.getBytes();
  var imageBase64 = Utilities.base64Encode(bytes);

  logHistoryEvent(session.email, 'getProfile', wellId, 'OK');

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

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { doPost, handleGetProfile };
}
