// routes/bpkm/v1/selecciones.js
const express = require('express');
const makeHelpers = require('./helpers');
const { getUserId } = makeHelpers;
const { requireAuth } = require('../../../../../packages/shared-auth');
const { requireModuloPermission } = require('../../../../../packages/shared-auth/permisos');
const { validateContentType, sanitizeInput } = require('../../middleware/rp/rpSecurityMiddleware');
const {
  validateComentarioAnulacion,
  validateDireccionEntrega,
  validateSolicitudCambioForma,
  validateResolucionCambioForma,
  validateQueryFacturasSeleccion
} = require('../../middleware/bpkm/bpkmValidationMiddleware');
const { apiLimiter } = require('../../middleware/bpkm/bpkmRateLimit');
const SeleccionController = require('../../controllers/bpkm/seleccionController');

module.exports = function makeSeleccionesRouter({ pool } = {}) {
  const router = express.Router();
  const { q, toStrOrNull, toInt, toDateOrNull, ok, bad, checkBPKMPerm } = makeHelpers({ pool });

  router.use((req, _res, next) => {
    req.app.locals.pool = pool;
    next();
  });

  function normalizePaged(row) {
    const total = Number(row?.total_count ?? row?.int_total ?? row?.total ?? 0);
    let items = row?.items ?? [];
    if (typeof items === 'string') {
      try { items = JSON.parse(items); } catch { items = []; }
    }
    if (!Array.isArray(items)) items = [];
    return { total, items };
  }

  // Facturas selección
  router.get(
    '/facturas_seleccion',
    requireAuth,
    requireModuloPermission('facturasbpkm'),
    apiLimiter,
    validateQueryFacturasSeleccion,
    SeleccionController.getFacturasSeleccion
  );

  /*
  router.post('/get_mis_facturas_seleccion', requireAuth, apiLimiter, async (req, res) => {
    try {
      const {
        id_vendedor = null,
        forma_codigo = null,
        folio_like = null,
        estado_codigo = null,
        fecha_desde = null,
        fecha_hasta = null,
        limit = 50,
        offset = 0
      } = req.body || {};
      const creado_por = getUserId(req);

      const hasPerm = await checkBPKMPerm(creado_por, 'bpkm.facturas.view', 'viewer');
      if (!hasPerm) return bad(res, 'No tiene permiso para ver facturas. Contacte al administrador.');

      const rows = await q(
        `SELECT * FROM bpkm.get_mis_facturas_seleccion($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
        [
          toInt(id_vendedor),
          toStrOrNull(forma_codigo),
          toStrOrNull(folio_like),
          toStrOrNull(estado_codigo),
          toDateOrNull(fecha_desde),
          toDateOrNull(fecha_hasta),
          toInt(creado_por),
          toInt(limit) || 50,
          toInt(offset) || 0
        ]
      );

      const total = rows?.length ? Number(rows[0].total_count || 0) : 0;
      return ok(res, { total, items: rows || [] });
    } catch (e) {
      return bad(res, e.message);
    }
  });
  */

  // Facturas elegibles para ruta
  router.post('/get_facturas_para_ruta', requireAuth, requireModuloPermission('rutasbpkm'), apiLimiter, async (req, res) => {
    try {
      const {
        creado_por = 0,
        estado_codigo = 'ACT',
        folio_like = '',
        fecha_desde = null,
        fecha_hasta = null,
        limit = 50,
        offset = 0,
        id_sucursal = 0,
        forma_entrega_codigo = null,
        id_transporte_externo = 0,
        id_sucursal_salida = 0
      } = req.body || {};

      const rows = await q(
        `SELECT * FROM bpkm.get_facturas_para_ruta($1::INTEGER,$2::VARCHAR,$3::VARCHAR,$4::DATE,$5::DATE,$6::INTEGER,$7::INTEGER,$8::INTEGER,$9::VARCHAR,$10::INTEGER,$11::INTEGER)`,
        [
          toInt(creado_por) || 0,
          toStrOrNull(estado_codigo) || 'ACT',
          toStrOrNull(folio_like) || '',
          toDateOrNull(fecha_desde),
          toDateOrNull(fecha_hasta),
          toInt(limit) || 50,
          toInt(offset) || 0,
          toInt(id_sucursal) || 0,
          toStrOrNull(forma_entrega_codigo),
          toInt(id_transporte_externo) || 0,
          toInt(id_sucursal_salida) || 0
        ]
      );
      return ok(res, normalizePaged(rows?.[0] || {}));
    } catch (e) {
      return bad(res, e.message);
    }
  });

  // Crear selección
  router.post(
    '/post_factura_seleccion',
    requireAuth, apiLimiter, validateContentType, sanitizeInput, validateDireccionEntrega,
    async (req, res) => {
    try {
      const {
        id_factura,
        folio,
        forma,
        transporte_externo,
        departamento,
        municipio,
        direccion,
        id_sucursal
      } = req.body || {};
      const creado_por = getUserId(req);

      if (!toInt(id_factura) || !toStrOrNull(folio)) return bad(res, 'id_factura y folio requeridos');
      if (!toInt(forma)) return bad(res, 'forma requerida');
      if (!toInt(id_sucursal)) return bad(res, 'id_sucursal requerido');
      if (!toInt(creado_por)) return bad(res, 'creado_por requerido');

      const hasPerm = await checkBPKMPerm(creado_por, 'bpkm.facturas.new', 'editor');
      if (!hasPerm) return bad(res, 'No tiene permiso para registrar facturas. Contacte al administrador.');

      const rows = await q(
        `SELECT * FROM bpkm.post_factura_seleccion($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
        [
          toInt(id_factura),
          toStrOrNull(folio),
          toInt(creado_por),
          toInt(forma),
          toInt(transporte_externo),
          toInt(departamento),
          toInt(municipio),
          toStrOrNull(direccion),
          toInt(id_sucursal),
          toInt(creado_por)
        ]
      );
      return ok(res, rows?.[0] || {});
    } catch (e) {
      return bad(res, e.message);
    }
  });

  // Anular selección
  router.post(
    '/post_factura_seleccion_anular',
    requireAuth, apiLimiter, validateContentType, sanitizeInput, validateComentarioAnulacion,
    async (req, res) => {
    try {
      const {
        id_factura_sel,
        folio_nc,
        fecha_anulacion = null,
        comentario = null
      } = req.body || {};
      const usuario = getUserId(req);

      if (!toInt(id_factura_sel)) return bad(res, 'id_factura_sel requerido');
      if (!toStrOrNull(folio_nc)) return bad(res, 'folio_nc requerido');
      if (!toInt(usuario)) return bad(res, 'usuario requerido');

      const hasPerm = await checkBPKMPerm(usuario, 'bpkm.facturas.view', 'viewer');
      if (!hasPerm) return bad(res, 'No tiene permiso para anular facturas. Contacte al administrador.');

      const ownerCheck = await q(
        `SELECT creado_por FROM bpkm.tbl_factura_seleccion WHERE id_factura_sel = $1`,
        [toInt(id_factura_sel)]
      );
      if (!ownerCheck?.length) return bad(res, 'Selección no encontrada');
      if (ownerCheck[0].creado_por !== toInt(usuario))
        return bad(res, 'Solo el creador puede anular la selección');

      const rows = await q(
        `SELECT * FROM bpkm.post_factura_seleccion_anular($1,$2,$3,$4,$5)`,
        [
          toInt(id_factura_sel),
          toStrOrNull(folio_nc),
          toInt(usuario),
          toDateOrNull(fecha_anulacion),
          toStrOrNull(comentario)
        ]
      );
      return ok(res, rows?.[0] || {});
    } catch (e) {
      return bad(res, e.message);
    }
  });

  // Solicitar cambio de forma
  router.post(
    '/post_sel_cambio',
    requireAuth, apiLimiter, validateContentType, sanitizeInput, validateSolicitudCambioForma,
    async (req, res) => {
    try {
      const {
        id_factura_sel,
        id_forma_nueva,
        id_transporte_externo_new,
        id_departamento_new,
        id_municipio_new,
        direccion_new,
        comentario_solicitante
      } = req.body || {};
      const id_solicitante = getUserId(req);

      if (!toInt(id_factura_sel)) return bad(res, 'id_factura_sel requerido');
      if (!toInt(id_solicitante)) return bad(res, 'id_solicitante requerido');
      if (!toInt(id_forma_nueva)) return bad(res, 'id_forma_nueva requerida');

      const hasPerm = await checkBPKMPerm(id_solicitante, 'bpkm.facturas.view', 'viewer');
      if (!hasPerm) return bad(res, 'No tiene permiso para solicitar cambios de factura. Contacte al administrador.');

      const ownerCheck = await q(
        `SELECT creado_por FROM bpkm.tbl_factura_seleccion WHERE id_factura_sel = $1`,
        [toInt(id_factura_sel)]
      );
      if (!ownerCheck?.length) return bad(res, 'Selección no encontrada');
      if (ownerCheck[0].creado_por !== toInt(id_solicitante))
        return bad(res, 'Solo el creador puede solicitar cambio de forma');

      const rows = await q(
        `SELECT * FROM bpkm.post_sel_cambio($1,$2,$3,$4,$5,$6,$7,$8)`,
        [
          toInt(id_factura_sel),
          toInt(id_solicitante),
          toInt(id_forma_nueva),
          toInt(id_transporte_externo_new),
          toInt(id_departamento_new),
          toInt(id_municipio_new),
          toStrOrNull(direccion_new),
          toStrOrNull(comentario_solicitante)
        ]
      );
      return ok(res, rows?.[0] || {});
    } catch (e) {
      return bad(res, e.message);
    }
  });

  // Aprobar/Rechazar cambio
  router.post(
    '/put_sel_cambio_resolver',
    requireAuth, requireModuloPermission('cambiosformaentrega'), apiLimiter, validateContentType, sanitizeInput, validateResolucionCambioForma,
    async (req, res) => {
    try {
      const {
        id_sel_cambio,
        decision_codigo,
        comentario_autorizador
      } = req.body || {};
      const id_autorizador = getUserId(req);

      if (!toInt(id_sel_cambio)) return bad(res, 'id_sel_cambio requerido');
      if (!toStrOrNull(decision_codigo)) return bad(res, 'decision_codigo requerido (APR|RECH)');
      if (!toInt(id_autorizador)) return bad(res, 'id_autorizador requerido');

      const permiso = await q(
        `SELECT EXISTS(
           SELECT 1
           FROM bpkm.tbl_factura_sel_cambio fsc
           JOIN bpkm.tbl_factura_seleccion  fs ON fs.id_factura_sel = fsc.id_factura_sel
           WHERE fsc.id_sel_cambio          = $1
             AND fs.id_sucursal_creador     = ANY(bpkm._get_sucursales_permitidas_cambio($2))
         ) AS puede_autorizar`,
        [toInt(id_sel_cambio), toInt(id_autorizador)]
      );
      if (!permiso?.[0]?.puede_autorizar)
        return bad(res, 'No tienes permiso para resolver cambios de esta sucursal');

      const rows = await q(
        `SELECT * FROM bpkm.put_sel_cambio_resolver($1,$2,$3,$4)`,
        [
          toInt(id_sel_cambio),
          toStrOrNull(decision_codigo),
          toInt(id_autorizador),
          toStrOrNull(comentario_autorizador)
        ]
      );
      return ok(res, rows?.[0] || {});
    } catch (e) {
      return bad(res, e.message);
    }
  });

  // Reciclar factura fallida
  router.post(
    '/post_reciclar_factura_fallida',
    requireAuth, requireModuloPermission('facturasbpkm'), apiLimiter, validateContentType, sanitizeInput,
    async (req, res) => {
    try {
      const { id_factura_sel } = req.body || {};
      const usuario = getUserId(req);
      if (!toInt(id_factura_sel)) return bad(res, 'id_factura_sel requerido');
      if (!toInt(usuario)) return bad(res, 'usuario requerido');

      const rows = await q(
        `SELECT * FROM bpkm.post_reciclar_factura_fallida($1,$2)`,
        [toInt(id_factura_sel), toInt(usuario)]
      );
      return ok(res, rows?.[0] || {});
    } catch (e) {
      return bad(res, e.message);
    }
  });

  // Liquidar selección despacho sucursal
  router.post(
    '/post_liquidar_sel_despacho_sucursal',
    requireAuth, apiLimiter, validateContentType, sanitizeInput,
    async (req, res) => {
    try {
      const {
        id_factura_sel,
        comentario = null
      } = req.body || {};
      const usuario = getUserId(req);

      if (!toInt(id_factura_sel)) return bad(res, 'id_factura_sel requerido');
      if (!toInt(usuario)) return bad(res, 'usuario requerido');

      const hasPerm = await checkBPKMPerm(usuario, 'bpkm.facturas.view', 'viewer');
      if (!hasPerm) return bad(res, 'No tiene permiso para liquidar facturas. Contacte al administrador.');

      const rows = await q(
        `SELECT * FROM bpkm.post_liquidar_sel_despacho_sucursal($1,$2,$3)`,
        [toInt(id_factura_sel), toInt(usuario), toStrOrNull(comentario)]
      );
      return ok(res, rows?.[0] || {});
    } catch (e) {
      return bad(res, e.message);
    }
  });

  // Resumen por factura
  router.post('/get_sel_resumen_por_factura', requireAuth, requireModuloPermission('facturasbpkm'), apiLimiter, async (req, res) => {
    try {
      const { id_factura = null, folio = null } = req.body || {};
      if (!toInt(id_factura) && !toStrOrNull(folio)) {
        return bad(res, 'Debe enviar id_factura o folio');
      }
      const rows = await q(
        `SELECT * FROM bpkm.get_sel_resumen_por_factura($1,$2)`,
        [toInt(id_factura), toStrOrNull(folio)]
      );
      return ok(res, rows?.[0] || { tiene_activa: 0, intentos_max: 0, intentos_total: 0 });
    } catch (e) {
      return bad(res, e.message);
    }
  });

  // Bitácora de selección
  router.post('/get_bitacora_sel', requireAuth, apiLimiter, async (req, res) => {
    try {
      const { id_factura_sel, scope = 'ADMIN' } = req.body || {};
      const usuario = getUserId(req);
      if (!toInt(id_factura_sel)) return bad(res, 'id_factura_sel requerido');

      const hasPerm = await checkBPKMPerm(usuario, 'bpkm.facturas.view', 'viewer');
      if (!hasPerm) return bad(res, 'No tiene permiso para ver el historial de facturas. Contacte al administrador.');

      const rows = await q(
        `SELECT * FROM bpkm.get_bitacora_sel($1,$2,$3)`,
        [toInt(id_factura_sel), toStrOrNull(scope) || 'ADMIN', toInt(usuario) || 0]
      );
      return ok(res, rows);
    } catch (e) {
      return bad(res, e.message);
    }
  });

  // POST /api/bpkm/get_estado_entrega_by_folio - Obtiene estado de entrega por folio de factura (para NDC)
  router.post('/get_estado_entrega_by_folio', requireAuth, apiLimiter, async (req, res) => {
    try {
      const { folio_factura } = req.body || {};

      // Validación
      if (!toStrOrNull(folio_factura)) {
        return bad(res, 'folio_factura requerido');
      }

      const rows = await q(
        `SELECT * FROM bpkm.get_estado_entrega_by_folio($1)`,
        [toStrOrNull(folio_factura)]
      );

      // Retornar el primer registro o null si no hay resultados
      return ok(res, rows?.[0] || null);
    } catch (e) {
      console.error('Error en get_estado_entrega_by_folio:', e);
      return bad(res, e.message);
    }
  });

  return router;
};
