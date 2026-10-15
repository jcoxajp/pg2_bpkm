class Evidencia {
  /**
   * Verifica existencia de la factura y autorización del usuario.
   * @param {object} pool - Pool de conexiones PostgreSQL
   * @param {number} idFacturaSel - ID de selección de factura
   * @param {number} idUsuario - ID del usuario autenticado
   * @returns {Promise<{ existe: boolean, autorizado: boolean, id_factura_sel?: number }>}
   */
  static async verificarAccesoFactura(pool, idFacturaSel, idUsuario) {
    const { rows } = await pool.query(
      `SELECT
        fs.id_factura_sel,
        fs.creado_por,
        tcf.vendedor_id,
        CASE
          WHEN fs.creado_por = $1 THEN true
          WHEN EXISTS (
            SELECT 1
            FROM bpkm.tbl_asignacion_usuario_vendedor a
            JOIN ndc.tbl_cat_vendedores v ON v.id = a.id_vendedor
            WHERE a.id_usuario  = $1
              AND a.id_vendedor = tcf.vendedor_id
              AND a.activo      = true
              AND v.activo      = true
          ) THEN true
          ELSE false
        END AS tiene_acceso
      FROM bpkm.tbl_factura_seleccion fs
      JOIN ndc.tbl_cat_facturas tcf ON tcf.id = fs.id_factura
      WHERE fs.id_factura_sel = $2
      LIMIT 1`,
      [idUsuario, idFacturaSel]
    );

    if (!rows || rows.length === 0) {
      return { existe: false, autorizado: false };
    }

    return {
      existe: true,
      autorizado: Boolean(rows[0].tiene_acceso),
      id_factura_sel: Number(rows[0].id_factura_sel)
    };
  }

  /**
   * Lista evidencias fotográficas asociadas a una factura de selección.
   * @param {object} pool - Pool de conexiones PostgreSQL
   * @param {number} idFacturaSel - ID de selección de factura
   * @returns {Promise<Array<{ id_evidencia: number, resultado: string, fecha: string }>>}
   */
  static async listarPorFacturaSel(pool, idFacturaSel) {
    const { rows } = await pool.query(
      `SELECT
        ee.id_evidencia,
        ep.id_entrega_piloto,
        DENSE_RANK() OVER (ORDER BY ep.id_entrega_piloto ASC) AS intento,
        ep.resultado,
        ep.motivo AS comentario,
        TO_CHAR(ee.fecha_captura, 'YYYY-MM-DD HH24:MI:SS') AS fecha
      FROM bpkm.tbl_detalles_ruta dr
      JOIN bpkm.tbl_entregas_piloto ep
        ON ep.id_detalle_ruta = dr.id_detalle_ruta
      JOIN bpkm.tbl_evidencia_entrega ee
        ON ee.id_entrega_piloto = ep.id_entrega_piloto
      WHERE dr.id_factura_sel = $1
      ORDER BY ee.fecha_captura DESC`,
      [idFacturaSel]
    );

    return (rows || []).map((r) => ({
      id_evidencia: Number(r.id_evidencia),
      id_entrega_piloto: r.id_entrega_piloto ? Number(r.id_entrega_piloto) : null,
      intento: r.intento ? Number(r.intento) : null,
      resultado: r.resultado,
      comentario: r.comentario || null,
      fecha: r.fecha
    }));
  }

  /**
   * Obtiene la evidencia y valida acceso del usuario para streaming de archivo.
   * @param {object} pool - Pool de conexiones PostgreSQL
   * @param {number} idEvidencia - ID de evidencia
   * @param {number} idUsuario - ID del usuario autenticado
   * @returns {Promise<{ id_evidencia: number, ruta_archivo: string, tiene_acceso: boolean } | null>}
   */
  static async buscarParaArchivo(pool, idEvidencia, idUsuario) {
    const { rows } = await pool.query(
      `SELECT
        ee.id_evidencia,
        ee.ruta_archivo,
        fs.id_factura_sel,
        CASE
          WHEN fs.creado_por = $1 THEN true
          WHEN EXISTS (
            SELECT 1
            FROM bpkm.tbl_asignacion_usuario_vendedor a
            JOIN ndc.tbl_cat_vendedores v ON v.id = a.id_vendedor
            WHERE a.id_usuario  = $1
              AND a.id_vendedor = tcf.vendedor_id
              AND a.activo      = true
              AND v.activo      = true
          ) THEN true
          ELSE false
        END AS tiene_acceso
      FROM bpkm.tbl_evidencia_entrega ee
      JOIN bpkm.tbl_entregas_piloto ep
        ON ep.id_entrega_piloto = ee.id_entrega_piloto
      JOIN bpkm.tbl_detalles_ruta dr
        ON dr.id_detalle_ruta = ep.id_detalle_ruta
      JOIN bpkm.tbl_factura_seleccion fs
        ON fs.id_factura_sel = dr.id_factura_sel
      JOIN ndc.tbl_cat_facturas tcf
        ON tcf.id = fs.id_factura
      WHERE ee.id_evidencia = $2
      LIMIT 1`,
      [idUsuario, idEvidencia]
    );

    if (!rows || rows.length === 0) {
      return null;
    }

    return {
      id_evidencia: Number(rows[0].id_evidencia),
      ruta_archivo: rows[0].ruta_archivo,
      tiene_acceso: Boolean(rows[0].tiene_acceso)
    };
  }
}

module.exports = Evidencia;
