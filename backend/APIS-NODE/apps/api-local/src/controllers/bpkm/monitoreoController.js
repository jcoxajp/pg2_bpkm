const Monitoreo = require('../../models/bpkm/Monitoreo');
const { successResponse, errorResponse } = require('../../../../../packages/shared-utils');
const makeHelpers = require('../../routes/bpkm/helpers');
const { getUserId } = makeHelpers;
const { toInt, toStrOrNull, toDateOrNull } = makeHelpers({});

// PATCH /api/bpkm/monitoreo/:id_ruta
// body: tipo ('S'|'E'), fecha_hora, comentario (opcional)
async function patchMonitoreo(req, res) {
  try {
    const pool = req.app.locals.pool;
    const { tipo, fecha_hora, comentario } = req.body || {};
    const idUsuario = toInt(getUserId(req));

    const idRuta = toInt(req.params.id_ruta);
    if (!idRuta) return errorResponse(res, 'id_ruta requerido', 400);
    if (!idUsuario) return errorResponse(res, 'usuario requerido', 400);

    const result = await Monitoreo.registrar(
      {
        id_ruta: idRuta,
        id_usuario: idUsuario,
        tipo: toStrOrNull(tipo),
        fecha_hora: toDateOrNull(fecha_hora),
        comentario: toStrOrNull(comentario)
      },
      pool
    );

    if (!result.ok) {
      return errorResponse(res, result.error, 400);
    }
    return successResponse(res, result.data, 'Monitoreo registrado correctamente', 200);
  } catch (err) {
    console.error('[monitoreoController.patchMonitoreo]', err);
    return errorResponse(res, 'Error interno del servidor', 500);
  }
}

// GET /api/bpkm/monitoreo
// query: estado_codigo, fecha_desde, fecha_hasta, id_suc_salida, id_camion, id_piloto,
// id_auxiliar, creado_por, page, limit
async function getRutasConMonitoreo(req, res) {
  try {
    const pool = req.app.locals.pool;
    const {
      estado_codigo = '',
      fecha_desde = null,
      fecha_hasta = null,
      id_suc_salida = 0,
      id_camion = 0,
      id_piloto = 0,
      id_auxiliar = 0,
      creado_por = 0,
      page = 1,
      limit = 25
    } = req.query || {};

    const data = await Monitoreo.listar(
      {
        estado_codigo: toStrOrNull(estado_codigo),
        fecha_desde: toDateOrNull(fecha_desde),
        fecha_hasta: toDateOrNull(fecha_hasta),
        id_suc_salida: toInt(id_suc_salida) || 0,
        id_camion: toInt(id_camion) || 0,
        id_piloto: toInt(id_piloto) || 0,
        id_auxiliar: toInt(id_auxiliar) || 0,
        creado_por: toInt(creado_por) || 0,
        page,
        limit
      },
      pool
    );
    return successResponse(res, data, 'Operación exitosa', 200);
  } catch (err) {
    console.error('[monitoreoController.getRutasConMonitoreo]', err);
    return errorResponse(res, 'Error interno del servidor', 500);
  }
}

module.exports = { patchMonitoreo, getRutasConMonitoreo };
