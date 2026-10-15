import { describe, it, expect, vi } from 'vitest';
import Ruta from '../../../../src/models/bpkm/Ruta';

function makeMockPool({ items = [{ id_ruta: 1 }], total = 1, enCurso = 0 } = {}) {
  return {
    query: vi.fn((sql) => {
      if (sql.includes('COUNT(*) AS total FROM (')) {
        return Promise.resolve({ rows: [{ total: String(total) }] });
      }
      if (sql.includes('COUNT(DISTINCT r.id_ruta) AS conteo')) {
        return Promise.resolve({ rows: [{ conteo: String(enCurso) }] });
      }
      return Promise.resolve({ rows: items });
    })
  };
}

const llamadaItems = (pool) =>
  pool.query.mock.calls.find(([sql]) => sql.includes('LIMIT $') && !sql.includes('COUNT(*)'));

describe('models/bpkm/Ruta', () => {
  describe('listar (mantenimiento Fase 4 / 3.14)', () => {
    it('acota "limit" entre 10 y 100', async () => {
      const pool = makeMockPool();
      const resAlto = await Ruta.listar({ limit: 500, id_sucursal_usuario: 10 }, pool);
      const resBajo = await Ruta.listar({ limit: 1, id_sucursal_usuario: 10 }, pool);

      expect(resAlto.limit).toBe(100);
      expect(resBajo.limit).toBe(10);
    });

    it('usa el offset calculado en servidor según "page"', async () => {
      const pool = makeMockPool();
      const res = await Ruta.listar({ page: 3, limit: 25, id_sucursal_usuario: 10 }, pool);

      expect(res.page).toBe(3);
      const params = llamadaItems(pool)[1];
      expect(params[params.length - 1]).toBe(50); // offset = (3-1)*25
    });

    it('sin sucursal asignada al usuario no ve ninguna ruta (falla cerrado) y no consulta la BD', async () => {
      const pool = makeMockPool();
      const res = await Ruta.listar({ id_sucursal_usuario: null }, pool);

      expect(res).toEqual({ items: [], total: 0, page: 1, limit: 25, resumen: { por_estado: { EN_CURSO: 0 } } });
      expect(pool.query).not.toHaveBeenCalled();
    });

    it('restringe por la sucursal del usuario (salida o creador), con igualdad simple', async () => {
      const pool = makeMockPool();
      await Ruta.listar({ id_sucursal_usuario: 7 }, pool);

      const [sql, params] = llamadaItems(pool);
      expect(sql).toContain('r.id_sucursal_salida = $7::int');
      expect(sql).toContain('r.id_sucursal_creador = $7::int');
      expect(params[6]).toBe(7);
    });

    it('no existe ningún filtro de sucursal aparte del que resuelve el servidor', async () => {
      const pool = makeMockPool();
      await Ruta.listar({ id_sucursal_usuario: 3, id_suc_salida: 999, usuario: 5 }, pool);

      expect(llamadaItems(pool)[1]).not.toContain(999);
    });

    it('folio_factura arma un EXISTS con ILIKE contra tbl_detalles_ruta', async () => {
      const pool = makeMockPool();
      await Ruta.listar({ id_sucursal_usuario: 10, folio_factura: 'CR5052' }, pool);

      const [sql, params] = llamadaItems(pool);
      expect(sql).toContain('EXISTS');
      expect(sql).toContain('dr2.folio_factura ILIKE');
      expect(params).toContain('CR5052');
    });

    it('con exportar:true ignora page/limit y usa el tope de exportación (1000)', async () => {
      const pool = makeMockPool();
      const res = await Ruta.listar({ id_sucursal_usuario: 10, page: 5, limit: 25, exportar: true }, pool);

      expect(res.limit).toBe(1000);
      expect(res.page).toBe(1);
    });

    it('arma el resumen por_estado solo con EN_CURSO, calculado con los mismos filtros menos el estado', async () => {
      const pool = makeMockPool({ enCurso: 4 });
      const res = await Ruta.listar({ id_sucursal_usuario: 10, estado_codigo: 'FINALIZADA' }, pool);

      expect(res.resumen).toEqual({ por_estado: { EN_CURSO: 4 } });
      const llamadaResumen = pool.query.mock.calls.find(([sql]) => sql.includes('COUNT(DISTINCT r.id_ruta) AS conteo'));
      expect(llamadaResumen[0]).toContain("e.codigo = 'EN_CURSO'");
      expect(llamadaResumen[1]).not.toContain('FINALIZADA');
    });

    it('normaliza estado_codigo a mayúsculas', async () => {
      const pool = makeMockPool();
      await Ruta.listar({ id_sucursal_usuario: 10, estado_codigo: 'en_curso' }, pool);

      expect(llamadaItems(pool)[1]).toContain('EN_CURSO');
    });
  });
});
