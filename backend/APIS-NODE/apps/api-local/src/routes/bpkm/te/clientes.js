const express   = require('express');
const rateLimit = require('express-rate-limit');
const { requireAuth }                        = require('../../../../../../packages/shared-auth');
const { validateContentType, sanitizeInput } = require('../../../middleware/rp/rpSecurityMiddleware');
const { validateId }                         = require('../../../middleware/rp/rpValidationMiddleware');
const {
  requireTeViewPerm,
  requireTeEditPerm,
  loadAndValidateTeCliente,
} = require('../../../middleware/bpkm/tePermMiddleware');
const ClienteTeController = require('../../../controllers/bpkm/te/clienteTeController');

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: { ok: false, message: 'Demasiadas solicitudes, intenta más tarde' },
});

module.exports = function makeTeClientesRouter({ pool } = {}) {
  const router = express.Router();

  router.use((req, _res, next) => {
    req.app.locals.pool = pool;
    next();
  });

  // ── Clientes ─────────────────────────────────────────────────────────────
  // GET  /te/clientes/sap?card_code=X  - busca en SAP antes de crear
  // DEBE ir antes de /:id para que Express no capture "sap" como parámetro
  router.get(
    '/te/clientes/sap',
    requireAuth, requireTeViewPerm,
    ClienteTeController.buscarClienteSap
  );

  // GET  /te/clientes?q=...&id_sucursal=X
  router.get(
    '/te/clientes',
    requireAuth, requireTeViewPerm,
    ClienteTeController.listar
  );

  // GET  /te/clientes/:id
  router.get(
    '/te/clientes/:id',
    requireAuth, validateId, requireTeViewPerm, loadAndValidateTeCliente,
    ClienteTeController.obtener
  );

  // POST /te/clientes
  router.post(
    '/te/clientes',
    requireAuth, requireTeEditPerm, apiLimiter, validateContentType, sanitizeInput,
    ClienteTeController.crear
  );

  // PUT  /te/clientes/:id  (solo observaciones)
  router.put(
    '/te/clientes/:id',
    requireAuth, validateId, requireTeEditPerm, loadAndValidateTeCliente,
    apiLimiter, validateContentType, sanitizeInput,
    ClienteTeController.actualizar
  );

  // ── Contactos ─────────────────────────────────────────────────────────────
  // GET  /te/clientes/:id/contactos
  router.get(
    '/te/clientes/:id/contactos',
    requireAuth, validateId, requireTeViewPerm, loadAndValidateTeCliente,
    ClienteTeController.listarContactos
  );

  // POST /te/clientes/:id/contactos
  router.post(
    '/te/clientes/:id/contactos',
    requireAuth, validateId, requireTeEditPerm, loadAndValidateTeCliente,
    apiLimiter, validateContentType, sanitizeInput,
    ClienteTeController.crearContacto
  );

  // DELETE /te/clientes/:id/contactos/:id_contacto
  router.delete(
    '/te/clientes/:id/contactos/:id_contacto',
    requireAuth, validateId, requireTeEditPerm, loadAndValidateTeCliente,
    apiLimiter, validateContentType, sanitizeInput,
    ClienteTeController.desactivarContacto
  );

  // PATCH  /te/clientes/:id/contactos/:id_contacto/default
  router.patch(
    '/te/clientes/:id/contactos/:id_contacto/default',
    requireAuth, validateId, requireTeEditPerm, loadAndValidateTeCliente,
    apiLimiter, validateContentType, sanitizeInput,
    ClienteTeController.setDefaultContacto
  );

  // ── Direcciones ───────────────────────────────────────────────────────────
  // GET  /te/clientes/:id/direcciones
  router.get(
    '/te/clientes/:id/direcciones',
    requireAuth, validateId, requireTeViewPerm, loadAndValidateTeCliente,
    ClienteTeController.listarDirecciones
  );

  // POST /te/clientes/:id/direcciones
  router.post(
    '/te/clientes/:id/direcciones',
    requireAuth, validateId, requireTeEditPerm, loadAndValidateTeCliente,
    apiLimiter, validateContentType, sanitizeInput,
    ClienteTeController.crearDireccion
  );

  // DELETE /te/clientes/:id/direcciones/:id_direccion
  router.delete(
    '/te/clientes/:id/direcciones/:id_direccion',
    requireAuth, validateId, requireTeEditPerm, loadAndValidateTeCliente,
    apiLimiter, validateContentType, sanitizeInput,
    ClienteTeController.desactivarDireccion
  );

  // PATCH  /te/clientes/:id/direcciones/:id_direccion/default
  router.patch(
    '/te/clientes/:id/direcciones/:id_direccion/default',
    requireAuth, validateId, requireTeEditPerm, loadAndValidateTeCliente,
    apiLimiter, validateContentType, sanitizeInput,
    ClienteTeController.setDefaultDireccion
  );

  return router;
};
