require('../helpers/loadEnv');
import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import fs from 'fs';
import path from 'path';
import app from '../../../src/app';
import pool from '../../../src/config/database';
import { mintAccessToken } from '../helpers/mintToken';

// Usuarios genéricos reusables entre módulos (ver .env.example) — este archivo otorga/revoca
// el permiso 'entregafacturas' y el vínculo a piloto sobre TEST_ID_USUARIO_1 en su propio
// setup/teardown, dejándolo como estaba al terminar. TEST_ID_USUARIO_2 nunca se toca.

function usuario1() {
  const id = Number(process.env.TEST_ID_USUARIO_1);
  const username = process.env.TEST_USERNAME_1;
  if (!id || !username) {
    throw new Error('TEST_ID_USUARIO_1 / TEST_USERNAME_1 no están definidos en tu .env (no versionado).');
  }
  return { id, username };
}

function usuario2() {
  const id = Number(process.env.TEST_ID_USUARIO_2);
  const username = process.env.TEST_USERNAME_2;
  if (!id || !username) {
    throw new Error('TEST_ID_USUARIO_2 / TEST_USERNAME_2 no están definidos en tu .env (no versionado).');
  }
  return { id, username };
}

// Carpeta del día de UPLOAD_ROOT: un POST rechazado no debe dejar archivos.
function archivosCarpetaDelDia() {
  const hoy = new Date();
  const carpeta = path.join(
    path.normalize(process.env.UPLOAD_ROOT || ''),
    'entregafacturas',
    String(hoy.getFullYear()),
    String(hoy.getMonth() + 1).padStart(2, '0'),
    String(hoy.getDate()).padStart(2, '0')
  );
  return fs.existsSync(carpeta) ? fs.readdirSync(carpeta).sort() : [];
}

const JPEG = Buffer.from([0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x10, 0x4A, 0x46, 0x49, 0x46]);
const PNG = Buffer.concat([Buffer.from('89504e470d0a1a0a', 'hex'), Buffer.alloc(8)]);

function idAplicacionWeb() {
  const id = Number(process.env.APP_WEB_ID);
  if (!id) throw new Error('APP_WEB_ID no está definido en tu .env');
  return id;
}

// beforeAll/afterAll NUNCA lanzan por fixture faltante — si TEST_ID_USUARIO_1 no está en el
// .env, el setup se salta en silencio y cada test que sí lo necesita falla individualmente
// (con su propio mensaje claro), igual que ya hace el resto de este repo. Así el test de 401,
// que no depende de ningún fixture, corre siempre.
let idPermisoEntregas = null;
let idPersonalOriginal;
let setupAplicado = false;

beforeAll(async () => {
  const idUsuario1 = Number(process.env.TEST_ID_USUARIO_1) || null;
  if (!idUsuario1) return;

  const { rows: permisoRows } = await pool.query(
    `SELECT id_permiso FROM usuarios.tbl_permisos WHERE codigo = 'entregafacturas' LIMIT 1`
  );
  if (!permisoRows[0]) throw new Error('No existe el permiso "entregafacturas" en usuarios.tbl_permisos');
  idPermisoEntregas = permisoRows[0].id_permiso;

  const { rows: personalRows } = await pool.query(
    `SELECT id_personal FROM bpkm.tbl_personal WHERE estado = 1 LIMIT 1`
  );
  if (!personalRows[0]) throw new Error('No hay ningún bpkm.tbl_personal activo para usar como fixture de lectura');
  const idPersonal = personalRows[0].id_personal;

  const { rows: usuarioRows } = await pool.query(
    `SELECT id_personal FROM usuarios.tbl_usuarios WHERE id_usuario = $1`,
    [idUsuario1]
  );
  idPersonalOriginal = usuarioRows[0]?.id_personal ?? null;

  await pool.query(`UPDATE usuarios.tbl_usuarios SET id_personal = $1 WHERE id_usuario = $2`, [idPersonal, idUsuario1]);

  await pool.query(
    `DELETE FROM usuarios.tbl_asignaciones_usuario_permiso WHERE id_usuario = $1 AND id_permiso = $2`,
    [idUsuario1, idPermisoEntregas]
  );
  await pool.query(
    `INSERT INTO usuarios.tbl_asignaciones_usuario_permiso (id_usuario, id_permiso, estado, creado_por, actualizado_por)
     VALUES ($1, $2, 1, $1, $1)`,
    [idUsuario1, idPermisoEntregas]
  );
  setupAplicado = true;
});

afterAll(async () => {
  if (setupAplicado) {
    const idUsuario1 = Number(process.env.TEST_ID_USUARIO_1);
    await pool.query(`UPDATE usuarios.tbl_usuarios SET id_personal = $1 WHERE id_usuario = $2`, [idPersonalOriginal, idUsuario1]);
    await pool.query(
      `DELETE FROM usuarios.tbl_asignaciones_usuario_permiso WHERE id_usuario = $1 AND id_permiso = $2`,
      [idUsuario1, idPermisoEntregas]
    );
  }
  await pool.end();
});

describe('[integración] entregafacturas contra la BD real (no mockeado)', () => {
  it('GET /api/v1/entregafacturas sin token, 401', async () => {
    const res = await request(app).get('/api/v1/entregafacturas');
    expect(res.status).toBe(401);
  });

  it('GET /api/v1/entregafacturas con usuario sin permiso, 403', async () => {
    const { id, username } = usuario2();
    const token = mintAccessToken(id, username, idAplicacionWeb());

    const res = await request(app).get('/api/v1/entregafacturas').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(403);
  });

  it('GET /api/v1/entregafacturas con piloto (permiso + id_personal), no debería dar 401/403', async () => {
    const { id, username } = usuario1();
    const token = mintAccessToken(id, username, idAplicacionWeb());

    const res = await request(app).get('/api/v1/entregafacturas').set('Authorization', `Bearer ${token}`);
    expect(res.status).not.toBe(401);
    expect(res.status).not.toBe(403);
    expect(Array.isArray(res.body.rutas)).toBe(true);
    expect(res.headers['ratelimit-policy']).toBe('60;w=300');
  });

  it('GET /api/v1/entregafacturas/:uuid con uuid que no existe, 404', async () => {
    const { id, username } = usuario1();
    const token = mintAccessToken(id, username, idAplicacionWeb());

    const res = await request(app)
      .get('/api/v1/entregafacturas/00000000-0000-0000-0000-000000000000')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(404);
    expect(res.headers['ratelimit-policy']).toBe('60;w=300');
  });

  it('GET /api/v1/entregafacturas/:uuid/archivo con uuid que no existe, 404', async () => {
    const { id, username } = usuario1();
    const token = mintAccessToken(id, username, idAplicacionWeb());

    const res = await request(app)
      .get('/api/v1/entregafacturas/00000000-0000-0000-0000-000000000000/archivo')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(404);
    expect(res.headers['ratelimit-policy']).toBe('300;w=300');
  });

  it('POST /api/v1/entregafacturas sin archivo, 400', async () => {
    const { id, username } = usuario1();
    const token = mintAccessToken(id, username, idAplicacionWeb());

    const res = await request(app)
      .post('/api/v1/entregafacturas')
      .set('Authorization', `Bearer ${token}`)
      .field('factura', '00000000-0000-0000-0000-000000000000')
      .field('resultado', 'ENT')
      .field('latitud', '14.6')
      .field('longitud', '-90.5');
    expect(res.status).toBe(400);
    expect(res.body.message).toBe('Se requiere al menos una foto');
    expect(res.headers['ratelimit-policy']).toBe('60;w=900');
  });

  it('POST /api/v1/entregafacturas con archivo válido pero factura que no le pertenece, 404', async () => {
    const { id, username } = usuario1();
    const token = mintAccessToken(id, username, idAplicacionWeb());

    const res = await request(app)
      .post('/api/v1/entregafacturas')
      .set('Authorization', `Bearer ${token}`)
      .field('factura', '00000000-0000-0000-0000-000000000000')
      .field('resultado', 'ENT')
      .field('latitud', '14.6')
      .field('longitud', '-90.5')
      .attach('foto', JPEG, 'test.jpg');

    expect(res.status).toBe(404);
  });

  it('POST /api/v1/entregafacturas con 3 fotos y factura que no le pertenece, 404 sin dejar archivos en disco', async () => {
    const { id, username } = usuario1();
    const token = mintAccessToken(id, username, idAplicacionWeb());
    const antes = archivosCarpetaDelDia();

    const res = await request(app)
      .post('/api/v1/entregafacturas')
      .set('Authorization', `Bearer ${token}`)
      .field('factura', '00000000-0000-0000-0000-000000000000')
      .field('resultado', 'ENT')
      .field('latitud', '14.6')
      .field('longitud', '-90.5')
      .attach('foto', JPEG, 'a.jpg')
      .attach('foto', PNG, 'b.png')
      .attach('foto', JPEG, 'c.jpg');

    expect(res.status).toBe(404);
    await vi.waitFor(() => expect(archivosCarpetaDelDia()).toEqual(antes));
  });

  it('POST /api/v1/entregafacturas con 4 fotos, 400 sin dejar archivos en disco', async () => {
    const { id, username } = usuario1();
    const token = mintAccessToken(id, username, idAplicacionWeb());
    const antes = archivosCarpetaDelDia();

    const res = await request(app)
      .post('/api/v1/entregafacturas')
      .set('Authorization', `Bearer ${token}`)
      .field('factura', '00000000-0000-0000-0000-000000000000')
      .field('resultado', 'ENT')
      .field('latitud', '14.6')
      .field('longitud', '-90.5')
      .attach('foto', JPEG, 'a.jpg')
      .attach('foto', JPEG, 'b.jpg')
      .attach('foto', JPEG, 'c.jpg')
      .attach('foto', JPEG, 'd.jpg');

    expect(res.status).toBe(400);
    expect(res.body.message).toBe('Máximo 3 fotos por entrega.');
    expect(archivosCarpetaDelDia()).toEqual(antes);
  });
});
