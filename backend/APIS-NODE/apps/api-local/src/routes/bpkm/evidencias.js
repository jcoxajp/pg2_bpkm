const express = require('express');
const { query, validationResult } = require('express-validator');
const rateLimit = require('express-rate-limit');
const { requireAuth } = require('../../../../../packages/shared-auth');
const { validateId } = require('../../middleware/rp/rpValidationMiddleware');
const EvidenciaController = require('../../controllers/bpkm/evidenciaController');
const { requireAnyModuloPermission } = require('../../../../../packages/shared-auth/permisos');

const evidenciasLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 300,
  message: { ok: false, message: 'Demasiadas solicitudes, intenta más tarde' }
});

const validateQueryId = [
  query('id')
    .notEmpty().withMessage('El parámetro id es requerido')
    .isInt({ min: 1 }).withMessage('El parámetro id debe ser un número entero positivo'),
  (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        ok: false,
        message: 'Errores de validación',
        errors: errors.array()
      });
    }
    next();
  }
];

module.exports = function makeEvidenciasRouter({ pool } = {}) {
  const router = express.Router();

  router.use((req, _res, next) => {
    req.app.locals.pool = pool;
    next();
  });

  // GET /api/bpkm/facturas/evidencias?id=12966 — Query param
  router.get('/facturas/evidencias', requireAuth, requireAnyModuloPermission(['facturasbpkm','adminnotascredito','localesbpkm','gerenciabpkm', 'rutasbpkm']), evidenciasLimiter, validateQueryId, EvidenciaController.listar);

  // GET /api/bpkm/evidencias/archivo?id=30 — Query param
  router.get('/evidencias/archivo', requireAuth, requireAnyModuloPermission(['facturasbpkm','adminnotascredito','localesbpkm','gerenciabpkm', 'rutasbpkm']), evidenciasLimiter, validateQueryId, EvidenciaController.archivo);

  return router;
};
