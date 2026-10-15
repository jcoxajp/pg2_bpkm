import { describe, it, expect, vi, afterEach } from 'vitest';
import { createRequire } from 'module';

// require() para espiar la misma instancia de pool que usa el Service (ver AGENTS.md raíz).
const require = createRequire(import.meta.url);
const GoogleRouteService = require('../../../../src/services/entregafacturas/GoogleRouteService');
const pool = require('../../../../src/config/database');

describe('GoogleRouteService._construirRequestBody', () => {
  const origen = { latitude: 14.6349, longitude: -90.5069 };
  const destinos = [
    { latitude: 14.6, longitude: -90.5 },
    { latitude: 14.7, longitude: -90.4 },
  ];

  it('arma origins/destinations en la forma exacta que exige Routes API', () => {
    const body = GoogleRouteService._construirRequestBody(origen, destinos);
    expect(body).toEqual({
      origins: [{ waypoint: { location: { latLng: origen } } }],
      destinations: [
        { waypoint: { location: { latLng: destinos[0] } } },
        { waypoint: { location: { latLng: destinos[1] } } },
      ],
      travelMode: 'DRIVE',
    });
  });

  it('un solo origen sin importar cuántos destinos', () => {
    const body = GoogleRouteService._construirRequestBody(origen, []);
    expect(body.origins).toHaveLength(1);
    expect(body.destinations).toHaveLength(0);
  });
});

describe('GoogleRouteService._evaluarElemento', () => {
  it('éxito: ROUTE_EXISTS + distanceMeters numérico, sin status.code', () => {
    const resultado = GoogleRouteService._evaluarElemento({
      condition: 'ROUTE_EXISTS',
      distanceMeters: 12500,
      status: {},
    });
    expect(resultado).toEqual({ exito: true, distanciaKm: 12.5 });
  });

  it('éxito: status ausente por completo', () => {
    const resultado = GoogleRouteService._evaluarElemento({
      condition: 'ROUTE_EXISTS',
      distanceMeters: 1000,
    });
    expect(resultado.exito).toBe(true);
    expect(resultado.distanciaKm).toBe(1);
  });

  it('falla: condition ROUTE_NOT_FOUND', () => {
    const resultado = GoogleRouteService._evaluarElemento({
      condition: 'ROUTE_NOT_FOUND',
    });
    expect(resultado.exito).toBe(false);
    expect(resultado.mensaje).toMatch(/ROUTE_NOT_FOUND/);
  });

  it('falla: status.code presente aunque distanceMeters venga', () => {
    const resultado = GoogleRouteService._evaluarElemento({
      condition: 'ROUTE_EXISTS',
      distanceMeters: 500,
      status: { code: 3, message: 'INVALID_ARGUMENT' },
    });
    expect(resultado.exito).toBe(false);
    expect(resultado.mensaje).toBe('INVALID_ARGUMENT');
  });

  it('falla: distanceMeters ausente', () => {
    const resultado = GoogleRouteService._evaluarElemento({ condition: 'ROUTE_EXISTS' });
    expect(resultado.exito).toBe(false);
  });

  it('usa mensaje genérico cuando status.message no viene', () => {
    const resultado = GoogleRouteService._evaluarElemento({ condition: 'ROUTE_NOT_FOUND', status: {} });
    expect(resultado.mensaje).toBe('Sin ruta encontrada (condition: ROUTE_NOT_FOUND)');
  });
});

describe('GoogleRouteService.calcularDistanciasRuta — destinos desde la geo de la entrega', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('manda a Routes API la lat/lng de cada entrega (numérica) con la sucursal como origen', async () => {
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(pool, 'query').mockResolvedValueOnce({ rows: [{ origen_lat: '14.6349000', origen_lng: '-90.5069000' }] });
    vi.spyOn(GoogleRouteService, '_destinosPendientes').mockResolvedValueOnce([
      { id_detalle_ruta: 1, latitud: '14.7000000', longitud: '-90.4000000' },
      { id_detalle_ruta: 2, latitud: '14.8000000', longitud: '-90.3000000' },
    ]);
    const spyApi = vi.spyOn(GoogleRouteService, '_llamarRoutesApi').mockResolvedValueOnce([
      { destinationIndex: 0, condition: 'ROUTE_EXISTS', distanceMeters: 1500 },
      { destinationIndex: 1, condition: 'ROUTE_EXISTS', distanceMeters: 2500 },
    ]);
    const spyResultado = vi.spyOn(GoogleRouteService, '_registrarResultado').mockResolvedValue(undefined);

    await GoogleRouteService.calcularDistanciasRuta(55);

    expect(GoogleRouteService._destinosPendientes).toHaveBeenCalledWith(55);
    expect(spyApi).toHaveBeenCalledWith(
      { latitude: 14.6349, longitude: -90.5069 },
      [{ latitude: 14.7, longitude: -90.4 }, { latitude: 14.8, longitude: -90.3 }]
    );
    expect(spyResultado).toHaveBeenCalledWith(1, 1.5);
    expect(spyResultado).toHaveBeenCalledWith(2, 2.5);
  });

  it('sin destinos pendientes no llama a Routes API', async () => {
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(pool, 'query').mockResolvedValueOnce({ rows: [{ origen_lat: '14.6', origen_lng: '-90.5' }] });
    vi.spyOn(GoogleRouteService, '_destinosPendientes').mockResolvedValueOnce([]);
    const spyApi = vi.spyOn(GoogleRouteService, '_llamarRoutesApi');

    await GoogleRouteService.calcularDistanciasRuta(55);

    expect(spyApi).not.toHaveBeenCalled();
  });
});
