const fs = require('fs');
const Evidencia = require('../../models/bpkm/Evidencia');
const { resolveAbsPath, determinarContentType } = require('../../services/bpkm/evidenciaStorage');
const { successResponse, errorResponse } = require('../../../../../packages/shared-utils');
const { tienePermisoModulo } = require('../../../../../packages/shared-auth/permisos');

const MODULOS_PERMITIDOS_EVIDENCIAS = ['adminnotascredito', 'localesbpkm', 'gerenciabpkm'];

/**
 * Valida si el usuario tiene permiso en cualquiera de los módulos 'adminnotascredito','localesbpkm','gerenciabpkm'.
 */
async function tienePermisoModulosElevados(idUsuario, pool) {
  for (const codigo of MODULOS_PERMITIDOS_EVIDENCIAS) {
    if (await tienePermisoModulo(idUsuario, codigo, pool)) {
      return true;
    }
  }
  return false;
}

function getUserId(req) {
  return req.user?.id_usuario || req.user?.id || null;
}

class EvidenciaController {
  /**
   * GET /api/bpkm/facturas/evidencias?id=...
   * Lista evidencias fotográficas de una factura de selección.
   */
  static async listar(req, res) {
    try {
      const pool = req.app.locals.pool;
      const idFacturaSel = parseInt(req.query.id || req.params.id, 10);
      const idUsuario = parseInt(getUserId(req), 10);

      const acceso = await Evidencia.verificarAccesoFactura(pool, idFacturaSel, idUsuario);

      if (!acceso.existe) {
        return errorResponse(res, 'Factura no encontrada', 404);
      }

      // 1. Validar si es creador o tiene la factura asignada
      let autorizado = acceso.autorizado;

      // 2. Si no, validar si tiene permiso en los módulos administrativos
      if (!autorizado) {
        autorizado = await tienePermisoModulosElevados(idUsuario, pool);
      }

      // 3. Si tampoco cumple, denegar acceso
      if (!autorizado) {
        return errorResponse(res, 'No tiene autorización para ver las evidencias de esta factura', 403);
      }

      const evidencias = await Evidencia.listarPorFacturaSel(pool, idFacturaSel);
      return successResponse(res, evidencias);
    } catch (error) {
      console.error('[EvidenciaController.listar] Error:', error);
      return errorResponse(res, 'Error al consultar evidencias de la factura', 500, { error: error.message });
    }
  }

  /**
   * GET /api/bpkm/evidencias/archivo?id=...
   * Sirve el binario de la imagen de evidencia.
   */
  static async archivo(req, res) {
    try {
      const pool = req.app.locals.pool;
      const idEvidencia = parseInt(req.query.id || req.params.id, 10);
      const idUsuario = parseInt(getUserId(req), 10);

      const evidencia = await Evidencia.buscarParaArchivo(pool, idEvidencia, idUsuario);

      if (!evidencia) {
        return errorResponse(res, 'Evidencia no encontrada', 404);
      }

      // 1. Validar si es creador o tiene la factura asignada
      let autorizado = evidencia.tiene_acceso;

      // 2. Si no, validar si tiene permiso en los módulos administrativos
      if (!autorizado) {
        autorizado = await tienePermisoModulosElevados(idUsuario, pool);
      }

      // 3. Si tampoco cumple, denegar acceso
      if (!autorizado) {
        return errorResponse(res, 'No tiene autorización para ver esta evidencia', 403);
      }

      if (!evidencia.ruta_archivo) {
        return errorResponse(res, 'Esta evidencia no tiene una ruta de archivo registrada', 404);
      }

      let absPath;
      try {
        absPath = resolveAbsPath(evidencia.ruta_archivo);
      } catch (errPath) {
        return errorResponse(res, 'Ruta de archivo inválida', 400);
      }

      if (!fs.existsSync(absPath)) {
        return errorResponse(res, 'El archivo físico no está disponible en disco', 404);
      }

      const contentType = determinarContentType(absPath);
      res.type(contentType);

      return res.sendFile(absPath, (err) => {
        if (err && !res.headersSent) {
          console.error('[EvidenciaController.archivo] Error en sendFile:', err);
          errorResponse(res, 'Error al transmitir el archivo', 500, { error: err.message });
        }
      });
    } catch (error) {
      console.error('[EvidenciaController.archivo] Error:', error);
      return errorResponse(res, 'Error al obtener el archivo de evidencia', 500, { error: error.message });
    }
  }
}

module.exports = EvidenciaController;
