const pool = require('../../config/database');
const { formatFecha } = require('../../utils/dateUtils');

const RESULTADOS_VALIDOS = new Set(['ENT', 'PARC', 'FALL']);

class Entrega {
  static validarCrear({ factura, resultado, latitud, longitud, precisionMetros, motivo }) {
    if (!factura || typeof factura !== 'string') return 'La factura es requerida';
    if (!resultado || !RESULTADOS_VALIDOS.has(resultado)) {
      return 'resultado debe ser ENT, PARC o FALL';
    }
    if ((resultado === 'PARC' || resultado === 'FALL') && (!motivo || !String(motivo).trim())) {
      return 'motivo es requerido cuando el resultado es parcial o fallido';
    }
    if (motivo !== undefined && motivo !== null && String(motivo).length > 500) {
      return 'motivo no puede exceder 500 caracteres';
    }
    if (latitud === undefined || latitud === null || latitud === '') return 'latitud es requerida';
    if (longitud === undefined || longitud === null || longitud === '') return 'longitud es requerida';
    const lat = Number(latitud);
    const lng = Number(longitud);
    if (Number.isNaN(lat) || Number.isNaN(lng)) {
      return 'latitud/longitud deben ser numéricas';
    }
    if (lat < -90 || lat > 90) return 'latitud fuera de rango (-90 a 90)';
    if (lng < -180 || lng > 180) return 'longitud fuera de rango (-180 a 180)';
    // (0,0) es el valor de respaldo típico cuando falla la geolocalización (ej. contexto no
    // seguro, HTTP en vez de HTTPS) — nunca una ubicación real de entrega.
    if (lat === 0 && lng === 0) return 'latitud/longitud no pueden ser (0,0) — geolocalización inválida';
    if (precisionMetros !== undefined) {
      const prec = Number(precisionMetros);
      if (Number.isNaN(prec) || prec < 0) return 'precision_metros debe ser numérico y no negativo';
      if (prec > 1000) return 'precision_metros demasiado impreciso (máx. 1000m) — geolocalización no confiable';
    }
    return null;
  }

  /**
   * Rutas activas (EN_CURSO) asignadas a este piloto. Puede ser más de una.
   * Nunca monto_total ni monto_total_transportado.
   */
  static async listarRutasActivas(idPersonal) {
    const { rows } = await pool.query(
      `SELECT r.uuid, r.numero_ruta, s.nombre AS sucursal_salida,
              r.fecha_salida_plan, r.fecha_entrada_plan,
              p.nombre AS piloto_nombre, a.nombre AS auxiliar_nombre, c.placa AS placa_camion
       FROM bpkm.tbl_rutas r
       JOIN bpkm.tbl_estado_bpkm e ON e.id_estado_bpkm = r.id_estado_ruta
       LEFT JOIN usuarios.tbl_sucursales s ON s.id_sucursal = r.id_sucursal_salida
       LEFT JOIN bpkm.tbl_personal p ON p.id_personal = r.id_piloto
       LEFT JOIN bpkm.tbl_personal a ON a.id_personal = r.id_auxiliar
       LEFT JOIN bpkm.tbl_camiones c ON c.id_camion = r.id_camion
       WHERE r.id_piloto = $1 AND e.tabla = 'RUTA' AND e.codigo = 'EN_CURSO'
       ORDER BY r.fecha_salida_plan ASC NULLS LAST`,
      [idPersonal]
    );
    return rows.map(Entrega._formatRuta);
  }

  /**
   * Detalle de una ruta (facturas de la ruta + resultado ya marcado, si existe).
   * Verifica que la ruta pertenece a este piloto — null si no.
   * estadoFiltro: 'pendiente' | 'registrado' | undefined (todas).
   */
  static async detalleRuta(uuidRuta, idPersonal, estadoFiltro) {
    const { rows: rutaRows } = await pool.query(
      `SELECT r.uuid, r.numero_ruta, s.nombre AS sucursal_salida,
              r.fecha_salida_plan, r.fecha_entrada_plan,
              p.nombre AS piloto_nombre, a.nombre AS auxiliar_nombre, c.placa AS placa_camion
       FROM bpkm.tbl_rutas r
       JOIN bpkm.tbl_estado_bpkm e ON e.id_estado_bpkm = r.id_estado_ruta
       LEFT JOIN usuarios.tbl_sucursales s ON s.id_sucursal = r.id_sucursal_salida
       LEFT JOIN bpkm.tbl_personal p ON p.id_personal = r.id_piloto
       LEFT JOIN bpkm.tbl_personal a ON a.id_personal = r.id_auxiliar
       LEFT JOIN bpkm.tbl_camiones c ON c.id_camion = r.id_camion
       WHERE r.uuid = $1 AND r.id_piloto = $2 AND e.tabla = 'RUTA' AND e.codigo = 'EN_CURSO'
       LIMIT 1`,
      [uuidRuta, idPersonal]
    );
    const rutaRow = rutaRows[0];
    if (!rutaRow) return null;

    const filtroSql =
      estadoFiltro === 'pendiente' ? 'AND ent.resultado IS NULL' :
      estadoFiltro === 'registrado' ? 'AND ent.resultado IS NOT NULL' :
      '';

    const { rows: facturaRows } = await pool.query(
      `SELECT dr.uuid,
              COALESCE(dr.direccion_snap, dr.direccion) AS direccion,
              dr.folio_factura,
              ent.resultado,
              ent.fecha_hora AS resultado_fecha,
              ent.motivo,
              ent.evidencias
       FROM bpkm.tbl_detalles_ruta dr
       JOIN bpkm.tbl_rutas r ON r.id_ruta = dr.id_ruta
       LEFT JOIN bpkm.tbl_estado_bpkm eDet ON eDet.id_estado_bpkm = dr.id_estado
       LEFT JOIN LATERAL (
         SELECT ep.resultado, ep.fecha_hora, ep.motivo,
                (SELECT COALESCE(json_agg(ev.uuid ORDER BY ev.id_evidencia), '[]'::json)
                 FROM bpkm.tbl_evidencia_entrega ev
                 WHERE ev.id_entrega_piloto = ep.id_entrega_piloto) AS evidencias
         FROM bpkm.tbl_entregas_piloto ep
         WHERE ep.id_detalle_ruta = dr.id_detalle_ruta
         LIMIT 1
       ) ent ON true
       WHERE r.uuid = $1 AND r.id_piloto = $2
         AND (eDet.codigo IS NULL OR eDet.codigo != 'ANULADO')
         ${filtroSql}
       ORDER BY dr.id_detalle_ruta ASC`,
      [uuidRuta, idPersonal]
    );

    return {
      ...Entrega._formatRuta(rutaRow),
      facturas: facturaRows.map(Entrega._formatFactura),
    };
  }

  /**
   * Crea el resultado de una factura de la ruta (con su geolocalización) + una evidencia
   * por foto, en una transacción.
   * Verifica que la factura pertenece a una ruta de este piloto antes de insertar.
   */
  static async crear({ facturaUuid, resultado, latitud, longitud, precisionMetros, motivo, rutasArchivo }, idUsuario, idPersonal) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const { rows: facturaRows } = await client.query(
        `SELECT dr.id_detalle_ruta, r.id_ruta
         FROM bpkm.tbl_detalles_ruta dr
         JOIN bpkm.tbl_rutas r ON r.id_ruta = dr.id_ruta
         JOIN bpkm.tbl_estado_bpkm eRuta ON eRuta.id_estado_bpkm = r.id_estado_ruta
         LEFT JOIN bpkm.tbl_estado_bpkm eDet ON eDet.id_estado_bpkm = dr.id_estado
         WHERE dr.uuid = $1 AND r.id_piloto = $2
           AND eRuta.tabla = 'RUTA' AND eRuta.codigo = 'EN_CURSO'
           AND (eDet.codigo IS NULL OR eDet.codigo != 'ANULADO')
         LIMIT 1
         FOR UPDATE OF dr`,
        [facturaUuid, idPersonal]
      );
      const factura = facturaRows[0];
      if (!factura) {
        await client.query('ROLLBACK');
        return { error: true, status: 404, message: 'Factura no disponible para registrar entrega' };
      }

      const { rows: existentes } = await client.query(
        `SELECT 1 FROM bpkm.tbl_entregas_piloto WHERE id_detalle_ruta = $1 LIMIT 1`,
        [factura.id_detalle_ruta]
      );
      if (existentes.length > 0) {
        await client.query('ROLLBACK');
        return { error: true, status: 409, message: 'Ya se registró una entrega para esta factura' };
      }

      const { rows: entregaRows } = await client.query(
        `INSERT INTO bpkm.tbl_entregas_piloto
           (id_detalle_ruta, resultado, motivo, latitud, longitud, precision_metros,
            id_usuario, fecha_hora, creado_por)
         VALUES ($1, $2, $3, $4, $5, $6, $7, now(), $7)
         RETURNING id_entrega_piloto, uuid`,
        [factura.id_detalle_ruta, resultado, motivo || null, latitud, longitud, precisionMetros ?? null, idUsuario]
      );
      const { id_entrega_piloto: idEntregaPiloto, uuid: entregaUuid } = entregaRows[0];

      // En orden: id_evidencia define el orden en que GET /:uuid devuelve las fotos.
      const evidenciaUuids = [];
      for (const rutaArchivo of rutasArchivo) {
        const { rows: fotoRows } = await client.query(
          `INSERT INTO bpkm.tbl_evidencia_entrega
             (id_entrega_piloto, ruta_archivo, fecha_captura, creado_por)
           VALUES ($1, $2, now(), $3)
           RETURNING uuid`,
          [idEntregaPiloto, rutaArchivo, idUsuario]
        );
        evidenciaUuids.push(fotoRows[0].uuid);
      }

      await client.query('COMMIT');
      return { error: false, entregaUuid, evidenciaUuids, idRuta: factura.id_ruta };
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  /**
   * Ruta del archivo en disco para una evidencia, verificando que pertenece
   * a una entrega hecha por este usuario (ownership check, no por idPersonal
   * — tbl_entregas_piloto.id_usuario ya es el usuario logueado).
   */
  static async buscarRutaArchivo(uuidEvidencia, idUsuario) {
    const { rows } = await pool.query(
      `SELECT ev.ruta_archivo
       FROM bpkm.tbl_evidencia_entrega ev
       JOIN bpkm.tbl_entregas_piloto en ON en.id_entrega_piloto = ev.id_entrega_piloto
       WHERE ev.uuid = $1 AND en.id_usuario = $2
       LIMIT 1`,
      [uuidEvidencia, idUsuario]
    );
    return rows[0]?.ruta_archivo || null;
  }

  static _formatRuta(row) {
    return {
      uuid: row.uuid,
      numero_ruta: row.numero_ruta,
      sucursal_salida: row.sucursal_salida,
      piloto: row.piloto_nombre,
      auxiliar: row.auxiliar_nombre || null,
      placa_camion: row.placa_camion,
      fecha_salida_plan: formatFecha(row.fecha_salida_plan),
      fecha_entrada_plan: formatFecha(row.fecha_entrada_plan),
    };
  }

  static _formatFactura(row) {
    return {
      uuid: row.uuid,
      direccion: row.direccion,
      folio_factura: row.folio_factura,
      resultado: row.resultado || null,
      resultado_fecha: row.resultado_fecha ? formatFecha(row.resultado_fecha) : null,
      motivo: row.motivo || null,
      // null si la factura todavía no tiene entrega
      evidencias: Array.isArray(row.evidencias) ? row.evidencias : [],
    };
  }
}

module.exports = Entrega;
