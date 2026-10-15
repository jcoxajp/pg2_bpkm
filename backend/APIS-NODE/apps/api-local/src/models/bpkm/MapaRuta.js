const ContadorCargasMapa = require('./ContadorCargasMapa');

const SELECT_MAPA_BASE = `
  SELECT 
    r.id_ruta,
    s.id_sucursal AS sucursal_id,
    s.nombre AS sucursal_nombre,
    s.latitud AS sucursal_latitud,
    s.longitud AS sucursal_longitud,
    dr.id_detalle_ruta,
    dr.folio_factura,
    ep.latitud AS entrega_latitud,
    ep.longitud AS entrega_longitud,
    ep.precision_metros AS entrega_precision_metros,
    ep.fecha_hora AS entrega_fecha_hora,
    ep.resultado AS entrega_resultado,
    CASE 
      WHEN dist.estado_calculo = 'OK' THEN dist.distancia_km 
      ELSE NULL 
    END AS distancia_km,
    dist.estado_calculo AS distancia_estado_calculo
`;

class MapaRuta {
  /**
   * Obtiene puntos de entrega, distancias y sucursal de salida por id_ruta.
   *
   * @param {object} pool - Pool de conexiones PostgreSQL
   * @param {number} idRuta - ID de la ruta
   * @param {object} [opciones]
   * @param {object} [opciones.contadorModel] - Modelo o doble de prueba para el contador
   * @returns {Promise<{ mapa_habilitado: boolean, sucursal: object | null, puntos: Array }>}
   */
  static async obtenerPorRuta(pool, idRuta, { contadorModel = ContadorCargasMapa } = {}) {
    if (!idRuta || isNaN(Number(idRuta))) {
      return { mapa_habilitado: false, sucursal: null, puntos: [] };
    }

    const sql = `
      ${SELECT_MAPA_BASE}
      FROM bpkm.tbl_rutas r
      LEFT JOIN usuarios.tbl_sucursales s ON s.id_sucursal = r.id_sucursal_salida
      LEFT JOIN bpkm.tbl_detalles_ruta dr ON dr.id_ruta = r.id_ruta
      LEFT JOIN bpkm.tbl_entregas_piloto ep ON ep.id_detalle_ruta = dr.id_detalle_ruta
      LEFT JOIN bpkm.tbl_distancias_ruta dist ON dist.id_detalle_ruta = dr.id_detalle_ruta
      WHERE r.id_ruta = $1
      ORDER BY dr.id_detalle_ruta ASC
    `;

    const { rows } = await pool.query(sql, [Number(idRuta)]);
    return MapaRuta._procesarFilas(pool, rows, contadorModel);
  }

  /**
   * Obtiene puntos de entrega, distancias y sucursal de salida por id_bpkm.
   *
   * @param {object} pool - Pool de conexiones PostgreSQL
   * @param {number} idBpkm - ID del registro BPKM
   * @param {object} [opciones]
   * @param {object} [opciones.contadorModel] - Modelo o doble de prueba para el contador
   * @returns {Promise<{ mapa_habilitado: boolean, sucursal: object | null, puntos: Array }>}
   */
  static async obtenerPorBpkm(pool, idBpkm, { contadorModel = ContadorCargasMapa } = {}) {
    if (!idBpkm || isNaN(Number(idBpkm))) {
      return { mapa_habilitado: false, sucursal: null, puntos: [] };
    }

    const sql = `
      ${SELECT_MAPA_BASE}
      FROM bpkm.tbl_bpkm b
      JOIN bpkm.tbl_rutas r ON r.id_ruta = b.id_ruta
      LEFT JOIN usuarios.tbl_sucursales s ON s.id_sucursal = r.id_sucursal_salida
      LEFT JOIN bpkm.tbl_detalles_ruta dr ON dr.id_ruta = r.id_ruta
      LEFT JOIN bpkm.tbl_entregas_piloto ep ON ep.id_detalle_ruta = dr.id_detalle_ruta
      LEFT JOIN bpkm.tbl_distancias_ruta dist ON dist.id_detalle_ruta = dr.id_detalle_ruta
      WHERE b.id_bpkm = $1
      ORDER BY dr.id_detalle_ruta ASC
    `;

    const { rows } = await pool.query(sql, [Number(idBpkm)]);
    return MapaRuta._procesarFilas(pool, rows, contadorModel);
  }

  /**
   * Procesa las filas de la consulta, mapea sucursal y entregas, y aplica
   * la verificación de cuota mensual si existen coordenadas a renderizar.
   *
   * @private
   */
  static async _procesarFilas(pool, rows, contadorModel) {
    if (!rows || rows.length === 0) {
      return { mapa_habilitado: false, sucursal: null, puntos: [] };
    }

    const primeraFila = rows[0];
    const sucursal = primeraFila.sucursal_id != null ? {
      id_sucursal: Number(primeraFila.sucursal_id),
      nombre: primeraFila.sucursal_nombre || null,
      latitud: primeraFila.sucursal_latitud != null ? Number(primeraFila.sucursal_latitud) : null,
      longitud: primeraFila.sucursal_longitud != null ? Number(primeraFila.sucursal_longitud) : null,
    } : null;

    const puntos = rows
      .filter((r) => r.id_detalle_ruta != null)
      .map((r) => ({
        id_detalle_ruta: Number(r.id_detalle_ruta),
        folio_factura: r.folio_factura || null,
        latitud: r.entrega_latitud != null ? Number(r.entrega_latitud) : null,
        longitud: r.entrega_longitud != null ? Number(r.entrega_longitud) : null,
        precision_metros: r.entrega_precision_metros != null ? Number(r.entrega_precision_metros) : null,
        fecha_hora: r.entrega_fecha_hora instanceof Date
          ? r.entrega_fecha_hora.toISOString()
          : (r.entrega_fecha_hora || null),
        resultado: r.entrega_resultado || null,
        distancia_km: (r.distancia_estado_calculo === 'OK' && r.distancia_km != null)
          ? Number(r.distancia_km)
          : null,
        estado_calculo: r.distancia_estado_calculo || null
      }));

    // Solo habilitar mapa e incrementar contador si al menos una factura/entrega tiene GPS
    const tieneCoordenadas = Boolean(
      puntos.some((p) => p.latitud != null && p.longitud != null)
    );

    let mapa_habilitado = false;
    if (tieneCoordenadas) {
      const resContador = await contadorModel.incrementarSiHabilitado(pool);
      mapa_habilitado = Boolean(resContador?.habilitado);
    }

    return {
      mapa_habilitado,
      sucursal,
      puntos
    };
  }
}

module.exports = MapaRuta;
