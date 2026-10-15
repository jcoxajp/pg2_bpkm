require('../helpers/loadEnv');
import { describe, it, expect, vi, afterAll } from 'vitest';
// require(), no import: los import ESM se evalúan antes que loadEnv() de arriba (hoisting) y el
// pool quedaría con PG_PASSWORD vacío. app.js no lo sufre porque llama dotenv en su primera
// línea; este archivo no pasa por app.js, necesita su propia garantía de orden.
const GoogleRouteService = require('../../../src/services/entregafacturas/GoogleRouteService');
const pool = require('../../../src/config/database');

// No fabrica rutas/facturas reales — solo valida que el SQL corre contra el esquema real.
// calcularDistanciasRuta va espiado para no disparar una llamada real a Google si algún día hay
// rutas candidatas reales en desarrollo al correr esto.

afterAll(async () => {
  await pool.end();
});

describe('[integración] GoogleRouteService contra la BD real (no mockeado)', () => {
  it('calcularRutasListas() corre sin error contra el esquema real', async () => {
    const spy = vi.spyOn(GoogleRouteService, 'calcularDistanciasRuta').mockResolvedValue(undefined);
    try {
      const resultado = await GoogleRouteService.calcularRutasListas();
      expect(typeof resultado.rutasProcesadas).toBe('number');
      expect(resultado.rutasProcesadas).toBeGreaterThanOrEqual(0);
    } finally {
      spy.mockRestore();
    }
  });

  it('dispararSiListo() con una ruta inexistente no lanza (defensivo, sin efectos secundarios)', async () => {
    await expect(GoogleRouteService.dispararSiListo(-1)).resolves.toBeUndefined();
  });

  it('calcularDistanciasRuta() con una ruta inexistente no lanza — sale temprano sin coordenadas', async () => {
    await expect(GoogleRouteService.calcularDistanciasRuta(-1)).resolves.toBeUndefined();
  });

  // calcularDistanciasRuta(-1) sale antes de esta consulta: se llama directo para validar su SQL.
  it('_destinosPendientes() corre contra el esquema real y lee la geo de tbl_entregas_piloto', async () => {
    await expect(GoogleRouteService._destinosPendientes(-1)).resolves.toEqual([]);
  });
});
