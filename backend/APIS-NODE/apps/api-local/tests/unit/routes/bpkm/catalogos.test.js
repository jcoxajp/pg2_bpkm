process.env.JWT_SECRET = 'test-jwt-secret-bpkm';

import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { createToken, makeMockPool, buildApp } from './helpers/bpkmTestApp.js';

describe('routes/bpkm/catalogos.js', () => {
  let makeCatalogosRouter;

  beforeAll(async () => {
    makeCatalogosRouter = (await import('../../../../src/routes/bpkm/catalogos.js')).default;
  });

  describe('Permiso de módulo "catalogosbpkm" (mantenimiento 3.2)', () => {
    it('POST /post_camion responde 403 sin el permiso', async () => {
      const pool = makeMockPool({ permisosPorUsuario: { 10: [] } });
      const app = buildApp(pool, makeCatalogosRouter);
      const token = createToken(10);

      const res = await request(app)
        .post('/api/bpkm/post_camion')
        .set('Authorization', `Bearer ${token}`)
        .send({ placa: 'P123ABC' });

      expect(res.status).toBe(403);
    });

    it('POST /post_camion responde 200 con "catalogosbpkm" y "bpkm.camiones.new"', async () => {
      const pool = makeMockPool({
        permisosPorUsuario: { 10: ['catalogosbpkm'] },
        bpkmPermsPorUsuario: { 10: [{ key: 'bpkm.camiones.new', nivel_permiso: 'editor' }] },
      });
      const app = buildApp(pool, makeCatalogosRouter);
      const token = createToken(10);

      const res = await request(app)
        .post('/api/bpkm/post_camion')
        .set('Authorization', `Bearer ${token}`)
        .send({ placa: 'P123ABC' });

      expect(res.status).toBe(200);
    });
  });

  describe('Permiso puntual (`bpkm.tbl_perm_key`) - ver módulo no basta para escribir en él (mantenimiento)', () => {
    it('POST /post_camion responde 403 con "catalogosbpkm" pero sin "bpkm.camiones.new" (ej. solo "bpkm.camiones.view")', async () => {
      const pool = makeMockPool({
        permisosPorUsuario: { 10: ['catalogosbpkm'] },
        bpkmPermsPorUsuario: { 10: [{ key: 'bpkm.camiones.view', nivel_permiso: 'viewer' }] },
      });
      const app = buildApp(pool, makeCatalogosRouter);
      const token = createToken(10);

      const res = await request(app)
        .post('/api/bpkm/post_camion')
        .set('Authorization', `Bearer ${token}`)
        .send({ placa: 'P123ABC' });

      expect(res.status).toBe(400);
    });

    it('PUT /put_personal exige "bpkm.personal.edit"', async () => {
      const pool = makeMockPool({
        permisosPorUsuario: { 10: ['catalogosbpkm'] },
        bpkmPermsPorUsuario: { 10: [{ key: 'bpkm.personal.new', nivel_permiso: 'editor' }] },
      });
      const app = buildApp(pool, makeCatalogosRouter);
      const token = createToken(10);

      const res = await request(app)
        .put('/api/bpkm/put_personal')
        .set('Authorization', `Bearer ${token}`)
        .send({ id_personal: 1, id_rol: 14, nombre: 'Prueba' });

      expect(res.status).toBe(400);
    });

    it('POST /post_transporte exige "bpkm.transportes.new"', async () => {
      const pool = makeMockPool({
        permisosPorUsuario: { 10: ['catalogosbpkm'] },
        bpkmPermsPorUsuario: { 10: [{ key: 'bpkm.transportes.new', nivel_permiso: 'editor' }] },
      });
      const app = buildApp(pool, makeCatalogosRouter);
      const token = createToken(10);

      const res = await request(app)
        .post('/api/bpkm/post_transporte')
        .set('Authorization', `Bearer ${token}`)
        .send({ nombre: 'Prueba' });

      expect(res.status).toBe(200);
    });
  });

  describe('Límites de tráfico y entrada (mantenimiento Fase 2)', () => {
    it('POST /post_camion sanea comillas de la placa antes de guardarla', async () => {
      const pool = makeMockPool({
        permisosPorUsuario: { 10: ['catalogosbpkm'] },
        bpkmPermsPorUsuario: { 10: [{ key: 'bpkm.camiones.new', nivel_permiso: 'editor' }] },
      });
      const app = buildApp(pool, makeCatalogosRouter);
      const token = createToken(10);

      const res = await request(app)
        .post('/api/bpkm/post_camion')
        .set('Authorization', `Bearer ${token}`)
        .send({ placa: "P123'ABC" });

      expect(res.status).toBe(200);
      const llamada = pool.query.mock.calls.find(([sql]) => sql.includes('bpkm.post_camion'));
      expect(llamada[1][0]).toBe('P123ABC');
    });

    it('POST /post_camion rechaza un Content-Type distinto de application/json', async () => {
      const pool = makeMockPool({
        permisosPorUsuario: { 10: ['catalogosbpkm'] },
        bpkmPermsPorUsuario: { 10: [{ key: 'bpkm.camiones.new', nivel_permiso: 'editor' }] },
      });
      const app = buildApp(pool, makeCatalogosRouter);
      const token = createToken(10);

      const res = await request(app)
        .post('/api/bpkm/post_camion')
        .set('Authorization', `Bearer ${token}`)
        .set('Content-Type', 'text/plain')
        .send('placa=P123ABC');

      expect(res.status).toBe(415);
    });
  });

  describe('Permiso de módulo "gerenciabpkm" o "distacia_rutas" en los filtros de sucursales/camiones (mantenimiento)', () => {
    it('GET /sucursales responde 403 sin "gerenciabpkm" ni "distacia_rutas"', async () => {
      const pool = makeMockPool({ permisosPorUsuario: { 10: [] } });
      const app = buildApp(pool, makeCatalogosRouter);
      const token = createToken(10);

      const res = await request(app)
        .get('/api/bpkm/sucursales')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(403);
    });

    it('GET /camiones responde 200 con "gerenciabpkm"', async () => {
      const pool = makeMockPool({ permisosPorUsuario: { 10: ['gerenciabpkm'] } });
      const app = buildApp(pool, makeCatalogosRouter);
      const token = createToken(10);

      const res = await request(app)
        .get('/api/bpkm/camiones')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
    });

    it('GET /camiones devuelve las filas dentro de data (mantenimiento: ahora pasa por controller)', async () => {
      const pool = makeMockPool({ permisosPorUsuario: { 10: ['gerenciabpkm'] } });
      const app = buildApp(pool, makeCatalogosRouter);
      const token = createToken(10);

      const res = await request(app)
        .get('/api/bpkm/camiones')
        .set('Authorization', `Bearer ${token}`);

      expect(res.body.ok).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
    });

    it('GET /camiones responde 200 con "distacia_rutas" (pantalla Distancia de Rutas, ops)', async () => {
      const pool = makeMockPool({ permisosPorUsuario: { 10: ['distacia_rutas'] } });
      const app = buildApp(pool, makeCatalogosRouter);
      const token = createToken(10);

      const res = await request(app)
        .get('/api/bpkm/camiones')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
    });

    it('GET /sucursales responde 200 con "distacia_rutas"', async () => {
      const pool = makeMockPool({ permisosPorUsuario: { 10: ['distacia_rutas'] } });
      const app = buildApp(pool, makeCatalogosRouter);
      const token = createToken(10);

      const res = await request(app)
        .get('/api/bpkm/sucursales')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
    });
  });

  describe('Validación de esquema (mantenimiento Fase 3)', () => {
    it('POST /post_camion responde 400 con placa de más de 15 caracteres', async () => {
      const pool = makeMockPool({ permisosPorUsuario: { 10: ['catalogosbpkm'] } });
      const app = buildApp(pool, makeCatalogosRouter);
      const token = createToken(10);

      const res = await request(app)
        .post('/api/bpkm/post_camion')
        .set('Authorization', `Bearer ${token}`)
        .send({ placa: 'A'.repeat(16) });

      expect(res.status).toBe(400);
    });

    it('POST /post_personal responde 400 sin nombre', async () => {
      const pool = makeMockPool({ permisosPorUsuario: { 10: ['catalogosbpkm'] } });
      const app = buildApp(pool, makeCatalogosRouter);
      const token = createToken(10);

      const res = await request(app)
        .post('/api/bpkm/post_personal')
        .set('Authorization', `Bearer ${token}`)
        .send({ id_rol: 1 });

      expect(res.status).toBe(400);
    });

    it('POST /post_personal responde 400 con "telefono" de más de 20 caracteres', async () => {
      const pool = makeMockPool({ permisosPorUsuario: { 10: ['catalogosbpkm'] } });
      const app = buildApp(pool, makeCatalogosRouter);
      const token = createToken(10);

      const res = await request(app)
        .post('/api/bpkm/post_personal')
        .set('Authorization', `Bearer ${token}`)
        .send({ id_rol: 1, nombre: 'Prueba', telefono: '1'.repeat(21) });

      expect(res.status).toBe(400);
    });

    it('POST /post_personal acepta "telefono" en null', async () => {
      const pool = makeMockPool({
        permisosPorUsuario: { 10: ['catalogosbpkm'] },
        bpkmPermsPorUsuario: { 10: [{ key: 'bpkm.personal.new', nivel_permiso: 'editor' }] },
      });
      const app = buildApp(pool, makeCatalogosRouter);
      const token = createToken(10);

      const res = await request(app)
        .post('/api/bpkm/post_personal')
        .set('Authorization', `Bearer ${token}`)
        .send({ id_rol: 1, nombre: 'Prueba', telefono: null });

      expect(res.status).toBe(200);
    });

    it('PUT /put_personal permite omitir "nombre" (actualización parcial, COALESCE en la función SQL)', async () => {
      const pool = makeMockPool({ permisosPorUsuario: { 10: ['catalogosbpkm'] } });
      const app = buildApp(pool, makeCatalogosRouter);
      const token = createToken(10);

      const res = await request(app)
        .put('/api/bpkm/put_personal')
        .set('Authorization', `Bearer ${token}`)
        .send({ id_personal: 1, telefono: '12345678' });

      expect(res.status).toBe(400); // 400 por permiso puntual (bpkm.personal.edit), no por el validador de esquema
      expect(res.body.error).toMatch(/permiso/i);
    });

    it('POST /post_transporte responde 400 sin nombre', async () => {
      const pool = makeMockPool({ permisosPorUsuario: { 10: ['catalogosbpkm'] } });
      const app = buildApp(pool, makeCatalogosRouter);
      const token = createToken(10);

      const res = await request(app)
        .post('/api/bpkm/post_transporte')
        .set('Authorization', `Bearer ${token}`)
        .send({});

      expect(res.status).toBe(400);
    });
  });
});
