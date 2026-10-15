import { describe, it, expect, vi } from 'vitest';
import Bpkm from '../../../../src/models/bpkm/Bpkm';

function makeMockPool({ items = [{ id_bpkm: 1 }], total = 1, resumenFilas = [], pendientes = 0 } = {}) {
  return {
    query: vi.fn((sql) => {
      if (sql.includes('COUNT(*) AS total FROM (') && sql.includes("distancia_anterior IS NULL")) {
        return Promise.resolve({ rows: [{ total: String(pendientes) }] });
      }
      if (sql.includes('COUNT(*) AS total FROM (')) {
        return Promise.resolve({ rows: [{ total: String(total) }] });
      }
      if (sql.includes("e.codigo IN ('PEND', 'APR')")) {
        return Promise.resolve({ rows: resumenFilas });
      }
      return Promise.resolve({ rows: items });
    })
  };
}

describe('models/bpkm/Bpkm', () => {
  describe('listarBandeja (mantenimiento Fase 4)', () => {
    it('acota "limit" entre 10 y 100', async () => {
      const pool = makeMockPool();
      const resAlto = await Bpkm.listarBandeja({ limit: 500 }, pool);
      const resBajo = await Bpkm.listarBandeja({ limit: 1 }, pool);

      expect(resAlto.limit).toBe(100);
      expect(resBajo.limit).toBe(10);
    });

    it('usa el offset calculado en servidor según "page"', async () => {
      const pool = makeMockPool();
      const res = await Bpkm.listarBandeja({ page: 3, limit: 25 }, pool);

      expect(res.page).toBe(3);
      const llamadaItems = pool.query.mock.calls.find(([sql]) => sql.includes('LIMIT $') && !sql.includes('COUNT(*)'));
      const params = llamadaItems[1];
      expect(params[params.length - 1]).toBe(50); // offset = (3-1)*25
    });

    it('con exportar:true ignora page/limit y usa el tope de exportación (5000)', async () => {
      const pool = makeMockPool();
      const res = await Bpkm.listarBandeja({ page: 5, limit: 25, exportar: true }, pool);

      expect(res.limit).toBe(5000);
      expect(res.page).toBe(1);
    });

    it('arma el resumen por_estado solo con PEND y APR, ignorando otros códigos', async () => {
      const pool = makeMockPool({
        resumenFilas: [{ codigo: 'PEND', conteo: '4' }, { codigo: 'APR', conteo: '1' }, { codigo: 'FIN_RRHH', conteo: '9' }]
      });
      const res = await Bpkm.listarBandeja({}, pool);

      expect(res.resumen).toEqual({ por_estado: { PEND: 4, APR: 1 } });
    });

    it('devuelve por_estado en 0 cuando no hay filas en el resumen', async () => {
      const pool = makeMockPool({ resumenFilas: [] });
      const res = await Bpkm.listarBandeja({}, pool);

      expect(res.resumen).toEqual({ por_estado: { PEND: 0, APR: 0 } });
    });

    it('con estado_excluido, manda el código a excluir en los parámetros de la consulta de items', async () => {
      const pool = makeMockPool();
      await Bpkm.listarBandeja({ estado_excluido: 'PEND' }, pool);

      const llamadaItems = pool.query.mock.calls.find(([sql]) => sql.includes('LIMIT $') && !sql.includes('COUNT(*)'));
      expect(llamadaItems[0]).toContain('e.codigo IS DISTINCT FROM $7');
      expect(llamadaItems[1]).toContain('PEND');
    });
  });

  describe('listarCamionesFiltro (mantenimiento)', () => {
    it('la sucursal de cada camión es la de SALIDA de sus rutas, no la actual del camión', async () => {
      const pool = makeMockPool({ items: [{ id_camion: 1, placa: 'C-1', id_sucursal: 3, sucursal: 'Zona 1' }] });
      const res = await Bpkm.listarCamionesFiltro(pool);

      const [sql] = pool.query.mock.calls[0];
      expect(sql).toContain('tr.id_sucursal_salida AS id_sucursal');
      expect(sql).not.toContain('tc.id_sucursal');
      expect(res).toEqual([{ id_camion: 1, placa: 'C-1', id_sucursal: 3, sucursal: 'Zona 1' }]);
    });
  });

  describe('getBpkm - Distancia de Rutas (mantenimiento Fase 4)', () => {
    it('filtra estado_distancia=PENDIENTE contra distancia_anterior IS NULL en SQL, no en memoria', async () => {
      const pool = makeMockPool();
      await Bpkm.getBpkm({ estado_distancia: 'PENDIENTE' }, pool);

      const llamadaItems = pool.query.mock.calls.find(([sql]) => sql.includes('LIMIT $') && !sql.includes('COUNT(*)'));
      expect(llamadaItems[0]).toContain('b.distancia_anterior IS NULL');
    });

    it('filtra estado_distancia=INGRESADO contra distancia_anterior IS NOT NULL en SQL', async () => {
      const pool = makeMockPool();
      await Bpkm.getBpkm({ estado_distancia: 'INGRESADO' }, pool);

      const llamadaItems = pool.query.mock.calls.find(([sql]) => sql.includes('LIMIT $') && !sql.includes('COUNT(*)'));
      expect(llamadaItems[0]).toContain('b.distancia_anterior IS NOT NULL');
    });

    it('mantiene la forma de respuesta { items, pagination: { total_pendientes } } que ya consume el frontend', async () => {
      const pool = makeMockPool({
        items: [{ id_bpkm: 1, codigo_ruta: 'RT-1', distancia_anterior: null }],
        total: 1,
        pendientes: 7
      });
      const res = await Bpkm.getBpkm({}, pool);

      expect(res.items[0].estado_distancia).toBe('PENDIENTE');
      expect(res.pagination.total).toBe(1);
      expect(res.pagination.total_pendientes).toBe(7);
    });

    it('deriva estado_distancia=INGRESADO cuando distancia_anterior no es null', async () => {
      const pool = makeMockPool({ items: [{ id_bpkm: 2, distancia_anterior: 12.5 }] });
      const res = await Bpkm.getBpkm({}, pool);

      expect(res.items[0].estado_distancia).toBe('INGRESADO');
    });

    it('incluye distancia_mas_lejana_gmaps en cada item y en el SQL base', async () => {
      const pool = makeMockPool({
        items: [
          { id_bpkm: 1, distancia_mas_lejana_gmaps: '45.80' },
          { id_bpkm: 2, distancia_mas_lejana_gmaps: null }
        ]
      });
      const res = await Bpkm.getBpkm({}, pool);

      const llamadaItems = pool.query.mock.calls.find(([sql]) => sql.includes('LIMIT $') && !sql.includes('COUNT(*)'));
      expect(llamadaItems[0]).toContain('LEFT JOIN bpkm.tbl_distancias_ruta dr_dist');
      expect(llamadaItems[0]).toContain('MAX(dr_dist.distancia_km) AS distancia_mas_lejana_gmaps');
      expect(res.items[0].distancia_mas_lejana_gmaps).toBe('45.80');
      expect(res.items[1].distancia_mas_lejana_gmaps).toBeNull();
    });
  });
});

