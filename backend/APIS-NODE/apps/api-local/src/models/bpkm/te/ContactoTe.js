const { toLocalDateTimeString } = require('../../../../../../packages/shared-utils');

function toJSON(row) {
  return {
    idTeContacto:         row.id_te_contacto,
    nombre:               row.nombre,
    telefono:             row.telefono ?? null,
    esDefault:            row.es_default,
    estado:               row.estado === 1 ? 'Activo' : 'Inactivo',
    creadoPorNombre:      row.creado_por_nombre ?? null,
    fechaCreacion:        toLocalDateTimeString(row.fecha_creacion),
    actualizadoPorNombre: row.actualizado_por_nombre ?? null,
    fechaActualizacion:   toLocalDateTimeString(row.fecha_actualizacion),
  };
}

class ContactoTe {
  static async findAll(idTeCliente, incluirInactivos = false, pool) {
    const { rows } = await pool.query(
      `SELECT
         tc.*,
         uc.nombre AS creado_por_nombre,
         ua.nombre AS actualizado_por_nombre
       FROM bpkm.tbl_te_contactos tc
       LEFT JOIN usuarios.tbl_usuarios uc ON uc.id_usuario = tc.creado_por
       LEFT JOIN usuarios.tbl_usuarios ua ON ua.id_usuario = tc.actualizado_por
       WHERE tc.id_te_cliente = $1 AND ($2 OR tc.estado = 1)
       ORDER BY tc.es_default DESC, tc.fecha_creacion ASC`,
      [idTeCliente, incluirInactivos]
    );
    return rows.map(toJSON);
  }

  static async create({ idTeCliente, nombre, telefono, esDefault, creadoPor }, pool) {
    const insertSql = `INSERT INTO bpkm.tbl_te_contactos
         (id_te_cliente, nombre, telefono, es_default, creado_por)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`;
    const params = [idTeCliente, nombre, telefono ?? null, Boolean(esDefault), creadoPor];

    if (!esDefault) {
      const { rows } = await pool.query(insertSql, params);
      return rows[0] ? toJSON(rows[0]) : null;
    }

    // esDefault = true: apagar el default anterior del cliente antes de insertar.
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query(
        `UPDATE bpkm.tbl_te_contactos
         SET es_default = false
         WHERE id_te_cliente = $1 AND estado = 1 AND es_default = true`,
        [idTeCliente]
      );
      const { rows } = await client.query(insertSql, params);
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
      `UPDATE bpkm.tbl_te_contactos
       SET estado = 0, actualizado_por = $2, fecha_actualizacion = NOW()
       WHERE id_te_contacto = $1 AND estado = 1
       RETURNING id_te_contacto`,
      [id, actualizadoPor]
    );
    return rows.length > 0;
  }

  // Marca un contacto como predeterminado y quita el flag a los demás del mismo cliente.
  static async setDefault(idTeCliente, idTeContacto, actualizadoPor, pool) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query(
        `UPDATE bpkm.tbl_te_contactos
         SET es_default = false
         WHERE id_te_cliente = $1 AND estado = 1 AND es_default = true`,
        [idTeCliente]
      );
      const { rows } = await client.query(
        `UPDATE bpkm.tbl_te_contactos
         SET es_default          = true,
             actualizado_por     = $3,
             fecha_actualizacion = NOW()
         WHERE id_te_contacto = $2 AND id_te_cliente = $1 AND estado = 1
         RETURNING *`,
        [idTeCliente, idTeContacto, actualizadoPor]
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

  // Verifica si ya existe un contacto activo con ese teléfono para el cliente
  static async phoneExists(idTeCliente, telefono, pool) {
    const { rows } = await pool.query(
      `SELECT 1 FROM bpkm.tbl_te_contactos
       WHERE id_te_cliente = $1 AND telefono = $2 AND estado = 1 LIMIT 1`,
      [idTeCliente, telefono]
    );
    return rows.length > 0;
  }

  // Verifica que el contacto pertenezca al cliente indicado (evita acceso cross-client)
  static async belongsToCliente(idContacto, idTeCliente, pool) {
    const { rows } = await pool.query(
      `SELECT 1 FROM bpkm.tbl_te_contactos
       WHERE id_te_contacto = $1 AND id_te_cliente = $2 LIMIT 1`,
      [idContacto, idTeCliente]
    );
    return rows.length > 0;
  }
}

module.exports = ContactoTe;
