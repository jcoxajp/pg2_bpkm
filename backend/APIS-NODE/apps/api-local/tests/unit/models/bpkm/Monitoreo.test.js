import { describe, it, expect, vi } from 'vitest';
import Monitoreo from '../../../../src/models/bpkm/Monitoreo';

function makeMockPool({ existentes = [], aprobado = false, insertResult = { id_monitoreo_bpkm: 1 } } = {}) {
  return {
    query: vi.fn((sql) => {
      if (sql.includes('tbl_monitoreo_bpkm WHERE id_ruta')) {
        return Promise.resolve({ rows: existentes });
      }
      if (sql.includes('tbl_bpkm') && sql.includes('usuario_gerencia')) {
        return Promise.resolve({ rows: aprobado ? [{ '?column?': 1 }] : [] });
      }
      if (sql.includes('bpkm.post_monitoreo_bpkm')) {
        return Promise.resolve({ rows: [insertResult] });
      }
      return Promise.resolve({ rows: [] });
    })
  };
}

const payloadBase = { id_ruta: 1, id_usuario: 10, tipo: 'S', fecha_hora: '2026-09-22 08:00:00', comentario: null };

describe('models/bpkm/Monitoreo', () => {
  describe('registrar (mantenimiento 3.16 - no modifica el SP, solo lo envuelve)', () => {
    it('registra "S" cuando no hay ningún registro previo para la ruta', async () => {
      const pool = makeMockPool({ existentes: [] });
      const res = await Monitoreo.registrar(payloadBase, pool);

      expect(res.ok).toBe(true);
      const llamada = pool.query.mock.calls.find(([sql]) => sql.includes('bpkm.post_monitoreo_bpkm'));
      expect(llamada[1]).toEqual([1, 10, 'S', expect.any(String), null]);
    });

    it('envía "fecha_hora" al SP tal cual llegó, sin convertirla a UTC (la columna es timestamp sin zona horaria)', async () => {
      const pool = makeMockPool({ existentes: [] });
      await Monitoreo.registrar(payloadBase, pool);

      const llamada = pool.query.mock.calls.find(([sql]) => sql.includes('bpkm.post_monitoreo_bpkm'));
      expect(llamada[1][3]).toBe('2026-09-22 08:00:00');
    });

    it('rechaza "S" si ya existe un registro de salida para la ruta (evita el upsert silencioso del SP)', async () => {
      const pool = makeMockPool({ existentes: [{ tipo: 'S', fecha_hora: '2026-09-22T08:00:00' }] });
      const res = await Monitoreo.registrar(payloadBase, pool);

      expect(res).toEqual({ ok: false, error: 'Ya existe un registro de salida para esta ruta.' });
      expect(pool.query.mock.calls.some(([sql]) => sql.includes('bpkm.post_monitoreo_bpkm'))).toBe(false);
    });

    it('rechaza "E" si no existe un registro de salida previo', async () => {
      const pool = makeMockPool({ existentes: [] });
      const res = await Monitoreo.registrar({ ...payloadBase, tipo: 'E' }, pool);

      expect(res).toEqual({ ok: false, error: 'No se puede registrar la entrada sin haber registrado la salida.' });
    });

    it('rechaza "E" si ya existe un registro de entrada para la ruta', async () => {
      const pool = makeMockPool({
        existentes: [
          { tipo: 'S', fecha_hora: '2026-09-22T08:00:00' },
          { tipo: 'E', fecha_hora: '2026-09-22T18:00:00' }
        ]
      });
      const res = await Monitoreo.registrar({ ...payloadBase, tipo: 'E', fecha_hora: '2026-09-23 08:00:00' }, pool);

      expect(res).toEqual({ ok: false, error: 'Ya existe un registro de entrada para esta ruta.' });
    });

    it('rechaza "E" con fecha anterior o igual a la de "S"', async () => {
      const pool = makeMockPool({ existentes: [{ tipo: 'S', fecha_hora: '2026-09-22T18:00:00' }] });
      const res = await Monitoreo.registrar({ ...payloadBase, tipo: 'E', fecha_hora: '2026-09-22 08:00:00' }, pool);

      expect(res).toEqual({ ok: false, error: 'La fecha de entrada debe ser posterior a la fecha de salida.' });
    });

    it('registra "E" cuando la fecha es posterior a la de "S"', async () => {
      const pool = makeMockPool({ existentes: [{ tipo: 'S', fecha_hora: '2026-09-22T08:00:00' }] });
      const res = await Monitoreo.registrar({ ...payloadBase, tipo: 'E', fecha_hora: '2026-09-22 18:00:00' }, pool);

      expect(res.ok).toBe(true);
    });

    it('rechaza cualquier registro si el BPKM de la ruta ya fue aprobado por gerencia', async () => {
      const pool = makeMockPool({ existentes: [], aprobado: true });
      const res = await Monitoreo.registrar(payloadBase, pool);

      expect(res).toEqual({
        ok: false,
        error: 'No se puede registrar monitoreo. El BPKM de esta ruta ya fue aprobado por gerencia.'
      });
      expect(pool.query.mock.calls.some(([sql]) => sql.includes('bpkm.post_monitoreo_bpkm'))).toBe(false);
    });

    it('rechaza el registro si no se manda "fecha_hora"', async () => {
      const pool = makeMockPool({ existentes: [] });
      const res = await Monitoreo.registrar({ ...payloadBase, fecha_hora: null }, pool);

      expect(res).toEqual({ ok: false, error: 'fecha_hora es obligatorio.' });
      expect(pool.query.mock.calls.some(([sql]) => sql.includes('bpkm.post_monitoreo_bpkm'))).toBe(false);
    });

    it('rechaza el registro si "fecha_hora" no es una fecha válida', async () => {
      const pool = makeMockPool({ existentes: [] });
      const res = await Monitoreo.registrar({ ...payloadBase, fecha_hora: 'no-es-una-fecha' }, pool);

      expect(res).toEqual({ ok: false, error: 'fecha_hora debe ser una fecha/hora válida.' });
      expect(pool.query.mock.calls.some(([sql]) => sql.includes('bpkm.post_monitoreo_bpkm'))).toBe(false);
    });
  });

  describe('listar (mantenimiento 3.16.1 - bandeja paginada, reemplaza bpkm.get_rutas_con_monitoreo)', () => {
    function makeMockListarPool({ items = [{ id_ruta: 1 }], total = 1, sinSalida = 0, sinEntrada = 0, proximas = [], regresaron = [] } = {}) {
      return {
        query: vi.fn((sql) => {
          if (sql.includes("sub.tiene_salida AND sub.estado_nombre IN")) {
            return Promise.resolve({ rows: [{ total: String(sinSalida) }] });
          }
          if (sql.includes('sub.tiene_salida AND NOT sub.tiene_entrada')) {
            return Promise.resolve({ rows: [{ total: String(sinEntrada) }] });
          }
          if (sql.includes('COUNT(*) AS total FROM (')) {
            return Promise.resolve({ rows: [{ total: String(total) }] });
          }
          if (sql.includes("CURRENT_DATE + INTERVAL '2 days'")) {
            return Promise.resolve({ rows: proximas });
          }
          if (sql.includes("'Regresada', 'Finalizada'")) {
            return Promise.resolve({ rows: regresaron });
          }
          return Promise.resolve({ rows: items });
        })
      };
    }

    const llamadaItems = (pool) =>
      pool.query.mock.calls.find(([sql]) => sql.includes('LIMIT $') && sql.includes('OFFSET $'));

    it('acota "limit" entre 10 y 100', async () => {
      const pool = makeMockListarPool();
      const resAlto = await Monitoreo.listar({ limit: 500 }, pool);
      const resBajo = await Monitoreo.listar({ limit: 1 }, pool);

      expect(resAlto.limit).toBe(100);
      expect(resBajo.limit).toBe(10);
    });

    it('usa el offset calculado en servidor según "page"', async () => {
      const pool = makeMockListarPool();
      const res = await Monitoreo.listar({ page: 3, limit: 25 }, pool);

      expect(res.page).toBe(3);
      const params = llamadaItems(pool)[1];
      expect(params[params.length - 1]).toBe(50); // offset = (3-1)*25
    });

    it('devuelve el resumen con los conteos reales de sin_salida/sin_entrada, no solo de la página', async () => {
      const pool = makeMockListarPool({ sinSalida: 7, sinEntrada: 3 });
      const res = await Monitoreo.listar({}, pool);

      expect(res.resumen).toEqual({ sin_salida: 7, sin_entrada: 3 });
    });

    it('devuelve destacadas.proximas_salir y destacadas.que_regresaron como filas, no conteos', async () => {
      const proximas = [{ id_ruta: 10 }];
      const regresaron = [{ id_ruta: 20 }];
      const pool = makeMockListarPool({ proximas, regresaron });
      const res = await Monitoreo.listar({}, pool);

      expect(res.destacadas).toEqual({ proximas_salir: proximas, que_regresaron: regresaron });
    });

    it('destacadas.proximas_salir se limita a un máximo de filas', async () => {
      const pool = makeMockListarPool();
      await Monitoreo.listar({}, pool);

      const llamada = pool.query.mock.calls.find(([sql]) => sql.includes("CURRENT_DATE + INTERVAL '2 days'"));
      expect(llamada[0]).toContain('LIMIT 12');
    });

    it('excluye siempre las rutas con estado "Cancelada"', async () => {
      const pool = makeMockListarPool();
      await Monitoreo.listar({}, pool);

      const [sql] = llamadaItems(pool);
      expect(sql).toContain("e.nombre IS DISTINCT FROM 'Cancelada'");
    });

    it('filtra por fecha_salida_plan, no por fecha_creacion (mantenimiento 3.16.1)', async () => {
      const pool = makeMockListarPool();
      await Monitoreo.listar({ fecha_desde: '2026-01-01', fecha_hasta: '2026-01-31' }, pool);

      const [sql, params] = llamadaItems(pool);
      expect(sql).toContain('r.fecha_salida_plan::date >= $2::date');
      expect(sql).toContain('r.fecha_salida_plan::date <= $3::date');
      expect(sql).not.toContain('fecha_creacion');
      expect(params[1]).toBe('2026-01-01');
      expect(params[2]).toBe('2026-01-31');
    });

    it('"id_suc_salida" es un filtro simple, sin restricción real (Monitoreo debe ver todas las sucursales)', async () => {
      const pool = makeMockListarPool();
      await Monitoreo.listar({ id_suc_salida: 5 }, pool);

      const [sql, params] = llamadaItems(pool);
      expect(sql).toContain('($4::int = 0 OR r.id_sucursal_salida = $4::int)');
      expect(params[3]).toBe(5);
    });

    it('expone el código de ruta como "codigo_ruta", igual que models/bpkm/Ruta.js', async () => {
      const pool = makeMockListarPool();
      await Monitoreo.listar({}, pool);

      const [sql] = llamadaItems(pool);
      expect(sql).toContain('r.numero_ruta AS codigo_ruta');
    });

    it('no selecciona monto_total_transportado ni total_facturas (datos financieros que Monitoreo no debe exponer)', async () => {
      const pool = makeMockListarPool();
      await Monitoreo.listar({}, pool);

      const [sql] = llamadaItems(pool);
      expect(sql).not.toContain('monto_total_transportado');
      expect(sql).not.toContain('total_facturas');
    });
  });
});
