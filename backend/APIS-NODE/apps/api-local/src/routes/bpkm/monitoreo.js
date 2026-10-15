// routes/bpkm/v1/monitoreo.js
const express = require('express');
const makeHelpers = require('./helpers');
const { requireAuth } = require('../../../../../packages/shared-auth');
const { requireModuloPermission, requireAnyModuloPermission } = require('../../../../../packages/shared-auth/permisos');
const { validateContentType, sanitizeInput } = require('../../middleware/rp/rpSecurityMiddleware');
const { validateIdParam } = require('../../middleware/rp/rpValidationMiddleware');
const { validateComentarioMonitoreo } = require('../../middleware/bpkm/bpkmValidationMiddleware');
const { apiLimiter } = require('../../middleware/bpkm/bpkmRateLimit');
const monitoreoController = require('../../controllers/bpkm/monitoreoController');

module.exports = function makeMonitoreoRouter({ pool } = {}) {
  const router = express.Router();
  const { q, toInt, ok, bad } = makeHelpers({ pool });

  router.use((req, _res, next) => {
    req.app.locals.pool = pool;
    next();
  });

  // PATCH /api/bpkm/monitoreo/:id_ruta - body: tipo ('S'|'E'), fecha_hora, comentario (opcional)
  router.patch(
    '/monitoreo/:id_ruta',
    requireAuth, validateIdParam('id_ruta'), requireModuloPermission('monitoreobpkm'), apiLimiter, validateContentType, sanitizeInput, validateComentarioMonitoreo,
    monitoreoController.patchMonitoreo
  );

  // POST /api/bpkm/get_monitoreo_por_ruta - body: id_ruta
  router.post('/get_monitoreo_por_ruta', requireAuth, requireAnyModuloPermission(['monitoreobpkm', 'gerenciabpkm', 'localesbpkm', 'rrhhbpkm']), apiLimiter, async (req, res) => {
    try {
      const { id_ruta } = req.body || {};
      if (!toInt(id_ruta)) return bad(res, 'id_ruta requerido');
      const rows = await q(`SELECT * FROM bpkm.get_monitoreo_por_ruta($1)`, [toInt(id_ruta)]);
      ok(res, rows);
    } catch (e) { bad(res, e.message); }
  });

  // GET /api/bpkm/monitoreo - query: estado_codigo, fecha_desde, fecha_hasta, id_suc_salida,
  // id_camion, id_piloto, id_auxiliar, creado_por, page, limit
  router.get(
    '/monitoreo',
    requireAuth, requireModuloPermission('monitoreobpkm'), apiLimiter,
    monitoreoController.getRutasConMonitoreo
  );

  return router;
};
