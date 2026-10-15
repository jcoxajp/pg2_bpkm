import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import ContadorCargasMapa from '../../../../src/models/bpkm/ContadorCargasMapa.js';

describe('ContadorCargasMapa', () => {
  const originalEnv = process.env.MAPS_MAX_LOADS_PER_MONTH;

  beforeEach(() => {
    delete process.env.MAPS_MAX_LOADS_PER_MONTH;
  });

  afterEach(() => {
    if (originalEnv !== undefined) {
      process.env.MAPS_MAX_LOADS_PER_MONTH = originalEnv;
    } else {
      delete process.env.MAPS_MAX_LOADS_PER_MONTH;
    }
  });

  describe('incrementarSiHabilitado', () => {
    it('inserta e incrementa en mes nuevo cuando no hay registro previo', async () => {
      const mockPool = {
        query: vi.fn().mockResolvedValue({
          rows: [{ contador: 1 }]
        })
      };

      const res = await ContadorCargasMapa.incrementarSiHabilitado(mockPool, {
        anio: 2026,
        mes: 10
      });

      expect(res).toEqual({ habilitado: true, contador: 1 });
      expect(mockPool.query).toHaveBeenCalledTimes(1);
      const [sql, params] = mockPool.query.mock.calls[0];
      expect(sql).toContain('INSERT INTO bpkm.tbl_contador_cargas_mapa');
      expect(sql).toContain('WHERE bpkm.tbl_contador_cargas_mapa.contador < $3');
      expect(params).toEqual([2026, 10, 10000]);
    });

    it('incrementa de 9999 a 10000 retornando habilitado true', async () => {
      const mockPool = {
        query: vi.fn().mockResolvedValue({
          rows: [{ contador: 10000 }]
        })
      };

      const res = await ContadorCargasMapa.incrementarSiHabilitado(mockPool, {
        anio: 2026,
        mes: 10
      });

      expect(res).toEqual({ habilitado: true, contador: 10000 });
    });

    it('bloquea y retorna habilitado false cuando el contador ya alcanzó el límite (rows vacío)', async () => {
      const mockPool = {
        query: vi.fn().mockResolvedValue({
          rows: []
        })
      };

      const res = await ContadorCargasMapa.incrementarSiHabilitado(mockPool, {
        anio: 2026,
        mes: 10
      });

      expect(res).toEqual({ habilitado: false, contador: 10000 });
    });

    it('respeta un límite personalizado pasado por parámetro', async () => {
      const mockPool = {
        query: vi.fn().mockResolvedValue({
          rows: []
        })
      };

      const res = await ContadorCargasMapa.incrementarSiHabilitado(mockPool, {
        anio: 2026,
        mes: 10,
        limite: 50
      });

      expect(res).toEqual({ habilitado: false, contador: 50 });
      expect(mockPool.query.mock.calls[0][1]).toEqual([2026, 10, 50]);
    });

    it('respeta la variable de entorno MAPS_MAX_LOADS_PER_MONTH', async () => {
      process.env.MAPS_MAX_LOADS_PER_MONTH = '500';
      const mockPool = {
        query: vi.fn().mockResolvedValue({
          rows: [{ contador: 100 }]
        })
      };

      const res = await ContadorCargasMapa.incrementarSiHabilitado(mockPool, {
        anio: 2026,
        mes: 10
      });

      expect(res).toEqual({ habilitado: true, contador: 100 });
      expect(mockPool.query.mock.calls[0][1]).toEqual([2026, 10, 500]);
    });

    it('falla cerrado (habilitado: false) si la base de datos lanza un error', async () => {
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const mockPool = {
        query: vi.fn().mockRejectedValue(new Error('Connection timeout'))
      };

      const res = await ContadorCargasMapa.incrementarSiHabilitado(mockPool, {
        anio: 2026,
        mes: 10
      });

      expect(res.habilitado).toBe(false);
      expect(res.contador).toBeNull();
      expect(res.error).toBe('Connection timeout');
      consoleErrorSpy.mockRestore();
    });
  });

  describe('obtenerEstado', () => {
    it('retorna habilitado true si el contador está por debajo del límite', async () => {
      const mockPool = {
        query: vi.fn().mockResolvedValue({
          rows: [{ contador: 450 }]
        })
      };

      const res = await ContadorCargasMapa.obtenerEstado(mockPool, {
        anio: 2026,
        mes: 10,
        limite: 1000
      });

      expect(res).toEqual({
        habilitado: true,
        contador: 450,
        limite: 1000
      });
    });

    it('retorna habilitado false si el contador iguala o supera el límite', async () => {
      const mockPool = {
        query: vi.fn().mockResolvedValue({
          rows: [{ contador: 10000 }]
        })
      };

      const res = await ContadorCargasMapa.obtenerEstado(mockPool, {
        anio: 2026,
        mes: 10,
        limite: 10000
      });

      expect(res).toEqual({
        habilitado: false,
        contador: 10000,
        limite: 10000
      });
    });

    it('retorna 0 si no hay fila registrada para ese mes', async () => {
      const mockPool = {
        query: vi.fn().mockResolvedValue({
          rows: []
        })
      };

      const res = await ContadorCargasMapa.obtenerEstado(mockPool, {
        anio: 2026,
        mes: 10
      });

      expect(res).toEqual({
        habilitado: true,
        contador: 0,
        limite: 10000
      });
    });
  });
});
