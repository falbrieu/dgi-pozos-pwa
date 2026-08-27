// Unica funcion que sabe que existe Drive y getFilesByName(). Si el dia de
// manana cambia el mecanismo de busqueda (por ejemplo, un indice), se
// cambia solo aca - ProfileService y el frontend no se enteran.
function driveProfileRepository_getFile(wellId) {
  var folder = DriveApp.getFolderById(getFolderId());
  var files = folder.getFilesByName(wellId + '.jpg');
  if (!files.hasNext()) {
    return { found: false };
  }
  var file = files.next();
  return { found: true, blob: file.getBlob() };
}
