import { describe, it, expect, vi } from 'vitest';
import MapaRuta from '../../../../src/models/bpkm/MapaRuta.js';

describe('MapaRuta', () => {
  const filaBase = {
    id_ruta: 1056,
    sucursal_id: 1,
    sucursal_nombre: 'Central',
    sucursal_latitud: '14.5981399',
    sucursal_longitud: '-90.5213547',
    id_detalle_ruta: 11566,
    folio_factura: '001059CR77528',
    entrega_latitud: '14.5982695',
    entrega_longitud: '-90.5214996',
    entrega_precision_metros: '200.00',
    entrega_fecha_hora: new Date('2026-09-24T19:55:44.753Z'),
    entrega_resultado: 'ENT',
    distancia_km: '40.00',
    distancia_estado_calculo: 'OK'
  };

  describe('obtenerPorRuta', () => {
    it('retorna sucursal, puntos y mapa_habilitado: true cuando hay coordenadas y el contador lo permite', async () => {
      const mockPool = {
        query: vi.fn().mockResolvedValue({
          rows: [
            filaBase,
            {
              ...filaBase,
              id_detalle_ruta: 11567,
              folio_factura: '001059CR77503',
              distancia_km: null,
              distancia_estado_calculo: 'ERROR'
            }
          ]
        })
      };

      const mockContador = {
        incrementarSiHabilitado: vi.fn().mockResolvedValue({ habilitado: true, contador: 15 })
      };

      const res = await MapaRuta.obtenerPorRuta(mockPool, 1056, { contadorModel: mockContador });

      expect(res.mapa_habilitado).toBe(true);
      expect(mockContador.incrementarSiHabilitado).toHaveBeenCalledTimes(1);

      // Sucursal formateada
      expect(res.sucursal).toEqual({
        id_sucursal: 1,
        nombre: 'Central',
        latitud: 14.5981399,
        longitud: -90.5213547
      });

      // Puntos formateados
      expect(res.puntos).toHaveLength(2);
      expect(res.puntos[0]).toEqual({
        id_detalle_ruta: 11566,
        folio_factura: '001059CR77528',
        latitud: 14.5982695,
        longitud: -90.5214996,
        precision_metros: 200,
        fecha_hora: '2026-09-24T19:55:44.753Z',
        resultado: 'ENT',
        distancia_km: 40,
        estado_calculo: 'OK'
      });

      // Factura con error de distancia: distancia_km es null, pero mantiene coordenadas
      expect(res.puntos[1]).toEqual({
        id_detalle_ruta: 11567,
        folio_factura: '001059CR77503',
        latitud: 14.5982695,
        longitud: -90.5214996,
        precision_metros: 200,
        fecha_hora: '2026-09-24T19:55:44.753Z',
        resultado: 'ENT',
        distancia_km: null,
        estado_calculo: 'ERROR'
      });
    });

    it('no incrementa el contador y retorna mapa_habilitado: false si no existen coordenadas en absoluto', async () => {
      const mockPool = {
        query: vi.fn().mockResolvedValue({
          rows: [
            {
              id_ruta: 1099,
              sucursal_id: 1,
              sucursal_nombre: 'Central',
              sucursal_latitud: null,
              sucursal_longitud: null,
              id_detalle_ruta: 12001,
              folio_factura: '001059CR99999',
              entrega_latitud: null,
              entrega_longitud: null,
              entrega_precision_metros: null,
              entrega_fecha_hora: null,
              entrega_resultado: null,
              distancia_km: null,
              distancia_estado_calculo: null
            }
          ]
        })
      };

      const mockContador = {
        incrementarSiHabilitado: vi.fn()
      };

      const res = await MapaRuta.obtenerPorRuta(mockPool, 1099, { contadorModel: mockContador });

      expect(res.mapa_habilitado).toBe(false);
      expect(mockContador.incrementarSiHabilitado).not.toHaveBeenCalled();
      expect(res.puntos).toHaveLength(1);
      expect(res.puntos[0].latitud).toBeNull();
    });

    it('no incrementa el contador y retorna mapa_habilitado: false si la sucursal tiene coordenadas pero ninguna factura tiene ubicacion GPS', async () => {
      const mockPool = {
        query: vi.fn().mockResolvedValue({
          rows: [
            {
              id_ruta: 1099,
              sucursal_id: 1,
              sucursal_nombre: 'Central',
              sucursal_latitud: 14.598,
              sucursal_longitud: -90.521,
              id_detalle_ruta: 12001,
              folio_factura: '001059CR99999',
              entrega_latitud: null,
              entrega_longitud: null,
              entrega_precision_metros: null,
              entrega_fecha_hora: null,
              entrega_resultado: null,
              distancia_km: null,
              distancia_estado_calculo: null
            }
          ]
        })
      };

      const mockContador = {
        incrementarSiHabilitado: vi.fn()
      };

      const res = await MapaRuta.obtenerPorRuta(mockPool, 1099, { contadorModel: mockContador });

      expect(res.mapa_habilitado).toBe(false);
      expect(mockContador.incrementarSiHabilitado).not.toHaveBeenCalled();
      expect(res.sucursal.latitud).toBe(14.598);
      expect(res.puntos[0].latitud).toBeNull();
    });

    it('retorna mapa_habilitado: false si el contador mensual ya alcanzó el tope de 10,000', async () => {
      const mockPool = {
        query: vi.fn().mockResolvedValue({
          rows: [filaBase]
        })
      };

      const mockContador = {
        incrementarSiHabilitado: vi.fn().mockResolvedValue({ habilitado: false, contador: 10000 })
      };

      const res = await MapaRuta.obtenerPorRuta(mockPool, 1056, { contadorModel: mockContador });

      expect(res.mapa_habilitado).toBe(false);
      expect(mockContador.incrementarSiHabilitado).toHaveBeenCalledTimes(1);
    });

    it('retorna vacío si la ruta no existe en base de datos', async () => {
      const mockPool = {
        query: vi.fn().mockResolvedValue({ rows: [] })
      };

      const mockContador = {
        incrementarSiHabilitado: vi.fn()
      };

      const res = await MapaRuta.obtenerPorRuta(mockPool, 99999, { contadorModel: mockContador });

      expect(res).toEqual({
        mapa_habilitado: false,
        sucursal: null,
        puntos: []
      });
      expect(mockContador.incrementarSiHabilitado).not.toHaveBeenCalled();
    });

    it('retorna vacío sin consultar la BD si idRuta es inválido', async () => {
      const mockPool = { query: vi.fn() };

      const res = await MapaRuta.obtenerPorRuta(mockPool, 'invalido');

      expect(res).toEqual({
        mapa_habilitado: false,
        sucursal: null,
        puntos: []
      });
      expect(mockPool.query).not.toHaveBeenCalled();
    });
  });

  describe('obtenerPorBpkm', () => {
    it('ejecuta consulta uniendo tbl_bpkm y retorna la información esperada', async () => {
      const mockPool = {
        query: vi.fn().mockResolvedValue({
          rows: [filaBase]
        })
      };

      const mockContador = {
        incrementarSiHabilitado: vi.fn().mockResolvedValue({ habilitado: true, contador: 1 })
      };

      const res = await MapaRuta.obtenerPorBpkm(mockPool, 378, { contadorModel: mockContador });

      expect(res.mapa_habilitado).toBe(true);
      expect(res.sucursal.nombre).toBe('Central');
      expect(mockPool.query).toHaveBeenCalledTimes(1);
      const [sql, params] = mockPool.query.mock.calls[0];
      expect(sql).toContain('FROM bpkm.tbl_bpkm b');
      expect(sql).toContain('JOIN bpkm.tbl_rutas r ON r.id_ruta = b.id_ruta');
      expect(params).toEqual([378]);
    });

    it('retorna vacío si idBpkm no es numérico', async () => {
      const mockPool = { query: vi.fn() };

      const res = await MapaRuta.obtenerPorBpkm(mockPool, null);

      expect(res).toEqual({
        mapa_habilitado: false,
        sucursal: null,
        puntos: []
      });
      expect(mockPool.query).not.toHaveBeenCalled();
    });
  });
});
