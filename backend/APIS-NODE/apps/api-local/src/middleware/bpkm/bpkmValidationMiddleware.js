const { body, query, validationResult } = require('express-validator');

const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    const errorsSinValor = errors.array().map(({ value, ...resto }) => resto);
    return res.status(400).json({ ok: false, message: 'Errores de validación', errors: errorsSinValor });
  }
  next();
};

const validateComentarioRuta = [
  body('comentario')
    .trim()
    .notEmpty().withMessage('comentario requerido')
    .isLength({ max: 1000 }).withMessage('comentario muy largo (máx 1000 caracteres)'),
  handleValidationErrors
];

const validateMontosAprobacion = [
  body('monto_aprobado_piloto')
    .notEmpty().withMessage('monto_aprobado_piloto requerido')
    .isFloat({ min: 0, max: 1000 }).withMessage('monto_aprobado_piloto debe ser un número entre 0 y 1000'),
  body('monto_aprobado_auxiliar')
    .notEmpty().withMessage('monto_aprobado_auxiliar requerido')
    .isFloat({ min: 0, max: 500 }).withMessage('monto_aprobado_auxiliar debe ser un número entre 0 y 500'),
  body('observaciones')
    .optional({ nullable: true })
    .isString().withMessage('observaciones debe ser texto')
    .isLength({ max: 500 }).withMessage('observaciones muy larga (máx 500 caracteres)'),
  handleValidationErrors
];

const validateTerminoBusqueda = (campo) => [
  body(campo)
    .optional({ nullable: true })
    .isString().withMessage(`${campo} debe ser texto`)
    .isLength({ max: 100 }).withMessage(`${campo} muy largo (máx 100 caracteres)`),
  handleValidationErrors
];

const validateMotivoCambioSucursal = [
  body('motivo')
    .trim()
    .notEmpty().withMessage('motivo requerido')
    .isLength({ max: 500 }).withMessage('motivo muy largo (máx 500 caracteres)'),
  handleValidationErrors
];

const validateObservacionesCambioSucursal = [
  body('observaciones')
    .optional({ nullable: true })
    .isString().withMessage('observaciones debe ser texto')
    .isLength({ max: 500 }).withMessage('observaciones muy larga (máx 500 caracteres)'),
  handleValidationErrors
];

const validateComentarioAnulacion = [
  body('comentario')
    .optional({ nullable: true })
    .isString().withMessage('comentario debe ser texto')
    .isLength({ max: 400 }).withMessage('comentario muy largo (máx 400 caracteres)'),
  body('folio_nc')
    .trim()
    .notEmpty().withMessage('folio_nc requerido')
    .isLength({ max: 50 }).withMessage('folio_nc muy largo (máx 50 caracteres)'),
  handleValidationErrors
];

// estado_codigo aquí es el de bpkm.post_liquidar_detalle_ruta (ENTREGADA/FALLIDA/PARCIAL,
// hardcodeado en esa función) - no confundir con el estado_codigo de catálogo dinámico
// (bpkm.tbl_estado_bpkm) que usan las bandejas, ese no se valida con lista fija.
// motivo_fallo/observaciones son opcionales de verdad: ninguno de los 3 estados exige uno en
// particular (ENTREGADA no necesita ninguno, FALLIDA típicamente manda motivo_fallo, PARCIAL
// típicamente observaciones, pero el backend no fuerza esa combinación).
const validateLiquidacionDetalle = [
  body('estado_codigo')
    .trim()
    .notEmpty().withMessage('estado_codigo requerido')
    .isIn(['ENTREGADA', 'FALLIDA', 'PARCIAL']).withMessage('estado_codigo debe ser ENTREGADA, FALLIDA o PARCIAL'),
  body('motivo_fallo')
    .optional({ nullable: true })
    .isString().withMessage('motivo_fallo debe ser texto')
    .isLength({ max: 500 }).withMessage('motivo_fallo muy largo (máx 500 caracteres)'),
  body('observaciones')
    .optional({ nullable: true })
    .isString().withMessage('observaciones debe ser texto')
    .isLength({ max: 500 }).withMessage('observaciones muy larga (máx 500 caracteres)'),
  handleValidationErrors
];

const validateDireccionEntrega = [
  body('direccion')
    .optional({ nullable: true })
    .isString().withMessage('direccion debe ser texto')
    .isLength({ max: 500 }).withMessage('direccion muy larga (máx 500 caracteres)'),
  handleValidationErrors
];

const validateSolicitudCambioForma = [
  body('direccion_new')
    .optional({ nullable: true })
    .isString().withMessage('direccion_new debe ser texto')
    .isLength({ max: 500 }).withMessage('direccion_new muy larga (máx 500 caracteres)'),
  body('comentario_solicitante')
    .optional({ nullable: true })
    .isString().withMessage('comentario_solicitante debe ser texto')
    .isLength({ max: 500 }).withMessage('comentario_solicitante muy largo (máx 500 caracteres)'),
  handleValidationErrors
];

const validateResolucionCambioForma = [
  body('decision_codigo')
    .trim()
    .notEmpty().withMessage('decision_codigo requerido')
    .isIn(['APR', 'RECH']).withMessage('decision_codigo debe ser APR o RECH'),
  body('comentario_autorizador')
    .optional({ nullable: true })
    .isString().withMessage('comentario_autorizador debe ser texto')
    .isLength({ max: 500 }).withMessage('comentario_autorizador muy largo (máx 500 caracteres)'),
  handleValidationErrors
];

const validateComentarioMonitoreo = [
  body('tipo')
    .trim()
    .notEmpty().withMessage('tipo requerido')
    .isIn(['S', 'E']).withMessage('tipo debe ser S o E'),
  body('comentario')
    .optional({ nullable: true })
    .isString().withMessage('comentario debe ser texto')
    .isLength({ max: 500 }).withMessage('comentario muy largo (máx 500 caracteres)'),
  body('fecha_hora')
    .notEmpty().withMessage('fecha_hora requerido')
    .custom((value) => {
      const parsed = new Date(String(value).trim().replace(' ', 'T'));
      if (Number.isNaN(parsed.getTime())) {
        throw new Error('fecha_hora debe ser una fecha/hora válida');
      }
      return true;
    }),
  handleValidationErrors
];

const validatePlacaCamion = [
  body('placa')
    .trim()
    .notEmpty().withMessage('placa requerida')
    .isLength({ max: 15 }).withMessage('placa muy larga (máx 15 caracteres)'),
  handleValidationErrors
];

const validatePersonal = [
  body('nombre')
    .trim()
    .notEmpty().withMessage('nombre requerido')
    .isLength({ max: 100 }).withMessage('nombre muy largo (máx 100 caracteres)'),
  body('telefono')
    .optional({ nullable: true })
    .isString().withMessage('telefono debe ser texto')
    .isLength({ max: 20 }).withMessage('telefono muy largo (máx 20 caracteres)'),
  handleValidationErrors
];

// bpkm.put_personal usa COALESCE - nombre/telefono son opcionales de verdad en edición, a
// diferencia del alta (validatePersonal).
const validatePersonalEdicion = [
  body('nombre')
    .optional({ nullable: true })
    .isString().withMessage('nombre debe ser texto')
    .isLength({ min: 1, max: 100 }).withMessage('nombre inválido (1 a 100 caracteres)'),
  body('telefono')
    .optional({ nullable: true })
    .isString().withMessage('telefono debe ser texto')
    .isLength({ max: 20 }).withMessage('telefono muy largo (máx 20 caracteres)'),
  handleValidationErrors
];

const validateTransporte = [
  body('nombre')
    .trim()
    .notEmpty().withMessage('nombre requerido')
    .isLength({ max: 100 }).withMessage('nombre muy largo (máx 100 caracteres)'),
  handleValidationErrors
];

// bpkm.put_transporte también usa COALESCE - mismo criterio que validatePersonalEdicion.
const validateTransporteEdicion = [
  body('nombre')
    .optional({ nullable: true })
    .isString().withMessage('nombre debe ser texto')
    .isLength({ min: 1, max: 100 }).withMessage('nombre inválido (1 a 100 caracteres)'),
  handleValidationErrors
];

const sanitizeNullish = (v) => {
  if (v === undefined || v === null) return null;
  const s = String(v).trim().toLowerCase();
  return (s === 'null' || s === 'undefined' || s === '') ? null : v;
};

// Validación de parámetros query para listar facturas seleccion
const validateQueryFacturasSeleccion = [
  query('page')
    .customSanitizer(sanitizeNullish)
    .optional({ nullable: true })
    .isInt({ min: 1 }).withMessage('page debe ser un número entero mayor o igual a 1'),
  query('limit')
    .customSanitizer(sanitizeNullish)
    .optional({ nullable: true })
    .isInt({ min: 1, max: 100 }).withMessage('limit debe ser un número entero entre 1 y 100'),
  query('offset')
    .customSanitizer(sanitizeNullish)
    .optional({ nullable: true })
    .isInt({ min: 0 }).withMessage('offset debe ser un número entero mayor o igual a 0'),
  query('folio_like')
    .customSanitizer(sanitizeNullish)
    .optional({ nullable: true })
    .isString().isLength({ max: 50 }).withMessage('folio_like no debe exceder 50 caracteres'),
  query('estado_codigo')
    .customSanitizer(sanitizeNullish)
    .optional({ nullable: true })
    .isString().isLength({ max: 20 }).withMessage('estado_codigo no debe exceder 20 caracteres'),
  query('fecha_desde')
    .customSanitizer(sanitizeNullish)
    .optional({ nullable: true })
    .isISO8601().withMessage('fecha_desde debe ser una fecha válida (YYYY-MM-DD)'),
  query('fecha_hasta')
    .customSanitizer(sanitizeNullish)
    .optional({ nullable: true })
    .isISO8601().withMessage('fecha_hasta debe ser una fecha válida (YYYY-MM-DD)'),
  handleValidationErrors
];

const validateQueryMisFacturas = validateQueryFacturasSeleccion;

module.exports = {
  handleValidationErrors,
  validateComentarioRuta,
  validateMontosAprobacion,
  validateTerminoBusqueda,
  validateMotivoCambioSucursal,
  validateObservacionesCambioSucursal,
  validateComentarioAnulacion,
  validateLiquidacionDetalle,
  validateDireccionEntrega,
  validateSolicitudCambioForma,
  validateResolucionCambioForma,
  validateComentarioMonitoreo,
  validatePlacaCamion,
  validatePersonal,
  validatePersonalEdicion,
  validateTransporte,
  validateTransporteEdicion,
  validateQueryFacturasSeleccion,
  validateQueryMisFacturas
};
