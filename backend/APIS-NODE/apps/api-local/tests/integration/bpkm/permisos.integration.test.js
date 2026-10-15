import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import {
  makePool,
  buildApp,
  mintToken,
  usuario1,
  usuario2,
  asegurarPermisoModulo,
  quitarPermisoModulo,
} from '../helpers/bpkmTestApp';

// Alcance deliberado: esta suite prueba solo lo que un mock no puede validar de verdad -
// que requireModuloPermission/requireAnyModuloPermission bloquean y permiten correctamente
// contra usuarios.tbl_modulos/tbl_permisos reales, con los 10 needKey de BPKM. No crea ni
// muta datos de negocio (rutas, selecciones, BPKM) - todos los endpoints usados son de solo
// lectura (SELECT), mismo criterio de bajo riesgo que cxc/permisos.integration.test.js. La
// corrección de identidad (req.user en vez del body) ya queda cubierta por los unitarios con
// mock, que sí pueden inspeccionar exactamente qué parámetro llegó a la función SQL.
//
// TEST_ID_USUARIO_1/2 son las cuentas genéricas compartidas entre módulos (ver
// helpers/bpkmTestApp.js) - esta suite otorga los 10 needKey sobre TEST_ID_USUARIO_1 en su
// beforeAll y los revierte todos en su afterAll, dejando la cuenta como la encontró.
// TEST_ID_USUARIO_2 nunca se toca.
const NEED_KEYS = [
  'gerenciabpkm', 'rrhhbpkm', 'catalogosbpkm', 'rutasbpkm', 'facturasbpkm',
  'cambiosformaentrega', 'cambiossucursal', 'monitoreobpkm', 'localesbpkm', 'distacia_rutas',
];

describe('[integración] permisos de módulo reales de BPKM contra la BD (no mockeados)', () => {
  let pool;
  let app;
  let idUsuarioConPermisos;
  let idUsuarioSinPermisos;

  beforeAll(async () => {
    pool = makePool(process.env);
    app = buildApp(pool);
    idUsuarioConPermisos = usuario1();
    idUsuarioSinPermisos = usuario2();

    for (const key of NEED_KEYS) {
      await asegurarPermisoModulo(pool, idUsuarioConPermisos, key);
    }
  });

  afterAll(async () => {
    for (const key of NEED_KEYS) {
      await quitarPermisoModulo(pool, idUsuarioConPermisos, key);
    }
    await pool.end();
  });

  describe('needKey único', () => {
    it('POST /get_camiones_admin - sin token, 401', async () => {
      const res = await request(app).post('/api/bpkm/get_camiones_admin').send({});
      expect(res.status).toBe(401);
    });

    it('POST /get_camiones_admin - con token pero sin "catalogosbpkm", 403', async () => {
      const token = mintToken(idUsuarioSinPermisos);
      const res = await request(app)
        .post('/api/bpkm/get_camiones_admin')
        .set('Authorization', `Bearer ${token}`)
        .send({});
      expect(res.status).toBe(403);
    });

    it('POST /get_camiones_admin - con "catalogosbpkm", no debería dar 401/403', async () => {
      const token = mintToken(idUsuarioConPermisos);
      const res = await request(app)
        .post('/api/bpkm/get_camiones_admin')
        .set('Authorization', `Bearer ${token}`)
        .send({});
      expect(res.status).not.toBe(401);
      expect(res.status).not.toBe(403);
      expect(res.status).not.toBe(500);
    });

    it('POST /get_facturas_disponibles exige "rutasbpkm"', async () => {
      const sinPermiso = mintToken(idUsuarioSinPermisos);
      const resSinPermiso = await request(app)
        .post('/api/bpkm/get_facturas_disponibles')
        .set('Authorization', `Bearer ${sinPermiso}`)
        .send({});
      expect(resSinPermiso.status).toBe(403);

      const conPermiso = mintToken(idUsuarioConPermisos);
      const resConPermiso = await request(app)
        .post('/api/bpkm/get_facturas_disponibles')
        .set('Authorization', `Bearer ${conPermiso}`)
        .send({});
      expect(resConPermiso.status).not.toBe(401);
      expect(resConPermiso.status).not.toBe(403);
      expect(resConPermiso.status).not.toBe(500);
    });

    it('POST /get_sel_resumen_por_factura exige "facturasbpkm"', async () => {
      const sinPermiso = mintToken(idUsuarioSinPermisos);
      const resSinPermiso = await request(app)
        .post('/api/bpkm/get_sel_resumen_por_factura')
        .set('Authorization', `Bearer ${sinPermiso}`)
        .send({ id_factura: 1 });
      expect(resSinPermiso.status).toBe(403);

      const conPermiso = mintToken(idUsuarioConPermisos);
      const resConPermiso = await request(app)
        .post('/api/bpkm/get_sel_resumen_por_factura')
        .set('Authorization', `Bearer ${conPermiso}`)
        .send({ id_factura: 1 });
      expect(resConPermiso.status).not.toBe(401);
      expect(resConPermiso.status).not.toBe(403);
      expect(resConPermiso.status).not.toBe(500);
    });

    it('POST /get_solicitudes_cambio exige "cambiosformaentrega"', async () => {
      const sinPermiso = mintToken(idUsuarioSinPermisos);
      const resSinPermiso = await request(app)
        .post('/api/bpkm/get_solicitudes_cambio')
        .set('Authorization', `Bearer ${sinPermiso}`)
        .send({ id_usuario: idUsuarioSinPermisos });
      expect(resSinPermiso.status).toBe(403);

      const conPermiso = mintToken(idUsuarioConPermisos);
      const resConPermiso = await request(app)
        .post('/api/bpkm/get_solicitudes_cambio')
        .set('Authorization', `Bearer ${conPermiso}`)
        .send({ id_usuario: idUsuarioConPermisos });
      expect(resConPermiso.status).not.toBe(401);
      expect(resConPermiso.status).not.toBe(403);
      expect(resConPermiso.status).not.toBe(500);
    });

    it('POST /get_cambios_sucursal exige "cambiossucursal"', async () => {
      const sinPermiso = mintToken(idUsuarioSinPermisos);
      const resSinPermiso = await request(app)
        .post('/api/bpkm/get_cambios_sucursal')
        .set('Authorization', `Bearer ${sinPermiso}`)
        .send({});
      expect(resSinPermiso.status).toBe(403);

      const conPermiso = mintToken(idUsuarioConPermisos);
      const resConPermiso = await request(app)
        .post('/api/bpkm/get_cambios_sucursal')
        .set('Authorization', `Bearer ${conPermiso}`)
        .send({});
      expect(resConPermiso.status).not.toBe(401);
      expect(resConPermiso.status).not.toBe(403);
      expect(resConPermiso.status).not.toBe(500);
    });

    it('GET /monitoreo exige "monitoreobpkm"', async () => {
      const sinPermiso = mintToken(idUsuarioSinPermisos);
      const resSinPermiso = await request(app)
        .get('/api/bpkm/monitoreo')
        .set('Authorization', `Bearer ${sinPermiso}`);
      expect(resSinPermiso.status).toBe(403);

      const conPermiso = mintToken(idUsuarioConPermisos);
      const resConPermiso = await request(app)
        .get('/api/bpkm/monitoreo')
        .set('Authorization', `Bearer ${conPermiso}`);
      expect(resConPermiso.status).not.toBe(401);
      expect(resConPermiso.status).not.toBe(403);
      expect(resConPermiso.status).not.toBe(500);
    });

    it('GET /rutas-locales exige "localesbpkm"', async () => {
      const sinPermiso = mintToken(idUsuarioSinPermisos);
      const resSinPermiso = await request(app)
        .get('/api/bpkm/rutas-locales')
        .set('Authorization', `Bearer ${sinPermiso}`);
      expect(resSinPermiso.status).toBe(403);

      const conPermiso = mintToken(idUsuarioConPermisos);
      const resConPermiso = await request(app)
        .get('/api/bpkm/rutas-locales')
        .set('Authorization', `Bearer ${conPermiso}`);
      expect(resConPermiso.status).not.toBe(401);
      expect(resConPermiso.status).not.toBe(403);
      expect(resConPermiso.status).not.toBe(500);
    });

    it('GET /distancia exige "distacia_rutas"', async () => {
      const sinPermiso = mintToken(idUsuarioSinPermisos);
      const resSinPermiso = await request(app)
        .get('/api/bpkm/distancia')
        .set('Authorization', `Bearer ${sinPermiso}`);
      expect(resSinPermiso.status).toBe(403);

      const conPermiso = mintToken(idUsuarioConPermisos);
      const resConPermiso = await request(app)
        .get('/api/bpkm/distancia')
        .set('Authorization', `Bearer ${conPermiso}`);
      expect(resConPermiso.status).not.toBe(401);
      expect(resConPermiso.status).not.toBe(403);
      expect(resConPermiso.status).not.toBe(500);
    });
  });

  describe('needKey múltiple (OR)', () => {
    it('POST /get_bpkm acepta "gerenciabpkm" o "rrhhbpkm" (ambos ya asignados a la cuenta de prueba)', async () => {
      const sinPermiso = mintToken(idUsuarioSinPermisos);
      const resSinPermiso = await request(app)
        .post('/api/bpkm/get_bpkm')
        .set('Authorization', `Bearer ${sinPermiso}`)
        .send({});
      expect(resSinPermiso.status).toBe(403);

      const conPermiso = mintToken(idUsuarioConPermisos);
      const resConPermiso = await request(app)
        .post('/api/bpkm/get_bpkm')
        .set('Authorization', `Bearer ${conPermiso}`)
        .send({});
      expect(resConPermiso.status).not.toBe(401);
      expect(resConPermiso.status).not.toBe(403);
      expect(resConPermiso.status).not.toBe(500);
    });

    it('POST /get_detalles_por_ruta_gerencia acepta "gerenciabpkm", "localesbpkm" o "rrhhbpkm"', async () => {
      const sinPermiso = mintToken(idUsuarioSinPermisos);
      const resSinPermiso = await request(app)
        .post('/api/bpkm/get_detalles_por_ruta_gerencia')
        .set('Authorization', `Bearer ${sinPermiso}`)
        .send({ id_ruta: 1 });
      expect(resSinPermiso.status).toBe(403);

      const conPermiso = mintToken(idUsuarioConPermisos);
      const resConPermiso = await request(app)
        .post('/api/bpkm/get_detalles_por_ruta_gerencia')
        .set('Authorization', `Bearer ${conPermiso}`)
        .send({ id_ruta: 1 });
      expect(resConPermiso.status).not.toBe(401);
      expect(resConPermiso.status).not.toBe(403);
      expect(resConPermiso.status).not.toBe(500);
    });
  });
});
