process.env.JWT_SECRET = 'test-jwt-secret-bpkm';

import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { createToken, makeMockPool, buildApp } from './helpers/bpkmTestApp.js';

describe('routes/bpkm/rutas.js', () => {
  let makeRutasRouter;

  beforeAll(async () => {
    makeRutasRouter = (await import('../../../../src/routes/bpkm/rutas.js')).default;
  });

  describe('Identidad del actor viene de req.user, no del body (mantenimiento 3.1)', () => {
    it('ignora un "usuario" del body que apunta a otra persona y usa el id real del token', async () => {
      const pool = makeMockPool({
        permisosPorUsuario: { 10: ['rutasbpkm'] },
        bpkmPermsPorUsuario: { 10: [{ key: 'bpkm.rutas.comentar', nivel_permiso: 'editor' }] },
      });
      const app = buildApp(pool, makeRutasRouter);
      const token = createToken(10);

      const res = await request(app)
        .post('/api/bpkm/post_comentario_ruta')
        .set('Authorization', `Bearer ${token}`)
        .send({ id_ruta: 1, comentario: 'hola', usuario: 999 });

      expect(res.status).toBe(200);

      const llamadaFuncionSql = pool.query.mock.calls.find(([sql]) =>
        sql.includes('bpkm.post_comentario_ruta')
      );
      expect(llamadaFuncionSql).toBeTruthy();
      // El tercer parámetro (usuario) debe ser el del token (10), no el 999 del body.
      expect(llamadaFuncionSql[1]).toEqual([1, 'hola', 10]);
    });

    it('no permite pasar el permiso de otro usuario mandando su id en el body', async () => {
      const pool = makeMockPool({
        permisosPorUsuario: { 10: ['rutasbpkm'] },
        bpkmPermsPorUsuario: {
          10: [], // el usuario real (10) NO tiene permiso
          999: [{ key: 'bpkm.rutas.comentar', nivel_permiso: 'editor' }], // 999 sí, pero no es quien llama
        },
      });
      const app = buildApp(pool, makeRutasRouter);
      const token = createToken(10);

      const res = await request(app)
        .post('/api/bpkm/post_comentario_ruta')
        .set('Authorization', `Bearer ${token}`)
        .send({ id_ruta: 1, comentario: 'hola', usuario: 999 });

      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/permiso/i);
    });
  });

  describe('Permiso de módulo "rutasbpkm" en endpoints antes sin control (mantenimiento 3.2)', () => {
    it('POST /get_facturas_disponibles responde 403 sin "rutasbpkm"', async () => {
      const pool = makeMockPool({ permisosPorUsuario: { 10: [] } });
      const app = buildApp(pool, makeRutasRouter);
      const token = createToken(10);

      const res = await request(app)
        .post('/api/bpkm/get_facturas_disponibles')
        .set('Authorization', `Bearer ${token}`)
        .send({});

      expect(res.status).toBe(403);
    });

    it('POST /get_facturas_disponibles responde 200 con "rutasbpkm"', async () => {
      const pool = makeMockPool({ permisosPorUsuario: { 10: ['rutasbpkm'] } });
      const app = buildApp(pool, makeRutasRouter);
      const token = createToken(10);

      const res = await request(app)
        .post('/api/bpkm/get_facturas_disponibles')
        .set('Authorization', `Bearer ${token}`)
        .send({});

      expect(res.status).toBe(200);
    });

    it('POST /get_comentarios_ruta acepta "rutasbpkm", "gerenciabpkm" o "localesbpkm" (lo usan RutaDetalle, GerenciaDetalle y RutasLocalesDetalle)', async () => {
      const sinPermiso = makeMockPool({ permisosPorUsuario: { 10: [] } });
      const appSinPermiso = buildApp(sinPermiso, makeRutasRouter);
      const token = createToken(10);

      const resSinPermiso = await request(appSinPermiso)
        .post('/api/bpkm/get_comentarios_ruta')
        .set('Authorization', `Bearer ${token}`)
        .send({ id_ruta: 1 });
      expect(resSinPermiso.status).toBe(403);

      const conLocalesbpkm = makeMockPool({ permisosPorUsuario: { 10: ['localesbpkm'] } });
      const appConLocalesbpkm = buildApp(conLocalesbpkm, makeRutasRouter);

      const resConLocalesbpkm = await request(appConLocalesbpkm)
        .post('/api/bpkm/get_comentarios_ruta')
        .set('Authorization', `Bearer ${token}`)
        .send({ id_ruta: 1 });
      expect(resConLocalesbpkm.status).toBe(200);
    });
  });

  describe('Límites de tráfico y entrada (mantenimiento Fase 2)', () => {
    it('POST /post_comentario_ruta rechaza un Content-Type distinto de application/json', async () => {
      const pool = makeMockPool({
        permisosPorUsuario: { 10: ['rutasbpkm'] },
        bpkmPermsPorUsuario: { 10: [{ key: 'bpkm.rutas.comentar', nivel_permiso: 'editor' }] },
      });
      const app = buildApp(pool, makeRutasRouter);
      const token = createToken(10);

      const res = await request(app)
        .post('/api/bpkm/post_comentario_ruta')
        .set('Authorization', `Bearer ${token}`)
        .set('Content-Type', 'text/plain')
        .send('id_ruta=1&comentario=hola');

      expect(res.status).toBe(415);
    });

    it('POST /post_comentario_ruta sanea caracteres de inyección del comentario antes de guardarlo', async () => {
      const pool = makeMockPool({
        permisosPorUsuario: { 10: ['rutasbpkm'] },
        bpkmPermsPorUsuario: { 10: [{ key: 'bpkm.rutas.comentar', nivel_permiso: 'editor' }] },
      });
      const app = buildApp(pool, makeRutasRouter);
      const token = createToken(10);

      const res = await request(app)
        .post('/api/bpkm/post_comentario_ruta')
        .set('Authorization', `Bearer ${token}`)
        .send({ id_ruta: 1, comentario: "hola'; DROP TABLE--" });

      expect(res.status).toBe(200);
      const llamada = pool.query.mock.calls.find(([sql]) => sql.includes('bpkm.post_comentario_ruta'));
      expect(llamada[1][1]).toBe('hola DROP TABLE');
    });

    it('GET /rutas/:id/destinos rechaza un :id no numérico antes de llegar al controlador', async () => {
      const pool = makeMockPool({ permisosPorUsuario: { 10: ['gerenciabpkm'] } });
      const app = buildApp(pool, makeRutasRouter);
      const token = createToken(10);

      const res = await request(app)
        .get('/api/bpkm/rutas/abc/destinos')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(400);
    });
  });

  describe('Validación de esquema (mantenimiento Fase 3)', () => {
    it('POST /post_comentario_ruta responde 400 con comentario vacío (solo espacios)', async () => {
      const pool = makeMockPool({
        permisosPorUsuario: { 10: ['rutasbpkm'] },
        bpkmPermsPorUsuario: { 10: [{ key: 'bpkm.rutas.comentar', nivel_permiso: 'editor' }] },
      });
      const app = buildApp(pool, makeRutasRouter);
      const token = createToken(10);

      const res = await request(app)
        .post('/api/bpkm/post_comentario_ruta')
        .set('Authorization', `Bearer ${token}`)
        .send({ id_ruta: 1, comentario: '   ' });

      expect(res.status).toBe(400);
    });

    it('POST /post_comentario_ruta responde 400 con un comentario de más de 2000 caracteres', async () => {
      const pool = makeMockPool({
        permisosPorUsuario: { 10: ['rutasbpkm'] },
        bpkmPermsPorUsuario: { 10: [{ key: 'bpkm.rutas.comentar', nivel_permiso: 'editor' }] },
      });
      const app = buildApp(pool, makeRutasRouter);
      const token = createToken(10);

      const res = await request(app)
        .post('/api/bpkm/post_comentario_ruta')
        .set('Authorization', `Bearer ${token}`)
        .send({ id_ruta: 1, comentario: 'a'.repeat(2001) });

      expect(res.status).toBe(400);
    });

    it('POST /get_facturas_disponibles responde 400 con "buscar" de más de 100 caracteres', async () => {
      const pool = makeMockPool({ permisosPorUsuario: { 10: ['rutasbpkm'] } });
      const app = buildApp(pool, makeRutasRouter);
      const token = createToken(10);

      const res = await request(app)
        .post('/api/bpkm/get_facturas_disponibles')
        .set('Authorization', `Bearer ${token}`)
        .send({ buscar: 'a'.repeat(101) });

      expect(res.status).toBe(400);
    });

    it('POST /post_liquidar_detalle_ruta responde 400 con "motivo_fallo" de más de 500 caracteres', async () => {
      const pool = makeMockPool({ permisosPorUsuario: { 10: ['rutasbpkm'] } });
      const app = buildApp(pool, makeRutasRouter);
      const token = createToken(10);

      const res = await request(app)
        .post('/api/bpkm/post_liquidar_detalle_ruta')
        .set('Authorization', `Bearer ${token}`)
        .send({ id_detalle_ruta: 1, estado_codigo: 'FALLIDA', motivo_fallo: 'a'.repeat(501) });

      expect(res.status).toBe(400);
    });

    it('POST /post_liquidar_detalle_ruta responde 400 con "observaciones" de más de 500 caracteres', async () => {
      const pool = makeMockPool({ permisosPorUsuario: { 10: ['rutasbpkm'] } });
      const app = buildApp(pool, makeRutasRouter);
      const token = createToken(10);

      const res = await request(app)
        .post('/api/bpkm/post_liquidar_detalle_ruta')
        .set('Authorization', `Bearer ${token}`)
        .send({ id_detalle_ruta: 1, estado_codigo: 'ENTREGADA', observaciones: 'a'.repeat(501) });

      expect(res.status).toBe(400);
    });

    it('POST /post_liquidar_detalle_ruta acepta ENTREGADA con motivo_fallo y observaciones en null (caso real reportado)', async () => {
      const pool = makeMockPool({
        permisosPorUsuario: { 10: ['rutasbpkm'] },
        bpkmPermsPorUsuario: { 10: [{ key: 'bpkm.rutas.liquidar', nivel_permiso: 'editor' }] },
      });
      const app = buildApp(pool, makeRutasRouter);
      const token = createToken(10);

      const res = await request(app)
        .post('/api/bpkm/post_liquidar_detalle_ruta')
        .set('Authorization', `Bearer ${token}`)
        .send({ id_detalle_ruta: 11546, estado_codigo: 'ENTREGADA', motivo_fallo: null, observaciones: null, puede_reenviar: true });

      expect(res.status).toBe(200);
    });

    it('POST /post_liquidar_detalle_ruta acepta PARCIAL con motivo_fallo en null y solo observaciones (caso real reportado)', async () => {
      const pool = makeMockPool({
        permisosPorUsuario: { 10: ['rutasbpkm'] },
        bpkmPermsPorUsuario: { 10: [{ key: 'bpkm.rutas.liquidar', nivel_permiso: 'editor' }] },
      });
      const app = buildApp(pool, makeRutasRouter);
      const token = createToken(10);

      const res = await request(app)
        .post('/api/bpkm/post_liquidar_detalle_ruta')
        .set('Authorization', `Bearer ${token}`)
        .send({ id_detalle_ruta: 11546, estado_codigo: 'PARCIAL', motivo_fallo: null, observaciones: 'Prueba parcial reenviable', puede_reenviar: true });

      expect(res.status).toBe(200);
    });

    it('POST /post_liquidar_detalle_ruta acepta FALLIDA con observaciones en null y solo motivo_fallo (caso real reportado)', async () => {
      const pool = makeMockPool({
        permisosPorUsuario: { 10: ['rutasbpkm'] },
        bpkmPermsPorUsuario: { 10: [{ key: 'bpkm.rutas.liquidar', nivel_permiso: 'editor' }] },
      });
      const app = buildApp(pool, makeRutasRouter);
      const token = createToken(10);

      const res = await request(app)
        .post('/api/bpkm/post_liquidar_detalle_ruta')
        .set('Authorization', `Bearer ${token}`)
        .send({ id_detalle_ruta: 11546, estado_codigo: 'FALLIDA', motivo_fallo: 'Prueba prueba', observaciones: null, puede_reenviar: true });

      expect(res.status).toBe(200);
    });

    it('POST /post_liquidar_detalle_ruta responde 400 con un "estado_codigo" que no es ENTREGADA/FALLIDA/PARCIAL', async () => {
      const pool = makeMockPool({ permisosPorUsuario: { 10: ['rutasbpkm'] } });
      const app = buildApp(pool, makeRutasRouter);
      const token = createToken(10);

      const res = await request(app)
        .post('/api/bpkm/post_liquidar_detalle_ruta')
        .set('Authorization', `Bearer ${token}`)
        .send({ id_detalle_ruta: 1, estado_codigo: 'ENTREGADO' });

      expect(res.status).toBe(400);
    });
  });

  describe('Permiso de módulo "rutasbpkm" agregado a endpoints que solo tenían el chequeo fino (mantenimiento 3.14)', () => {
    it('POST /get_rutas responde 403 sin "rutasbpkm"', async () => {
      const pool = makeMockPool({ permisosPorUsuario: { 10: [] } });
      const app = buildApp(pool, makeRutasRouter);
      const token = createToken(10);

      const res = await request(app)
        .post('/api/bpkm/get_rutas')
        .set('Authorization', `Bearer ${token}`)
        .send({});

      expect(res.status).toBe(403);
    });

    it('POST /post_ruta_completa responde 403 sin "rutasbpkm"', async () => {
      const pool = makeMockPool({ permisosPorUsuario: { 10: [] } });
      const app = buildApp(pool, makeRutasRouter);
      const token = createToken(10);

      const res = await request(app)
        .post('/api/bpkm/post_ruta_completa')
        .set('Authorization', `Bearer ${token}`)
        .send({});

      expect(res.status).toBe(403);
    });

    it('POST /put_ruta_actualizar_personal responde 403 sin "rutasbpkm"', async () => {
      const pool = makeMockPool({ permisosPorUsuario: { 10: [] } });
      const app = buildApp(pool, makeRutasRouter);
      const token = createToken(10);

      const res = await request(app)
        .post('/api/bpkm/put_ruta_actualizar_personal')
        .set('Authorization', `Bearer ${token}`)
        .send({ id_ruta: 1 });

      expect(res.status).toBe(403);
    });
  });

  describe('POST /get_rutas - paginación real y sin filtro de sucursal del cliente (mantenimiento 3.14)', () => {
    const mockPoolRutas = ({ totalFilas = 1, sucursalesUsuario = [10], enCurso = 0 } = {}) => ({
      query: (sql) => {
        if (sql.includes('tbl_asignaciones_usuario_rol_sucursal')) {
          return Promise.resolve({ rows: sucursalesUsuario.map((id_sucursal) => ({ id_sucursal })) });
        }
        if (sql.includes('COUNT(*) AS total FROM (')) {
          return Promise.resolve({ rows: [{ total: String(totalFilas) }] });
        }
        if (sql.includes('COUNT(DISTINCT r.id_ruta) AS conteo')) {
          return Promise.resolve({ rows: [{ conteo: String(enCurso) }] });
        }
        if (sql.includes('tbl_modulos')) {
          return Promise.resolve({ rows: [{ total: '1' }] });
        }
        return Promise.resolve({ rows: [{ id_ruta: 1, codigo_ruta: 'RT-1' }] });
      },
    });

    it('devuelve items/total/page/limit, no un arreglo plano', async () => {
      const pool = mockPoolRutas({ totalFilas: 3 });
      const app = buildApp(pool, makeRutasRouter);
      const token = createToken(10);

      const res = await request(app)
        .post('/api/bpkm/get_rutas')
        .set('Authorization', `Bearer ${token}`)
        .send({});

      expect(res.status).toBe(200);
      expect(res.body.ok).toBe(true);
      expect(Array.isArray(res.body.data.items)).toBe(true);
      expect(res.body.data.total).toBe(3);
    });

    it('ignora cualquier "id_sucursal_usuario"/"id_suc_salida" que mande el cliente en el body', async () => {
      const pool = mockPoolRutas({ sucursalesUsuario: [7] });
      const app = buildApp(pool, makeRutasRouter);
      const token = createToken(10);

      const res = await request(app)
        .post('/api/bpkm/get_rutas')
        .set('Authorization', `Bearer ${token}`)
        .send({ id_sucursal_usuario: 999, id_suc_salida: 999 });

      expect(res.status).toBe(200);
    });

    it('devuelve resumen.por_estado.EN_CURSO', async () => {
      const pool = mockPoolRutas({ enCurso: 2 });
      const app = buildApp(pool, makeRutasRouter);
      const token = createToken(10);

      const res = await request(app)
        .post('/api/bpkm/get_rutas')
        .set('Authorization', `Bearer ${token}`)
        .send({});

      expect(res.status).toBe(200);
      expect(res.body.data.resumen).toEqual({ por_estado: { EN_CURSO: 2 } });
    });

    it('un usuario sin ninguna sucursal asignada no ve ninguna ruta', async () => {
      const pool = mockPoolRutas({ sucursalesUsuario: [] });
      const app = buildApp(pool, makeRutasRouter);
      const token = createToken(10);

      const res = await request(app)
        .post('/api/bpkm/get_rutas')
        .set('Authorization', `Bearer ${token}`)
        .send({});

      expect(res.status).toBe(200);
      expect(res.body.data.items).toEqual([]);
      expect(res.body.data.total).toBe(0);
    });
  });

  describe('Limpieza de endpoints muertos/duplicados (mantenimiento 3.3, 3.7, 3.14)', () => {
    it('POST /post_ruta ya no existe (eliminado por no usarse desde el frontend)', async () => {
      const pool = makeMockPool();
      const app = buildApp(pool, makeRutasRouter);
      const token = createToken(10);

      const res = await request(app)
        .post('/api/bpkm/post_ruta')
        .set('Authorization', `Bearer ${token}`)
        .send({ usuario: 10 });

      expect(res.status).toBe(404);
    });

    it('POST /put_ruta_cancelar ya no existe (retirado por no tener ningún caso de uso real: 0/1999 rutas canceladas)', async () => {
      const pool = makeMockPool();
      const app = buildApp(pool, makeRutasRouter);
      const token = createToken(10);

      const res = await request(app)
        .post('/api/bpkm/put_ruta_cancelar')
        .set('Authorization', `Bearer ${token}`)
        .send({ id_ruta: 1, usuario: 10 });

      expect(res.status).toBe(404);
    });

    it('POST /get_productos_entrega_parcial solo llama a la función SQL (no queda el bloque duplicado con SQL crudo)', async () => {
      const pool = makeMockPool({ permisosPorUsuario: { 10: ['rutasbpkm'] } });
      const app = buildApp(pool, makeRutasRouter);
      const token = createToken(10);

      const res = await request(app)
        .post('/api/bpkm/get_productos_entrega_parcial')
        .set('Authorization', `Bearer ${token}`)
        .send({ id_liquidacion: 5 });

      expect(res.status).toBe(200);
      const sqlLlamada = pool.query.mock.calls.map(([sql]) => sql).join('\n');
      expect(sqlLlamada).toContain('bpkm.get_productos_entrega_parcial');
      expect(sqlLlamada).not.toContain('FROM bpkm.tbl_entrega_parcial_productos');
    });
  });
});
