import { describe, it, expect, vi } from 'vitest';
import Seleccion from '../../../../src/models/bpkm/Seleccion';

function makeMockPool({
  items = [
    {
      id_factura_sel: '101',
      id_factura: '5001',
      folio_factura: 'F-1234',
      forma_codigo: 'CAM',
      estado_codigo: 'ACT',
      es_creador: true,
      puede_reenviar: true,
      tiene_evidencia: true,
      en_ruta: '0',
      anulada: '0'
    }
  ],
  total = 42,
  resumenFilas = [
    { estado: 'ACT', conteo: '15' },
    { estado: 'EN_RUTA', conteo: '8' },
    { estado: 'FALLIDA', conteo: '2' }
  ]
} = {}) {
  return {
    query: vi.fn((sql) => {
      if (sql.includes('SELECT COUNT(*)::bigint AS total')) {
        return Promise.resolve({ rows: [{ total: String(total) }] });
      }
      if (sql.includes("e.codigo IN ('ACT', 'EN_RUTA')")) {
        return Promise.resolve({ rows: resumenFilas });
      }
      return Promise.resolve({ rows: items });
    })
  };
}

describe('models/bpkm/Seleccion', () => {
  describe('listarMisFacturas', () => {
    it('acota "limit" entre 1 y 100', async () => {
      const pool = makeMockPool();
      const resAlto = await Seleccion.listarMisFacturas({ limit: 500 }, pool);
      const resBajo = await Seleccion.listarMisFacturas({ limit: 1 }, pool);
      const resInvalido = await Seleccion.listarMisFacturas({ limit: -5 }, pool);

      expect(resAlto.resumen.pagination.limit).toBe(100);
      expect(resBajo.resumen.pagination.limit).toBe(1);
      expect(resInvalido.resumen.pagination.limit).toBe(50);
    });

    it('calcula el offset en el servidor a partir de "page"', async () => {
      const pool = makeMockPool();
      const res = await Seleccion.listarMisFacturas({ page: 3, limit: 25 }, pool);

      expect(res.resumen.pagination.page).toBe(3);
      expect(res.resumen.pagination.limit).toBe(25);
      const llamadaItems = pool.query.mock.calls.find(([sql]) => sql.includes('LIMIT $8 OFFSET $9'));
      const params = llamadaItems[1];
      expect(params[params.length - 2]).toBe(25); // limitNum
      expect(params[params.length - 1]).toBe(50); // offsetNum = (3 - 1) * 25
    });

    it('respeta "offset" directo si viene del frontend (ej. paginador DataTable) deduciendo la página', async () => {
      const pool = makeMockPool();
      const res = await Seleccion.listarMisFacturas({ offset: 100, limit: 50 }, pool);

      expect(res.resumen.pagination.page).toBe(3); // floor(100/50) + 1
      const llamadaItems = pool.query.mock.calls.find(([sql]) => sql.includes('LIMIT $8 OFFSET $9'));
      const params = llamadaItems[1];
      expect(params[params.length - 1]).toBe(100);
    });

    it('retorna la estructura esperada con pagination y por_estado dentro de resumen', async () => {
      const pool = makeMockPool();
      const res = await Seleccion.listarMisFacturas({ page: 1, limit: 50 }, pool);

      expect(res.total).toBeUndefined();
      expect(res.items).toHaveLength(1);
      expect(res.resumen).toEqual({
        pagination: {
          total: 42,
          page: 1,
          limit: 50
        },
        por_estado: {
          ACT: 15,
          EN_RUTA: 8,
          FALLIDA: 2
        }
      });
    });

    it('la consulta de por_estado filtra ACT y EN_RUTA en general, y FALLIDA únicamente de la última semana', async () => {
      const pool = makeMockPool();
      await Seleccion.listarMisFacturas({ estado_codigo: 'ACT', folio_like: '123' }, pool);

      const llamadaResumen = pool.query.mock.calls.find(([sql]) =>
        sql.includes("e.codigo IN ('ACT', 'EN_RUTA')")
      );
      expect(llamadaResumen).toBeDefined();
      const [sqlResumen] = llamadaResumen;

      expect(sqlResumen).toContain("e.codigo IN ('ACT', 'EN_RUTA')");
      expect(sqlResumen).toContain("e.codigo = 'FALLIDA' AND s.fecha_creacion >= NOW() - INTERVAL '7 days'");
      expect(sqlResumen).not.toContain('$7::varchar');
    });

    it('mapea correctamente booleanos y números incluyendo tiene_evidencias', async () => {
      const pool = makeMockPool({
        items: [
          {
            id_factura_sel: '101',
            id_factura: '5001',
            folio_factura: 'F-1234',
            forma_codigo: 'CAM',
            estado_codigo: 'ACT',
            es_creador: true,
            puede_reenviar: true,
            tiene_evidencias: true,
            en_ruta: '0',
            anulada: '0'
          }
        ]
      });
      const res = await Seleccion.listarMisFacturas({}, pool);

      expect(res.items.length).toBe(1);
      const item = res.items[0];
      expect(item.id_factura_sel).toBe(101);
      expect(item.id_factura).toBe(5001);
      expect(item.tiene_evidencias).toBe(true);
      expect(item.tiene_evidencia).toBeUndefined();
      expect(item.es_creador).toBe(true);
      expect(item.puede_reenviar).toBe(true);
      expect(item.en_ruta).toBe(0);
      expect(item.anulada).toBe(0);
    });
  });
});
