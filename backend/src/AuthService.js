// AuthService: identidad y sesion. No sabe nada de HTTP (eso es Api.js) ni
// de Drive/Sheets (eso son los repositorios).

// Sin cambios de comportamiento en este paso: se mantiene en 1800s tal
// como estaba en V0. Sube a 12 horas en un paso posterior, explicito.
var SESSION_TTL_SECONDS = 1800;

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

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { signPayload, createSessionToken, verifySessionToken, handleCheckSession, handleLogin };
}
