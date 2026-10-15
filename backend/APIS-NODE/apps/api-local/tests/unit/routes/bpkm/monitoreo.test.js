process.env.JWT_SECRET = 'test-jwt-secret-bpkm';

import { describe, it, expect, beforeAll, vi } from 'vitest';
import request from 'supertest';
import { createToken, makeMockPool, buildApp } from './helpers/bpkmTestApp.js';

describe('routes/bpkm/monitoreo.js', () => {
  let makeMonitoreoRouter;

  beforeAll(async () => {
    makeMonitoreoRouter = (await import('../../../../src/routes/bpkm/monitoreo.js')).default;
  });

  describe('Identidad del actor viene de req.user, no del body (mantenimiento 3.1)', () => {
    it('ignora el "id_usuario" del body y usa el id real del token al registrar monitoreo', async () => {
      const pool = makeMockPool({ permisosPorUsuario: { 10: ['monitoreobpkm'] } });
      // BPKM de la ruta aún no aprobado por gerencia (lista vacía), para que el registro pueda continuar.
      pool.query.mockImplementation((sql, params = []) => {
        if (sql.includes('tbl_bpkm')) return Promise.resolve({ rows: [] });
        if (sql.includes('tbl_modulos')) {
          const tiene = (params[1] === 10) && params[0] === 'monitoreobpkm';
          return Promise.resolve({ rows: [{ total: tiene ? '1' : '0' }] });
        }
        return Promise.resolve({ rows: [{ ok: true }] });
      });
      const app = buildApp(pool, makeMonitoreoRouter);
      const token = createToken(10);

      const res = await request(app)
        .patch('/api/bpkm/monitoreo/1')
        .set('Authorization', `Bearer ${token}`)
        .send({ tipo: 'S', fecha_hora: '2026-09-17 03:00:00', id_usuario: 999 });

      expect(res.status).toBe(200);
      const llamada = pool.query.mock.calls.find(([sql]) => sql.includes('bpkm.post_monitoreo_bpkm'));
      expect(llamada[1][1]).toBe(10); // id_usuario real (token), no el 999 del body
    });
  });

  describe('Permiso de módulo "monitoreobpkm" (mantenimiento 3.2)', () => {
    it('PATCH /monitoreo/:id_ruta responde 403 sin el permiso', async () => {
      const pool = makeMockPool({ permisosPorUsuario: { 10: [] } });
      const app = buildApp(pool, makeMonitoreoRouter);
      const token = createToken(10);

      const res = await request(app)
        .patch('/api/bpkm/monitoreo/1')
        .set('Authorization', `Bearer ${token}`)
        .send({ tipo: 'S' });

      expect(res.status).toBe(403);
    });

    it('GET /monitoreo responde 200 con el permiso', async () => {
      const pool = makeMockPool({ permisosPorUsuario: { 10: ['monitoreobpkm'] } });
      const app = buildApp(pool, makeMonitoreoRouter);
      const token = createToken(10);

      const res = await request(app)
        .get('/api/bpkm/monitoreo')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
    });
  });

  describe('PATCH /monitoreo/:id_ruta - id_ruta en la URL (naming REST, mantenimiento 3.16.1)', () => {
    it('responde 400 si el :id_ruta de la URL no es un entero válido', async () => {
      const pool = makeMockPool({ permisosPorUsuario: { 10: ['monitoreobpkm'] } });
      const app = buildApp(pool, makeMonitoreoRouter);
      const token = createToken(10);

      const res = await request(app)
        .patch('/api/bpkm/monitoreo/abc')
        .set('Authorization', `Bearer ${token}`)
        .send({ tipo: 'S' });

      expect(res.status).toBe(400);
    });
  });

  describe('Validación de esquema (mantenimiento Fase 3)', () => {
    it('PATCH /monitoreo/:id_ruta responde 400 con "comentario" de más de 500 caracteres', async () => {
      const pool = makeMockPool({ permisosPorUsuario: { 10: ['monitoreobpkm'] } });
      const app = buildApp(pool, makeMonitoreoRouter);
      const token = createToken(10);

      const res = await request(app)
        .patch('/api/bpkm/monitoreo/1')
        .set('Authorization', `Bearer ${token}`)
        .send({ tipo: 'S', comentario: 'a'.repeat(501) });

      expect(res.status).toBe(400);
    });

    it('PATCH /monitoreo/:id_ruta responde 400 con un "tipo" que no es S/E', async () => {
      const pool = makeMockPool({ permisosPorUsuario: { 10: ['monitoreobpkm'] } });
      const app = buildApp(pool, makeMonitoreoRouter);
      const token = createToken(10);

      const res = await request(app)
        .patch('/api/bpkm/monitoreo/1')
        .set('Authorization', `Bearer ${token}`)
        .send({ tipo: 'X' });

      expect(res.status).toBe(400);
    });

    it('PATCH /monitoreo/:id_ruta acepta "comentario" en null (caso real reportado)', async () => {
      const pool = makeMockPool({ permisosPorUsuario: { 10: ['monitoreobpkm'] } });
      pool.query.mockImplementation((sql) => {
        if (sql.includes('tbl_bpkm')) return Promise.resolve({ rows: [] });
        if (sql.includes('tbl_modulos')) return Promise.resolve({ rows: [{ total: '1' }] });
        return Promise.resolve({ rows: [{ ok: true }] });
      });
      const app = buildApp(pool, makeMonitoreoRouter);
      const token = createToken(10);

      const res = await request(app)
        .patch('/api/bpkm/monitoreo/1047')
        .set('Authorization', `Bearer ${token}`)
        .send({ tipo: 'S', fecha_hora: '2026-09-17 03:00:00', comentario: null });

      expect(res.status).toBe(200);
    });

    it('PATCH /monitoreo/:id_ruta responde 400 con "fecha_hora" que no es una fecha real (mantenimiento 3.16)', async () => {
      const pool = makeMockPool({ permisosPorUsuario: { 10: ['monitoreobpkm'] } });
      const app = buildApp(pool, makeMonitoreoRouter);
      const token = createToken(10);

      const res = await request(app)
        .patch('/api/bpkm/monitoreo/1')
        .set('Authorization', `Bearer ${token}`)
        .send({ tipo: 'S', fecha_hora: 'no-es-una-fecha' });

      expect(res.status).toBe(400);
    });

    it('PATCH /monitoreo/:id_ruta responde 400 con "fecha_hora" ausente', async () => {
      const pool = makeMockPool({ permisosPorUsuario: { 10: ['monitoreobpkm'] } });
      const app = buildApp(pool, makeMonitoreoRouter);
      const token = createToken(10);

      const res = await request(app)
        .patch('/api/bpkm/monitoreo/1')
        .set('Authorization', `Bearer ${token}`)
        .send({ tipo: 'S' });

      expect(res.status).toBe(400);
    });
  });

  describe('PATCH /monitoreo/:id_ruta - reglas de negocio ahora en Node, no solo en el frontend (mantenimiento 3.16)', () => {
    it('responde 400 si ya existe un registro del mismo tipo para la ruta (el SP hace UPSERT, aquí se rechaza explícitamente)', async () => {
      const pool = makeMockPool({ permisosPorUsuario: { 10: ['monitoreobpkm'] } });
      pool.query.mockImplementation((sql) => {
        if (sql.includes('tbl_bpkm') && sql.includes('usuario_gerencia')) return Promise.resolve({ rows: [] });
        if (sql.includes('tbl_monitoreo_bpkm WHERE id_ruta')) {
          return Promise.resolve({ rows: [{ tipo: 'S', fecha_hora: '2026-09-22T08:00:00' }] });
        }
        if (sql.includes('tbl_modulos')) return Promise.resolve({ rows: [{ total: '1' }] });
        return Promise.resolve({ rows: [{ ok: true }] });
      });
      const app = buildApp(pool, makeMonitoreoRouter);
      const token = createToken(10);

      const res = await request(app)
        .patch('/api/bpkm/monitoreo/1')
        .set('Authorization', `Bearer ${token}`)
        .send({ tipo: 'S', fecha_hora: '2026-09-22 09:00:00' });

      expect(res.status).toBe(400);
      expect(res.body.message).toBe('Ya existe un registro de salida para esta ruta.');
      expect(pool.query.mock.calls.some(([s]) => s.includes('bpkm.post_monitoreo_bpkm'))).toBe(false);
    });

    it('responde 400 al intentar registrar "E" sin que exista "S" previo', async () => {
      const pool = makeMockPool({ permisosPorUsuario: { 10: ['monitoreobpkm'] } });
      pool.query.mockImplementation((sql) => {
        if (sql.includes('tbl_bpkm') && sql.includes('usuario_gerencia')) return Promise.resolve({ rows: [] });
        if (sql.includes('tbl_monitoreo_bpkm WHERE id_ruta')) return Promise.resolve({ rows: [] });
        if (sql.includes('tbl_modulos')) return Promise.resolve({ rows: [{ total: '1' }] });
        return Promise.resolve({ rows: [{ ok: true }] });
      });
      const app = buildApp(pool, makeMonitoreoRouter);
      const token = createToken(10);

      const res = await request(app)
        .patch('/api/bpkm/monitoreo/1')
        .set('Authorization', `Bearer ${token}`)
        .send({ tipo: 'E', fecha_hora: '2026-09-22 09:00:00' });

      expect(res.status).toBe(400);
      expect(res.body.message).toBe('No se puede registrar la entrada sin haber registrado la salida.');
    });
  });

  describe('GET /monitoreo - bandeja paginada (mantenimiento 3.16.1)', () => {
    function mockListarPool({ items = [{ id_ruta: 1 }], total = 1, sinSalida = 0, sinEntrada = 0 } = {}) {
      return {
        query: vi.fn((sql, params = []) => {
          if (sql.includes('tbl_modulos')) {
            const [codigoModulo, idUsuario] = params;
            return Promise.resolve({ rows: [{ total: (idUsuario === 10 && codigoModulo === 'monitoreobpkm') ? '1' : '0' }] });
          }
          if (sql.includes("sub.tiene_salida AND sub.estado_nombre IN")) {
            return Promise.resolve({ rows: [{ total: String(sinSalida) }] });
          }
          if (sql.includes('sub.tiene_salida AND NOT sub.tiene_entrada')) {
            return Promise.resolve({ rows: [{ total: String(sinEntrada) }] });
          }
          if (sql.includes('COUNT(*) AS total FROM (')) {
            return Promise.resolve({ rows: [{ total: String(total) }] });
          }
          if (sql.includes("CURRENT_DATE + INTERVAL '2 days'") || sql.includes("'Regresada', 'Finalizada'")) {
            return Promise.resolve({ rows: [] });
          }
          return Promise.resolve({ rows: items });
        })
      };
    }

    it('devuelve items/total/page/limit/resumen/destacadas envuelto en {ok, message, data}', async () => {
      const pool = mockListarPool({ items: [{ id_ruta: 1, codigo_ruta: 'CR001' }], total: 1, sinSalida: 2, sinEntrada: 1 });
      const app = buildApp(pool, makeMonitoreoRouter);
      const token = createToken(10);

      const res = await request(app)
        .get('/api/bpkm/monitoreo')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.ok).toBe(true);
      expect(res.body.data.items).toEqual([{ id_ruta: 1, codigo_ruta: 'CR001' }]);
      expect(res.body.data.resumen).toEqual({ sin_salida: 2, sin_entrada: 1 });
      expect(res.body.data.destacadas).toEqual({ proximas_salir: [], que_regresaron: [] });
    });

    it('acepta filtros por query string (naming REST, mantenimiento 3.16.1)', async () => {
      const pool = mockListarPool();
      const app = buildApp(pool, makeMonitoreoRouter);
      const token = createToken(10);

      const res = await request(app)
        .get('/api/bpkm/monitoreo')
        .query({ fecha_desde: '2026-01-01', id_camion: 5, limit: 999 })
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.data.limit).toBe(100); // acotado a 100 aunque se pida más
    });
  });

  describe('Permiso de módulo múltiple (OR) en get_monitoreo_por_ruta (mantenimiento 3.2)', () => {
    it('acepta a quien solo tiene "gerenciabpkm", sin "monitoreobpkm"', async () => {
      const pool = makeMockPool({ permisosPorUsuario: { 10: ['gerenciabpkm'] } });
      const app = buildApp(pool, makeMonitoreoRouter);
      const token = createToken(10);

      const res = await request(app)
        .post('/api/bpkm/get_monitoreo_por_ruta')
        .set('Authorization', `Bearer ${token}`)
        .send({ id_ruta: 1 });

      expect(res.status).toBe(200);
    });
  });
});
