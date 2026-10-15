const Bpkm = require('../../models/bpkm/Bpkm');
const { successResponse, errorResponse } = require('../../../../../packages/shared-utils');
const makeHelpers = require('../../routes/bpkm/helpers');
const { toStrOrNull, toDateOrNull, toInt } = makeHelpers({});

function getUserId(req) {
  return req.user?.id_usuario || req.user?.id || null;
}

/**
  * PATCH /api/bpkm/distancia
  * Modifica la distancia lejana de un BPKM respaldando la anterior y recalculando comisiones.
  */
async function patchDistanciaLejana(req, res) {
  try {
    const pool = req.app.locals.pool;
    const { id_bpkm, distancia } = { ...req.query, ...req.body };

    const idBpkm = parseInt(id_bpkm, 10);
    const idUsuario = parseInt(getUserId(req), 10);
    const valDistancia = parseFloat(distancia);

    if (!idBpkm || isNaN(idBpkm) || idBpkm <= 0) {
      return errorResponse(res, 'id_bpkm requerido y debe ser un número entero válido', 400);
    }

    if (!idUsuario || isNaN(idUsuario) || idUsuario <= 0) {
      return errorResponse(res, 'usuario requerido y debe ser un número entero válido', 400);
    }

    if (isNaN(valDistancia) || valDistancia <= 0) {
      return errorResponse(res, 'distancia requerida y debe ser un número válido mayor a 0', 400);
    }

    const result = await Bpkm.updateDistanciaLejana(
      { idBpkm, distancia: valDistancia, usuario: idUsuario },
      pool
    );

    if (!result.ok) {
      return errorResponse(res, result.error || 'No se pudo actualizar la distancia', 400);
    }

    return successResponse(res, null, result.mensaje || 'Distancia y comisiones actualizadas correctamente', 200);
  } catch (err) {
    console.error('[bpkmController.patchDistanciaLejana]', err);
    return errorResponse(res, 'Error interno del servidor', 500);
  }
}

/**
  * GET /api/bpkm/distancia
  * Devuelve el listado BPKM con campos resumidos y paginados para la App Ops.
  */
async function getBpkm(req, res) {
  try {
    const pool = req.app.locals.pool;
    const filters = { ...req.query, ...req.body };

    const data = await Bpkm.getBpkm(filters, pool);
    return successResponse(res, data, 'Operación exitosa', 200);
  } catch (err) {
    console.error('[bpkmController.getBpkm]', err);
    return errorResponse(res, 'Error interno del servidor', 500);
  }
}

/**
  * POST /api/bpkm/get_bpkm
  * Bandeja BPKM para Gerencia y RRHH, paginada del lado del servidor.
  */
async function getBpkmBandeja(req, res) {
  try {
    const pool = req.app.locals.pool;
    const {
      estado_codigo = '',
      estado_excluido = null,
      fecha_desde = null,
      fecha_hasta = null,
      id_sucursal = 0,
      id_camion = 0,
      folio_factura = null,
      page = 1,
      limit = 25,
      exportar = false
    } = req.body || {};

    const data = await Bpkm.listarBandeja(
      {
        estado_codigo: toStrOrNull(estado_codigo),
        estado_excluido: toStrOrNull(estado_excluido),
        fecha_desde: toDateOrNull(fecha_desde),
        fecha_hasta: toDateOrNull(fecha_hasta),
        id_sucursal: toInt(id_sucursal) || 0,
        id_camion: toInt(id_camion) || 0,
        folio_factura: toStrOrNull(folio_factura),
        page,
        limit,
        exportar: exportar === true
      },
      pool
    );
    return successResponse(res, data, 'Operación exitosa', 200);
  } catch (err) {
    console.error('[bpkmController.getBpkmBandeja]', err);
    return errorResponse(res, 'Error interno del servidor', 500);
  }
}

/**
  * GET /api/bpkm/camiones
  * Camiones del filtro de Gerencia y Distancia de Rutas, con la sucursal de salida de sus rutas.
  */
async function getCamionesFiltro(req, res) {
  try {
    const pool = req.app.locals.pool;
    const data = await Bpkm.listarCamionesFiltro(pool);
    return successResponse(res, data, 'Operación exitosa', 200);
  } catch (err) {
    console.error('[bpkmController.getCamionesFiltro]', err);
    return errorResponse(res, 'Error interno del servidor', 500);
  }
}

module.exports = {
  patchDistanciaLejana,
  getBpkm,
  getBpkmBandeja,
  getCamionesFiltro
};
