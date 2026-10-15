process.env.JWT_SECRET = 'test-jwt-secret-bpkm';

import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { createToken, makeMockPool, buildApp } from './helpers/bpkmTestApp.js';

describe('routes/bpkm/bpkm.js', () => {
  let makeBpkmRouter;

  beforeAll(async () => {
    makeBpkmRouter = (await import('../../../../src/routes/bpkm/bpkm.js')).default;
  });

  describe('Permiso de módulo "gerenciabpkm" (mantenimiento 3.2)', () => {
    it('POST /post_aprobar_bpkm_gerencia responde 403 sin el permiso', async () => {
      const pool = makeMockPool({ permisosPorUsuario: { 10: [] } });
      const app = buildApp(pool, makeBpkmRouter);
      const token = createToken(10);

      const res = await request(app)
        .post('/api/bpkm/post_aprobar_bpkm_gerencia')
        .set('Authorization', `Bearer ${token}`)
        .send({ id_bpkm: 1, monto_aprobado_piloto: 100, monto_aprobado_auxiliar: 50 });

      expect(res.status).toBe(403);
    });

    it('POST /post_aprobar_bpkm_gerencia responde 200 con el permiso, y usa el usuario del token', async () => {
      const pool = makeMockPool({ permisosPorUsuario: { 10: ['gerenciabpkm'] } });
      const app = buildApp(pool, makeBpkmRouter);
      const token = createToken(10);

      const res = await request(app)
        .post('/api/bpkm/post_aprobar_bpkm_gerencia')
        .set('Authorization', `Bearer ${token}`)
        .send({ id_bpkm: 1, monto_aprobado_piloto: 100, monto_aprobado_auxiliar: 50, usuario_gerencia: 999 });

      expect(res.status).toBe(200);
      const llamada = pool.query.mock.calls.find(([sql]) => sql.includes('bpkm.post_aprobar_bpkm_gerencia'));
      expect(llamada[1][4]).toBe(10); // usuario_gerencia real (token), no el 999 del body
    });
  });

  describe('Validación de esquema: montos de aprobación (mantenimiento Fase 3)', () => {
    it('POST /post_aprobar_bpkm_gerencia responde 400 con monto negativo', async () => {
      const pool = makeMockPool({ permisosPorUsuario: { 10: ['gerenciabpkm'] } });
      const app = buildApp(pool, makeBpkmRouter);
      const token = createToken(10);

      const res = await request(app)
        .post('/api/bpkm/post_aprobar_bpkm_gerencia')
        .set('Authorization', `Bearer ${token}`)
        .send({ id_bpkm: 1, monto_aprobado_piloto: -100, monto_aprobado_auxiliar: 50 });

      expect(res.status).toBe(400);
    });

    it('POST /post_aprobar_bpkm_gerencia responde 400 con monto fuera del tope', async () => {
      const pool = makeMockPool({ permisosPorUsuario: { 10: ['gerenciabpkm'] } });
      const app = buildApp(pool, makeBpkmRouter);
      const token = createToken(10);

      const res = await request(app)
        .post('/api/bpkm/post_aprobar_bpkm_gerencia')
        .set('Authorization', `Bearer ${token}`)
        .send({ id_bpkm: 1, monto_aprobado_piloto: 999999, monto_aprobado_auxiliar: 50 });

      expect(res.status).toBe(400);
    });

    it('POST /post_aprobar_bpkm_gerencia responde 400 sin monto_aprobado_auxiliar', async () => {
      const pool = makeMockPool({ permisosPorUsuario: { 10: ['gerenciabpkm'] } });
      const app = buildApp(pool, makeBpkmRouter);
      const token = createToken(10);

      const res = await request(app)
        .post('/api/bpkm/post_aprobar_bpkm_gerencia')
        .set('Authorization', `Bearer ${token}`)
        .send({ id_bpkm: 1, monto_aprobado_piloto: 100 });

      expect(res.status).toBe(400);
    });

    it('POST /post_aprobar_bpkm_gerencia responde 400 con "observaciones" de más de 500 caracteres', async () => {
      const pool = makeMockPool({ permisosPorUsuario: { 10: ['gerenciabpkm'] } });
      const app = buildApp(pool, makeBpkmRouter);
      const token = createToken(10);

      const res = await request(app)
        .post('/api/bpkm/post_aprobar_bpkm_gerencia')
        .set('Authorization', `Bearer ${token}`)
        .send({ id_bpkm: 1, monto_aprobado_piloto: 100, monto_aprobado_auxiliar: 50, observaciones: 'a'.repeat(501) });

      expect(res.status).toBe(400);
    });

    it('POST /post_aprobar_bpkm_gerencia acepta "observaciones" en null (no solo ausente)', async () => {
      const pool = makeMockPool({ permisosPorUsuario: { 10: ['gerenciabpkm'] } });
      const app = buildApp(pool, makeBpkmRouter);
      const token = createToken(10);

      const res = await request(app)
        .post('/api/bpkm/post_aprobar_bpkm_gerencia')
        .set('Authorization', `Bearer ${token}`)
        .send({ id_bpkm: 1, monto_aprobado_piloto: 100, monto_aprobado_auxiliar: 50, observaciones: null });

      expect(res.status).toBe(200);
    });

    it('POST /post_aprobar_bpkm_gerencia acepta un caso real reportado en prueba manual (Q700/Q350)', async () => {
      const pool = makeMockPool({ permisosPorUsuario: { 10: ['gerenciabpkm'] } });
      const app = buildApp(pool, makeBpkmRouter);
      const token = createToken(10);

      const res = await request(app)
        .post('/api/bpkm/post_aprobar_bpkm_gerencia')
        .set('Authorization', `Bearer ${token}`)
        .send({ id_bpkm: 326, monto_aprobado_piloto: 700, monto_aprobado_auxiliar: 350 });

      expect(res.status).toBe(200);
    });
  });

  describe('Permiso de módulo OR: "gerenciabpkm" o "distacia_rutas" (mantenimiento 3.2)', () => {
    it('PATCH /distancia acepta a quien solo tiene "distacia_rutas"', async () => {
      const pool = makeMockPool({ permisosPorUsuario: { 10: ['distacia_rutas'] } });
      const app = buildApp(pool, makeBpkmRouter);
      const token = createToken(10);

      const res = await request(app)
        .patch('/api/bpkm/distancia')
        .set('Authorization', `Bearer ${token}`)
        .send({ id_bpkm: 1, distancia: 42 });

      expect(res.status).not.toBe(403);
    });

    it('PATCH /distancia responde 403 si no tiene ni "gerenciabpkm" ni "distacia_rutas"', async () => {
      const pool = makeMockPool({ permisosPorUsuario: { 10: [] } });
      const app = buildApp(pool, makeBpkmRouter);
      const token = createToken(10);

      const res = await request(app)
        .patch('/api/bpkm/distancia')
        .set('Authorization', `Bearer ${token}`)
        .send({ id_bpkm: 1, distancia: 42 });

      expect(res.status).toBe(403);
    });
  });

  describe('Límites de tráfico y entrada (mantenimiento Fase 2)', () => {
    it('GET /rutas-locales/:id rechaza un :id no numérico antes de llegar al controlador', async () => {
      const pool = makeMockPool({ permisosPorUsuario: { 10: ['localesbpkm'] } });
      const app = buildApp(pool, makeBpkmRouter);
      const token = createToken(10);

      const res = await request(app)
        .get('/api/bpkm/rutas-locales/abc')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(400);
    });

    it('GET /distancia trae cabeceras de rate limiting (apiLimiter montado)', async () => {
      const pool = makeMockPool({ permisosPorUsuario: { 10: ['distacia_rutas'] } });
      const app = buildApp(pool, makeBpkmRouter);
      const token = createToken(10);

      const res = await request(app)
        .get('/api/bpkm/distancia')
        .set('Authorization', `Bearer ${token}`);

      const tieneCabeceraRateLimit = Object.keys(res.headers).some((h) => h.toLowerCase().includes('ratelimit'));
      expect(tieneCabeceraRateLimit).toBe(true);
    });

    it('GET /rutas-locales acota "limit" a 100 aunque se pida más (mantenimiento 3.15)', async () => {
      const pool = makeMockPool({ permisosPorUsuario: { 10: ['localesbpkm'] } });
      const app = buildApp(pool, makeBpkmRouter);
      const token = createToken(10);

      const res = await request(app)
        .get('/api/bpkm/rutas-locales')
        .query({ limit: 999999 })
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.limit).toBe(100);
      const llamada = pool.query.mock.calls.find(([sql]) => sql.includes('bpkm.get_rutas_sin_bpkm'));
      expect(llamada[1][5]).toBe(100); // p_limit
    });

    it('GET /rutas-locales acota "limit" a 10 como mínimo', async () => {
      const pool = makeMockPool({ permisosPorUsuario: { 10: ['localesbpkm'] } });
      const app = buildApp(pool, makeBpkmRouter);
      const token = createToken(10);

      const res = await request(app)
        .get('/api/bpkm/rutas-locales')
        .query({ limit: 1 })
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.limit).toBe(10);
    });

    it('GET /rutas-locales devuelve resumen.por_estado.EN_CURSO, calculado con los mismos filtros menos el estado', async () => {
      const pool = {
        query: (sql, params) => {
          if (sql.includes('tbl_modulos')) return Promise.resolve({ rows: [{ total: '1' }] });
          // El 10º parámetro posicional es p_estado_ruta.
          const estado = params[9];
          if (estado === 'EN_CURSO') {
            return Promise.resolve({ rows: [{ id_ruta: 1, total_count: '4' }] });
          }
          return Promise.resolve({ rows: [{ id_ruta: 1, total_count: '9' }] });
        },
      };
      const app = buildApp(pool, makeBpkmRouter);
      const token = createToken(10);

      const res = await request(app)
        .get('/api/bpkm/rutas-locales')
        .query({ estado_ruta: 'FINALIZADA' })
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.total).toBe('9'); // total_count llega de Postgres como bigint → string, sin cambios de esta pasada
      expect(res.body.resumen).toEqual({ por_estado: { EN_CURSO: 4 } });
    });
  });

  describe('Paginación real (mantenimiento Fase 4)', () => {
    const mockPoolBandeja = ({ totalFilas = 1, resumenFilas = [] } = {}) => ({
      query: (sql) => {
        if (sql.includes('COUNT(*) AS total FROM (')) {
          return Promise.resolve({ rows: [{ total: String(totalFilas) }] });
        }
        if (sql.includes("e.codigo IN ('PEND', 'APR')")) {
          return Promise.resolve({ rows: resumenFilas });
        }
        if (sql.includes('tbl_modulos')) {
          return Promise.resolve({ rows: [{ total: '1' }] });
        }
        return Promise.resolve({ rows: [{ id_bpkm: 1, codigo_ruta: 'RT-1' }] });
      },
    });

    it('POST /get_bpkm responde 403 sin "gerenciabpkm" ni "rrhhbpkm"', async () => {
      const pool = makeMockPool({ permisosPorUsuario: { 10: [] } });
      const app = buildApp(pool, makeBpkmRouter);
      const token = createToken(10);

      const res = await request(app)
        .post('/api/bpkm/get_bpkm')
        .set('Authorization', `Bearer ${token}`)
        .send({});

      expect(res.status).toBe(403);
    });

    it('POST /get_bpkm devuelve items/total/page/limit/resumen, no un arreglo plano', async () => {
      const pool = mockPoolBandeja({ totalFilas: 1, resumenFilas: [{ codigo: 'PEND', conteo: '3' }, { codigo: 'APR', conteo: '2' }] });
      const app = buildApp(pool, makeBpkmRouter);
      const token = createToken(10);

      const res = await request(app)
        .post('/api/bpkm/get_bpkm')
        .set('Authorization', `Bearer ${token}`)
        .send({ estado_codigo: 'PEND' });

      expect(res.status).toBe(200);
      expect(res.body.ok).toBe(true);
      expect(Array.isArray(res.body.data.items)).toBe(true);
      expect(res.body.data.total).toBe(1);
      expect(res.body.data.resumen).toEqual({ por_estado: { PEND: 3, APR: 2 } });
    });

    it('POST /get_bpkm acota "limit" a 100 aunque se pida más', async () => {
      const pool = mockPoolBandeja();
      const app = buildApp(pool, makeBpkmRouter);
      const token = createToken(10);

      const res = await request(app)
        .post('/api/bpkm/get_bpkm')
        .set('Authorization', `Bearer ${token}`)
        .send({ limit: 999 });

      expect(res.status).toBe(200);
      expect(res.body.data.limit).toBe(100);
    });

    it('POST /get_bpkm acota "limit" a 10 como mínimo', async () => {
      const pool = mockPoolBandeja();
      const app = buildApp(pool, makeBpkmRouter);
      const token = createToken(10);

      const res = await request(app)
        .post('/api/bpkm/get_bpkm')
        .set('Authorization', `Bearer ${token}`)
        .send({ limit: 1 });

      expect(res.status).toBe(200);
      expect(res.body.data.limit).toBe(10);
    });

    it('POST /get_bpkm con "exportar: true" ignora el tope normal de 100', async () => {
      const pool = mockPoolBandeja();
      const app = buildApp(pool, makeBpkmRouter);
      const token = createToken(10);

      const res = await request(app)
        .post('/api/bpkm/get_bpkm')
        .set('Authorization', `Bearer ${token}`)
        .send({ exportar: true });

      expect(res.status).toBe(200);
      expect(res.body.data.limit).toBe(5000);
    });
  });
});
