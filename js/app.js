(function () {
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

  window.handleCredentialResponse = function (response) {
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
  };

  function enterMain() {
    document.getElementById('user-email').textContent = currentEmail;
    renderIdle();
    showScreen('main');
  }

  function logout() {
    localStorage.removeItem('sessionToken');
    sessionToken = null;
    currentEmail = null;
    showScreen('login');
  }

  document.getElementById('btn-logout').addEventListener('click', logout);
  document.getElementById('btn-logout-disabled').addEventListener('click', logout);

  // --- Busqueda ---
  var form = document.getElementById('search-form');
  var input = document.getElementById('input-well-id');
  var inputError = document.getElementById('input-error');

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
      showScreen('login');
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
        showScreen('login');
      }
    }).catch(function () {
      showScreen('login');
    });
  }

  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js');
  }

  init();
})();
