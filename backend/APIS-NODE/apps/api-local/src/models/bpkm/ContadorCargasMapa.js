const LIMITE_CARGAS_DEFAULT = 10000;

class ContadorCargasMapa {
  /**
   * Incrementa el contador si se encuentra bajo el límite mensual.
   * En caso de error de BD, falla cerrado (habilitado: false).
   *
   * @param {object} pool - Pool de conexiones PostgreSQL
   * @param {object} [opciones]
   * @param {number} [opciones.anio] - Año (default: año actual local)
   * @param {number} [opciones.mes] - Mes 1-12 (default: mes actual local)
   * @param {number} [opciones.limite] - Límite mensual (default: MAPS_MAX_LOADS_PER_MONTH o 10000)
   * @returns {Promise<{ habilitado: boolean, contador: number | null, error?: string }>}
   */
  static async incrementarSiHabilitado(pool, { anio, mes, limite } = {}) {
    const fechaActual = new Date();
    const anioActual = anio || fechaActual.getFullYear();
    const mesActual = mes || (fechaActual.getMonth() + 1);
    const limiteEfectivo = limite || parseInt(process.env.MAPS_MAX_LOADS_PER_MONTH, 10) || LIMITE_CARGAS_DEFAULT;

    const sql = `
      INSERT INTO bpkm.tbl_contador_cargas_mapa (anio, mes, contador, fecha_actualizacion)
      VALUES ($1, $2, 1, NOW())
      ON CONFLICT (anio, mes) DO UPDATE
        SET contador = bpkm.tbl_contador_cargas_mapa.contador + 1,
            fecha_actualizacion = NOW()
      WHERE bpkm.tbl_contador_cargas_mapa.contador < $3
      RETURNING contador;
    `;

    try {
      const { rows } = await pool.query(sql, [anioActual, mesActual, limiteEfectivo]);
      if (rows && rows.length > 0) {
        return { habilitado: true, contador: Number(rows[0].contador) };
      }
      // Si rows está vacío, la condición WHERE evitó el update porque ya se alcanzó el límite
      return { habilitado: false, contador: limiteEfectivo };
    } catch (err) {
      console.error('[ContadorCargasMapa] Error en incremento atómico (falla cerrada):', err.message);
      return { habilitado: false, contador: null, error: err.message };
    }
  }

  /**
   * Obtiene el estado actual del contador sin incrementarlo.
   *
   * @param {object} pool - Pool de conexiones PostgreSQL
   * @param {object} [opciones]
   * @param {number} [opciones.anio]
   * @param {number} [opciones.mes]
   * @param {number} [opciones.limite]
   * @returns {Promise<{ habilitado: boolean, contador: number | null, limite: number, error?: string }>}
   */
  static async obtenerEstado(pool, { anio, mes, limite } = {}) {
    const fechaActual = new Date();
    const anioActual = anio || fechaActual.getFullYear();
    const mesActual = mes || (fechaActual.getMonth() + 1);
    const limiteEfectivo = limite || parseInt(process.env.MAPS_MAX_LOADS_PER_MONTH, 10) || LIMITE_CARGAS_DEFAULT;

    try {
      const { rows } = await pool.query(
        `SELECT contador FROM bpkm.tbl_contador_cargas_mapa WHERE anio = $1 AND mes = $2`,
        [anioActual, mesActual]
      );
      const contador = rows?.[0]?.contador != null ? Number(rows[0].contador) : 0;
      return {
        habilitado: contador < limiteEfectivo,
        contador,
        limite: limiteEfectivo
      };
    } catch (err) {
      console.error('[ContadorCargasMapa] Error obteniendo estado:', err.message);
      return { habilitado: false, contador: null, limite: limiteEfectivo, error: err.message };
    }
  }
}

module.exports = ContadorCargasMapa;
