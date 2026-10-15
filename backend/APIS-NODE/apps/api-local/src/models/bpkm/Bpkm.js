const FROM_JOINS = `
  FROM bpkm.tbl_bpkm b
  JOIN bpkm.tbl_rutas r ON r.id_ruta = b.id_ruta
  LEFT JOIN bpkm.tbl_estado_bpkm e ON e.id_estado_bpkm = b.id_estado_bpkm
  LEFT JOIN catalogos.tbl_municipios m ON m.id_municipio = b.id_municipio_lejano
  LEFT JOIN bpkm.tbl_personal p ON p.id_personal = r.id_piloto
  LEFT JOIN bpkm.tbl_personal a ON a.id_personal = r.id_auxiliar
  LEFT JOIN bpkm.tbl_camiones c ON c.id_camion = r.id_camion
  LEFT JOIN bpkm.tbl_detalles_ruta dr ON dr.id_ruta = r.id_ruta
  LEFT JOIN bpkm.tbl_distancias_ruta dr_dist ON dr_dist.id_detalle_ruta = dr.id_detalle_ruta AND dr_dist.estado_calculo = 'OK'
  LEFT JOIN usuarios.tbl_sucursales s ON s.id_sucursal = r.id_sucursal_salida
  LEFT JOIN catalogos.tbl_ciudades tc ON tc.id_ciudad = m.id_ciudad
  LEFT JOIN LATERAL (
    SELECT fecha_hora FROM bpkm.tbl_monitoreo_bpkm
    WHERE id_ruta = r.id_ruta AND tipo = 'S'
    ORDER BY fecha_hora DESC LIMIT 1
  ) mon_salida ON true
  LEFT JOIN LATERAL (
    SELECT fecha_hora FROM bpkm.tbl_monitoreo_bpkm
    WHERE id_ruta = r.id_ruta AND tipo = 'E'
    ORDER BY fecha_hora DESC LIMIT 1
  ) mon_entrada ON true
`;

const SELECT_COLUMNAS = `
  SELECT
    b.id_bpkm,
    r.numero_ruta AS codigo_ruta,
    e.nombre AS estado_nombre,
    e.codigo AS estado_codigo,
    b.distancia_mas_lejana,
    b.distancia_anterior,
    MAX(dr_dist.distancia_km) AS distancia_mas_lejana_gmaps,
    m.nombre AS municipio_lejano,
    b.monto_total_transportado,
    b.monto_sugerido_piloto,
    b.monto_aprobado_piloto,
    p.nombre AS nombre_piloto,
    a.nombre AS nombre_auxiliar,
    c.placa AS placa_camion,
    COUNT(dr.id_detalle_ruta) AS total_facturas,
    r.tipo_ruta,
    r.fecha_salida_plan AS fecha_creacion,
    b.fecha_aprobacion,
    b.fecha_rrhh,
    CASE
      WHEN r.fecha_salida_plan IS NULL OR r.fecha_entrada_plan IS NULL THEN NULL
      WHEN mon_salida.fecha_hora IS NULL OR mon_entrada.fecha_hora IS NULL THEN NULL
      WHEN (EXTRACT(EPOCH FROM (mon_salida.fecha_hora - r.fecha_salida_plan)) / 60)::INTEGER BETWEEN -15 AND 15 THEN TRUE
      ELSE FALSE
    END AS ruta_cumplida,
    b.cumplimiento,
    s.nombre AS sucursal_salida,
    b.monto_aprobado_auxiliar,
    tc.nombre AS departamento,
    CASE
      WHEN r.fecha_entrada_plan IS NULL THEN NULL
      WHEN mon_entrada.fecha_hora IS NULL THEN NULL
      WHEN (EXTRACT(EPOCH FROM (mon_entrada.fecha_hora - r.fecha_entrada_plan)) / 60)::INTEGER BETWEEN -15 AND 15 THEN TRUE
      ELSE FALSE
    END AS cumplimiento_regreso,
    CASE
      WHEN b.monto_total_transportado IS NULL OR b.monto_total_transportado = 0 THEN 0.00
      ELSE (
        (SELECT COALESCE(SUM(tcf.doc_total), 0)
         FROM bpkm.tbl_detalles_ruta tdr
         LEFT JOIN bpkm.tbl_estado_bpkm teb ON tdr.id_estado = teb.id_estado_bpkm
         LEFT JOIN bpkm.tbl_factura_seleccion tfs ON tdr.id_factura_sel = tfs.id_factura_sel
         LEFT JOIN ndc.tbl_cat_facturas tcf ON tfs.id_factura = tcf.id
         WHERE tdr.id_ruta = r.id_ruta AND teb.codigo IN ('ENT', 'PARC')
        ) / b.monto_total_transportado * 100
      )
    END AS porcentaje_entrega
`;

const GROUP_BY = `
  GROUP BY b.id_bpkm, r.numero_ruta, e.nombre, e.codigo, b.distancia_mas_lejana,
           b.distancia_anterior, m.nombre, b.monto_total_transportado, b.monto_sugerido_piloto,
           b.monto_aprobado_piloto, p.nombre, a.nombre, c.placa, r.tipo_ruta,
           b.fecha_aprobacion, b.fecha_rrhh, r.fecha_salida_plan,
           r.fecha_entrada_plan, mon_salida.fecha_hora, mon_entrada.fecha_hora,
           b.cumplimiento, s.nombre, b.monto_aprobado_auxiliar, tc.nombre, r.id_ruta
`;

const LIMITE_EXPORTACION = 5000;

function clampLimit(limit, def = 25) {
  const n = parseInt(limit, 10);
  if (!Number.isFinite(n)) return def;
  return Math.min(100, Math.max(10, n));
}

function clampPage(page) {
  const n = parseInt(page, 10);
  return Number.isFinite(n) && n > 0 ? n : 1;
}

class Bpkm {
  // Sucursal de SALIDA de cada ruta, no la actual del camión: los camiones cambian de sucursal con el tiempo.
  static async listarCamionesFiltro(pool) {
    const { rows } = await pool.query(
      `SELECT DISTINCT
         tr.id_camion,
         tc.placa,
         tr.id_sucursal_salida AS id_sucursal,
         ts.nombre AS sucursal
       FROM bpkm.tbl_rutas tr
       JOIN bpkm.tbl_bpkm tb ON tb.id_ruta = tr.id_ruta
       JOIN bpkm.tbl_camiones tc ON tc.id_camion = tr.id_camion
       JOIN usuarios.tbl_sucursales ts ON ts.id_sucursal = tr.id_sucursal_salida
       ORDER BY tc.placa, ts.nombre`
    );
    return rows;
  }

  static async updateDistanciaLejana({ idBpkm, distancia, usuario }, pool) {
    const { rows } = await pool.query(
      `SELECT * FROM bpkm.patch_bpkm_distancia_lejana($1, $2, $3)`,
      [idBpkm, distancia, usuario]
    );

    const result = rows?.[0];
    if (!result?.ok) {
      return { ok: false, error: result?.mensaje || 'No se pudo actualizar la distancia' };
    }

    return { ok: true, mensaje: result.mensaje };
  }

  static async listarBandeja(filters = {}, pool) {
    const {
      estado_codigo = null,
      estado_excluido = null,
      fecha_desde = null,
      fecha_hasta = null,
      id_sucursal = 0,
      id_camion = 0,
      folio_factura = null,
      page = 1,
      limit = 25,
      exportar = false
    } = filters;

    const condicionesComunes = [
      `($1::date IS NULL OR r.fecha_salida_plan::date >= $1::date)`,
      `($2::date IS NULL OR r.fecha_salida_plan::date <= $2::date)`,
      `($3::int = 0 OR r.id_sucursal_salida = $3::int)`,
      `($4::int = 0 OR r.id_camion = $4::int)`,
      `($5::varchar IS NULL OR $5::varchar = '' OR EXISTS (
         SELECT 1 FROM bpkm.tbl_detalles_ruta dr2
         WHERE dr2.id_ruta = r.id_ruta AND dr2.folio_factura ILIKE '%' || $5::varchar || '%'
       ))`
    ];
    const valoresComunes = [
      fecha_desde || null,
      fecha_hasta || null,
      parseInt(id_sucursal, 10) || 0,
      parseInt(id_camion, 10) || 0,
      folio_factura || null
    ];

    const estadoNormalizado = (estado_codigo || '').trim().toUpperCase() || null;
    const estadoExcluidoNormalizado = (estado_excluido || '').trim().toUpperCase() || null;
    const condicionesLista = [
      ...condicionesComunes,
      `($6::varchar IS NULL OR e.codigo = $6::varchar)`,
      `($7::varchar IS NULL OR e.codigo IS DISTINCT FROM $7::varchar)`
    ];
    const valoresLista = [...valoresComunes, estadoNormalizado, estadoExcluidoNormalizado];

    const whereLista = `WHERE ${condicionesLista.join(' AND ')}`;
    const whereComun = `WHERE ${condicionesComunes.join(' AND ')}`;

    const limitNum = exportar ? LIMITE_EXPORTACION : clampLimit(limit);
    const pageNum = exportar ? 1 : clampPage(page);
    const offset = exportar ? 0 : (pageNum - 1) * limitNum;

    const ordenPend = estadoNormalizado === 'PEND';
    const orderBy = ordenPend
      ? `ORDER BY r.fecha_salida_plan ASC NULLS LAST`
      : `ORDER BY r.fecha_salida_plan DESC NULLS LAST`;

    const sqlBase = `${SELECT_COLUMNAS} ${FROM_JOINS} ${whereLista} ${GROUP_BY}`;

    const [itemsResult, totalResult, resumenResult] = await Promise.all([
      pool.query(
        `${sqlBase} ${orderBy} LIMIT $${valoresLista.length + 1} OFFSET $${valoresLista.length + 2}`,
        [...valoresLista, limitNum, offset]
      ),
      pool.query(`SELECT COUNT(*) AS total FROM (${sqlBase}) sub`, valoresLista),
      pool.query(
        `SELECT e.codigo, COUNT(DISTINCT b.id_bpkm) AS conteo
         FROM bpkm.tbl_bpkm b
         JOIN bpkm.tbl_rutas r ON r.id_ruta = b.id_ruta
         LEFT JOIN bpkm.tbl_estado_bpkm e ON e.id_estado_bpkm = b.id_estado_bpkm
         ${whereComun} AND e.codigo IN ('PEND', 'APR')
         GROUP BY e.codigo`,
        valoresComunes
      )
    ]);

    const porEstado = { PEND: 0, APR: 0 };
    for (const row of resumenResult.rows) {
      if (row.codigo === 'PEND' || row.codigo === 'APR') porEstado[row.codigo] = parseInt(row.conteo, 10);
    }

    return {
      items: itemsResult.rows,
      total: parseInt(totalResult.rows[0].total, 10),
      page: pageNum,
      limit: limitNum,
      resumen: { por_estado: porEstado }
    };
  }

  static async getBpkm(filters = {}, pool) {
    const {
      estado_distancia = '',
      codigo_ruta = '',
      fecha_desde = null,
      fecha_hasta = null,
      id_sucursal = 0,
      id_camion = 0,
      page = 1,
      limit = 25
    } = filters;

    const estadoDistNormalizado = (estado_distancia || '').trim().toUpperCase();
    const filtroEstadoDist = estadoDistNormalizado === 'INGRESADO' ? 'INGRESADO'
      : estadoDistNormalizado === 'PENDIENTE' ? 'PENDIENTE'
      : null;

    const condicionesComunes = [
      `($1::date IS NULL OR r.fecha_salida_plan::date >= $1::date)`,
      `($2::date IS NULL OR r.fecha_salida_plan::date <= $2::date)`,
      `($3::int = 0 OR r.id_sucursal_salida = $3::int)`,
      `($4::int = 0 OR r.id_camion = $4::int)`,
      `($5::varchar IS NULL OR $5::varchar = '' OR r.numero_ruta ILIKE '%' || $5::varchar || '%')`
    ];
    const valoresComunes = [
      fecha_desde || null,
      fecha_hasta || null,
      parseInt(id_sucursal, 10) || 0,
      parseInt(id_camion, 10) || 0,
      codigo_ruta || null
    ];

    const condicionesLista = [...condicionesComunes];
    const valoresLista = [...valoresComunes];
    if (filtroEstadoDist === 'INGRESADO') {
      condicionesLista.push(`b.distancia_anterior IS NOT NULL`);
    } else if (filtroEstadoDist === 'PENDIENTE') {
      condicionesLista.push(`b.distancia_anterior IS NULL`);
    }

    const whereLista = `WHERE ${condicionesLista.join(' AND ')}`;
    const whereComun = `WHERE ${condicionesComunes.join(' AND ')}`;

    const limitNum = clampLimit(limit);
    const pageNum = clampPage(page);
    const offset = (pageNum - 1) * limitNum;

    const sqlBase = `${SELECT_COLUMNAS} ${FROM_JOINS} ${whereLista} ${GROUP_BY}`;

    const [itemsResult, totalResult, pendientesResult] = await Promise.all([
      pool.query(
        `${sqlBase} ORDER BY r.fecha_salida_plan DESC NULLS LAST LIMIT $${valoresLista.length + 1} OFFSET $${valoresLista.length + 2}`,
        [...valoresLista, limitNum, offset]
      ),
      pool.query(`SELECT COUNT(*) AS total FROM (${sqlBase}) sub`, valoresLista),
      pool.query(
        `SELECT COUNT(*) AS total FROM (
           ${SELECT_COLUMNAS} ${FROM_JOINS} ${whereComun} AND b.distancia_anterior IS NULL ${GROUP_BY}
         ) sub`,
        valoresComunes
      )
    ]);

    const items = itemsResult.rows.map((r) => ({
      id_bpkm: r.id_bpkm,
      codigo_ruta: r.codigo_ruta,
      sucursal_salida: r.sucursal_salida,
      distancia_mas_lejana: r.distancia_mas_lejana,
      distancia_anterior: r.distancia_anterior,
      distancia_mas_lejana_gmaps: r.distancia_mas_lejana_gmaps ?? null,
      estado_distancia: r.distancia_anterior !== null && r.distancia_anterior !== undefined ? 'INGRESADO' : 'PENDIENTE',
      nombre_piloto: r.nombre_piloto,
      nombre_auxiliar: r.nombre_auxiliar,
      placa_camion: r.placa_camion,
      fecha_creacion: r.fecha_creacion
    }));

    const total = parseInt(totalResult.rows[0].total, 10);
    return {
      items,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages: Math.ceil(total / limitNum) || 1,
        total_pendientes: parseInt(pendientesResult.rows[0].total, 10)
      }
    };
  }
}

module.exports = Bpkm;
