// routes/bpkm/cambiosSucursal.js
const express = require('express');
const makeHelpers = require('./helpers');
const { getUserId } = makeHelpers;
const { requireAuth } = require('../../../../../packages/shared-auth');
const { requireModuloPermission } = require('../../../../../packages/shared-auth/permisos');
const { validateContentType, sanitizeInput } = require('../../middleware/rp/rpSecurityMiddleware');
const { validateMotivoCambioSucursal, validateObservacionesCambioSucursal } = require('../../middleware/bpkm/bpkmValidationMiddleware');
const { apiLimiter } = require('../../middleware/bpkm/bpkmRateLimit');

module.exports = function makeCambiosSucursalRouter({ pool } = {}) {
  const router = express.Router();
  const { q, toStrOrNull, toInt, ok, bad } = makeHelpers({ pool });

  router.use((req, _res, next) => {
    req.app.locals.pool = pool;
    next();
  });

  // Solicitar cambio de sucursal
  router.post(
    '/post_solicitar_cambio_sucursal',
    requireAuth, apiLimiter, validateContentType, sanitizeInput, validateMotivoCambioSucursal,
    async (req, res) => {
    try {
      const {
        id_factura_sel,
        id_sucursal_destino,
        motivo
      } = req.body || {};
      const usuario = getUserId(req);

      if (!toInt(id_factura_sel)) return bad(res, 'id_factura_sel requerido');
      if (!toInt(id_sucursal_destino)) return bad(res, 'id_sucursal_destino requerido');
      if (!toStrOrNull(motivo)) return bad(res, 'motivo requerido');
      if (!toInt(usuario)) return bad(res, 'usuario requerido');

      const ownerCheck = await q(
        `SELECT creado_por FROM bpkm.tbl_factura_seleccion WHERE id_factura_sel = $1`,
        [toInt(id_factura_sel)]
      );
      if (!ownerCheck?.length) return bad(res, 'Selección no encontrada');
      if (ownerCheck[0].creado_por !== toInt(usuario))
        return bad(res, 'Solo el creador puede solicitar cambio de sucursal');

      const rows = await q(
        `SELECT * FROM bpkm.post_solicitar_cambio_sucursal($1,$2,$3,$4)`,
        [
          toInt(id_factura_sel),
          toInt(id_sucursal_destino),
          toStrOrNull(motivo),
          toInt(usuario)
        ]
      );
      return ok(res, rows?.[0] || {});
    } catch (e) {
      return bad(res, e.message);
    }
  });

  // Aprobar cambio de sucursal
  router.post(
    '/post_aprobar_cambio_sucursal',
    requireAuth, requireModuloPermission('cambiossucursal'), apiLimiter, validateContentType, sanitizeInput, validateObservacionesCambioSucursal,
    async (req, res) => {
    try {
      const {
        id_cambio,
        observaciones
      } = req.body || {};
      const usuario = getUserId(req);

      if (!toInt(id_cambio)) return bad(res, 'id_cambio requerido');
      if (!toInt(usuario)) return bad(res, 'usuario requerido');

      // Validar que el usuario sea de la sucursal destino
      const validacion = await q(`
        SELECT
          cs.id_sucursal_destino,
          aurs.id_sucursal as id_sucursal_usuario
        FROM bpkm.tbl_cambio_sucursal_factura cs
        LEFT JOIN usuarios.tbl_asignaciones_usuario_rol_sucursal aurs
          ON aurs.id_usuario = $2 AND aurs.estado = 1
        WHERE cs.id_cambio_sucursal = $1
        LIMIT 1
      `, [toInt(id_cambio), toInt(usuario)]);

      if (!validacion || validacion.length === 0) {
        return bad(res, 'Solicitud de cambio no encontrada.');
      }

      const { id_sucursal_destino, id_sucursal_usuario } = validacion[0];

      if (!id_sucursal_usuario) {
        return bad(res, 'Usuario no tiene asignación de sucursal.');
      }

      if (id_sucursal_usuario !== id_sucursal_destino) {
        return bad(res, 'Solo la sucursal destino puede aprobar esta solicitud.');
      }

      const rows = await q(
        `SELECT * FROM bpkm.post_aprobar_cambio_sucursal($1,$2,$3)`,
        [
          toInt(id_cambio),
          toStrOrNull(observaciones),
          toInt(usuario)
        ]
      );
      return ok(res, rows?.[0] || {});
    } catch (e) {
      return bad(res, e.message);
    }
  });

  // Rechazar cambio de sucursal
  router.post(
    '/post_rechazar_cambio_sucursal',
    requireAuth, requireModuloPermission('cambiossucursal'), apiLimiter, validateContentType, sanitizeInput, validateObservacionesCambioSucursal,
    async (req, res) => {
    try {
      const {
        id_cambio,
        observaciones
      } = req.body || {};
      const usuario = getUserId(req);

      if (!toInt(id_cambio)) return bad(res, 'id_cambio requerido');
      if (!toInt(usuario)) return bad(res, 'usuario requerido');

      // Validar que el usuario sea de la sucursal destino
      const validacion = await q(`
        SELECT
          cs.id_sucursal_destino,
          aurs.id_sucursal as id_sucursal_usuario
        FROM bpkm.tbl_cambio_sucursal_factura cs
        LEFT JOIN usuarios.tbl_asignaciones_usuario_rol_sucursal aurs
          ON aurs.id_usuario = $2 AND aurs.estado = 1
        WHERE cs.id_cambio_sucursal = $1
        LIMIT 1
      `, [toInt(id_cambio), toInt(usuario)]);

      if (!validacion || validacion.length === 0) {
        return bad(res, 'Solicitud de cambio no encontrada.');
      }

      const { id_sucursal_destino, id_sucursal_usuario } = validacion[0];

      if (!id_sucursal_usuario) {
        return bad(res, 'Usuario no tiene asignación de sucursal.');
      }

      if (id_sucursal_usuario !== id_sucursal_destino) {
        return bad(res, 'Solo la sucursal destino puede rechazar esta solicitud.');
      }

      const rows = await q(
        `SELECT * FROM bpkm.post_rechazar_cambio_sucursal($1,$2,$3)`,
        [
          toInt(id_cambio),
          toStrOrNull(observaciones),
          toInt(usuario)
        ]
      );
      return ok(res, rows?.[0] || {});
    } catch (e) {
      return bad(res, e.message);
    }
  });

  // Obtener solicitudes de cambio de sucursal
  router.post('/get_cambios_sucursal', requireAuth, requireModuloPermission('cambiossucursal'), apiLimiter, async (req, res) => {
    try {
      const {
        estado_codigo = '',
        id_sucursal = 0,
        limit = 50,
        offset = 0
      } = req.body || {};

      const rows = await q(
        `SELECT * FROM bpkm.get_cambios_sucursal($1,$2,$3,$4)`,
        [
          toStrOrNull(estado_codigo),
          toInt(id_sucursal) || 0,
          toInt(limit) || 50,
          toInt(offset) || 0
        ]
      );

      const result = rows?.[0] || {};
      return ok(res, {
        items: result.items || [],
        total_count: result.total_count || 0
      });
    } catch (e) {
      return bad(res, e.message);
    }
  });

  return router;
};
