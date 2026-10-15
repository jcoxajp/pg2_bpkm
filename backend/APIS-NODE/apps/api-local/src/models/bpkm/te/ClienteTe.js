const { toLocalDateTimeString } = require('../../../../../../packages/shared-utils');

const SELECT_CLIENTE = `
  SELECT
    tc.id_te_cliente,
    tc.card_code,
    tc.card_name,
    tc.nit,
    tc.id_sucursal,
    s.nombre    AS sucursal_nombre,
    tc.observaciones,
    tc.estado,
    uc.nombre   AS creado_por_nombre,
    tc.fecha_creacion,
    ua.nombre   AS actualizado_por_nombre,
    tc.fecha_actualizacion
  FROM bpkm.tbl_te_clientes tc
  LEFT JOIN usuarios.tbl_sucursales   s  ON s.id_sucursal = tc.id_sucursal
  LEFT JOIN usuarios.tbl_usuarios     uc ON uc.id_usuario = tc.creado_por
  LEFT JOIN usuarios.tbl_usuarios     ua ON ua.id_usuario = tc.actualizado_por
`;

function toJSON(row) {
  return {
    idTeCliente:          row.id_te_cliente,
    cardCode:             row.card_code,
    cardName:             row.card_name ?? null,
    nit:                  row.nit ?? null,
    idSucursal:           row.id_sucursal,
    sucursalNombre:       row.sucursal_nombre ?? null,
    observaciones:        row.observaciones ?? null,
    estado:               row.estado === 1 ? 'Activo' : 'Inactivo',
    creadoPorNombre:      row.creado_por_nombre ?? null,
    fechaCreacion:        toLocalDateTimeString(row.fecha_creacion),
    actualizadoPorNombre: row.actualizado_por_nombre ?? null,
    fechaActualizacion:   toLocalDateTimeString(row.fecha_actualizacion),
  };
}

class ClienteTe {
  static async findAll({ q, idSucursal, page = 1, limit = 25 }, pool) {
    const term   = q?.trim() || null;
    const offset = (page - 1) * limit;

    const baseWhere = `
      WHERE tc.id_sucursal = $1
        AND tc.estado = 1
        AND ($2::text IS NULL
             OR tc.card_code ILIKE '%' || $2 || '%'
             OR tc.card_name ILIKE '%' || $2 || '%')`;

    const [countResult, dataResult] = await Promise.all([
      pool.query(
        `SELECT COUNT(*) FROM bpkm.tbl_te_clientes tc ${baseWhere}`,
        [idSucursal, term]
      ),
      pool.query(
        `${SELECT_CLIENTE} ${baseWhere}
         ORDER BY tc.fecha_creacion DESC
         LIMIT $3 OFFSET $4`,
        [idSucursal, term, limit, offset]
      ),
    ]);

    const total = parseInt(countResult.rows[0].count, 10);
    return {
      items:      dataResult.rows.map(toJSON),
      pagination: { total, page, limit, pages: Math.ceil(total / limit) },
    };
  }

  static async findById(id, pool) {
    const { rows } = await pool.query(
      `${SELECT_CLIENTE} WHERE tc.id_te_cliente = $1 AND tc.estado = 1`,
      [id]
    );
    return rows[0] ? toJSON(rows[0]) : null;
  }

  static async create({ cardCode, cardName, nit, idSucursal, observaciones, creadoPor }, pool) {
    const { rows } = await pool.query(
      `INSERT INTO bpkm.tbl_te_clientes
         (card_code, card_name, nit, id_sucursal, observaciones, creado_por)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [cardCode, cardName ?? null, nit ?? null, idSucursal, observaciones ?? null, creadoPor]
    );
    return rows[0] ? toJSON(rows[0]) : null;
  }

  static async update(id, { observaciones, actualizadoPor }, pool) {
    const { rows } = await pool.query(
      `UPDATE bpkm.tbl_te_clientes
       SET observaciones       = $2,
           actualizado_por     = $3,
           fecha_actualizacion = NOW()
       WHERE id_te_cliente = $1 AND estado = 1
       RETURNING *`,
      [id, observaciones ?? null, actualizadoPor]
    );
    return rows[0] ? toJSON(rows[0]) : null;
  }
}

module.exports = ClienteTe;
