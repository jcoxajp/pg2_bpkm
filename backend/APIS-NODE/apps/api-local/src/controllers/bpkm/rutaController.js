const Ruta = require('../../models/bpkm/Ruta');
const RolSucursal = require('../../models/usuarios/RolSucursal');
const { successResponse, errorResponse } = require('../../../../../packages/shared-utils');
const makeHelpers = require('../../routes/bpkm/helpers');
const { getUserId } = makeHelpers;
const { toStrOrNull, toDateOrNull, toInt } = makeHelpers({});

async function getRutasBandeja(req, res) {
  try {
    const pool = req.app.locals.pool;
    const usuario = getUserId(req);
    const {
      estado_codigo = '',
      fecha_desde = null,
      fecha_hasta = null,
      id_camion = 0,
      id_piloto = 0,
      id_auxiliar = 0,
      folio_factura = null,
      page = 1,
      limit = 25,
      exportar = false
    } = req.body || {};

    const idSucursalUsuario = await RolSucursal.findSucursalActivaId(toInt(usuario) || 0, pool);

    const data = await Ruta.listar(
      {
        estado_codigo: toStrOrNull(estado_codigo),
        fecha_desde: toDateOrNull(fecha_desde),
        fecha_hasta: toDateOrNull(fecha_hasta),
        id_camion: toInt(id_camion) || 0,
        id_piloto: toInt(id_piloto) || 0,
        id_auxiliar: toInt(id_auxiliar) || 0,
        folio_factura: toStrOrNull(folio_factura),
        page,
        limit,
        id_sucursal_usuario: idSucursalUsuario,
        exportar: exportar === true
      },
      pool
    );
    return successResponse(res, data, 'Operación exitosa', 200);
  } catch (err) {
    console.error('[rutaController.getRutasBandeja]', err);
    return errorResponse(res, 'Error interno del servidor', 500);
  }
}

module.exports = { getRutasBandeja };
