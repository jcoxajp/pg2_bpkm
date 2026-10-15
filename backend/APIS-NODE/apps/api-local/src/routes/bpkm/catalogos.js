// routes/bpkm/v1/catalogos.js
const express = require('express');
const makeHelpers = require('./helpers');
const { getUserId } = makeHelpers;
const { requireAuth } = require('../../../../../packages/shared-auth');
const { requireModuloPermission, requireAnyModuloPermission } = require('../../../../../packages/shared-auth/permisos');
const { validateContentType, sanitizeInput } = require('../../middleware/rp/rpSecurityMiddleware');
const { validatePlacaCamion, validatePersonal, validatePersonalEdicion, validateTransporte, validateTransporteEdicion } = require('../../middleware/bpkm/bpkmValidationMiddleware');
const { apiLimiter } = require('../../middleware/bpkm/bpkmRateLimit');
const bpkmController = require('../../controllers/bpkm/bpkmController');

module.exports = function makeCatalogosRouter({ pool } = {}) {
  const router = express.Router();
  const { q, toStrOrNull, toInt, ok, bad, checkBPKMPerm } = makeHelpers({ pool });

  router.use((req, _res, next) => {
    req.app.locals.pool = pool;
    next();
  });

  router.post('/get_permisos_bpkm', requireAuth, apiLimiter, async (req, res) => {
    try {
      const { p_id_usuario = 0 } = req.body || {};
      const uid = toInt(p_id_usuario);
      if (!uid) return bad(res, 'p_id_usuario requerido');
      const rows = await q(`SELECT * FROM bpkm.get_permisos_bpkm($1)`, [uid]);
      ok(res, rows);
    } catch (e) { bad(res, e.message); }
  });

  // ======= Formas de entrega =======
  router.get('/get_formas_entrega', requireAuth, apiLimiter, async (_req, res) => {
    try {
      const rows = await q(`SELECT * FROM bpkm.get_formas_entrega()`, []);
      ok(res, rows);
    } catch (e) { bad(res, e.message); }
  });

  router.get('/get_ciudades', requireAuth, apiLimiter, async (_req, res) => {
    try {
      const rows = await q(`SELECT * FROM catalogos.get_ciudades()`, []);
      ok(res, rows);
    } catch (e) { bad(res, e.message); }
  });

  router.post('/get_municipios', requireAuth, apiLimiter, async (req, res) => {
    try {
      const { p_departamento = 0 } = req.body || {};
      const did = toInt(p_departamento);
      if (!did) return bad(res, 'p_departamento requerido');
      const rows = await q(`SELECT * FROM catalogos.get_municipios($1)`, [did]);
      ok(res, rows);
    } catch (e) { bad(res, e.message); }
  });

  router.get('/get_sucursales_list', requireAuth, apiLimiter, async (_req, res) => {
    try {
      const rows = await q(`SELECT * FROM usuarios.get_sucursales_list()`, []);
      ok(res, rows);
    } catch (e) { bad(res, e.message); }
  });

  // ======= Estados (por tabla opcional) =======
  router.post('/get_estados', requireAuth, apiLimiter, async (req, res) => {
    try {
      const { tabla = '' } = req.body || {};
      const rows = await q(`SELECT * FROM catalogos.get_estados($1)`, [toStrOrNull(tabla) || '']);
      ok(res, rows);
    } catch (e) { bad(res, e.message); }
  });

  // ======= Camiones =======
  router.post('/get_camiones', requireAuth, apiLimiter, async (req, res) => {
    try {
      const { id_camion = 0, placa_like = '', estado = 1, id_sucursal = 0 } = req.body || {};
      const rows = await q(`SELECT * FROM bpkm.get_camiones($1,$2,$3,$4)`,
        [toInt(id_camion) || 0, toStrOrNull(placa_like) || '', Number.isInteger(+estado) ? +estado : 1, toInt(id_sucursal) || 0]);
      ok(res, rows);
    } catch (e) { bad(res, e.message); }
  });

  router.post('/get_camiones_admin', requireAuth, requireModuloPermission('catalogosbpkm'), apiLimiter, async (req, res) => {
    try {
      const { id_camion = 0, placa_like = '', estado = 1, id_sucursal = 0 } = req.body || {};
      const rows = await q(`SELECT * FROM bpkm.get_camiones_admin($1,$2,$3,$4)`,
        [toInt(id_camion) || 0, toStrOrNull(placa_like) || '', Number.isInteger(+estado) ? +estado : 1, toInt(id_sucursal) || 0]);
      ok(res, rows);
    } catch (e) { bad(res, e.message); }
  });

  router.post(
    '/post_camion',
    requireAuth, requireModuloPermission('catalogosbpkm'), apiLimiter, validateContentType, sanitizeInput, validatePlacaCamion,
    async (req, res) => {
    try {
      const { placa, estado = 1, id_sucursal = null } = req.body || {};
      const usuario = getUserId(req);
      const hasPerm = await checkBPKMPerm(usuario, 'bpkm.camiones.new', 'editor');
      if (!hasPerm) return bad(res, 'No tiene permiso para crear camiones. Contacte al administrador.');
      const rows = await q(`SELECT * FROM bpkm.post_camion($1,$2,$3,$4)`,
        [toStrOrNull(placa), +estado || 1, toInt(usuario) || 0, toInt(id_sucursal) || null]);
      ok(res, rows?.[0] || {});
    } catch (e) { bad(res, e.message); }
  });

  router.put(
    '/put_camion',
    requireAuth, requireModuloPermission('catalogosbpkm'), apiLimiter, validateContentType, sanitizeInput,
    async (req, res) => {
    try {
      const { id_camion, estado, id_sucursal = null } = req.body || {};
      const usuario = getUserId(req);
      if (!toInt(id_camion)) return bad(res, 'id_camion requerido');
      const hasPerm = await checkBPKMPerm(usuario, 'bpkm.camiones.edit', 'editor');
      if (!hasPerm) return bad(res, 'No tiene permiso para editar camiones. Contacte al administrador.');
      const rows = await q(`SELECT * FROM bpkm.put_camion($1,$2,$3,$4)`,
        [toInt(id_camion), Number.isInteger(+estado) ? +estado : null, toInt(usuario) || 0, toInt(id_sucursal) || null]);
      ok(res, rows?.[0] || {});
    } catch (e) { bad(res, e.message); }
  });

  // ======= Personal =======
  router.post('/get_personal', requireAuth, apiLimiter, async (req, res) => {
    try {
      const { id_personal = 0, id_rol = 0, nombre_like = '', estado = 1, id_sucursal = 0 } = req.body || {};
      const rows = await q(`SELECT * FROM bpkm.get_personal($1,$2,$3,$4,$5)`,
        [toInt(id_personal) || 0, toInt(id_rol) || 0, toStrOrNull(nombre_like) || '', Number.isInteger(+estado) ? +estado : 1, toInt(id_sucursal) || 0]);
      ok(res, rows);
    } catch (e) { bad(res, e.message); }
  });

  router.post('/get_personal_admin', requireAuth, requireModuloPermission('catalogosbpkm'), apiLimiter, async (req, res) => {
    try {
      const { id_personal = 0, id_rol = 0, nombre_like = '', estado = 1, id_sucursal = 0 } = req.body || {};
      const rows = await q(`SELECT * FROM bpkm.get_personal_admin($1,$2,$3,$4,$5)`,
        [toInt(id_personal) || 0, toInt(id_rol) || 0, toStrOrNull(nombre_like) || '', Number.isInteger(+estado) ? +estado : 1, toInt(id_sucursal) || 0]);
      ok(res, rows);
    } catch (e) { bad(res, e.message); }
  });

  router.post(
    '/post_personal',
    requireAuth, requireModuloPermission('catalogosbpkm'), apiLimiter, validateContentType, sanitizeInput, validatePersonal,
    async (req, res) => {
    try {
      const { id_rol, nombre, telefono, estado = 1, id_sucursal = null } = req.body || {};
      const usuario = getUserId(req);
      const hasPerm = await checkBPKMPerm(usuario, 'bpkm.personal.new', 'editor');
      if (!hasPerm) return bad(res, 'No tiene permiso para crear personal. Contacte al administrador.');
      const rows = await q(`SELECT * FROM bpkm.post_personal($1,$2,$3,$4,$5,$6)`,
        [toInt(id_rol), toStrOrNull(nombre), toStrOrNull(telefono), +estado || 1, toInt(usuario) || 0, toInt(id_sucursal) || null]);
      ok(res, rows?.[0] || {});
    } catch (e) { bad(res, e.message); }
  });

  router.put(
    '/put_personal',
    requireAuth, requireModuloPermission('catalogosbpkm'), apiLimiter, validateContentType, sanitizeInput, validatePersonalEdicion,
    async (req, res) => {
    try {
      const { id_personal, id_rol, nombre, telefono, estado, id_sucursal = null } = req.body || {};
      const usuario = getUserId(req);
      if (!toInt(id_personal)) return bad(res, 'id_personal requerido');
      const hasPerm = await checkBPKMPerm(usuario, 'bpkm.personal.edit', 'editor');
      if (!hasPerm) return bad(res, 'No tiene permiso para editar personal. Contacte al administrador.');
      const rows = await q(`SELECT * FROM bpkm.put_personal($1,$2,$3,$4,$5,$6,$7)`,
        [toInt(id_personal), toInt(id_rol), toStrOrNull(nombre), toStrOrNull(telefono),
        Number.isInteger(+estado) ? +estado : null, toInt(usuario) || 0, toInt(id_sucursal) || null]);
      ok(res, rows?.[0] || {});
    } catch (e) { bad(res, e.message); }
  });

  router.get('/get_roles_personal', requireAuth, apiLimiter, async (_req, res) => {
    try {
      const rows = await q(`SELECT * FROM bpkm.get_roles_personal()`, []);
      ok(res, rows);
    } catch (e) { bad(res, e.message); }
  });

  // ======= Filtros bandeja BPKM (Gerencia y Distancia de Rutas) =======
  router.get('/sucursales', requireAuth, requireAnyModuloPermission(['gerenciabpkm', 'distacia_rutas']), apiLimiter, async (_req, res) => {
    try {
      const rows = await q(`SELECT * FROM bpkm.get_bpkm_sucursales()`, []);
      ok(res, rows);
    } catch (e) { bad(res, e.message); }
  });

  router.get('/camiones', requireAuth, requireAnyModuloPermission(['gerenciabpkm', 'distacia_rutas']), apiLimiter, bpkmController.getCamionesFiltro);

  // ======= Transporte externo =======
  router.post('/get_transportes', requireAuth, apiLimiter, async (req, res) => {
    try {
      const { id_transporte = 0, nombre_like = '', estado = 1 } = req.body || {};
      const rows = await q(`SELECT * FROM bpkm.get_transportes($1,$2,$3)`,
        [toInt(id_transporte) || 0, toStrOrNull(nombre_like) || '', Number.isInteger(+estado) ? +estado : 1]);
      ok(res, rows);
    } catch (e) { bad(res, e.message); }
  });

  router.post('/get_transportes_admin', requireAuth, requireModuloPermission('catalogosbpkm'), apiLimiter, async (req, res) => {
    try {
      const { id_transporte = 0, nombre_like = '', estado = 1 } = req.body || {};
      const rows = await q(`SELECT * FROM bpkm.get_transportes_admin($1,$2,$3)`,
        [toInt(id_transporte) || 0, toStrOrNull(nombre_like) || '', Number.isInteger(+estado) ? +estado : 1]);
      ok(res, rows);
    } catch (e) { bad(res, e.message); }
  });

  router.post(
    '/post_transporte',
    requireAuth, requireModuloPermission('catalogosbpkm'), apiLimiter, validateContentType, sanitizeInput, validateTransporte,
    async (req, res) => {
    try {
      const { nombre, estado = 1 } = req.body || {};
      const usuario = getUserId(req);
      const hasPerm = await checkBPKMPerm(usuario, 'bpkm.transportes.new', 'editor');
      if (!hasPerm) return bad(res, 'No tiene permiso para crear transportes. Contacte al administrador.');
      const rows = await q(`SELECT * FROM bpkm.post_transporte($1,$2,$3)`,
        [toStrOrNull(nombre), +estado || 1, toInt(usuario) || 0]);
      ok(res, rows?.[0] || {});
    } catch (e) { bad(res, e.message); }
  });

  router.put(
    '/put_transporte',
    requireAuth, requireModuloPermission('catalogosbpkm'), apiLimiter, validateContentType, sanitizeInput, validateTransporteEdicion,
    async (req, res) => {
    try {
      const { id_transporte, nombre, estado } = req.body || {};
      const usuario = getUserId(req);
      if (!toInt(id_transporte)) return bad(res, 'id_transporte requerido');
      const hasPerm = await checkBPKMPerm(usuario, 'bpkm.transportes.edit', 'editor');
      if (!hasPerm) return bad(res, 'No tiene permiso para editar transportes. Contacte al administrador.');
      const rows = await q(`SELECT * FROM bpkm.put_transporte($1,$2,$3,$4)`,
        [toInt(id_transporte), toStrOrNull(nombre), Number.isInteger(+estado) ? +estado : null, toInt(usuario) || 0]);
      ok(res, rows?.[0] || {});
    } catch (e) { bad(res, e.message); }
  });

  return router;
};
