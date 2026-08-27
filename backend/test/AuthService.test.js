const { installAppsScriptFakes } = require('./appsScriptFakes');

// AuthService declara isUserActive/verifySessionToken en su propio scope
// de modulo (CommonJS), asi que cuando handleLogin/handleCheckSession las
// llaman internamente usan las funciones reales de este archivo, no los
// fakes globales - los fakes globales solo importan para llamadas desde
// OTROS archivos (ver Api.test.js). Por eso acá se prueba el
// comportamiento real end-to-end, no solo mocks.
const AuthService = require('../src/AuthService');

beforeEach(() => {
  installAppsScriptFakes();
});

describe('handleLogin', () => {
  test('login valido: usuario activo, devuelve sessionToken', () => {
    global.UrlFetchApp.fetch.mockReturnValue({
      getResponseCode: () => 200,
      getContentText: () => JSON.stringify({
        aud: global.GOOGLE_CLIENT_ID,
        email: 'user@example.com',
        name: 'Usuario Ejemplo',
        email_verified: 'true'
      })
    });
    global.sheetUserRepository_getUserStatus.mockReturnValue({ found: true, active: true });

    const result = AuthService.handleLogin('un-id-token-cualquiera');

    expect(result.status).toBe('ok');
    expect(result.data.email).toBe('user@example.com');
    expect(typeof result.data.sessionToken).toBe('string');
    expect(result.data.sessionToken.split('.').length).toBe(2);
  });

  test('token de Google invalido (tokeninfo responde distinto de 200): UNAUTHORIZED', () => {
    global.UrlFetchApp.fetch.mockReturnValue({
      getResponseCode: () => 400,
      getContentText: () => JSON.stringify({ error: 'invalid_token' })
    });

    const result = AuthService.handleLogin('token-invalido');

    expect(result.status).toBe('error');
    expect(result.code).toBe('UNAUTHORIZED');
  });

  test('token valido para Google pero de otra app (aud distinto): UNAUTHORIZED', () => {
    global.UrlFetchApp.fetch.mockReturnValue({
      getResponseCode: () => 200,
      getContentText: () => JSON.stringify({ aud: 'otra-app.apps.googleusercontent.com', email: 'user@example.com' })
    });

    const result = AuthService.handleLogin('token-de-otra-app');

    expect(result.status).toBe('error');
    expect(result.code).toBe('UNAUTHORIZED');
  });

  test('login con usuario deshabilitado en la allowlist: USER_DISABLED, no emite sessionToken', () => {
    global.UrlFetchApp.fetch.mockReturnValue({
      getResponseCode: () => 200,
      getContentText: () => JSON.stringify({ aud: global.GOOGLE_CLIENT_ID, email: 'deshabilitado@example.com' })
    });
    global.sheetUserRepository_getUserStatus.mockReturnValue({ found: true, active: false });

    const result = AuthService.handleLogin('token-de-usuario-deshabilitado');

    expect(result.status).toBe('error');
    expect(result.code).toBe('USER_DISABLED');
    expect(result.data).toBeUndefined();
  });
});

describe('isUserActive', () => {
  test('usuario encontrado y activo devuelve true', () => {
    global.sheetUserRepository_getUserStatus.mockReturnValue({ found: true, active: true });
    expect(AuthService.isUserActive('user@example.com')).toBe(true);
  });

  test('usuario encontrado pero no activo devuelve false', () => {
    global.sheetUserRepository_getUserStatus.mockReturnValue({ found: true, active: false });
    expect(AuthService.isUserActive('inactivo@example.com')).toBe(false);
  });

  test('usuario inexistente en la allowlist devuelve false', () => {
    global.sheetUserRepository_getUserStatus.mockReturnValue({ found: false, active: false });
    expect(AuthService.isUserActive('desconocido@example.com')).toBe(false);
  });

  test('usa el cache: la segunda llamada no vuelve a consultar la hoja', () => {
    global.sheetUserRepository_getUserStatus.mockReturnValue({ found: true, active: true });
    AuthService.isUserActive('user@example.com');
    AuthService.isUserActive('user@example.com');
    expect(global.sheetUserRepository_getUserStatus).toHaveBeenCalledTimes(1);
  });
});

describe('createSessionToken + verifySessionToken', () => {
  test('un token recien creado es valido', () => {
    const token = AuthService.createSessionToken('user@example.com');
    const result = AuthService.verifySessionToken(token);
    expect(result.valid).toBe(true);
    expect(result.email).toBe('user@example.com');
  });

  test('token con la firma alterada es rechazado', () => {
    const token = AuthService.createSessionToken('user@example.com');
    const tampered = token + 'x';
    const result = AuthService.verifySessionToken(tampered);
    expect(result.valid).toBe(false);
    expect(result.reason).toBe('firma invalida');
  });

  test('token con exp en el pasado es rechazado', () => {
    const payload = JSON.stringify({ email: 'user@example.com', iat: 1000, exp: 1000 });
    const payloadB64 = global.Utilities.base64EncodeWebSafe(payload);
    const signature = AuthService.signPayload(payloadB64);
    const expiredToken = payloadB64 + '.' + signature;

    const result = AuthService.verifySessionToken(expiredToken);

    expect(result.valid).toBe(false);
    expect(result.reason).toBe('expirado');
  });

  test('token con formato invalido (sin punto) es rechazado', () => {
    const result = AuthService.verifySessionToken('esto-no-es-un-token');
    expect(result.valid).toBe(false);
    expect(result.reason).toBe('formato invalido');
  });
});

describe('handleCheckSession', () => {
  test('sesion valida y usuario activo -> ok', () => {
    const token = AuthService.createSessionToken('user@example.com');
    global.sheetUserRepository_getUserStatus.mockReturnValue({ found: true, active: true });

    const result = AuthService.handleCheckSession(token);

    expect(result.status).toBe('ok');
    expect(result.data.email).toBe('user@example.com');
  });

  test('sesion valida pero usuario deshabilitado -> USER_DISABLED', () => {
    const token = AuthService.createSessionToken('user@example.com');
    global.sheetUserRepository_getUserStatus.mockReturnValue({ found: true, active: false });

    const result = AuthService.handleCheckSession(token);

    expect(result.status).toBe('error');
    expect(result.code).toBe('USER_DISABLED');
  });

  test('token invalido -> UNAUTHORIZED', () => {
    const result = AuthService.handleCheckSession('token-truchisimo');
    expect(result.status).toBe('error');
    expect(result.code).toBe('UNAUTHORIZED');
  });
});
