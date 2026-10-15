// controllers/bpkm/seleccionController.js

const Seleccion = require('../../models/bpkm/Seleccion');
const { successResponse, errorResponse } = require('../../../../../packages/shared-utils');
const makeHelpers = require('../../routes/bpkm/helpers');
const { getUserId } = makeHelpers;
const { toStrOrNull, toDateOrNull, toInt } = makeHelpers({});

/**
 * GET /api/bpkm/facturas_seleccion
 *
 * Consulta de facturas del usuario creador o de sus vendedores asignados.
 */
async function getFacturasSeleccion(req, res) {
  try {
    const pool = req.app.locals.pool;
    const usuario = getUserId(req);

    const { checkBPKMPerm } = makeHelpers({ pool });
    const hasPerm = await checkBPKMPerm(usuario, 'bpkm.facturas.view', 'viewer');
    if (!hasPerm) {
      return errorResponse(res, 'No tiene permiso para ver facturas.', 403);
    }

    const params = { ...(req.body || {}), ...(req.query || {}) };
    const {
      folio_like = null,
      estado_codigo = null,
      fecha_desde = null,
      fecha_hasta = null,
      page = undefined,
      limit = undefined,
      offset = undefined
    } = params;

    const data = await Seleccion.listarMisFacturas(
      {
        id_vendedor: null,
        forma_codigo: null,
        folio_like: toStrOrNull(folio_like),
        estado_codigo: toStrOrNull(estado_codigo),
        fecha_desde: toDateOrNull(fecha_desde),
        fecha_hasta: toDateOrNull(fecha_hasta),
        creado_por: toInt(usuario),
        page: page !== undefined && page !== null && page !== '' ? parseInt(page, 10) : undefined,
        limit: limit !== undefined && limit !== null && limit !== '' ? parseInt(limit, 10) : undefined,
        offset: offset !== undefined && offset !== null && offset !== '' ? parseInt(offset, 10) : undefined
      },
      pool
    );

    return res.status(200).json(data);
  } catch (err) {
    console.error('[seleccionController.getFacturasSeleccion]', err);
    return errorResponse(res, 'Error interno del servidor', 500);
  }
}

module.exports = {
  getFacturasSeleccion,
  getMisFacturas: getFacturasSeleccion
};
