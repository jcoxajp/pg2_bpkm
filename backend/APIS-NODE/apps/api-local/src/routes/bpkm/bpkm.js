// routes/bpkm/v1/bpkm.js
const express = require('express');
const makeHelpers = require('./helpers');
const { getUserId } = makeHelpers;
const { requireAuth } = require('../../../../../packages/shared-auth');
const { requireModuloPermission, requireAnyModuloPermission } = require('../../../../../packages/shared-auth/permisos');
const { validateContentType, sanitizeInput } = require('../../middleware/rp/rpSecurityMiddleware');
const { validateId } = require('../../middleware/rp/rpValidationMiddleware');
const { validateMontosAprobacion } = require('../../middleware/bpkm/bpkmValidationMiddleware');
const { apiLimiter } = require('../../middleware/bpkm/bpkmRateLimit');
const bpkmController = require('../../controllers/bpkm/bpkmController');
const MapaRuta = require('../../models/bpkm/MapaRuta');

module.exports = function makeBpkmRouter({ pool } = {}) {
  const router = express.Router();
  const { q, toStrOrNull, toInt, toDateOrNull, ok, bad, clampLimit, clampPage } = makeHelpers({ pool });

  router.use((req, _res, next) => {
    req.app.locals.pool = pool;
    next();
  });

  // Crear registro BPKM desde ruta
  router.post(
    '/post_crear_registro_bpkm',
    requireAuth, requireModuloPermission('gerenciabpkm'), apiLimiter, validateContentType, sanitizeInput,
    async (req, res) => {
    try {
      const { id_ruta } = req.body || {};
      const usuario = getUserId(req);
      if (!toInt(id_ruta)) return bad(res, 'id_ruta requerido');
      if (!toInt(usuario)) return bad(res, 'usuario requerido');

      const rows = await q(
        `SELECT * FROM bpkm.post_crear_registro_bpkm($1,$2)`,
        [toInt(id_ruta), toInt(usuario)]
      );
      return ok(res, rows?.[0] || {});
    } catch (e) {
      return bad(res, e.message);
    }
  });

  // Aprobar BPKM (Gerencia)
  router.post(
    '/post_aprobar_bpkm_gerencia',
    requireAuth, requireModuloPermission('gerenciabpkm'), apiLimiter, validateContentType, sanitizeInput, validateMontosAprobacion,
    async (req, res) => {
    try {
      const {
        id_bpkm,
        monto_aprobado_piloto,
        monto_aprobado_auxiliar,
        observaciones
      } = req.body || {};
      const usuario_gerencia = getUserId(req);

      if (!toInt(id_bpkm)) return bad(res, 'id_bpkm requerido');
      if (!usuario_gerencia) return bad(res, 'usuario_gerencia requerido');

      const rows = await q(
        `SELECT * FROM bpkm.post_aprobar_bpkm_gerencia($1,$2,$3,$4,$5)`,
        [
          toInt(id_bpkm),
          parseFloat(monto_aprobado_piloto) || 0,
          parseFloat(monto_aprobado_auxiliar) || 0,
          toStrOrNull(observaciones),
          toInt(usuario_gerencia)
        ]
      );
      return ok(res, rows?.[0] || {});
    } catch (e) {
      return bad(res, e.message);
    }
  });

  // Finalizar BPKM (RRHH)
  router.post(
    '/post_finalizar_bpkm_rrhh',
    requireAuth, requireModuloPermission('rrhhbpkm'), apiLimiter, validateContentType, sanitizeInput,
    async (req, res) => {
    try {
      const { id_bpkm } = req.body || {};
      const usuario_rrhh = getUserId(req);
      if (!toInt(id_bpkm)) return bad(res, 'id_bpkm requerido');
      if (!toInt(usuario_rrhh)) return bad(res, 'usuario_rrhh requerido');

      const rows = await q(
        `SELECT * FROM bpkm.post_finalizar_bpkm_rrhh($1,$2)`,
        [toInt(id_bpkm), toInt(usuario_rrhh)]
      );
      return ok(res, rows?.[0] || {});
    } catch (e) {
      return bad(res, e.message);
    }
  });

  // Bandeja BPKM (filtros)
  router.post('/get_bpkm', requireAuth, requireAnyModuloPermission(['gerenciabpkm', 'rrhhbpkm']), apiLimiter, bpkmController.getBpkmBandeja);

  // Detalle BPKM (con todo el contexto de ruta)
  router.post('/get_bpkm_detalle', requireAuth, requireAnyModuloPermission(['gerenciabpkm', 'rrhhbpkm']), apiLimiter, async (req, res) => {
    try {
      const { id_bpkm } = req.body || {};
      if (!toInt(id_bpkm)) return bad(res, 'id_bpkm requerido');

      const [rows, mapa] = await Promise.all([
        q(
          `SELECT * FROM bpkm.get_bpkm_detalle($1)`,
          [toInt(id_bpkm)]
        ),
        MapaRuta.obtenerPorBpkm(pool, toInt(id_bpkm))
      ]);
      const detalle = rows?.[0];
      if (!detalle) return ok(res, {});
      return ok(res, { ...detalle, mapa });
    } catch (e) {
      return bad(res, e.message);
    }
  });

  // Ver factura con maestro/detalle (de NDC)
  router.post('/get_factura_md', requireAuth, requireModuloPermission('gerenciabpkm'), apiLimiter, async (req, res) => {
    try {
      const { p_id_factura, p_folio } = req.body || {};
      const rows = await q(
        `SELECT * FROM ndc.get_factura_md($1,$2)`,
        [toInt(p_id_factura), toStrOrNull(p_folio)]
      );
      const payload = rows?.[0]?.get_factura_md ?? null;
      return ok(res, payload);
    } catch (e) {
      return bad(res, e.message);
    }
  });

  // Modificar distancia lejana en BPKM (con recálculo de comisiones y respaldo en distancia_anterior)
  router.patch(
    '/distancia',
    requireAuth, requireAnyModuloPermission(['gerenciabpkm', 'distacia_rutas']), apiLimiter, validateContentType, sanitizeInput,
    bpkmController.patchDistanciaLejana
  );

  // Obtener BPKM resumido para Ops (con paginación)
  router.get('/distancia', requireAuth, requireModuloPermission('distacia_rutas'), apiLimiter, bpkmController.getBpkm);

  // Obtener bitácora de BPKM
  router.post('/get_bitacora_bpkm', requireAuth, requireAnyModuloPermission(['gerenciabpkm', 'rrhhbpkm']), apiLimiter, async (req, res) => {
    try {
      const { id_bpkm } = req.body || {};
      if (!toInt(id_bpkm)) return bad(res, 'id_bpkm requerido');

      const rows = await q(
        `SELECT * FROM bpkm.get_bitacora_bpkm($1)`,
        [toInt(id_bpkm)]
      );
      return ok(res, rows || []);
    } catch (e) {
      return bad(res, e.message);
    }
  });

  // Encabezado de una ruta local sin BPKM por id
  // GET /api/bpkm/rutas-locales/:id
  router.get('/rutas-locales/:id', requireAuth, validateId, requireModuloPermission('localesbpkm'), apiLimiter, async (req, res) => {
    try {
      const id = toInt(req.params.id);
      if (!id) return bad(res, 'id_ruta requerido');

      const [rows, mapa] = await Promise.all([
        q(
          `SELECT * FROM bpkm.get_ruta_sin_bpkm_detalle($1)`,
          [id]
        ),
        MapaRuta.obtenerPorRuta(pool, id)
      ]);
      const detalle = rows?.[0];
      if (!detalle) return ok(res, null);
      return ok(res, { ...detalle, mapa });
    } catch (e) {
      return bad(res, e.message);
    }
  });

  // Bandeja de rutas sin BPKM (RC, TE y RT con genera_bpkm=false)
  // GET /api/bpkm/rutas-locales?fecha_desde=&fecha_hasta=&id_sucursal=0&id_camion=0&id_piloto=0&folio_factura=&tipo_ruta=&limit=20&page=1
  router.get('/rutas-locales', requireAuth, requireModuloPermission('localesbpkm'), apiLimiter, async (req, res) => {
    try {
      const {
        fecha_desde = null,
        fecha_hasta = null,
        id_sucursal = 0,
        id_camion = 0,
        id_piloto = 0,
        folio_factura = null,
        tipo_ruta = '',
        estado_ruta = '',
        limit = 20,
        page = 1
      } = req.query || {};

      const lim = clampLimit(limit, 20);
      const pageNum = clampPage(page);
      const offset = (pageNum - 1) * lim;

      // Orden posicional de bpkm.get_rutas_sin_bpkm: fecha_desde, fecha_hasta, id_sucursal,
      // id_camion, id_piloto, limit, offset, folio_factura, tipo_ruta, estado_ruta.
      const armarParametros = (limParam, offsetParam, estadoParam) => [
        toDateOrNull(fecha_desde),
        toDateOrNull(fecha_hasta),
        toInt(id_sucursal) || 0,
        toInt(id_camion) || 0,
        toInt(id_piloto) || 0,
        limParam,
        offsetParam,
        toStrOrNull(folio_factura),
        toStrOrNull(tipo_ruta) || '',
        estadoParam
      ];
      const sqlGetRutasSinBpkm = `SELECT * FROM bpkm.get_rutas_sin_bpkm($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`;

      const [rows, rowsResumen] = await Promise.all([
        q(sqlGetRutasSinBpkm, armarParametros(lim, offset, toStrOrNull(estado_ruta) || '')),
        // Mismos filtros, sin el de estado (que aquí forzamos a EN_CURSO) - resumen.por_estado,
        // mismo patrón que get_bpkm/get_rutas. p_limit=1 porque solo se usa total_count.
        q(sqlGetRutasSinBpkm, armarParametros(1, 0, 'EN_CURSO'))
      ]);

      const total = rows?.[0]?.total_count ?? 0;
      const enCurso = parseInt(rowsResumen?.[0]?.total_count, 10) || 0;
      return ok(res, {
        items: rows,
        total,
        page: pageNum,
        limit: lim,
        resumen: { por_estado: { EN_CURSO: enCurso } }
      });
    } catch (e) {
      return bad(res, e.message);
    }
  });

  return router;
};
