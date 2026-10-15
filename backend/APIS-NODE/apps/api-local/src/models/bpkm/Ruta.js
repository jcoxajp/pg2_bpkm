const FROM_JOINS = `
  FROM bpkm.tbl_rutas r
  LEFT JOIN bpkm.tbl_estado_bpkm e ON e.id_estado_bpkm = r.id_estado_ruta
  LEFT JOIN bpkm.tbl_camiones c ON c.id_camion = r.id_camion
  LEFT JOIN bpkm.tbl_personal p ON p.id_personal = r.id_piloto
  LEFT JOIN bpkm.tbl_personal a ON a.id_personal = r.id_auxiliar
  LEFT JOIN bpkm.tbl_detalles_ruta dr ON dr.id_ruta = r.id_ruta
  LEFT JOIN bpkm.tbl_estado_bpkm ed_det ON ed_det.id_estado_bpkm = dr.id_estado
`;

const SELECT_COLUMNAS = `
  SELECT
    r.id_ruta,
    r.numero_ruta AS codigo_ruta,
    r.tipo_ruta,
    e.nombre AS estado_nombre,
    c.placa AS camion,
    p.nombre AS piloto,
    a.nombre AS auxiliar,
    r.fecha_salida_plan,
    r.fecha_entrada_plan,
    r.monto_total,
    COUNT(CASE WHEN ed_det.codigo NOT IN ('ANULADO', 'ANUL') THEN dr.id_detalle_ruta END) AS total_facturas,
    r.fecha_creacion
`;

const GROUP_BY = `
  GROUP BY r.id_ruta, r.numero_ruta, r.tipo_ruta, e.nombre, c.placa, p.nombre, a.nombre,
           r.fecha_salida_plan, r.fecha_entrada_plan, r.monto_total, r.fecha_creacion
`;

const LIMITE_EXPORTACION = 1000;

function clampLimit(limit, def = 25) {
  const n = parseInt(limit, 10);
  if (!Number.isFinite(n)) return def;
  return Math.min(100, Math.max(10, n));
}

function clampPage(page) {
  const n = parseInt(page, 10);
  return Number.isFinite(n) && n > 0 ? n : 1;
}

class Ruta {
  static async listar(filters = {}, pool) {
    const {
      estado_codigo = null,
      fecha_desde = null,
      fecha_hasta = null,
      id_camion = 0,
      id_piloto = 0,
      id_auxiliar = 0,
      folio_factura = null,
      page = 1,
      limit = 25,
      id_sucursal_usuario = null,
      exportar = false
    } = filters;

    const limitNum = exportar ? LIMITE_EXPORTACION : clampLimit(limit);
    const pageNum = exportar ? 1 : clampPage(page);

    if (!id_sucursal_usuario) {
      return { items: [], total: 0, page: pageNum, limit: limitNum, resumen: { por_estado: { EN_CURSO: 0 } } };
    }

    const condicionesComunes = [
      `($1::date IS NULL OR r.fecha_creacion::date >= $1::date)`,
      `($2::date IS NULL OR r.fecha_creacion::date <= $2::date)`,
      `($3::int = 0 OR r.id_camion = $3::int)`,
      `($4::int = 0 OR r.id_piloto = $4::int)`,
      `($5::int = 0 OR r.id_auxiliar = $5::int)`,
      `($6::varchar IS NULL OR $6::varchar = '' OR EXISTS (
         SELECT 1 FROM bpkm.tbl_detalles_ruta dr2
         WHERE dr2.id_ruta = r.id_ruta AND dr2.folio_factura ILIKE '%' || $6::varchar || '%'
       ))`,
      `(r.id_sucursal_salida = $7::int OR r.id_sucursal_creador = $7::int)`
    ];
    const valoresComunes = [
      fecha_desde || null,
      fecha_hasta || null,
      parseInt(id_camion, 10) || 0,
      parseInt(id_piloto, 10) || 0,
      parseInt(id_auxiliar, 10) || 0,
      folio_factura || null,
      parseInt(id_sucursal_usuario, 10)
    ];

    const estadoNormalizado = (estado_codigo || '').trim().toUpperCase() || null;
    const condicionesLista = [
      ...condicionesComunes,
      `($8::varchar IS NULL OR e.codigo = $8::varchar)`
    ];
    const valoresLista = [...valoresComunes, estadoNormalizado];

    const whereLista = `WHERE ${condicionesLista.join(' AND ')}`;
    const whereComun = `WHERE ${condicionesComunes.join(' AND ')}`;
    const sqlBase = `${SELECT_COLUMNAS} ${FROM_JOINS} ${whereLista} ${GROUP_BY}`;
    const offset = (pageNum - 1) * limitNum;

    const [itemsResult, totalResult, resumenResult] = await Promise.all([
      pool.query(
        `${sqlBase} ORDER BY r.id_ruta DESC LIMIT $${valoresLista.length + 1} OFFSET $${valoresLista.length + 2}`,
        [...valoresLista, limitNum, offset]
      ),
      pool.query(`SELECT COUNT(*) AS total FROM (${sqlBase}) sub`, valoresLista),
      pool.query(
        `SELECT COUNT(DISTINCT r.id_ruta) AS conteo
         FROM bpkm.tbl_rutas r
         LEFT JOIN bpkm.tbl_estado_bpkm e ON e.id_estado_bpkm = r.id_estado_ruta
         ${whereComun} AND e.codigo = 'EN_CURSO'`,
        valoresComunes
      )
    ]);

    return {
      items: itemsResult.rows,
      total: parseInt(totalResult.rows[0].total, 10),
      page: pageNum,
      limit: limitNum,
      resumen: { por_estado: { EN_CURSO: parseInt(resumenResult.rows[0].conteo, 10) || 0 } }
    };
  }
}

module.exports = Ruta;
