const path = require('path');

function getUploadRoot() {
  const raw = (process.env.UPLOAD_ROOT || '').trim();
  return raw ? path.normalize(raw) : path.join('C:', 'apps', 'upload');
}

/**
 * Resuelve una ruta relativa contra UPLOAD_ROOT previniendo path traversal.
 * @param {string} rutaRelativa
 * @returns {string} Ruta absoluta segura
 */
function resolveAbsPath(rutaRelativa) {
  if (!rutaRelativa || typeof rutaRelativa !== 'string') {
    throw new Error('Ruta de archivo vacía');
  }
  const rootAbs = path.resolve(getUploadRoot());
  const abs = path.resolve(rootAbs, rutaRelativa.replace(/\\/g, '/'));

  if (abs !== rootAbs && !abs.startsWith(rootAbs + path.sep)) {
    throw new Error('Ruta fuera de UPLOAD_ROOT');
  }

  return abs;
}

const MIME_TYPES = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp'
};

/**
 * Determina el Content-Type para streaming de imagen.
 * @param {string} rutaArchivo
 * @returns {string} MIME type correspondiente
 */
function determinarContentType(rutaArchivo) {
  const ext = path.extname(rutaArchivo || '').toLowerCase();
  return MIME_TYPES[ext] || 'application/octet-stream';
}

module.exports = {
  getUploadRoot,
  resolveAbsPath,
  determinarContentType
};
