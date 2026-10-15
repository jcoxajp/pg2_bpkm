const fs = require('fs');
const Entrega = require('../../models/entregafacturas/Entrega');
const GoogleRouteService = require('../../services/entregafacturas/GoogleRouteService');
const { ok, fail, handleDbError } = require('../../utils/responseUtils');
const { isValidUuid } = require('../../utils/validators');
const {
  computeStoredPath,
  resolveAbsPath,
} = require('../../middleware/entregafacturas/entregaEvidenciaUploadMiddleware');

// unlink(undefined) lanza sincrónico (no rechaza la promesa) — evitarlo con el chequeo previo.
function unlinkArchivos(files) {
  for (const file of files || []) {
    if (file?.path) fs.promises.unlink(file.path).catch(() => {});
  }
}

class EntregasController {
  static async listar(req, res) {
    try {
      const rutas = await Entrega.listarRutasActivas(req.user.idPersonal);
      return ok(res, { rutas });
    } catch (err) {
      console.error('[EntregasController.listar] Error:', err);
      return (handleDbError(res, err)) || fail(res, 500, 'Error al listar rutas');
    }
  }

  static async detalle(req, res) {
    try {
      const { uuid } = req.params;
      if (!isValidUuid(uuid)) return fail(res, 400, 'uuid inválido');

      // ?estado= (vacío) se trata igual que si no se hubiera mandado el parámetro
      const estado = req.query?.estado || undefined;
      if (estado !== undefined && estado !== 'pendiente' && estado !== 'registrado') {
        return fail(res, 400, 'estado debe ser "pendiente" o "registrado"');
      }

      const ruta = await Entrega.detalleRuta(uuid, req.user.idPersonal, estado);
      if (!ruta) return fail(res, 404, 'Ruta no encontrada');

      return ok(res, { ruta });
    } catch (err) {
      console.error('[EntregasController.detalle] Error:', err);
      return (handleDbError(res, err)) || fail(res, 500, 'Error al obtener el detalle de la ruta');
    }
  }

  static async crear(req, res) {
    try {
      const { factura, resultado, latitud, longitud, motivo } = req.body || {};
      // '' se trata igual que "no enviado" — evita que precision_metros=0 legítimo se pierda
      const { precision_metros: precisionRaw } = req.body || {};
      const precisionMetros = (precisionRaw === undefined || precisionRaw === null || precisionRaw === '')
        ? undefined
        : Number(precisionRaw);

      const errorValidacion = Entrega.validarCrear({ factura, resultado, latitud, longitud, precisionMetros, motivo });
      if (errorValidacion) {
        unlinkArchivos(req.files);
        return fail(res, 400, errorValidacion);
      }
      if (!isValidUuid(factura)) {
        unlinkArchivos(req.files);
        return fail(res, 400, 'factura debe ser un uuid válido');
      }

      const rutasArchivo = req.files.map((file) => computeStoredPath(file.path));

      const resultado_ = await Entrega.crear(
        {
          facturaUuid: factura,
          resultado,
          latitud: Number(latitud),
          longitud: Number(longitud),
          precisionMetros: precisionMetros ?? null,
          motivo: motivo || null,
          rutasArchivo,
        },
        req.user.idUsuario,
        req.user.idPersonal
      );

      if (resultado_.error) {
        // Los archivos ya se guardaron en disco: se eliminan para no dejar huérfanos.
        unlinkArchivos(req.files);
        return fail(res, resultado_.status, resultado_.message);
      }

      // Fire-and-forget: no bloquea la respuesta al piloto, GoogleRouteService maneja sus propios errores.
      GoogleRouteService.dispararSiListo(resultado_.idRuta);

      return ok(res, { uuid: resultado_.entregaUuid, evidencias: resultado_.evidenciaUuids }, 201);
    } catch (err) {
      console.error('[EntregasController.crear] Error:', err);
      unlinkArchivos(req.files);
      if (err.code === '23505') {
        return fail(res, 409, 'Ya se registró una entrega para esta factura');
      }
      return (handleDbError(res, err)) || fail(res, 500, 'Error al registrar la entrega');
    }
  }

  static async archivo(req, res) {
    try {
      const { uuid } = req.params;
      if (!isValidUuid(uuid)) return fail(res, 400, 'uuid inválido');

      const rutaArchivo = await Entrega.buscarRutaArchivo(uuid, req.user.idUsuario);
      if (!rutaArchivo) return fail(res, 404, 'Evidencia no encontrada');

      const absPath = resolveAbsPath(rutaArchivo);
      return res.sendFile(absPath, (err) => {
        if (err && !res.headersSent) {
          console.error('[EntregasController.archivo] Error al enviar archivo:', err);
          fail(res, 404, 'Archivo no encontrado');
        }
      });
    } catch (err) {
      console.error('[EntregasController.archivo] Error:', err);
      return fail(res, 500, 'Error al obtener el archivo');
    }
  }
}

module.exports = EntregasController;
