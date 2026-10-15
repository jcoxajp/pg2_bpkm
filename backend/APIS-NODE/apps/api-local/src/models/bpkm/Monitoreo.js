const FROM_JOINS = `
  FROM bpkm.tbl_rutas r
  LEFT JOIN bpkm.tbl_estado_bpkm e ON e.id_estado_bpkm = r.id_estado_ruta
  LEFT JOIN bpkm.tbl_camiones c ON c.id_camion = r.id_camion
  LEFT JOIN bpkm.tbl_personal p ON p.id_personal = r.id_piloto
  LEFT JOIN bpkm.tbl_personal a ON a.id_personal = r.id_auxiliar
  LEFT JOIN bpkm.tbl_monitoreo_bpkm ms ON ms.id_ruta = r.id_ruta AND ms.tipo = 'S'
  LEFT JOIN bpkm.tbl_monitoreo_bpkm me ON me.id_ruta = r.id_ruta AND me.tipo = 'E'
  LEFT JOIN bpkm.tbl_bpkm bpkm_data ON bpkm_data.id_ruta = r.id_ruta
`;

const SELECT_COLUMNAS = `
  SELECT
    r.id_ruta,
    r.numero_ruta AS codigo_ruta,
    e.nombre AS estado_nombre,
    c.placa AS camion,
    p.nombre AS piloto,
    a.nombre AS auxiliar,
    r.fecha_salida_plan,
    r.fecha_entrada_plan,
    (ms.id_monitoreo_bpkm IS NOT NULL) AS tiene_salida,
    (me.id_monitoreo_bpkm IS NOT NULL) AS tiene_entrada,
    ms.fecha_hora AS salida_fecha_hora,
    ms.comentario AS salida_comentario,
    me.fecha_hora AS entrada_fecha_hora,
    me.comentario AS entrada_comentario,
    (bpkm_data.usuario_gerencia IS NOT NULL AND bpkm_data.fecha_aprobacion IS NOT NULL) AS bpkm_aprobado
`;

const MAX_DESTACADAS = 12;

function clampLimit(limit, def = 25) {
  const n = parseInt(limit, 10);
  if (!Number.isFinite(n)) return def;
  return Math.min(100, Math.max(10, n));
}

function clampPage(page) {
  const n = parseInt(page, 10);
  return Number.isFinite(n) && n > 0 ? n : 1;
}

class Monitoreo {
  static async listar(filters = {}, pool) {
    const {
      estado_codigo = null,
      fecha_desde = null,
      fecha_hasta = null,
      id_suc_salida = 0,
      id_camion = 0,
      id_piloto = 0,
      id_auxiliar = 0,
      creado_por = 0,
      page = 1,
      limit = 25
    } = filters;

    const limitNum = clampLimit(limit);
    const pageNum = clampPage(page);
    const offset = (pageNum - 1) * limitNum;

    const condicionesComunes = [
      `(e.nombre IS DISTINCT FROM 'Cancelada')`,
      `($1::varchar IS NULL OR e.codigo = $1::varchar)`,
      `($2::date IS NULL OR r.fecha_salida_plan::date >= $2::date)`,
      `($3::date IS NULL OR r.fecha_salida_plan::date <= $3::date)`,
      `($4::int = 0 OR r.id_sucursal_salida = $4::int)`,
      `($5::int = 0 OR r.id_camion = $5::int)`,
      `($6::int = 0 OR r.id_piloto = $6::int)`,
      `($7::int = 0 OR r.id_auxiliar = $7::int)`,
      `($8::int = 0 OR r.creado_por = $8::int)`
    ];
    const valoresComunes = [
      (estado_codigo || '').trim().toUpperCase() || null,
      fecha_desde || null,
      fecha_hasta || null,
      parseInt(id_suc_salida, 10) || 0,
      parseInt(id_camion, 10) || 0,
      parseInt(id_piloto, 10) || 0,
      parseInt(id_auxiliar, 10) || 0,
      parseInt(creado_por, 10) || 0
    ];

    const whereComun = `WHERE ${condicionesComunes.join(' AND ')}`;
    const sqlBase = `${SELECT_COLUMNAS} ${FROM_JOINS} ${whereComun}`;

    const [
      itemsResult,
      totalResult,
      sinSalidaResult,
      sinEntradaResult,
      proximasSalirResult,
      queRegresaronResult
    ] = await Promise.all([
      pool.query(
        `${sqlBase} ORDER BY r.id_ruta DESC LIMIT $${valoresComunes.length + 1} OFFSET $${valoresComunes.length + 2}`,
        [...valoresComunes, limitNum, offset]
      ),
      pool.query(`SELECT COUNT(*) AS total FROM (${sqlBase}) sub`, valoresComunes),
      pool.query(
        `SELECT COUNT(*) AS total FROM (${sqlBase}) sub
         WHERE NOT sub.tiene_salida AND sub.estado_nombre IN ('Creada', 'En curso')`,
        valoresComunes
      ),
      pool.query(
        `SELECT COUNT(*) AS total FROM (${sqlBase}) sub
         WHERE sub.tiene_salida AND NOT sub.tiene_entrada AND sub.estado_nombre = 'Regresada'`,
        valoresComunes
      ),
      pool.query(
        `${sqlBase}
           AND NOT (bpkm_data.usuario_gerencia IS NOT NULL AND bpkm_data.fecha_aprobacion IS NOT NULL)
           AND ms.id_monitoreo_bpkm IS NULL
           AND r.fecha_salida_plan::date >= CURRENT_DATE
           AND r.fecha_salida_plan::date < CURRENT_DATE + INTERVAL '2 days'
         ORDER BY r.fecha_salida_plan ASC
         LIMIT ${MAX_DESTACADAS}`,
        valoresComunes
      ),
      pool.query(
        `${sqlBase}
           AND NOT (bpkm_data.usuario_gerencia IS NOT NULL AND bpkm_data.fecha_aprobacion IS NOT NULL)
           AND me.id_monitoreo_bpkm IS NULL
           AND e.nombre IN ('Regresada', 'Finalizada')
         ORDER BY r.fecha_entrada_plan ASC NULLS LAST
         LIMIT ${MAX_DESTACADAS}`,
        valoresComunes
      )
    ]);

    return {
      items: itemsResult.rows,
      total: parseInt(totalResult.rows[0].total, 10),
      page: pageNum,
      limit: limitNum,
      resumen: {
        sin_salida: parseInt(sinSalidaResult.rows[0].total, 10) || 0,
        sin_entrada: parseInt(sinEntradaResult.rows[0].total, 10) || 0
      },
      destacadas: {
        proximas_salir: proximasSalirResult.rows,
        que_regresaron: queRegresaronResult.rows
      }
    };
  }

  static async registrar({ id_ruta, id_usuario, tipo, fecha_hora, comentario }, pool) {
    const [{ rows: existentes }, { rows: aprobados }] = await Promise.all([
      pool.query(
        `SELECT tipo, fecha_hora FROM bpkm.tbl_monitoreo_bpkm WHERE id_ruta = $1`,
        [id_ruta]
      ),
      pool.query(
        `SELECT 1 FROM bpkm.tbl_bpkm
         WHERE id_ruta = $1 AND usuario_gerencia IS NOT NULL AND fecha_aprobacion IS NOT NULL`,
        [id_ruta]
      )
    ]);

    if (aprobados.length > 0) {
      return {
        ok: false,
        error: 'No se puede registrar monitoreo. El BPKM de esta ruta ya fue aprobado por gerencia.'
      };
    }

    const salida = existentes.find((e) => e.tipo === 'S') || null;
    const entrada = existentes.find((e) => e.tipo === 'E') || null;

    if (tipo === 'S' && salida) {
      return { ok: false, error: 'Ya existe un registro de salida para esta ruta.' };
    }

    if (!fecha_hora) {
      return { ok: false, error: 'fecha_hora es obligatorio.' };
    }

    const fechaHoraFinal = new Date(String(fecha_hora).trim().replace(' ', 'T'));
    if (Number.isNaN(fechaHoraFinal.getTime())) {
      return { ok: false, error: 'fecha_hora debe ser una fecha/hora válida.' };
    }

    if (tipo === 'E') {
      if (!salida) {
        return { ok: false, error: 'No se puede registrar la entrada sin haber registrado la salida.' };
      }
      if (entrada) {
        return { ok: false, error: 'Ya existe un registro de entrada para esta ruta.' };
      }
      if (fechaHoraFinal <= new Date(salida.fecha_hora)) {
        return { ok: false, error: 'La fecha de entrada debe ser posterior a la fecha de salida.' };
      }
    }

    const { rows } = await pool.query(
      `SELECT * FROM bpkm.post_monitoreo_bpkm($1,$2,$3,$4,$5)`,
      [id_ruta, id_usuario, tipo, String(fecha_hora).trim(), comentario ?? null]
    );

    return { ok: true, data: rows?.[0] || {} };
  }
}

module.exports = Monitoreo;
