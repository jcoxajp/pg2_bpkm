// routes/bpkm/v1/cambiosForma.js
const express = require('express');
const makeHelpers = require('./helpers');
const { requireAuth } = require('../../../../../packages/shared-auth');
const { requireModuloPermission } = require('../../../../../packages/shared-auth/permisos');
const { apiLimiter } = require('../../middleware/bpkm/bpkmRateLimit');

const { getUserId } = makeHelpers;

module.exports = function makeCambiosFormaRouter({ pool } = {}) {
  const router = express.Router();
  const { q, toStrOrNull, toInt, toDateOrNull, ok, bad } = makeHelpers({ pool });

  router.use((req, _res, next) => {
    req.app.locals.pool = pool;
    next();
  });

  // Bandeja de solicitudes de cambio (paginado)
  router.post('/get_solicitudes_cambio', requireAuth, requireModuloPermission('cambiosformaentrega'), apiLimiter, async (req, res) => {
    try {
      const {
        estado_codigo = 'PEND',
        fecha_desde = null,
        fecha_hasta = null,
        folio_like = '',
        limit = 50,
        offset = 0
      } = req.body || {};

      const usuario = getUserId(req);
      if (!toInt(usuario)) return bad(res, 'usuario requerido');

      const rows = await q(
        `SELECT * FROM bpkm.get_solicitudes_cambio($1,$2,$3,$4,$5,$6,$7)`,
        [
          toStrOrNull(estado_codigo),
          toDateOrNull(fecha_desde),
          toDateOrNull(fecha_hasta),
          toStrOrNull(folio_like),
          toInt(limit) || 50,
          toInt(offset) || 0,
          toInt(usuario)
        ]
      );
      const total = rows?.length ? Number(rows[0].total_count || 0) : 0;
      return ok(res, { total, items: rows || [] });
    } catch (e) {
      return bad(res, e.message);
    }
  });

  // put_sel_cambio_resolver: manejado en selecciones.js (montado antes en el router)

  // Historial de cambios por selección
  router.post('/get_cambios_por_seleccion', requireAuth, requireModuloPermission('cambiosformaentrega'), apiLimiter, async (req, res) => {
    try {
      const { id_factura_sel } = req.body || {};
      if (!toInt(id_factura_sel)) return bad(res, 'id_factura_sel requerido');

      const rows = await q(
        `SELECT * FROM bpkm.get_cambios_por_seleccion($1)`,
        [toInt(id_factura_sel)]
      );
      return ok(res, rows || []);
    } catch (e) {
      return bad(res, e.message);
    }
  });

  return router;
};