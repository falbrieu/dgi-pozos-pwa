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

  function renderFound(wellId, mimeType, imageBase64) {
    var dataUri = 'data:' + mimeType + ';base64,' + imageBase64;
    var html = '<p class="status success">Perfil encontrado</p>';
    html += '<img class="profile-image" src="' + dataUri + '" alt="Perfil del pozo ' + wellId + '" />';
    if (isIOS()) {
      html += '<p class="hint">Mantené presionada la imagen para guardarla.</p>';
    } else {
      html += '<a class="button" href="' + dataUri + '" download="' + wellId + '.jpg">Descargar</a>';
    }
    resultArea.innerHTML = html;
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

  // Enmascarado en vivo: solo digitos, guion automatico despues del
  // segundo digito, maximo 6 digitos reales. El pegado usa la
  // normalizacion completa (acepta guion, espacios, etc.) en vez del
  // enmascarado simple, para que pegar "3-123" siga funcionando.
  input.addEventListener('input', function () {
    input.value = formatWellIdInput(input.value);
  });

  input.addEventListener('paste', function (event) {
    event.preventDefault();
    var pasted = (event.clipboardData || window.clipboardData).getData('text');
    var normalizado = normalizeWellId(pasted);
    input.value = isValidWellId(normalizado) ? normalizado : formatWellIdInput(pasted);
  });

  form.addEventListener('submit', function (event) {
    event.preventDefault();
    inputError.hidden = true;

    var normalized = normalizeWellId(input.value);
    if (!isValidWellId(normalized)) {
      inputError.textContent = getErrorMessage('INVALID_WELL_ID');
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
