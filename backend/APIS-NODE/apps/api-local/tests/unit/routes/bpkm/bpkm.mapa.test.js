process.env.JWT_SECRET = 'test-jwt-secret-bpkm-mapa';

import { describe, it, expect, beforeAll, vi } from 'vitest';
import request from 'supertest';
import { createToken, makeMockPool, buildApp } from './helpers/bpkmTestApp.js';

describe('Detalles de Ruta con Mapa (BPKM y Rutas Locales)', () => {
  let makeBpkmRouter;

  beforeAll(async () => {
    makeBpkmRouter = (await import('../../../../src/routes/bpkm/bpkm.js')).default;
  });

  describe('POST /api/bpkm/get_bpkm_detalle', () => {
    it('responde 401 si no se envía token de autenticación', async () => {
      const pool = makeMockPool();
      const app = buildApp(pool, makeBpkmRouter);

      const res = await request(app)
        .post('/api/bpkm/get_bpkm_detalle')
        .send({ id_bpkm: 378 });

      expect(res.status).toBe(401);
    });

    it('responde 403 si el usuario no tiene permisos "gerenciabpkm" ni "rrhhbpkm"', async () => {
      const pool = makeMockPool({ permisosPorUsuario: { 10: ['otro_permiso'] } });
      const app = buildApp(pool, makeBpkmRouter);
      const token = createToken(10);

      const res = await request(app)
        .post('/api/bpkm/get_bpkm_detalle')
        .set('Authorization', `Bearer ${token}`)
        .send({ id_bpkm: 378 });

      expect(res.status).toBe(403);
    });

    it('responde 400 si id_bpkm no es numérico', async () => {
      const pool = makeMockPool({ permisosPorUsuario: { 10: ['gerenciabpkm'] } });
      const app = buildApp(pool, makeBpkmRouter);
      const token = createToken(10);

      const res = await request(app)
        .post('/api/bpkm/get_bpkm_detalle')
        .set('Authorization', `Bearer ${token}`)
        .send({ id_bpkm: 'invalido' });

      expect(res.status).toBe(400);
    });

    it('responde 200 e inyecta la clave "mapa" en el objeto de detalle cuando existe la ruta', async () => {
      const pool = {
        query: vi.fn((sql, params) => {
          if (sql.includes('tbl_modulos')) {
            return Promise.resolve({ rows: [{ total: '1' }] });
          }
          if (sql.includes('bpkm.get_bpkm_detalle')) {
            return Promise.resolve({
              rows: [{
                id_bpkm: 378,
                id_ruta: 1054,
                codigo_ruta: '2609RL008',
                distancia_mas_lejana: '70.00'
              }]
            });
          }
          if (sql.includes('FROM bpkm.tbl_bpkm b')) {
            return Promise.resolve({
              rows: [{
                id_ruta: 1054,
                sucursal_id: 1,
                sucursal_nombre: 'Central',
                sucursal_latitud: '14.5981399',
                sucursal_longitud: '-90.5213547',
                id_detalle_ruta: 11564,
                folio_factura: '001059CR82839',
                entrega_latitud: '14.5982695',
                entrega_longitud: '-90.5214996',
                entrega_precision_metros: '200.00',
                entrega_fecha_hora: '2026-09-23T16:00:00.000Z',
                entrega_resultado: 'ENT',
                distancia_km: '30.00',
                distancia_estado_calculo: 'OK'
              }]
            });
          }
          if (sql.includes('INSERT INTO bpkm.tbl_contador_cargas_mapa')) {
            return Promise.resolve({
              rows: [{ contador: 1 }]
            });
          }
          return Promise.resolve({ rows: [{ ok: true }] });
        })
      };

      const app = buildApp(pool, makeBpkmRouter);
      const token = createToken(10);

      const res = await request(app)
        .post('/api/bpkm/get_bpkm_detalle')
        .set('Authorization', `Bearer ${token}`)
        .send({ id_bpkm: 378 });

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('id_bpkm', 378);
      expect(res.body).toHaveProperty('id_ruta', 1054);
      expect(res.body).toHaveProperty('mapa');
      expect(res.body.mapa.mapa_habilitado).toBe(true);
      expect(res.body.mapa.sucursal.nombre).toBe('Central');
      expect(res.body.mapa.puntos).toHaveLength(1);
      expect(res.body.mapa.puntos[0].distancia_km).toBe(30);
    });

    it('responde 200 con {} si el id_bpkm no existe', async () => {
      const pool = {
        query: vi.fn((sql) => {
          if (sql.includes('tbl_modulos')) {
            return Promise.resolve({ rows: [{ total: '1' }] });
          }
          if (sql.includes('bpkm.get_bpkm_detalle')) {
            return Promise.resolve({ rows: [] });
          }
          if (sql.includes('FROM bpkm.tbl_bpkm b')) {
            return Promise.resolve({ rows: [] });
          }
          return Promise.resolve({ rows: [] });
        })
      };

      const app = buildApp(pool, makeBpkmRouter);
      const token = createToken(10);

      const res = await request(app)
        .post('/api/bpkm/get_bpkm_detalle')
        .set('Authorization', `Bearer ${token}`)
        .send({ id_bpkm: 9999 });

      expect(res.status).toBe(200);
      expect(res.body).toEqual({});
    });
  });

  describe('GET /api/bpkm/rutas-locales/:id', () => {
    it('responde 401 si no se envía token', async () => {
      const pool = makeMockPool();
      const app = buildApp(pool, makeBpkmRouter);

      const res = await request(app).get('/api/bpkm/rutas-locales/1056');

      expect(res.status).toBe(401);
    });

    it('responde 403 si el usuario no tiene permiso "localesbpkm"', async () => {
      const pool = makeMockPool({ permisosPorUsuario: { 10: ['gerenciabpkm'] } });
      const app = buildApp(pool, makeBpkmRouter);
      const token = createToken(10);

      const res = await request(app)
        .get('/api/bpkm/rutas-locales/1056')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(403);
    });

    it('responde 400 si :id no es numérico', async () => {
      const pool = makeMockPool({ permisosPorUsuario: { 10: ['localesbpkm'] } });
      const app = buildApp(pool, makeBpkmRouter);
      const token = createToken(10);

      const res = await request(app)
        .get('/api/bpkm/rutas-locales/abc')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(400);
    });

    it('responde 200 con el detalle e inyecta la clave "mapa"', async () => {
      const pool = {
        query: vi.fn((sql, params) => {
          if (sql.includes('tbl_modulos')) {
            return Promise.resolve({ rows: [{ total: '1' }] });
          }
          if (sql.includes('bpkm.get_ruta_sin_bpkm_detalle')) {
            return Promise.resolve({
              rows: [{
                id_ruta: 1056,
                numero_ruta: '2609RL010',
                tipo_ruta: 'RL',
                estado_ruta_codigo: 'EN_CURSO'
              }]
            });
          }
          if (sql.includes('FROM bpkm.tbl_rutas r')) {
            return Promise.resolve({
              rows: [{
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
                entrega_fecha_hora: '2026-09-24T19:55:44.753Z',
                entrega_resultado: 'ENT',
                distancia_km: '40.00',
                distancia_estado_calculo: 'OK'
              }]
            });
          }
          if (sql.includes('INSERT INTO bpkm.tbl_contador_cargas_mapa')) {
            return Promise.resolve({
              rows: [{ contador: 5 }]
            });
          }
          return Promise.resolve({ rows: [{ ok: true }] });
        })
      };

      const app = buildApp(pool, makeBpkmRouter);
      const token = createToken(10);

      const res = await request(app)
        .get('/api/bpkm/rutas-locales/1056')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('id_ruta', 1056);
      expect(res.body).toHaveProperty('numero_ruta', '2609RL010');
      expect(res.body).toHaveProperty('mapa');
      expect(res.body.mapa.mapa_habilitado).toBe(true);
      expect(res.body.mapa.puntos[0].distancia_km).toBe(40);
    });

    it('responde 200 con null si la ruta local no existe', async () => {
      const pool = {
        query: vi.fn((sql) => {
          if (sql.includes('tbl_modulos')) {
            return Promise.resolve({ rows: [{ total: '1' }] });
          }
          if (sql.includes('bpkm.get_ruta_sin_bpkm_detalle')) {
            return Promise.resolve({ rows: [] });
          }
          if (sql.includes('FROM bpkm.tbl_rutas r')) {
            return Promise.resolve({ rows: [] });
          }
          return Promise.resolve({ rows: [] });
        })
      };

      const app = buildApp(pool, makeBpkmRouter);
      const token = createToken(10);

      const res = await request(app)
        .get('/api/bpkm/rutas-locales/9999')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body).toEqual([]);
    });
  });
});
