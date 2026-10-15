process.env.JWT_SECRET = 'test-jwt-secret-bpkm';

import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { createToken, makeMockPool, buildApp } from './helpers/bpkmTestApp.js';

describe('routes/bpkm/cambiosForma.js', () => {
  let makeCambiosFormaRouter;

  beforeAll(async () => {
    makeCambiosFormaRouter = (await import('../../../../src/routes/bpkm/cambiosForma.js')).default;
  });

  describe('Permiso de módulo "cambiosformaentrega" (mantenimiento 3.2)', () => {
    it('POST /get_solicitudes_cambio responde 403 sin el permiso', async () => {
      const pool = makeMockPool({ permisosPorUsuario: { 10: [] } });
      const app = buildApp(pool, makeCambiosFormaRouter);
      const token = createToken(10);

      const res = await request(app)
        .post('/api/bpkm/get_solicitudes_cambio')
        .set('Authorization', `Bearer ${token}`)
        .send({ id_usuario: 10 });

      expect(res.status).toBe(403);
    });

    it('POST /get_cambios_por_seleccion responde 200 con el permiso', async () => {
      const pool = makeMockPool({ permisosPorUsuario: { 10: ['cambiosformaentrega'] } });
      const app = buildApp(pool, makeCambiosFormaRouter);
      const token = createToken(10);

      const res = await request(app)
        .post('/api/bpkm/get_cambios_por_seleccion')
        .set('Authorization', `Bearer ${token}`)
        .send({ id_factura_sel: 1 });

      expect(res.status).toBe(200);
    });
  });

  describe('Identidad del actor (corrección) - get_solicitudes_cambio ignora "id_usuario" del body', () => {
    it('usa el usuario del JWT aunque el body mande el id de otro usuario', async () => {
      const pool = makeMockPool({ permisosPorUsuario: { 10: ['cambiosformaentrega'] } });
      const app = buildApp(pool, makeCambiosFormaRouter);
      const token = createToken(10);

      const res = await request(app)
        .post('/api/bpkm/get_solicitudes_cambio')
        .set('Authorization', `Bearer ${token}`)
        .send({ id_usuario: 999 });

      expect(res.status).toBe(200);
      const llamada = pool.query.mock.calls.find(([sql]) => sql.includes('bpkm.get_solicitudes_cambio'));
      expect(llamada[1][6]).toBe(10);
    });
  });
});
