process.env.JWT_SECRET = 'test-jwt-secret-bpkm';

import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import request from 'supertest';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { createToken, buildApp } from './helpers/bpkmTestApp.js';
import { resolveAbsPath, determinarContentType } from '../../../../src/services/bpkm/evidenciaStorage.js';

describe('routes/bpkm/evidencias.js', () => {
  let makeEvidenciasRouter;
  let testUploadRoot;

  beforeAll(async () => {
    testUploadRoot = path.join(os.tmpdir(), `bpkm-evidencias-test-${Date.now()}`);
    fs.mkdirSync(testUploadRoot, { recursive: true });
    process.env.UPLOAD_ROOT = testUploadRoot;

    makeEvidenciasRouter = (await import('../../../../src/routes/bpkm/evidencias.js')).default;
  });

  afterAll(() => {
    if (fs.existsSync(testUploadRoot)) {
      fs.rmSync(testUploadRoot, { recursive: true, force: true });
    }
  });

  function makePool({
    permisosPorUsuario = { 10: ['facturasbpkm'] },
    facturaSelRow = null,
    evidenciasRows = [],
    evidenciaArchivoRow = null
  } = {}) {
    return {
      query: vi.fn(async (sql, params = []) => {
        if (sql.includes('tbl_modulos')) {
          const [codigoModulo, idUsuario] = params;
          const userPerms = permisosPorUsuario[idUsuario] || [];
          const tiene = userPerms.includes(codigoModulo);
          return { rows: [{ total: tiene ? '1' : '0' }] };
        }
        if (sql.includes('ee.ruta_archivo')) {
          return { rows: evidenciaArchivoRow ? [evidenciaArchivoRow] : [] };
        }
        if (sql.includes('tbl_factura_seleccion')) {
          return { rows: facturaSelRow ? [facturaSelRow] : [] };
        }
        if (sql.includes('tbl_evidencia_entrega')) {
          return { rows: evidenciasRows };
        }
        return { rows: [] };
      })
    };
  }

  describe('Servicio evidenciaStorage', () => {
    it('determina correctamente el Content-Type por extensión', () => {
      expect(determinarContentType('foto.jpg')).toBe('image/jpeg');
      expect(determinarContentType('foto.jpeg')).toBe('image/jpeg');
      expect(determinarContentType('foto.png')).toBe('image/png');
      expect(determinarContentType('foto.webp')).toBe('image/webp');
      expect(determinarContentType('archivo.xyz')).toBe('application/octet-stream');
    });

    it('resuelve ruta absoluta dentro de UPLOAD_ROOT', () => {
      const rel = 'entregafacturas/2026/09/22/foto.png';
      const abs = resolveAbsPath(rel);
      expect(abs).toBe(path.resolve(testUploadRoot, rel));
    });

    it('rechaza path traversal que intente salir de UPLOAD_ROOT', () => {
      expect(() => resolveAbsPath('../../etc/passwd')).toThrow(/fuera de UPLOAD_ROOT/);
      expect(() => resolveAbsPath('..\\..\\windows\\system32')).toThrow(/fuera de UPLOAD_ROOT/);
    });

    it('rechaza ruta vacía', () => {
      expect(() => resolveAbsPath('')).toThrow(/vacía/);
      expect(() => resolveAbsPath(null)).toThrow(/vacía/);
    });
  });

  describe('GET /api/bpkm/facturas/evidencias?id=...', () => {
    it('retorna 401 si no se envía token de autenticación', async () => {
      const pool = makePool();
      const app = buildApp(pool, makeEvidenciasRouter);

      const res = await request(app).get('/api/bpkm/facturas/evidencias?id=100');
      expect(res.status).toBe(401);
      expect(res.body.ok).toBe(false);
    });

    it('retorna 403 si el usuario no tiene ningún permiso de módulo permitido en la ruta', async () => {
      const pool = makePool({ permisosPorUsuario: { 10: ['otro_modulo'] } });
      const app = buildApp(pool, makeEvidenciasRouter);
      const token = createToken(10);

      const res = await request(app)
        .get('/api/bpkm/facturas/evidencias?id=100')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(403);
      expect(res.body.ok).toBe(false);
      expect(res.body.message).toMatch(/No tienes permisos para este módulo/i);
    });

    it('retorna 400 si falta el query param id', async () => {
      const pool = makePool();
      const app = buildApp(pool, makeEvidenciasRouter);
      const token = createToken(10);

      const res = await request(app)
        .get('/api/bpkm/facturas/evidencias')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(400);
      expect(res.body.ok).toBe(false);
      expect(res.body.message).toMatch(/Errores de validación/i);
    });

    it('retorna 400 si el query param id no es numérico', async () => {
      const pool = makePool();
      const app = buildApp(pool, makeEvidenciasRouter);
      const token = createToken(10);

      const res = await request(app)
        .get('/api/bpkm/facturas/evidencias?id=abc')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(400);
      expect(res.body.ok).toBe(false);
      expect(res.body.message).toMatch(/Errores de validación/i);
    });

    it('retorna 404 si la factura no existe en tbl_factura_seleccion', async () => {
      const pool = makePool({ facturaSelRow: null });
      const app = buildApp(pool, makeEvidenciasRouter);
      const token = createToken(10);

      const res = await request(app)
        .get('/api/bpkm/facturas/evidencias?id=9999')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(404);
      expect(res.body.ok).toBe(false);
      expect(res.body.message).toMatch(/Factura no encontrada/i);
    });

    it('retorna 403 si el usuario no es creador/asignado Y no tiene permiso administrativo', async () => {
      const pool = makePool({
        permisosPorUsuario: { 10: ['facturasbpkm'] },
        facturaSelRow: {
          id_factura_sel: 100,
          creado_por: 99,
          vendedor_id: 50,
          tiene_acceso: false
        }
      });
      const app = buildApp(pool, makeEvidenciasRouter);
      const token = createToken(10);

      const res = await request(app)
        .get('/api/bpkm/facturas/evidencias?id=100')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(403);
      expect(res.body.ok).toBe(false);
      expect(res.body.message).toMatch(/No tiene autorización para ver las evidencias de esta factura/i);
    });

    it('retorna 200 si el usuario no es creador/asignado pero tiene permiso admin (ej: gerenciabpkm)', async () => {
      const pool = makePool({
        permisosPorUsuario: { 20: ['gerenciabpkm'] },
        facturaSelRow: {
          id_factura_sel: 100,
          creado_por: 99,
          vendedor_id: 50,
          tiene_acceso: false
        },
        evidenciasRows: [{ id_evidencia: '30', resultado: 'ENT', fecha: '2026-09-22 10:05:00' }]
      });
      const app = buildApp(pool, makeEvidenciasRouter);
      const token = createToken(20);

      const res = await request(app)
        .get('/api/bpkm/facturas/evidencias?id=100')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.ok).toBe(true);
      expect(res.body.data).toHaveLength(1);
      expect(res.body.data[0].id_evidencia).toBe(30);
    });

    it('retorna 200 con array vacío si la factura no tiene evidencias fotográficas', async () => {
      const pool = makePool({
        permisosPorUsuario: { 10: ['facturasbpkm'] },
        facturaSelRow: {
          id_factura_sel: 100,
          creado_por: 10,
          vendedor_id: 50,
          tiene_acceso: true
        },
        evidenciasRows: []
      });
      const app = buildApp(pool, makeEvidenciasRouter);
      const token = createToken(10);

      const res = await request(app)
        .get('/api/bpkm/facturas/evidencias?id=100')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.ok).toBe(true);
      expect(res.body.data).toEqual([]);
    });

    it('retorna 200 con lista de evidencias cuando el usuario es creador o asignado', async () => {
      const pool = makePool({
        permisosPorUsuario: { 10: ['facturasbpkm'] },
        facturaSelRow: {
          id_factura_sel: 100,
          creado_por: 10,
          vendedor_id: 50,
          tiene_acceso: true
        },
        evidenciasRows: [
          {
            id_evidencia: '30',
            id_entrega_piloto: '15',
            intento: '1',
            resultado: 'ENT',
            fecha: '2026-09-22 10:05:00'
          }
        ]
      });
      const app = buildApp(pool, makeEvidenciasRouter);
      const token = createToken(10);

      const res = await request(app)
        .get('/api/bpkm/facturas/evidencias?id=100')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.ok).toBe(true);
      expect(res.body.data).toEqual([
        {
          id_evidencia: 30,
          id_entrega_piloto: 15,
          intento: 1,
          resultado: 'ENT',
          comentario: null,
          fecha: '2026-09-22 10:05:00'
        }
      ]);
    });
  });

  describe('GET /api/bpkm/evidencias/archivo?id=...', () => {
    it('retorna 401 si no se envía token de autenticación', async () => {
      const pool = makePool();
      const app = buildApp(pool, makeEvidenciasRouter);

      const res = await request(app).get('/api/bpkm/evidencias/archivo?id=30');
      expect(res.status).toBe(401);
    });

    it('retorna 403 si el usuario no tiene ningún permiso de módulo permitido en la ruta', async () => {
      const pool = makePool({ permisosPorUsuario: { 10: ['modulo_ajeno'] } });
      const app = buildApp(pool, makeEvidenciasRouter);
      const token = createToken(10);

      const res = await request(app)
        .get('/api/bpkm/evidencias/archivo?id=30')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(403);
      expect(res.body.ok).toBe(false);
      expect(res.body.message).toMatch(/No tienes permisos para este módulo/i);
    });

    it('retorna 400 si falta el query param id', async () => {
      const pool = makePool();
      const app = buildApp(pool, makeEvidenciasRouter);
      const token = createToken(10);

      const res = await request(app)
        .get('/api/bpkm/evidencias/archivo')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(400);
      expect(res.body.ok).toBe(false);
      expect(res.body.message).toMatch(/Errores de validación/i);
    });

    it('retorna 400 si el query param id no es numérico', async () => {
      const pool = makePool();
      const app = buildApp(pool, makeEvidenciasRouter);
      const token = createToken(10);

      const res = await request(app)
        .get('/api/bpkm/evidencias/archivo?id=uuid-invalido')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(400);
      expect(res.body.ok).toBe(false);
      expect(res.body.message).toMatch(/Errores de validación/i);
    });

    it('retorna 404 si la evidencia no existe en base de datos', async () => {
      const pool = makePool({ evidenciaArchivoRow: null });
      const app = buildApp(pool, makeEvidenciasRouter);
      const token = createToken(10);

      const res = await request(app)
        .get('/api/bpkm/evidencias/archivo?id=999')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(404);
      expect(res.body.message).toMatch(/Evidencia no encontrada/i);
    });

    it('retorna 403 si el usuario no tiene autorización (ni creador/asignado ni permiso admin)', async () => {
      const pool = makePool({
        permisosPorUsuario: { 10: ['facturasbpkm'] },
        evidenciaArchivoRow: {
          id_evidencia: '30',
          ruta_archivo: 'entregafacturas/2026/09/22/foto.png',
          id_factura_sel: '100',
          tiene_acceso: false
        }
      });
      const app = buildApp(pool, makeEvidenciasRouter);
      const token = createToken(10);

      const res = await request(app)
        .get('/api/bpkm/evidencias/archivo?id=30')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(403);
      expect(res.body.message).toMatch(/No tiene autorización/i);
    });

    it('permite acceso si el usuario no es creador/asignado pero tiene permiso admin (ej: adminnotascredito)', async () => {
      const subfolder = path.join(testUploadRoot, 'entregafacturas', '2026', '09', '22');
      fs.mkdirSync(subfolder, { recursive: true });
      const testFilePath = path.join(subfolder, 'foto_admin_test.png');
      fs.writeFileSync(testFilePath, Buffer.from('fake-png-admin-content'));

      const pool = makePool({
        permisosPorUsuario: { 20: ['adminnotascredito'] },
        evidenciaArchivoRow: {
          id_evidencia: '30',
          ruta_archivo: 'entregafacturas/2026/09/22/foto_admin_test.png',
          id_factura_sel: '100',
          tiene_acceso: false
        }
      });
      const app = buildApp(pool, makeEvidenciasRouter);
      const token = createToken(20);

      const res = await request(app)
        .get('/api/bpkm/evidencias/archivo?id=30')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toMatch(/image\/png/);
      expect(res.body.toString()).toBe('fake-png-admin-content');
    });

    it('retorna 404 si la evidencia existe pero el archivo físico no está en disco', async () => {
      const pool = makePool({
        permisosPorUsuario: { 10: ['facturasbpkm'] },
        evidenciaArchivoRow: {
          id_evidencia: '30',
          ruta_archivo: 'entregafacturas/2026/09/22/archivo_inexistente.png',
          id_factura_sel: '100',
          tiene_acceso: true
        }
      });
      const app = buildApp(pool, makeEvidenciasRouter);
      const token = createToken(10);

      const res = await request(app)
        .get('/api/bpkm/evidencias/archivo?id=30')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(404);
      expect(res.body.message).toMatch(/no está disponible en disco/i);
    });

    it('retorna 200 y transmite el archivo cuando existe físicamente', async () => {
      const subfolder = path.join(testUploadRoot, 'entregafacturas', '2026', '09', '22');
      fs.mkdirSync(subfolder, { recursive: true });
      const testFilePath = path.join(subfolder, 'foto_test.png');
      fs.writeFileSync(testFilePath, Buffer.from('fake-png-content'));

      const pool = makePool({
        permisosPorUsuario: { 10: ['facturasbpkm'] },
        evidenciaArchivoRow: {
          id_evidencia: '30',
          ruta_archivo: 'entregafacturas/2026/09/22/foto_test.png',
          id_factura_sel: '100',
          tiene_acceso: true
        }
      });
      const app = buildApp(pool, makeEvidenciasRouter);
      const token = createToken(10);

      const res = await request(app)
        .get('/api/bpkm/evidencias/archivo?id=30')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toMatch(/image\/png/);
      expect(res.body.toString()).toBe('fake-png-content');
    });
  });
});
