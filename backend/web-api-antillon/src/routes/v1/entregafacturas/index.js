const { Router } = require('express');
const { authenticate } = require('../../../middleware/authenticate');
const { requirePermiso } = require('../../../middleware/requirePermiso');
const { requirePiloto } = require('../../../middleware/requirePiloto');
const { sanitizeInput } = require('../../../middleware/securityMiddleware');
const {
  searchLimiter,
  entregaUploadLimiter,
  entregaArchivoLimiter,
} = require('../../../middleware/rateLimiter');
const { uploadEvidencia } = require('../../../middleware/entregafacturas/entregaEvidenciaUploadMiddleware');
const EntregasController = require('../../../controllers/entregafacturas/entregasController');

const router = Router();

const requireAcceso = [authenticate, requirePermiso('entregafacturas'), requirePiloto];

// GET /api/v1/entregafacturas — rutas activas del piloto (puede ser más de una)
router.get('/', 
  requireAcceso, 
  searchLimiter, 
  EntregasController.listar
);

// POST /api/v1/entregafacturas — crea el resultado + evidencia de una factura de la ruta
// multipart/form-data: factura (uuid), resultado, latitud, longitud, precision_metros?, motivo?; foto (1 a 3)
// motivo es requerido cuando resultado es PARC o FALL
// el limiter va antes de la subida: un request rechazado no escribe en disco
router.post(
  '/',
  requireAcceso,
  entregaUploadLimiter,
  uploadEvidencia,
  sanitizeInput,
  EntregasController.crear
);

// GET /api/v1/entregafacturas/:uuid/archivo — sirve el archivo de una evidencia
// va ANTES de GET /:uuid para no chocar con la ruta parametrizada de detalle
router.get('/:uuid/archivo', 
  requireAcceso, 
  entregaArchivoLimiter, 
  EntregasController.archivo
);

// GET /api/v1/entregafacturas/:uuid — detalle de una ruta (facturas + resultado si ya existe)
// query: estado=pendiente|registrado (opcional, sin filtro = todas)
router.get('/:uuid', 
  requireAcceso, 
  searchLimiter, 
  EntregasController.detalle
);

module.exports = router;
