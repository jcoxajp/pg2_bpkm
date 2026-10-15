const path = require('path');
const { crearUploadImagenes } = require('../../utils/imageUpload');

// Sin UPLOAD_ROOT el proceso no arranca: nunca escribir dentro del repo.
const rawUploadRoot = (process.env.UPLOAD_ROOT || '').trim();
if (!rawUploadRoot) {
  throw new Error('UPLOAD_ROOT no está configurado (requerido para guardar evidencia de entregas)');
}
const UPLOAD_ROOT = path.normalize(rawUploadRoot);

const MAX_MB = Number(process.env.MAX_UPLOAD_MB || 10);
const MAX_FOTOS = 3;

const { uploadImagenes, computeStoredPath, resolveAbsPath } = crearUploadImagenes({
  uploadRoot: UPLOAD_ROOT,
  subcarpeta: 'entregafacturas',
  campo: 'foto',
  maxArchivos: MAX_FOTOS,
  maxMb: MAX_MB,
  contexto: 'entrega',
});

module.exports = {
  uploadEvidencia: uploadImagenes,
  computeStoredPath,
  resolveAbsPath,
  UPLOAD_ROOT,
  MAX_MB,
  MAX_FOTOS,
};
