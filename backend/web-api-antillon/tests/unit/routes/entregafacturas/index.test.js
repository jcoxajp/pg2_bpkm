import { describe, it, expect } from 'vitest';
import { createRequire } from 'module';
import os from 'os';
import path from 'path';

// El middleware de subida exige UPLOAD_ROOT al cargarse: carpeta temporal.
process.env.UPLOAD_ROOT = path.join(os.tmpdir(), 'wa-tests-entrega-routes');

const require = createRequire(import.meta.url);
const router = require('../../../../src/routes/v1/entregafacturas');
const { requirePiloto } = require('../../../../src/middleware/requirePiloto');
const {
  searchLimiter,
  entregaUploadLimiter,
  entregaArchivoLimiter,
} = require('../../../../src/middleware/rateLimiter');
const { uploadEvidencia } = require('../../../../src/middleware/entregafacturas/entregaEvidenciaUploadMiddleware');

function cadena(metodo, ruta) {
  const layer = router.stack.find((l) => l.route?.path === ruta && l.route.methods[metodo]);
  if (!layer) throw new Error(`No existe ${metodo.toUpperCase()} ${ruta} en el router`);
  return layer.route.stack.map((s) => s.handle);
}

describe('router entregafacturas — rate limit por ruta', () => {
  it.each([
    ['get', '/', searchLimiter, 'searchLimiter'],
    ['get', '/:uuid', searchLimiter, 'searchLimiter'],
    ['get', '/:uuid/archivo', entregaArchivoLimiter, 'entregaArchivoLimiter'],
    ['post', '/', entregaUploadLimiter, 'entregaUploadLimiter'],
  ])('%s %s usa %s después de requirePiloto', (metodo, ruta, limiter) => {
    const handlers = cadena(metodo, ruta);
    const iPiloto = handlers.indexOf(requirePiloto);
    const iLimiter = handlers.indexOf(limiter);

    expect(iPiloto).toBeGreaterThanOrEqual(0);
    expect(iLimiter).toBeGreaterThan(iPiloto);
  });

  it('POST / aplica el limiter antes de la subida — un request rechazado nunca escribe en disco', () => {
    const handlers = cadena('post', '/');
    expect(handlers.indexOf(entregaUploadLimiter)).toBeLessThan(handlers.indexOf(uploadEvidencia));
  });
});
