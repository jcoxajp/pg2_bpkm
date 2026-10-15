// routes/bpkm/v1/rutas.js
const express = require('express');
const makeHelpers = require('./helpers');
const { getUserId } = makeHelpers;
const { requireAuth } = require('../../../../../packages/shared-auth');
const { requireModuloPermission, requireAnyModuloPermission } = require('../../../../../packages/shared-auth/permisos');
const { validateContentType, sanitizeInput } = require('../../middleware/rp/rpSecurityMiddleware');
const { validateId } = require('../../middleware/rp/rpValidationMiddleware');
const { validateComentarioRuta, validateTerminoBusqueda, validateLiquidacionDetalle } = require('../../middleware/bpkm/bpkmValidationMiddleware');
const { apiLimiter } = require('../../middleware/bpkm/bpkmRateLimit');
const rutaController = require('../../controllers/bpkm/rutaController');

module.exports = function makeRutasRouter({ pool } = {}) {
  const router = express.Router();
  const { q, toStrOrNull, toInt, toDateOrNull, ok, bad, checkBPKMPerm } = makeHelpers({ pool });

  router.use((req, _res, next) => {
    req.app.locals.pool = pool;
    next();
  });

  // Helper para parsear valores booleanos desde request (maneja strings y booleans)
  function toBool(val, defaultVal = true) {
    if (val === undefined || val === null) return defaultVal;
    // Valores falsy: false, 'false', '0', 0, ''
    if (val === false || val === 'false' || val === '0' || val === 0 || val === '') return false;
    // Valores truthy: true, 'true', '1', 1, cualquier otro string no vacío
    if (val === true || val === 'true' || val === '1' || val === 1) return true;
    // Para cualquier otro valor, usar Boolean() pero con cautela
    return Boolean(val);
  }

  // Crear ruta completa (maestro + facturas + recalcular)
  router.post(
    '/post_ruta_completa',
    requireAuth, requireModuloPermission('rutasbpkm'), apiLimiter, validateContentType, sanitizeInput,
    async (req, res) => {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const {
        id_sucursal_salida,
        id_sucursal_regreso,
        id_camion,
        id_piloto,
        id_auxiliar,
        fecha_salida_plan,
        fecha_entrada_plan,
        tipo_ruta = 'RL',
        id_transporte_externo,
        facturas = []
      } = req.body || {};
      const usuario = getUserId(req);

      // Validar permiso: crear rutas
      const hasPerm = await checkBPKMPerm(usuario, 'bpkm.rutas.new', 'editor');
      if (!hasPerm) {
        await client.query('ROLLBACK');
        return bad(res, 'No tiene permiso para crear rutas. Contacte al administrador.');
      }

      // Validaciones según tipo de ruta
      if (tipo_ruta === 'RL' || tipo_ruta === 'RC') {
        if (!toInt(id_camion)) return bad(res, `id_camion requerido para rutas ${tipo_ruta}`);
        if (!toInt(id_piloto)) return bad(res, `id_piloto requerido para rutas ${tipo_ruta}`);
      } else if (tipo_ruta === 'TE') {
        if (!toInt(id_transporte_externo)) return bad(res, 'id_transporte_externo requerido para rutas TE');
        if (!toInt(id_camion)) return bad(res, 'id_camion requerido para rutas TE');
        if (!toInt(id_piloto)) return bad(res, 'id_piloto requerido para rutas TE');
      } else {
        return bad(res, 'tipo_ruta debe ser RL, TE o RC');
      }

      if (!toInt(usuario)) return bad(res, 'usuario requerido');
      if (!Array.isArray(facturas) || facturas.length === 0) {
        return bad(res, 'Debe incluir al menos una factura');
      }

      // 1. Crear ruta maestra
      const rutaResult = await client.query(
        `SELECT * FROM bpkm.post_ruta($1::INTEGER,$2::INTEGER,$3::INTEGER,$4::INTEGER,$5::INTEGER,$6::TIMESTAMP,$7::TIMESTAMP,$8::INTEGER,$9::VARCHAR,$10::INTEGER)`,
        [
          toInt(id_sucursal_salida) || null,
          toInt(id_sucursal_regreso) || null,
          toInt(id_camion) || null,
          toInt(id_piloto) || null,
          toInt(id_auxiliar) || null,
          toDateOrNull(fecha_salida_plan),
          toDateOrNull(fecha_entrada_plan),
          toInt(usuario),
          tipo_ruta,
          toInt(id_transporte_externo) || null
        ]
      );

      const nuevaRuta = rutaResult.rows?.[0];
      if (!nuevaRuta?.int_id_ruta) {
        await client.query('ROLLBACK');
        return bad(res, 'Error al crear ruta maestra');
      }

      const idRuta = nuevaRuta.int_id_ruta;

      // 2. Agregar facturas
      for (const f of facturas) {
        await client.query(
          `SELECT * FROM bpkm.post_agregar_factura_a_ruta($1,$2,$3)`,
          [idRuta, toInt(f.id_factura_sel), toInt(usuario)]
        );
      }

      // 3. Recalcular monto total
      const montoResult = await client.query(
        `SELECT * FROM bpkm.put_ruta_recalcular_monto($1,$2)`,
        [idRuta, toInt(usuario)]
      );

      await client.query('COMMIT');

      return ok(res, {
        id_ruta: idRuta,
        codigo_ruta: nuevaRuta.str_codigo_ruta,
        tipo_ruta: tipo_ruta,
        monto_total: montoResult.rows?.[0]?.int_monto_total || 0,
        facturas_agregadas: facturas.length
      });

    } catch (e) {
      await client.query('ROLLBACK');

      // Mensajes personalizados para errores comunes
      const errorMsg = e.message || '';

      // Constraints de recursos ocupados
      if (errorMsg.includes('ya está asignado')) {
        return bad(res, errorMsg);
      }

      // Constraints de exclusión (fallback por si acaso)
      if (errorMsg.includes('ex_camion_sin_solape')) {
        return bad(res, 'El camión seleccionado ya está asignado a otra ruta en ese horario');
      }
      if (errorMsg.includes('ex_piloto_sin_solape')) {
        return bad(res, 'El piloto seleccionado ya está asignado a otra ruta en ese horario');
      }
      if (errorMsg.includes('ex_auxiliar_sin_solape')) {
        return bad(res, 'El auxiliar seleccionado ya está asignado a otra ruta en ese horario');
      }

      // Constraint de número duplicado (no debería pasar con la nueva validación)
      if (errorMsg.includes('ux_rutas_numero')) {
        return bad(res, 'Error de concurrencia. Por favor intente nuevamente');
      }

      // Devolver el mensaje de error real de la base de datos
      return bad(res, errorMsg || 'Error al crear la ruta. Verifique los datos e intente nuevamente.');
    } finally {
      client.release();
    }
  });

  // Agregar factura a ruta
  router.post(
    '/post_agregar_factura_a_ruta',
    requireAuth, requireModuloPermission('rutasbpkm'), apiLimiter, validateContentType, sanitizeInput,
    async (req, res) => {
    try {
      const { id_ruta, id_factura_sel } = req.body || {};
      const usuario = getUserId(req);
      if (!toInt(id_ruta)) return bad(res, 'id_ruta requerido');
      if (!toInt(id_factura_sel)) return bad(res, 'id_factura_sel requerido');
      if (!toInt(usuario)) return bad(res, 'usuario requerido');

      const rows = await q(
        `SELECT * FROM bpkm.post_agregar_factura_a_ruta($1,$2,$3)`,
        [toInt(id_ruta), toInt(id_factura_sel), toInt(usuario)]
      );
      return ok(res, rows?.[0] || {});
    } catch (e) {
      return bad(res, e.message);
    }
  });

  router.post(
    '/delete_factura_de_ruta',
    requireAuth, requireModuloPermission('rutasbpkm'), apiLimiter, validateContentType, sanitizeInput,
    async (req, res) => {
    try {
      const { id_detalle_ruta } = req.body || {};
      const usuario = getUserId(req);
      if (!toInt(id_detalle_ruta)) return bad(res, 'id_detalle_ruta requerido');
      if (!toInt(usuario)) return bad(res, 'usuario requerido');

      const rows = await q(
        `SELECT * FROM bpkm.delete_factura_de_ruta($1,$2)`,
        [toInt(id_detalle_ruta), toInt(usuario)]
      );
      const result = rows?.[0];
      if (!result?.ok) {
        return bad(res, result?.mensaje || 'Error al eliminar factura');
      }
      return ok(res, result);
    } catch (e) {
      return bad(res, e.message);
    }
  });

  // Obtener facturas disponibles para agregar a rutas
  router.post('/get_facturas_disponibles', requireAuth, requireModuloPermission('rutasbpkm'), apiLimiter, validateTerminoBusqueda('buscar'), async (req, res) => {
    try {
      const { buscar = '', limite = 50, offset = 0, id_sucursal = 0, tipo_ruta = '' } = req.body || {};

      const rows = await q(
        `SELECT * FROM bpkm.get_facturas_disponibles($1,$2,$3,$4,$5)`,
        [buscar || '', toInt(limite) || 50, toInt(offset) || 0, toInt(id_sucursal) || 0, tipo_ruta || '']
      );
      return ok(res, rows || []);
    } catch (e) {
      return bad(res, e.message);
    }
  });

  // Liquidar detalle de ruta
  router.post(
    '/post_liquidar_detalle_ruta',
    requireAuth, requireModuloPermission('rutasbpkm'), apiLimiter, validateContentType, sanitizeInput, validateLiquidacionDetalle,
    async (req, res) => {
    try {
      const {
        id_detalle_ruta,
        estado_codigo,
        motivo_fallo,
        observaciones,
        puede_reenviar,
        fecha_hora_intento
      } = req.body || {};
      const usuario = getUserId(req);

      if (!toInt(id_detalle_ruta)) return bad(res, 'id_detalle_ruta requerido');
      if (!toStrOrNull(estado_codigo)) return bad(res, 'estado_codigo requerido (ENTREGADA|FALLIDA|PARCIAL)');
      if (!toInt(usuario)) return bad(res, 'usuario requerido');

      // Validar permiso: liquidar rutas
      const hasPerm = await checkBPKMPerm(usuario, 'bpkm.rutas.liquidar', 'editor');
      if (!hasPerm) {
        return bad(res, 'No tiene permiso para liquidar entregas. Contacte al administrador.');
      }

      // Validar que la ruta ya haya iniciado (fecha_salida_plan alcanzada)
      // Consultar como string para evitar que pg convierta TIMESTAMP → UTC (+6h)
      const rutaCheck = await q(
        `SELECT r.fecha_salida_plan::text AS fecha_salida_plan
         FROM bpkm.tbl_detalles_ruta dr
         JOIN bpkm.tbl_rutas r ON r.id_ruta = dr.id_ruta
         WHERE dr.id_detalle_ruta = $1`,
        [toInt(id_detalle_ruta)]
      );
      if (!rutaCheck?.length) return bad(res, 'Detalle de ruta no encontrado');

      const { fecha_salida_plan } = rutaCheck[0]; // '2026-05-11 12:00:00' en hora Guatemala
      if (fecha_salida_plan) {
        // Guatemala UTC-6 fijo (sin horario de verano)
        const ahora = new Date(Date.now() - 6 * 60 * 60 * 1000);
        const ahoraFecha = ahora.toISOString().split('T')[0];          // 'YYYY-MM-DD'
        const ahoraMin = ahora.getUTCHours() * 60 + ahora.getUTCMinutes();

        const salidaFecha = fecha_salida_plan.substring(0, 10);        // 'YYYY-MM-DD'
        const salidaHora = fecha_salida_plan.substring(11, 16);       // 'HH:MM'
        const [sh, sm] = salidaHora.split(':').map(Number);
        const salidaMin = sh * 60 + sm;

        if (salidaFecha > ahoraFecha || (salidaFecha === ahoraFecha && salidaMin > ahoraMin)) {
          const fechaStr = salidaFecha.split('-').reverse().join('/') + ' ' + salidaHora;
          return bad(res, `No se puede liquidar antes de la salida planificada (${fechaStr})`, 409);
        }
      }

      const rows = await q(
        `SELECT * FROM bpkm.post_liquidar_detalle_ruta($1,$2,$3,$4,$5,$6,$7)`,
        [
          toInt(id_detalle_ruta),
          toStrOrNull(estado_codigo),
          toStrOrNull(motivo_fallo),
          toStrOrNull(observaciones),
          toBool(puede_reenviar, true),  // FIX: Maneja correctamente false, 'false', '0', etc.
          toDateOrNull(fecha_hora_intento),
          toInt(usuario)
        ]
      );
      return ok(res, rows?.[0] || {});
    } catch (e) {
      return bad(res, e.message);
    }
  });

  // Recalcular monto total
  router.post(
    '/put_ruta_recalcular_monto',
    requireAuth, requireModuloPermission('rutasbpkm'), apiLimiter, validateContentType, sanitizeInput,
    async (req, res) => {
    try {
      const { id_ruta } = req.body || {};
      const usuario = getUserId(req);
      if (!toInt(id_ruta)) return bad(res, 'id_ruta requerido');
      const rows = await q(
        `SELECT * FROM bpkm.put_ruta_recalcular_monto($1,$2)`,
        [toInt(id_ruta), toInt(usuario) || 0]
      );
      return ok(res, rows?.[0] || {});
    } catch (e) {
      return bad(res, e.message);
    }
  });

  // Finalizar ruta
  router.post(
    '/put_ruta_finalizar',
    requireAuth, requireModuloPermission('rutasbpkm'), apiLimiter, validateContentType, sanitizeInput,
    async (req, res) => {
    try {
      const { id_ruta } = req.body || {};
      const usuario = getUserId(req);
      if (!toInt(id_ruta)) return bad(res, 'id_ruta requerido');
      const rows = await q(
        `SELECT * FROM bpkm.put_ruta_finalizar($1,$2)`,
        [toInt(id_ruta), toInt(usuario) || 0]
      );
      return ok(res, rows?.[0] || {});
    } catch (e) {
      return bad(res, e.message);
    }
  });

  // Actualizar piloto/auxiliar de ruta
  router.post(
    '/put_ruta_actualizar_personal',
    requireAuth, requireModuloPermission('rutasbpkm'), apiLimiter, validateContentType, sanitizeInput,
    async (req, res) => {
    try {
      const { id_ruta, id_piloto, id_auxiliar } = req.body || {};
      const usuario = getUserId(req);
      if (!toInt(id_ruta)) return bad(res, 'id_ruta requerido');

      // Validar permiso: modificar rutas
      const hasPerm = await checkBPKMPerm(usuario, 'bpkm.rutas.edit', 'editor');
      if (!hasPerm) {
        return bad(res, 'No tiene permiso para modificar rutas. Contacte al administrador.');
      }

      // Al menos uno debe estar presente
      if (!toInt(id_piloto) && !toInt(id_auxiliar)) {
        return bad(res, 'Debe proporcionar al menos un piloto o auxiliar');
      }

      await q(
        `SELECT bpkm.put_ruta_actualizar_personal($1,$2,$3,$4)`,
        [toInt(id_ruta), toInt(id_piloto) || null, toInt(id_auxiliar) || null, toInt(usuario) || 0]
      );
      return ok(res, { success: true });
    } catch (e) {
      return bad(res, e.message);
    }
  });

  // Guardar productos de entrega parcial
  router.post(
    '/post_productos_entrega_parcial',
    requireAuth, requireModuloPermission('rutasbpkm'), apiLimiter, validateContentType, sanitizeInput,
    async (req, res) => {
    try {
      const { id_liquidacion, productos } = req.body || {};
      const usuario = getUserId(req);
      if (!toInt(id_liquidacion)) return bad(res, 'id_liquidacion requerido');
      if (!Array.isArray(productos) || productos.length === 0) return bad(res, 'productos requerido (array)');
      if (!toInt(usuario)) return bad(res, 'usuario requerido');

      const rows = await q(
        `SELECT * FROM bpkm.post_productos_entrega_parcial($1,$2,$3)`,
        [toInt(id_liquidacion), JSON.stringify(productos), toInt(usuario)]
      );
      return ok(res, rows?.[0] || {});
    } catch (e) {
      return bad(res, e.message);
    }
  });

  // Obtener productos de entrega parcial
  router.post('/get_productos_entrega_parcial', requireAuth, requireModuloPermission('rutasbpkm'), apiLimiter, async (req, res) => {
    try {
      const { id_liquidacion } = req.body || {};
      if (!toInt(id_liquidacion)) return bad(res, 'id_liquidacion requerido');

      const rows = await q(
        `SELECT * FROM bpkm.get_productos_entrega_parcial($1)`,
        [toInt(id_liquidacion)]
      );
      return ok(res, rows || []);
    } catch (e) {
      return bad(res, e.message);
    }
  });

  // Obtener datos completos para PDF
  router.post('/get_ruta_pdf', requireAuth, requireModuloPermission('rutasbpkm'), apiLimiter, async (req, res) => {
    try {
      const { id_ruta } = req.body || {};
      if (!toInt(id_ruta)) return bad(res, 'id_ruta requerido');

      const rows = await q(
        `SELECT * FROM bpkm.get_ruta_completa_pdf($1)`,
        [toInt(id_ruta)]
      );

      return ok(res, rows?.[0] || {});
    } catch (e) {
      return bad(res, e.message);
    }
  });

  // Bandeja rutas
  router.post('/get_rutas', requireAuth, requireModuloPermission('rutasbpkm'), apiLimiter, rutaController.getRutasBandeja);

  // Detalles por ruta (para liquidación)
  router.post('/get_ruta_para_liquidar', requireAuth, requireModuloPermission('rutasbpkm'), apiLimiter, async (req, res) => {
    try {
      const { id_ruta } = req.body || {};
      if (!toInt(id_ruta)) return bad(res, 'id_ruta requerido');
      const rows = await q(
        `SELECT * FROM bpkm.get_ruta_para_liquidar($1)`,
        [toInt(id_ruta)]
      );
      return ok(res, rows);
    } catch (e) {
      return bad(res, e.message);
    }
  });

  // Detalles por ruta (genérico)
  router.post('/get_detalles_por_ruta', requireAuth, requireModuloPermission('rutasbpkm'), apiLimiter, async (req, res) => {
    try {
      const { id_ruta } = req.body || {};
      if (!toInt(id_ruta)) return bad(res, 'id_ruta requerido');
      const rows = await q(
        `SELECT * FROM bpkm.get_detalles_por_ruta($1)`,
        [toInt(id_ruta)]
      );
      return ok(res, rows);
    } catch (e) {
      return bad(res, e.message);
    }
  });

  // Detalles por ruta para GERENCIA (con dirección completa y más info)
  router.post('/get_detalles_por_ruta_gerencia', requireAuth, requireAnyModuloPermission(['gerenciabpkm', 'localesbpkm', 'rrhhbpkm']), apiLimiter, async (req, res) => {
    try {
      const { id_ruta } = req.body || {};
      if (!toInt(id_ruta)) return bad(res, 'id_ruta requerido');
      const rows = await q(
        `SELECT
           d.*,
           ep.latitud,
           ep.longitud,
           dist.distancia_km AS dist_calculada_km,
           dist.estado_calculo AS distancia_estado_calculo
         FROM bpkm.get_detalles_por_ruta_gerencia($1) d
         LEFT JOIN bpkm.tbl_entregas_piloto ep ON ep.id_detalle_ruta = d.id_detalle_ruta
         LEFT JOIN bpkm.tbl_distancias_ruta dist ON dist.id_detalle_ruta = d.id_detalle_ruta`,
        [toInt(id_ruta)]
      );

      const formateadas = (rows || []).map((r) => {
        const distanciaVal = r.distancia_estado_calculo === 'ERROR'
          ? null
          : (r.dist_calculada_km != null ? r.dist_calculada_km : r.distancia_km);

        return {
          id_detalle_ruta: r.id_detalle_ruta,
          folio: r.folio_factura || null,
          latitud: r.latitud != null ? Number(r.latitud) : null,
          longitud: r.longitud != null ? Number(r.longitud) : null,
          distancia: distanciaVal != null ? (isNaN(Number(distanciaVal)) ? distanciaVal : Number(distanciaVal)) : null,
          id_factura: r.id_factura,
          id_factura_sel: r.id_factura_sel,
          folio_factura: r.folio_factura,
          forma_entrega: r.forma_entrega,
          municipio: r.municipio,
          ciudad: r.ciudad,
          direccion_snap: r.direccion_snap,
          direccion_entrega: r.direccion_entrega,
          direccion_completa: r.direccion_completa,
          distancia_km: distanciaVal != null ? String(distanciaVal) : null,
          intento_numero: r.intento_numero,
          intentos_envio: r.intentos_envio,
          estado_liquidacion: r.estado_liquidacion,
          estado_codigo: r.estado_codigo,
          fecha_liquidacion: r.fecha_liquidacion,
          total_factura: r.total_factura,
          comentario_rutero: r.comentario_rutero,
          nombre_transporte_externo: r.nombre_transporte_externo,
          distancia_estado_calculo: r.distancia_estado_calculo || null
        };
      });

      return ok(res, formateadas);
    } catch (e) {
      return bad(res, e.message);
    }
  });

  // GET /api/bpkm/rutas/:id/destinos - Desglose de montos por departamento y municipio para una ruta
  router.get('/rutas/:id/destinos', requireAuth, validateId, requireAnyModuloPermission(['localesbpkm', 'gerenciabpkm']), apiLimiter, async (req, res) => {
    try {
      const id_ruta = toInt(req.params.id);
      if (!id_ruta) return bad(res, 'id_ruta requerido y debe ser un número entero');

      const rows = await q(
        `SELECT * FROM bpkm.get_destinos_por_ruta($1)`,
        [id_ruta]
      );
      return ok(res, rows || []);
    } catch (e) {
      return bad(res, e.message);
    }
  });

  // Agregar comentario a ruta
  router.post(
    '/post_comentario_ruta',
    requireAuth, requireModuloPermission('rutasbpkm'), apiLimiter, validateContentType, sanitizeInput, validateComentarioRuta,
    async (req, res) => {
    try {
      const { id_ruta, comentario } = req.body || {};
      const usuario = getUserId(req);
      if (!toInt(id_ruta)) return bad(res, 'id_ruta requerido');
      if (!comentario || !comentario.trim()) return bad(res, 'comentario requerido');
      if (!toInt(usuario)) return bad(res, 'usuario requerido');

      // Validar permiso: comentar rutas
      const hasPerm = await checkBPKMPerm(usuario, 'bpkm.rutas.comentar', 'editor');
      if (!hasPerm) {
        return bad(res, 'No tiene permiso para comentar en rutas. Contacte al administrador.');
      }

      const rows = await q(
        `SELECT * FROM bpkm.post_comentario_ruta($1, $2, $3)`,
        [toInt(id_ruta), comentario.trim(), toInt(usuario)]
      );
      return ok(res, rows?.[0] || {});
    } catch (e) {
      return bad(res, e.message);
    }
  });

  // Obtener comentarios de una ruta
  router.post('/get_comentarios_ruta', requireAuth, requireAnyModuloPermission(['rutasbpkm', 'gerenciabpkm', 'localesbpkm']), apiLimiter, async (req, res) => {
    try {
      const { id_ruta } = req.body || {};
      if (!toInt(id_ruta)) return bad(res, 'id_ruta requerido');

      const rows = await q(
        `SELECT * FROM bpkm.get_comentarios_ruta($1)`,
        [toInt(id_ruta)]
      );
      return ok(res, rows || []);
    } catch (e) {
      return bad(res, e.message);
    }
  });

  return router;
};
