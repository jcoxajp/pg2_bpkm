const { toLocalDateTimeString } = require('../../../../../../packages/shared-utils');

function toJSON(row) {
  return {
    idTeDireccion:        row.id_te_direccion,
    alias:                row.alias,
    idMunicipio:          row.id_municipio ?? null,
    municipioNombre:      row.municipio_nombre ?? null,
    departamentoNombre:   row.departamento_nombre ?? null,
    direccion:            row.direccion,
    instruccionesEntrega: row.instrucciones_entrega ?? null,
    idTransporteExterno:  row.id_transporte_externo ?? null,
    transporteNombre:     row.transporte_nombre ?? null,
    esDefault:            row.es_default,
    estado:               row.estado === 1 ? 'Activo' : 'Inactivo',
    creadoPorNombre:      row.creado_por_nombre ?? null,
    fechaCreacion:        toLocalDateTimeString(row.fecha_creacion),
    actualizadoPorNombre: row.actualizado_por_nombre ?? null,
    fechaActualizacion:   toLocalDateTimeString(row.fecha_actualizacion),
  };
}

class DireccionTe {
  static async findAll(idTeCliente, incluirInactivos = false, pool) {
    const { rows } = await pool.query(
      `SELECT
         d.*,
         m.nombre   AS municipio_nombre,
         c.nombre   AS departamento_nombre,
         te.nombre  AS transporte_nombre,
         uc.nombre  AS creado_por_nombre,
         ua.nombre  AS actualizado_por_nombre
       FROM bpkm.tbl_te_direcciones d
       LEFT JOIN catalogos.tbl_municipios    m  ON m.id_municipio           = d.id_municipio
       LEFT JOIN catalogos.tbl_ciudades      c  ON c.id_ciudad              = m.id_ciudad
       LEFT JOIN bpkm.tbl_transporte_externo te ON te.id_transporte_externo = d.id_transporte_externo
       LEFT JOIN usuarios.tbl_usuarios       uc ON uc.id_usuario            = d.creado_por
       LEFT JOIN usuarios.tbl_usuarios       ua ON ua.id_usuario            = d.actualizado_por
       WHERE d.id_te_cliente = $1 AND ($2 OR d.estado = 1)
       ORDER BY d.es_default DESC, d.fecha_creacion ASC`,
      [idTeCliente, incluirInactivos]
    );
    return rows.map(toJSON);
  }

  static async create(
    { idTeCliente, alias, idMunicipio, direccion, instrucciones, idTransporteExterno, esDefault, creadoPor },
    pool
  ) {
    const insertSql = `INSERT INTO bpkm.tbl_te_direcciones
         (id_te_cliente, alias, id_municipio, direccion,
          instrucciones_entrega, id_transporte_externo, es_default, creado_por)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING *`;
    const insertParams = [
      idTeCliente,
      alias,
      idMunicipio ?? null,
      direccion,
      instrucciones ?? null,
      idTransporteExterno ?? null,
      Boolean(esDefault),
      creadoPor,
    ];

    if (!esDefault) {
      const { rows } = await pool.query(insertSql, insertParams);
      return rows[0] ? toJSON(rows[0]) : null;
    }

    // esDefault = true: apagar el default anterior del cliente antes de insertar.
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query(
        `UPDATE bpkm.tbl_te_direcciones
         SET es_default = false
         WHERE id_te_cliente = $1 AND estado = 1 AND es_default = true`,
        [idTeCliente]
      );
      const { rows } = await client.query(insertSql, insertParams);
      await client.query('COMMIT');
      return rows[0] ? toJSON(rows[0]) : null;
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  static async deactivate(id, actualizadoPor, pool) {
    const { rows } = await pool.query(
      `UPDATE bpkm.tbl_te_direcciones
       SET estado = 0, actualizado_por = $2, fecha_actualizacion = NOW()
       WHERE id_te_direccion = $1 AND estado = 1
       RETURNING id_te_direccion`,
      [id, actualizadoPor]
    );
    return rows.length > 0;
  }

  // Marca una dirección como predeterminada y quita el flag a las demás del mismo cliente.
  static async setDefault(idTeCliente, idTeDireccion, actualizadoPor, pool) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query(
        `UPDATE bpkm.tbl_te_direcciones
         SET es_default = false
         WHERE id_te_cliente = $1 AND estado = 1 AND es_default = true`,
        [idTeCliente]
      );
      const { rows } = await client.query(
        `UPDATE bpkm.tbl_te_direcciones
         SET es_default          = true,
             actualizado_por     = $3,
             fecha_actualizacion = NOW()
         WHERE id_te_direccion = $2 AND id_te_cliente = $1 AND estado = 1
         RETURNING *`,
        [idTeCliente, idTeDireccion, actualizadoPor]
      );
      await client.query('COMMIT');
      return rows[0] ? toJSON(rows[0]) : null;
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  // Verifica si ya existe una dirección activa con ese alias para el cliente (case-insensitive)
  static async aliasExists(idTeCliente, alias, pool) {
    const { rows } = await pool.query(
      `SELECT 1 FROM bpkm.tbl_te_direcciones
       WHERE id_te_cliente = $1 AND LOWER(alias) = LOWER($2) AND estado = 1 LIMIT 1`,
      [idTeCliente, alias]
    );
    return rows.length > 0;
  }

  // Verifica que la dirección pertenezca al cliente indicado (evita acceso cross-client)
  static async belongsToCliente(idDireccion, idTeCliente, pool) {
    const { rows } = await pool.query(
      `SELECT 1 FROM bpkm.tbl_te_direcciones
       WHERE id_te_direccion = $1 AND id_te_cliente = $2 LIMIT 1`,
      [idDireccion, idTeCliente]
    );
    return rows.length > 0;
  }
}

module.exports = DireccionTe;
