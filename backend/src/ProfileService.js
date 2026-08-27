// ProfileService: logica de negocio pura. No sabe si el resultado se va a
// mandar como base64, como link, o de cualquier otra forma - eso lo decide
// Api.js, no esta funcion.
function profileService_getProfile(wellId) {
  return driveProfileRepository_getFile(wellId);
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { profileService_getProfile };
}
