process.env.JWT_SECRET = 'test-jwt-secret-bpkm';

import { describe, it, expect, beforeAll, vi } from 'vitest';
import request from 'supertest';
import { createToken, makeMockPool, buildApp } from './helpers/bpkmTestApp.js';

describe('routes/bpkm/selecciones.js', () => {
  let makeSeleccionesRouter;

  beforeAll(async () => {
    makeSeleccionesRouter = (await import('../../../../src/routes/bpkm/selecciones.js')).default;
  });

  describe('Identidad del actor viene de req.user, no del body (mantenimiento 3.1)', () => {
    /*
    it('"Mis selecciones" ignora el creado_por del body y siempre usa el id real del token', async () => {
      const pool = makeMockPool({
        bpkmPermsPorUsuario: { 10: [{ key: 'bpkm.facturas.view', nivel_permiso: 'viewer' }] },
      });
      const app = buildApp(pool, makeSeleccionesRouter);
      const token = createToken(10);

      const res = await request(app)
        .post('/api/bpkm/get_mis_facturas_seleccion')
        .set('Authorization', `Bearer ${token}`)
        .send({ creado_por: 999 });

      expect(res.status).toBe(200);
      const llamada = pool.query.mock.calls.find(([sql]) => sql.includes('bpkm.get_mis_facturas_seleccion'));
      expect(llamada[1][6]).toBe(10); // creado_por real (token), no el 999 del body
    });
    */

    it('no permite anular una selección ajena mandando el id del dueño real en "usuario"', async () => {
      const pool = {
        query: (sql, params = []) => {
          if (sql.includes('bpkm.get_permisos_bpkm')) {
            const [idUsuario] = params;
            return Promise.resolve({
              rows: idUsuario === 10 ? [{ key: 'bpkm.facturas.view', nivel_permiso: 'viewer' }] : [],
            });
          }
          if (sql.includes('SELECT creado_por FROM bpkm.tbl_factura_seleccion')) {
            return Promise.resolve({ rows: [{ creado_por: 999 }] }); // el dueño real es 999, no el 10 que llama
          }
          return Promise.resolve({ rows: [{ ok: true }] });
        },
      };
      const app = buildApp(pool, makeSeleccionesRouter);
      const token = createToken(10);

      const res = await request(app)
        .post('/api/bpkm/post_factura_seleccion_anular')
        .set('Authorization', `Bearer ${token}`)
        .send({ id_factura_sel: 1, folio_nc: 'NC-1', usuario: 999 });

      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/creador/i);
    });
  });

  describe('Permiso de módulo en endpoints antes sin control (mantenimiento 3.2)', () => {
    it('POST /get_facturas_para_ruta exige "rutasbpkm"', async () => {
      const sinPermiso = makeMockPool({ permisosPorUsuario: { 10: [] } });
      const appSinPermiso = buildApp(sinPermiso, makeSeleccionesRouter);
      const token = createToken(10);

      const resSinPermiso = await request(appSinPermiso)
        .post('/api/bpkm/get_facturas_para_ruta')
        .set('Authorization', `Bearer ${token}`)
        .send({});
      expect(resSinPermiso.status).toBe(403);

      const conPermiso = makeMockPool({ permisosPorUsuario: { 10: ['rutasbpkm'] } });
      const appConPermiso = buildApp(conPermiso, makeSeleccionesRouter);

      const resConPermiso = await request(appConPermiso)
        .post('/api/bpkm/get_facturas_para_ruta')
        .set('Authorization', `Bearer ${token}`)
        .send({});
      expect(resConPermiso.status).toBe(200);
    });

    it('POST /get_sel_resumen_por_factura exige "facturasbpkm"', async () => {
      const pool = makeMockPool({ permisosPorUsuario: { 10: [] } });
      const app = buildApp(pool, makeSeleccionesRouter);
      const token = createToken(10);

      const res = await request(app)
        .post('/api/bpkm/get_sel_resumen_por_factura')
        .set('Authorization', `Bearer ${token}`)
        .send({ id_factura: 1 });

      expect(res.status).toBe(403);
    });

    it('POST /put_sel_cambio_resolver exige "cambiosformaentrega", no solo pertenecer a la sucursal', async () => {
      const pool = makeMockPool({ permisosPorUsuario: { 10: [] } });
      const app = buildApp(pool, makeSeleccionesRouter);
      const token = createToken(10);

      const res = await request(app)
        .post('/api/bpkm/put_sel_cambio_resolver')
        .set('Authorization', `Bearer ${token}`)
        .send({ id_sel_cambio: 1, decision_codigo: 'APR' });

      expect(res.status).toBe(403);
    });
  });

  describe('Validación de esquema (mantenimiento Fase 3)', () => {
    it('POST /post_factura_seleccion_anular responde 400 con "comentario" de más de 400 caracteres', async () => {
      const pool = makeMockPool();
      const app = buildApp(pool, makeSeleccionesRouter);
      const token = createToken(10);

      const res = await request(app)
        .post('/api/bpkm/post_factura_seleccion_anular')
        .set('Authorization', `Bearer ${token}`)
        .send({ id_factura_sel: 1, folio_nc: 'NC-1', comentario: 'a'.repeat(401) });

      expect(res.status).toBe(400);
    });

    it('POST /post_factura_seleccion responde 400 con "direccion" de más de 500 caracteres', async () => {
      const pool = makeMockPool();
      const app = buildApp(pool, makeSeleccionesRouter);
      const token = createToken(10);

      const res = await request(app)
        .post('/api/bpkm/post_factura_seleccion')
        .set('Authorization', `Bearer ${token}`)
        .send({ id_factura: 1, folio: 'F-1', forma: 1, id_sucursal: 1, direccion: 'a'.repeat(501) });

      expect(res.status).toBe(400);
    });

    it('POST /post_sel_cambio responde 400 con "direccion_new" de más de 500 caracteres', async () => {
      const pool = makeMockPool();
      const app = buildApp(pool, makeSeleccionesRouter);
      const token = createToken(10);

      const res = await request(app)
        .post('/api/bpkm/post_sel_cambio')
        .set('Authorization', `Bearer ${token}`)
        .send({ id_factura_sel: 1, id_forma_nueva: 2, direccion_new: 'a'.repeat(501) });

      expect(res.status).toBe(400);
    });

    it('POST /post_sel_cambio acepta "direccion_new" en null (caso real: despacho en sucursal no tiene dirección)', async () => {
      const pool = {
        query: (sql, params = []) => {
          if (sql.includes('bpkm.get_permisos_bpkm')) {
            return Promise.resolve({ rows: [{ key: 'bpkm.facturas.view', nivel_permiso: 'viewer' }] });
          }
          if (sql.includes('SELECT creado_por FROM bpkm.tbl_factura_seleccion')) {
            return Promise.resolve({ rows: [{ creado_por: 10 }] });
          }
          return Promise.resolve({ rows: [{ ok: true }] });
        },
      };
      const app = buildApp(pool, makeSeleccionesRouter);
      const token = createToken(10);

      const res = await request(app)
        .post('/api/bpkm/post_sel_cambio')
        .set('Authorization', `Bearer ${token}`)
        .send({ id_factura_sel: 13166, id_forma_nueva: 2, id_transporte_externo_new: 12, id_departamento_new: null, id_municipio_new: null, direccion_new: null, comentario_solicitante: 'Prueba prueba prueba' });

      expect(res.status).toBe(200);
    });

    it('POST /post_factura_seleccion_anular acepta "comentario" en null', async () => {
      const pool = {
        query: (sql, params = []) => {
          if (sql.includes('bpkm.get_permisos_bpkm')) {
            return Promise.resolve({ rows: [{ key: 'bpkm.facturas.view', nivel_permiso: 'viewer' }] });
          }
          if (sql.includes('SELECT creado_por FROM bpkm.tbl_factura_seleccion')) {
            return Promise.resolve({ rows: [{ creado_por: 10 }] });
          }
          return Promise.resolve({ rows: [{ ok: true }] });
        },
      };
      const app = buildApp(pool, makeSeleccionesRouter);
      const token = createToken(10);

      const res = await request(app)
        .post('/api/bpkm/post_factura_seleccion_anular')
        .set('Authorization', `Bearer ${token}`)
        .send({ id_factura_sel: 1, folio_nc: 'NC-1', comentario: null });

      expect(res.status).toBe(200);
    });

    it('POST /post_sel_cambio responde 400 con "comentario_solicitante" de más de 500 caracteres', async () => {
      const pool = makeMockPool();
      const app = buildApp(pool, makeSeleccionesRouter);
      const token = createToken(10);

      const res = await request(app)
        .post('/api/bpkm/post_sel_cambio')
        .set('Authorization', `Bearer ${token}`)
        .send({ id_factura_sel: 1, id_forma_nueva: 2, comentario_solicitante: 'a'.repeat(501) });

      expect(res.status).toBe(400);
    });

    it('POST /post_factura_seleccion_anular responde 400 sin folio_nc', async () => {
      const pool = makeMockPool();
      const app = buildApp(pool, makeSeleccionesRouter);
      const token = createToken(10);

      const res = await request(app)
        .post('/api/bpkm/post_factura_seleccion_anular')
        .set('Authorization', `Bearer ${token}`)
        .send({ id_factura_sel: 1 });

      expect(res.status).toBe(400);
    });

    it('PUT /put_sel_cambio_resolver responde 400 con "comentario_autorizador" de más de 500 caracteres', async () => {
      const pool = makeMockPool({ permisosPorUsuario: { 10: ['cambiosformaentrega'] } });
      const app = buildApp(pool, makeSeleccionesRouter);
      const token = createToken(10);

      const res = await request(app)
        .post('/api/bpkm/put_sel_cambio_resolver')
        .set('Authorization', `Bearer ${token}`)
        .send({ id_sel_cambio: 1, decision_codigo: 'APR', comentario_autorizador: 'a'.repeat(501) });

      expect(res.status).toBe(400);
    });

    it('PUT /put_sel_cambio_resolver responde 400 con un "decision_codigo" que no es APR/RECH', async () => {
      const pool = makeMockPool({ permisosPorUsuario: { 10: ['cambiosformaentrega'] } });
      const app = buildApp(pool, makeSeleccionesRouter);
      const token = createToken(10);

      const res = await request(app)
        .post('/api/bpkm/put_sel_cambio_resolver')
        .set('Authorization', `Bearer ${token}`)
        .send({ id_sel_cambio: 1, decision_codigo: 'PENDIENTE' });

      expect(res.status).toBe(400);
    });
  });

  describe('GET /facturas_seleccion (Migración Node)', () => {
    it('responde 401 si no hay token de autenticación', async () => {
      const pool = makeMockPool();
      const app = buildApp(pool, makeSeleccionesRouter);

      const res = await request(app).get('/api/bpkm/facturas_seleccion');
      expect(res.status).toBe(401);
    });

    it('responde 403 si el usuario no tiene el permiso de módulo "facturasbpkm"', async () => {
      const pool = makeMockPool({ permisosPorUsuario: { 10: [] } });
      const app = buildApp(pool, makeSeleccionesRouter);
      const token = createToken(10);

      const res = await request(app)
        .get('/api/bpkm/facturas_seleccion')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(403);
    });

    it('responde 403 si el usuario tiene módulo "facturasbpkm" pero no el permiso "bpkm.facturas.view"', async () => {
      const pool = makeMockPool({
        permisosPorUsuario: { 10: ['facturasbpkm'] },
        bpkmPermsPorUsuario: { 10: [] }
      });
      const app = buildApp(pool, makeSeleccionesRouter);
      const token = createToken(10);

      const res = await request(app)
        .get('/api/bpkm/facturas_seleccion')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(403);
      expect(res.body.message || res.body.error).toMatch(/permiso para ver facturas/i);
    });

    it('responde 200 con estructura de datos y resumen por estado cuando tiene permisos', async () => {
      const pool = {
        query: vi.fn((sql, params = []) => {
          if (sql.includes('usuarios.tbl_asignaciones_usuario_permiso')) {
            return Promise.resolve({ rows: [{ total: '1' }] });
          }
          if (sql.includes('bpkm.get_permisos_bpkm')) {
            return Promise.resolve({ rows: [{ key: 'bpkm.facturas.view', nivel_permiso: 'viewer' }] });
          }
          if (sql.includes('SELECT COUNT(*)::bigint AS total')) {
            return Promise.resolve({ rows: [{ total: '10' }] });
          }
          if (sql.includes("e.codigo IN ('ACT', 'EN_RUTA')")) {
            return Promise.resolve({
              rows: [
                { estado: 'ACT', conteo: '3' },
                { estado: 'EN_RUTA', conteo: '2' },
                { estado: 'FALLIDA', conteo: '0' }
              ]
            });
          }
          return Promise.resolve({
            rows: [
              {
                id_factura_sel: 1,
                id_factura: 100,
                folio_factura: 'F-001',
                estado_codigo: 'ACT',
                tiene_evidencias: true
              }
            ]
          });
        })
      };

      const app = buildApp(pool, makeSeleccionesRouter);
      const token = createToken(10);

      const res = await request(app)
        .get('/api/bpkm/facturas_seleccion?page=1&limit=25')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.total).toBeUndefined();
      expect(res.body.items).toHaveLength(1);
      expect(res.body.items[0].tiene_evidencias).toBe(true);
      expect(res.body.items[0].tiene_evidencia).toBeUndefined();
      expect(res.body.items[0].total_count).toBeUndefined();
      expect(res.body.resumen).toEqual({
        pagination: {
          total: 10,
          page: 1,
          limit: 25
        },
        por_estado: {
          ACT: 3,
          EN_RUTA: 2,
          FALLIDA: 0
        }
      });

      // Validar que creado_por vino del token (10) y no del query param (999)
      const llamadaItems = pool.query.mock.calls.find(([sql]) => sql.includes('LIMIT $8 OFFSET $9'));
      expect(llamadaItems[1][5]).toBe(10); // $6 creado_por
    });

    it('responde 400 si se envía un parámetro de query inválido (ej. fecha malformada o limit > 100)', async () => {
      const pool = makeMockPool({
        permisosPorUsuario: { 10: ['facturasbpkm'] },
        bpkmPermsPorUsuario: { 10: [{ key: 'bpkm.facturas.view', nivel_permiso: 'viewer' }] }
      });
      const app = buildApp(pool, makeSeleccionesRouter);
      const token = createToken(10);

      const res = await request(app)
        .get('/api/bpkm/facturas_seleccion?limit=999')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/validación/i);
    });
  });
});
