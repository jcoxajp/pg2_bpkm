// models/bpkm/Seleccion.js

const FROM_JOINS = `
  FROM bpkm.tbl_factura_seleccion s
  JOIN bpkm.tbl_forma_entrega fe ON fe.id_forma_entrega = s.id_forma_entrega
  JOIN bpkm.tbl_estado_bpkm e ON e.id_estado_bpkm = s.id_estado_sel
  JOIN ndc.tbl_cat_facturas tcf ON tcf.id = s.id_factura
  LEFT JOIN bpkm.tbl_transporte_externo te ON te.id_transporte_externo = s.id_transporte_externo
  LEFT JOIN catalogos.tbl_ciudades tc ON s.id_departamento = tc.id_ciudad
  LEFT JOIN catalogos.tbl_municipios tm ON s.id_municipio = tm.id_municipio
  LEFT JOIN usuarios.tbl_sucursales suc ON suc.id_sucursal = s.id_sucursal_creador
`;

const SELECT_COLUMNAS = `
  SELECT
    s.id_factura_sel,
    s.id_factura,
    s.folio_factura,
    s.id_vendedor,
    s.id_forma_entrega,
    fe.codigo AS forma_codigo,
    fe.nombre AS forma_nombre,
    s.id_transporte_externo,
    te.nombre AS transporte_nombre,
    s.id_departamento,
    s.id_municipio,
    CASE
      WHEN fe.codigo = 'CAM' THEN
        CONCAT_WS(', ', tc.nombre, tm.nombre, NULLIF(BTRIM(s.direccion_entrega), ''))
      WHEN fe.codigo = 'LOCAL' THEN
        CONCAT_WS(', ', tc.nombre, tm.nombre, NULLIF(BTRIM(s.direccion_entrega), ''))
      WHEN fe.codigo = 'SUC' THEN ''
      WHEN fe.codigo = 'EXT' THEN
        CONCAT_WS(' - ', te.nombre, NULLIF(BTRIM(s.direccion_entrega), ''))
      ELSE NULL
    END AS destino,
    s.en_ruta,
    s.anulada,
    s.id_estado_sel,
    e.codigo AS estado_codigo,
    e.nombre AS estado_nombre,
    s.id_sucursal_creador,
    suc.nombre AS sucursal_creador,
    s.fecha_creacion,
    s.fecha_actualizacion,
    COALESCE(s.creado_por = $6::int, false) AS es_creador,
    COALESCE(
      (SELECT ld.puede_reenviar
       FROM bpkm.tbl_detalles_ruta dr
       JOIN bpkm.tbl_liquidacion_detalle ld ON ld.id_detalle_ruta = dr.id_detalle_ruta
       WHERE dr.id_factura_sel = s.id_factura_sel
       ORDER BY ld.fecha_creacion DESC
       LIMIT 1),
      true
    ) AS puede_reenviar,
    EXISTS (
      SELECT 1
      FROM bpkm.tbl_detalles_ruta dr
      JOIN bpkm.tbl_entregas_piloto ep ON ep.id_detalle_ruta = dr.id_detalle_ruta
      JOIN bpkm.tbl_evidencia_entrega ee ON ee.id_entrega_piloto = ep.id_entrega_piloto
      WHERE dr.id_factura_sel = s.id_factura_sel
    ) AS tiene_evidencias,
    tcf.card_name AS nombre_cliente,
    tcf.fecha::date AS fecha_factura
`;

function clampLimit(limit, def = 50) {
  const n = parseInt(limit, 10);
  if (!Number.isFinite(n) || n <= 0) return def;
  return Math.min(100, Math.max(1, n));
}

function clampPage(page) {
  const n = parseInt(page, 10);
  return Number.isFinite(n) && n > 0 ? n : 1;
}

function mapFacturaSeleccionRow(r) {
  return {
    id_factura_sel: Number(r.id_factura_sel),
    id_factura: Number(r.id_factura),
    folio_factura: r.folio_factura,
    id_vendedor: r.id_vendedor ? Number(r.id_vendedor) : null,
    id_forma_entrega: r.id_forma_entrega ? Number(r.id_forma_entrega) : null,
    forma_codigo: r.forma_codigo,
    forma_nombre: r.forma_nombre,
    id_transporte_externo: r.id_transporte_externo ? Number(r.id_transporte_externo) : null,
    transporte_nombre: r.transporte_nombre,
    id_departamento: r.id_departamento ? Number(r.id_departamento) : null,
    id_municipio: r.id_municipio ? Number(r.id_municipio) : null,
    destino: r.destino,
    en_ruta: Number(r.en_ruta || 0),
    anulada: Number(r.anulada || 0),
    id_estado_sel: Number(r.id_estado_sel),
    estado_codigo: r.estado_codigo,
    estado_nombre: r.estado_nombre,
    id_sucursal_creador: r.id_sucursal_creador ? Number(r.id_sucursal_creador) : null,
    sucursal_creador: r.sucursal_creador,
    fecha_creacion: r.fecha_creacion,
    fecha_actualizacion: r.fecha_actualizacion,
    es_creador: Boolean(r.es_creador),
    puede_reenviar: Boolean(r.puede_reenviar),
    tiene_evidencias: Boolean(r.tiene_evidencias),
    nombre_cliente: r.nombre_cliente,
    fecha_factura: r.fecha_factura
  };
}

class Seleccion {
  /**
   * Reemplaza la función SQL bpkm.get_mis_facturas_seleccion.
   *
   * @param {object} filters
   * @param {number|null} [filters.id_vendedor]
   * @param {string|null} [filters.forma_codigo]
   * @param {string|null} [filters.folio_like]
   * @param {string|null} [filters.estado_codigo]
   * @param {string|null} [filters.fecha_desde]
   * @param {string|null} [filters.fecha_hasta]
   * @param {number|null} [filters.creado_por]
   * @param {number} [filters.page=1]
   * @param {number} [filters.limit=50]
   * @param {number|null} [filters.offset=null]
   * @param {object} pool - Pool de conexiones de PostgreSQL
   * @returns {Promise<{ items: Array, pagination: { total: number, page: number, limit: number }, por_estado: { ACT: number, EN_RUTA: number, FALLIDA: number } }>}
   */
  static async listarMisFacturas(filters = {}, pool) {
    const {
      id_vendedor = null,
      forma_codigo = null,
      folio_like = null,
      estado_codigo = null,
      fecha_desde = null,
      fecha_hasta = null,
      creado_por = null,
      page = 1,
      limit = 50,
      offset = null
    } = filters;

    const condicionesComunes = [
      `e.tabla = 'SEL'`,
      `($1::int IS NULL OR s.id_vendedor = $1::int)`,
      `($2::varchar IS NULL OR fe.codigo = $2::varchar)`,
      `($3::varchar IS NULL OR s.folio_factura ILIKE '%' || $3::varchar || '%')`,
      `($4::date IS NULL OR s.fecha_creacion::date >= $4::date)`,
      `($5::date IS NULL OR s.fecha_creacion::date <= $5::date)`,
      `($6::int IS NULL OR s.creado_por = $6::int OR EXISTS (
         SELECT 1 FROM bpkm.tbl_asignacion_usuario_vendedor a
         WHERE a.id_usuario = $6::int AND a.id_vendedor = tcf.vendedor_id AND a.activo = true
       ))`
    ];

    const valoresComunes = [
      id_vendedor !== null && id_vendedor !== undefined && !isNaN(Number(id_vendedor)) ? parseInt(id_vendedor, 10) : null,
      forma_codigo ? String(forma_codigo).trim() : null,
      folio_like ? String(folio_like).trim() : null,
      fecha_desde ? String(fecha_desde).trim() : null,
      fecha_hasta ? String(fecha_hasta).trim() : null,
      creado_por !== null && creado_por !== undefined && !isNaN(Number(creado_por)) ? parseInt(creado_por, 10) : null
    ];

    const estadoNormalizado = estado_codigo ? String(estado_codigo).trim() : null;
    const condicionesLista = [
      ...condicionesComunes,
      `($7::varchar IS NULL OR e.codigo = $7::varchar)`
    ];
    const valoresLista = [...valoresComunes, estadoNormalizado];

    const whereLista = `WHERE ${condicionesLista.join(' AND ')}`;

    const limitNum = clampLimit(limit, 50);
    let pageNum = 1;
    let offsetNum = 0;

    if (offset !== undefined && offset !== null && Number.isFinite(Number(offset))) {
      offsetNum = Math.max(0, parseInt(offset, 10));
      pageNum = Math.floor(offsetNum / limitNum) + 1;
    } else {
      pageNum = clampPage(page);
      offsetNum = (pageNum - 1) * limitNum;
    }

    const orderBy = `
      ORDER BY
        CASE WHEN $7::varchar = 'ACT' THEN NULL ELSE tcf.fecha END DESC,
        CASE WHEN $7::varchar = 'ACT' THEN tcf.fecha END ASC,
        s.id_factura_sel DESC
    `;

    // Conteo por estado: facturas pendientes (ACT), en ruta (EN_RUTA) y fallidas (FALLIDA, última semana)
    const sqlResumenPorEstado = `
      SELECT
        e.codigo AS estado,
        COUNT(DISTINCT s.id_factura_sel)::int AS conteo
      FROM bpkm.tbl_factura_seleccion s
      JOIN bpkm.tbl_forma_entrega fe ON fe.id_forma_entrega = s.id_forma_entrega
      JOIN bpkm.tbl_estado_bpkm e ON e.id_estado_bpkm = s.id_estado_sel
      JOIN ndc.tbl_cat_facturas tcf ON tcf.id = s.id_factura
      WHERE e.tabla = 'SEL'
        AND (
          e.codigo IN ('ACT', 'EN_RUTA')
          OR (e.codigo = 'FALLIDA' AND s.fecha_creacion >= NOW() - INTERVAL '7 days')
        )
        AND ($1::int IS NULL OR s.id_vendedor = $1::int)
        AND ($2::varchar IS NULL OR fe.codigo = $2::varchar)
        AND ($3::int IS NULL OR s.creado_por = $3::int OR EXISTS (
          SELECT 1 FROM bpkm.tbl_asignacion_usuario_vendedor a
          WHERE a.id_usuario = $3::int AND a.id_vendedor = tcf.vendedor_id AND a.activo = true
        ))
      GROUP BY e.codigo
    `;

    const valoresResumen = [valoresComunes[0], valoresComunes[1], valoresComunes[5]];

    const [itemsResult, countResult, resumenResult] = await Promise.all([
      pool.query(
        `${SELECT_COLUMNAS} ${FROM_JOINS} ${whereLista} ${orderBy} LIMIT $8 OFFSET $9`,
        [...valoresLista, limitNum, offsetNum]
      ),
      pool.query(
        `SELECT COUNT(*)::bigint AS total
         FROM bpkm.tbl_factura_seleccion s
         JOIN bpkm.tbl_forma_entrega fe ON fe.id_forma_entrega = s.id_forma_entrega
         JOIN bpkm.tbl_estado_bpkm e ON e.id_estado_bpkm = s.id_estado_sel
         JOIN ndc.tbl_cat_facturas tcf ON tcf.id = s.id_factura
         ${whereLista}`,
        valoresLista
      ),
      pool.query(sqlResumenPorEstado, valoresResumen)
    ]);

    const totalCount = Number(countResult.rows[0]?.total || 0);

    const porEstado = {
      ACT: 0,
      EN_RUTA: 0,
      FALLIDA: 0
    };
    for (const row of resumenResult.rows) {
      if (porEstado[row.estado] !== undefined) {
        porEstado[row.estado] = Number(row.conteo || 0);
      }
    }

    const items = (itemsResult.rows || []).map(r => mapFacturaSeleccionRow(r));

    return {
      items,
      resumen: {
        pagination: {
          total: totalCount,
          page: pageNum,
          limit: limitNum
        },
        por_estado: porEstado
      }
    };
  }
}

module.exports = Seleccion;
