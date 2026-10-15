process.env.JWT_SECRET = 'test-jwt-secret-bpkm';

import { describe, it, expect, beforeAll } from 'vitest';
import { vi } from 'vitest';
import request from 'supertest';
import { createToken, makeMockPool, buildApp } from './helpers/bpkmTestApp.js';

describe('routes/bpkm/cambiosSucursal.js', () => {
  let makeCambiosSucursalRouter;

  beforeAll(async () => {
    makeCambiosSucursalRouter = (await import('../../../../src/routes/bpkm/cambiosSucursal.js')).default;
  });

  describe('Identidad del actor viene de req.user, no del body (mantenimiento 3.1)', () => {
    it('valida la sucursal del usuario real del token, no la del body', async () => {
      const pool = {
        query: vi.fn((sql, params = []) => {
          if (sql.includes('tbl_modulos')) return Promise.resolve({ rows: [{ total: '1' }] });
          if (sql.includes('tbl_cambio_sucursal_factura')) {
            const [, idUsuario] = params;
            // Solo el usuario 10 (el del token) pertenece a la sucursal destino (5).
            const id_sucursal_usuario = idUsuario === 10 ? 5 : null;
            return Promise.resolve({ rows: [{ id_sucursal_destino: 5, id_sucursal_usuario }] });
          }
          return Promise.resolve({ rows: [{ ok: true }] });
        }),
      };
      const app = buildApp(pool, makeCambiosSucursalRouter);
      const token = createToken(10);

      const res = await request(app)
        .post('/api/bpkm/post_aprobar_cambio_sucursal')
        .set('Authorization', `Bearer ${token}`)
        .send({ id_cambio: 1, observaciones: 'ok', usuario: 999 });

      expect(res.status).toBe(200);
    });

    it('rechaza si el usuario real del token no pertenece a la sucursal destino, aunque el body diga otro id', async () => {
      const pool = {
        query: vi.fn((sql, params = []) => {
          if (sql.includes('tbl_modulos')) return Promise.resolve({ rows: [{ total: '1' }] });
          if (sql.includes('tbl_cambio_sucursal_factura')) {
            const [, idUsuario] = params;
            const id_sucursal_usuario = idUsuario === 999 ? 5 : null; // solo 999 pertenece, pero no es quien llama
            return Promise.resolve({ rows: [{ id_sucursal_destino: 5, id_sucursal_usuario }] });
          }
          return Promise.resolve({ rows: [{ ok: true }] });
        }),
      };
      const app = buildApp(pool, makeCambiosSucursalRouter);
      const token = createToken(10);

      const res = await request(app)
        .post('/api/bpkm/post_aprobar_cambio_sucursal')
        .set('Authorization', `Bearer ${token}`)
        .send({ id_cambio: 1, observaciones: 'ok', usuario: 999 });

      expect(res.status).toBe(400);
    });
  });

  describe('Permiso de módulo "cambiossucursal" (mantenimiento 3.2)', () => {
    it('POST /get_cambios_sucursal responde 403 sin el permiso', async () => {
      const pool = makeMockPool({ permisosPorUsuario: { 10: [] } });
      const app = buildApp(pool, makeCambiosSucursalRouter);
      const token = createToken(10);

      const res = await request(app)
        .post('/api/bpkm/get_cambios_sucursal')
        .set('Authorization', `Bearer ${token}`)
        .send({});

      expect(res.status).toBe(403);
    });

    it('POST /get_cambios_sucursal responde 200 con el permiso', async () => {
      const pool = makeMockPool({ permisosPorUsuario: { 10: ['cambiossucursal'] } });
      const app = buildApp(pool, makeCambiosSucursalRouter);
      const token = createToken(10);

      const res = await request(app)
        .post('/api/bpkm/get_cambios_sucursal')
        .set('Authorization', `Bearer ${token}`)
        .send({});

      expect(res.status).toBe(200);
    });

    it('POST /post_aprobar_cambio_sucursal exige "cambiossucursal", no solo pertenecer a la sucursal destino', async () => {
      const pool = makeMockPool({ permisosPorUsuario: { 10: [] } });
      const app = buildApp(pool, makeCambiosSucursalRouter);
      const token = createToken(10);

      const res = await request(app)
        .post('/api/bpkm/post_aprobar_cambio_sucursal')
        .set('Authorization', `Bearer ${token}`)
        .send({ id_cambio: 1, observaciones: 'ok' });

      expect(res.status).toBe(403);
    });

    it('POST /post_rechazar_cambio_sucursal exige "cambiossucursal", no solo pertenecer a la sucursal destino', async () => {
      const pool = makeMockPool({ permisosPorUsuario: { 10: [] } });
      const app = buildApp(pool, makeCambiosSucursalRouter);
      const token = createToken(10);

      const res = await request(app)
        .post('/api/bpkm/post_rechazar_cambio_sucursal')
        .set('Authorization', `Bearer ${token}`)
        .send({ id_cambio: 1, observaciones: 'ok' });

      expect(res.status).toBe(403);
    });
  });

  describe('Validación de esquema (mantenimiento Fase 3)', () => {
    it('POST /post_solicitar_cambio_sucursal responde 400 sin motivo', async () => {
      const pool = makeMockPool();
      const app = buildApp(pool, makeCambiosSucursalRouter);
      const token = createToken(10);

      const res = await request(app)
        .post('/api/bpkm/post_solicitar_cambio_sucursal')
        .set('Authorization', `Bearer ${token}`)
        .send({ id_factura_sel: 1, id_sucursal_destino: 5 });

      expect(res.status).toBe(400);
    });

    it('POST /post_solicitar_cambio_sucursal responde 400 con un motivo de más de 500 caracteres', async () => {
      const pool = makeMockPool();
      const app = buildApp(pool, makeCambiosSucursalRouter);
      const token = createToken(10);

      const res = await request(app)
        .post('/api/bpkm/post_solicitar_cambio_sucursal')
        .set('Authorization', `Bearer ${token}`)
        .send({ id_factura_sel: 1, id_sucursal_destino: 5, motivo: 'a'.repeat(501) });

      expect(res.status).toBe(400);
    });

    it('POST /post_aprobar_cambio_sucursal responde 400 con "observaciones" de más de 500 caracteres', async () => {
      const pool = makeMockPool({ permisosPorUsuario: { 10: ['cambiossucursal'] } });
      const app = buildApp(pool, makeCambiosSucursalRouter);
      const token = createToken(10);

      const res = await request(app)
        .post('/api/bpkm/post_aprobar_cambio_sucursal')
        .set('Authorization', `Bearer ${token}`)
        .send({ id_cambio: 1, observaciones: 'a'.repeat(501) });

      expect(res.status).toBe(400);
    });

    it('POST /post_aprobar_cambio_sucursal acepta "observaciones" en null', async () => {
      const pool = {
        query: vi.fn((sql, params = []) => {
          if (sql.includes('tbl_modulos')) return Promise.resolve({ rows: [{ total: '1' }] });
          if (sql.includes('tbl_cambio_sucursal_factura')) {
            const [, idUsuario] = params;
            return Promise.resolve({ rows: [{ id_sucursal_destino: 5, id_sucursal_usuario: idUsuario === 10 ? 5 : null }] });
          }
          return Promise.resolve({ rows: [{ ok: true }] });
        }),
      };
      const app = buildApp(pool, makeCambiosSucursalRouter);
      const token = createToken(10);

      const res = await request(app)
        .post('/api/bpkm/post_aprobar_cambio_sucursal')
        .set('Authorization', `Bearer ${token}`)
        .send({ id_cambio: 1, observaciones: null });

      expect(res.status).toBe(200);
    });
  });
});
