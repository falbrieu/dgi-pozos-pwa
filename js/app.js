(function () {
  var GOOGLE_CLIENT_ID = '970817103867-q30tnqqqcc9lhtaamqplbs28nglcj7q3.apps.googleusercontent.com';

  var sessionToken = null;
  var currentEmail = null;

  var screens = {
    loading: document.getElementById('screen-loading'),
    login: document.getElementById('screen-login'),
    main: document.getElementById('screen-main'),
    disabled: document.getElementById('screen-disabled')
  };

  function showScreen(name) {
    Object.keys(screens).forEach(function (key) {
      screens[key].hidden = key !== name;
    });
  }

  function isIOS() {
    return /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
  }

  function networkAwareMessage() {
    return navigator.onLine ? getErrorMessage('SERVICE_UNAVAILABLE') : getErrorMessage('OFFLINE');
  }

  // --- Google Identity Services: init programatico, nunca declarativo ---
  // Se inicializa (y recien ahi puede aparecer el prompt de One Tap) SOLO
  // cuando ya sabemos que hace falta - es decir, despues de intentar
  // recuperar la sesion propia y confirmar que no hay una valida. Asi se
  // evita el prompt de Google apareciendo encima de una sesion ya
  // recuperada con exito.
  var gsiLoaded = false;
  var shouldInitGoogleSignIn = false;

  window.onGsiLoaded = function () {
    gsiLoaded = true;
    tryInitGoogleSignIn();
  };

  function tryInitGoogleSignIn() {
    if (!gsiLoaded || !shouldInitGoogleSignIn) {
      return;
    }
    google.accounts.id.initialize({
      client_id: GOOGLE_CLIENT_ID,
      callback: handleCredentialResponse,
      auto_select: true
    });
    google.accounts.id.renderButton(document.getElementById('google-signin-button'), { type: 'standard' });
    google.accounts.id.prompt();
  }

  function goToLogin() {
    shouldInitGoogleSignIn = true;
    tryInitGoogleSignIn();
    showScreen('login');
  }

  // --- Area de resultado (dentro de screen-main, no se pierde el input) ---
  var resultArea = document.getElementById('result-area');

  function renderIdle() {
    resultArea.innerHTML = '';
  }

  function renderSearching(wellId) {
    resultArea.innerHTML = '<p class="status">Buscando ' + wellId + '...</p>';
  }

  function base64ToFile(base64, mimeType, filename) {
    var byteChars = atob(base64);
    var byteNumbers = new Array(byteChars.length);
    for (var i = 0; i < byteChars.length; i++) {
      byteNumbers[i] = byteChars.charCodeAt(i);
    }
    return new File([new Uint8Array(byteNumbers)], filename, { type: mimeType });
  }

  // iOS no ofrece <a download> de forma confiable para imagenes: Safari
  // tiende a abrirla en vez de guardarla. En vez de depender solo del
  // gesto de mantener presionado, el boton dispara el share sheet nativo
  // (Web Share API con archivos, soportado desde iOS 15), que incluye
  // "Guardar en Fotos". Si el dispositivo no lo soporta, el fallback es
  // abrir la imagen en una pestana nueva, donde Safari si ofrece su
  // propio boton de compartir/guardar sobre la imagen ya abierta.
  async function handleSaveImageIOS(wellId, mimeType, imageBase64, dataUri) {
    var file = base64ToFile(imageBase64, mimeType, wellId + '.jpg');
    var supportsFileShare = false;
    try {
      supportsFileShare = !!(navigator.canShare && navigator.canShare({ files: [file] }));
    } catch (err) {
      supportsFileShare = false;
    }

    if (supportsFileShare) {
      try {
        await navigator.share({ files: [file], title: 'Perfil ' + wellId });
      } catch (err) {
        // Cancelado por el usuario u otro error del share sheet: no es
        // un error de la app, no hacemos nada mas.
      }
      return;
    }

    window.open(dataUri, '_blank');
  }

  function renderFound(wellId, mimeType, imageBase64) {
    var dataUri = 'data:' + mimeType + ';base64,' + imageBase64;
    var html = '<p class="status success">Perfil encontrado</p>';
    html += '<img class="profile-image" src="' + dataUri + '" alt="Perfil del pozo ' + wellId + '" />';
    if (isIOS()) {
      html += '<button type="button" id="btn-save-image" class="button">Guardar / Compartir</button>';
    } else {
      html += '<a class="button" href="' + dataUri + '" download="' + wellId + '.jpg">Descargar</a>';
    }
    resultArea.innerHTML = html;

    if (isIOS()) {
      document.getElementById('btn-save-image').addEventListener('click', function () {
        handleSaveImageIOS(wellId, mimeType, imageBase64, dataUri);
      });
    }
  }

  function renderMessage(text) {
    resultArea.innerHTML = '<p class="status error">' + text + '</p>';
  }

  // --- Login ---
  var loginErrorEl = document.getElementById('login-error');

  function handleCredentialResponse(response) {
    loginErrorEl.hidden = true;
    apiLogin(response.credential).then(function (result) {
      if (result.status === 'ok') {
        sessionToken = result.data.sessionToken;
        currentEmail = result.data.email;
        localStorage.setItem('sessionToken', sessionToken);
        enterMain();
      } else if (result.code === 'USER_DISABLED') {
        showScreen('disabled');
      } else {
        loginErrorEl.textContent = getErrorMessage(result.code);
        loginErrorEl.hidden = false;
      }
    }).catch(function () {
      loginErrorEl.textContent = networkAwareMessage();
      loginErrorEl.hidden = false;
    });
  }

  function enterMain() {
    document.getElementById('user-email').textContent = currentEmail;
    renderIdle();
    showScreen('main');
  }

  function logout() {
    localStorage.removeItem('sessionToken');
    sessionToken = null;
    currentEmail = null;
    if (gsiLoaded) {
      // Sin esto, auto_select podria volver a loguear silenciosamente a
      // la misma cuenta apenas se re-inicialice el boton de Google.
      google.accounts.id.disableAutoSelect();
    }
    goToLogin();
  }

  document.getElementById('btn-logout').addEventListener('click', logout);
  document.getElementById('btn-logout-disabled').addEventListener('click', logout);

  // --- Busqueda ---
  var form = document.getElementById('search-form');
  var input = document.getElementById('input-well-id');
  var inputError = document.getElementById('input-error');
  var btnClear = document.getElementById('btn-clear-well-id');

  function updateClearButtonVisibility() {
    btnClear.hidden = input.value.length === 0;
  }

  // Enmascarado en vivo: solo digitos, guion automatico despues del
  // segundo digito, maximo 6 digitos reales. Preserva la posicion logica
  // del cursor (contando digitos, no caracteres) para que backspace en
  // cualquier punto del valor se sienta natural, no solo al final.
  // El pegado usa la normalizacion completa (acepta guion, espacios,
  // etc.) en vez del enmascarado simple, para que pegar "3-123" funcione.
  input.addEventListener('input', function () {
    var cursorPos = input.selectionStart;
    var digitsBeforeCursor = countDigitsBefore(input.value, cursorPos);
    var formatted = formatWellIdInput(input.value);
    input.value = formatted;
    var newPos = positionAfterNDigits(formatted, digitsBeforeCursor);
    input.setSelectionRange(newPos, newPos);
    updateClearButtonVisibility();
  });

  input.addEventListener('paste', function (event) {
    event.preventDefault();
    var pasted = (event.clipboardData || window.clipboardData).getData('text');
    var normalizado = normalizeWellId(pasted);
    input.value = isValidWellId(normalizado) ? normalizado : formatWellIdInput(pasted);
    updateClearButtonVisibility();
  });

  btnClear.addEventListener('click', function () {
    input.value = '';
    updateClearButtonVisibility();
    inputError.hidden = true;
    input.focus();
  });

  form.addEventListener('submit', function (event) {
    event.preventDefault();
    inputError.hidden = true;

    var normalized = normalizeWellId(input.value);
    var wellIdError = getWellIdError(normalized);
    if (wellIdError) {
      inputError.textContent = getErrorMessage('INVALID_WELL_ID_' + wellIdError);
      inputError.hidden = false;
      return;
    }
    input.value = normalized;

    renderSearching(normalized);
    apiGetProfile(sessionToken, normalized).then(function (result) {
      if (result.status === 'ok') {
        renderFound(result.data.wellId, result.data.mimeType, result.data.imageBase64);
      } else if (result.code === 'USER_DISABLED') {
        showScreen('disabled');
      } else if (result.code === 'UNAUTHORIZED') {
        logout();
      } else if (result.code === 'PROFILE_NOT_FOUND') {
        renderMessage(getErrorMessage('PROFILE_NOT_FOUND', normalized));
      } else {
        renderMessage(getErrorMessage(result.code));
      }
    }).catch(function () {
      renderMessage(networkAwareMessage());
    });
  });

  // --- Recuperacion de sesion al cargar ---
  function init() {
    var stored = localStorage.getItem('sessionToken');
    if (!stored) {
      goToLogin();
      return;
    }

    apiCheckSession(stored).then(function (result) {
      if (result.status === 'ok') {
        sessionToken = stored;
        currentEmail = result.data.email;
        enterMain();
      } else if (result.code === 'USER_DISABLED') {
        showScreen('disabled');
      } else {
        localStorage.removeItem('sessionToken');
        goToLogin();
      }
    }).catch(function () {
      goToLogin();
    });
  }

  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js');
  }

  init();
})();
