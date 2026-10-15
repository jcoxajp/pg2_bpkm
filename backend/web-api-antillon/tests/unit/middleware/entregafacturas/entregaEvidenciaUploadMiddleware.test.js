import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import { createRequire } from 'module';
import os from 'os';
import path from 'path';
import fs from 'fs';
import express from 'express';
import request from 'supertest';

// El middleware exige UPLOAD_ROOT al cargarse: carpeta temporal, nunca la real.
process.env.UPLOAD_ROOT = path.join(os.tmpdir(), 'wa-tests-entrega-middleware');

const require = createRequire(import.meta.url);
const {
  uploadEvidencia,
  UPLOAD_ROOT,
  MAX_MB,
  MAX_FOTOS,
} = require('../../../../src/middleware/entregafacturas/entregaEvidenciaUploadMiddleware');

const CARPETA_MODULO = path.join(UPLOAD_ROOT, 'entregafacturas');

const JPEG = Buffer.concat([Buffer.from([0xFF, 0xD8, 0xFF, 0xE0]), Buffer.alloc(64)]);
const PNG = Buffer.concat([Buffer.from('89504e470d0a1a0a', 'hex'), Buffer.alloc(64)]);
const WEBP = Buffer.concat([Buffer.from('RIFF'), Buffer.alloc(4), Buffer.from('WEBP'), Buffer.alloc(64)]);
// Firma HEIC válida con contenido basura: pasa la validación y falla al convertir.
const HEIC_CORRUPTO = Buffer.concat([
  Buffer.from([0x00, 0x00, 0x00, 0x18]), Buffer.from('ftypheic'), Buffer.alloc(64, 0x41),
]);
const NO_IMAGEN = Buffer.from('esto no es una imagen, solo texto con extensión .jpg');

function archivosEnDisco() {
  if (!fs.existsSync(CARPETA_MODULO)) return [];
  return fs.readdirSync(CARPETA_MODULO, { recursive: true })
    .map((rel) => path.join(CARPETA_MODULO, rel))
    .filter((abs) => fs.statSync(abs).isFile());
}

const app = express();
app.post('/subir', uploadEvidencia, (req, res) => {
  res.json({ ok: true, archivos: req.files.map((f) => ({ path: f.path, mimetype: f.mimetype })) });
});

function subir(fotos, campo = 'foto') {
  let req = request(app).post('/subir').field('factura', 'x');
  for (const [buffer, nombre] of fotos) req = req.attach(campo, buffer, nombre);
  return req;
}

beforeEach(() => {
  if (!CARPETA_MODULO.startsWith(os.tmpdir())) throw new Error(`UPLOAD_ROOT inesperado en tests: ${UPLOAD_ROOT}`);
  fs.rmSync(CARPETA_MODULO, { recursive: true, force: true });
});

afterAll(() => {
  fs.rmSync(CARPETA_MODULO, { recursive: true, force: true });
});

describe('uploadEvidencia — cantidad de fotos', () => {
  it('MAX_FOTOS es 3', () => {
    expect(MAX_FOTOS).toBe(3);
  });

  it('sin fotos, 400', async () => {
    const res = await subir([]);
    expect(res.status).toBe(400);
    expect(res.body.message).toBe('Se requiere al menos una foto');
  });

  it('1 foto, pasa al siguiente middleware y queda en disco', async () => {
    const res = await subir([[JPEG, 'a.jpg']]);
    expect(res.status).toBe(200);
    expect(res.body.archivos).toHaveLength(1);
    expect(archivosEnDisco()).toHaveLength(1);
  });

  it('3 fotos (jpeg/png/webp), pasan en el orden de subida', async () => {
    const res = await subir([[JPEG, 'a.jpg'], [PNG, 'b.png'], [WEBP, 'c.webp']]);
    expect(res.status).toBe(200);
    expect(res.body.archivos.map((a) => path.extname(a.path))).toEqual(['.jpg', '.png', '.webp']);
    expect(archivosEnDisco()).toHaveLength(3);
  });

  it('4 fotos, 400 y no queda ningún archivo en disco', async () => {
    const res = await subir([[JPEG, 'a.jpg'], [JPEG, 'b.jpg'], [JPEG, 'c.jpg'], [JPEG, 'd.jpg']]);
    expect(res.status).toBe(400);
    expect(res.body.message).toBe('Máximo 3 fotos por entrega.');
    expect(archivosEnDisco()).toHaveLength(0);
  });

  it('archivo en un campo que no es "foto", 400 con mensaje propio (no el de "máximo 3")', async () => {
    const res = await subir([[JPEG, 'a.jpg']], 'imagen');
    expect(res.status).toBe(400);
    expect(res.body.message).toBe('Campo de archivo no permitido: las fotos van en el campo "foto".');
    expect(archivosEnDisco()).toHaveLength(0);
  });
});

describe('uploadEvidencia — tamaño y formato', () => {
  it(`foto de más de MAX_UPLOAD_MB (${MAX_MB} MB), 413 y no queda nada en disco`, async () => {
    const grande = Buffer.concat([JPEG, Buffer.alloc(MAX_MB * 1024 * 1024)]);
    const res = await subir([[JPEG, 'a.jpg'], [grande, 'b.jpg']]);
    expect(res.status).toBe(413);
    expect(res.body.message).toBe(`Cada foto puede pesar máximo ${MAX_MB} MB.`);
    expect(archivosEnDisco()).toHaveLength(0);
  });

  it('extensión/mimetype no permitidos, 400 y no queda nada en disco', async () => {
    const res = await request(app).post('/subir')
      .attach('foto', JPEG, 'a.jpg')
      .attach('foto', Buffer.from('%PDF-1.4'), { filename: 'b.pdf', contentType: 'application/pdf' });
    expect(res.status).toBe(400);
    expect(res.body.message).toBe('Formato inválido. Solo JPG/PNG/WEBP/HEIC');
    expect(archivosEnDisco()).toHaveLength(0);
  });

  it('una foto con contenido que no es imagen entre fotos válidas, 400 y se borran TODAS', async () => {
    const res = await subir([[JPEG, 'a.jpg'], [NO_IMAGEN, 'b.jpg'], [PNG, 'c.png']]);
    expect(res.status).toBe(400);
    expect(res.body.message).toBe('El contenido de un archivo no corresponde a una imagen válida');
    expect(archivosEnDisco()).toHaveLength(0);
  });

  it('valida todas las firmas antes de convertir: inválida + HEIC corrupto responde 400, no 500', async () => {
    const res = await subir([[HEIC_CORRUPTO, 'a.heic'], [NO_IMAGEN, 'b.jpg']]);
    expect(res.status).toBe(400);
    expect(archivosEnDisco()).toHaveLength(0);
  });

  it('falla la conversión HEIC, 500 y se borran TODAS (incluida la válida)', async () => {
    const res = await subir([[JPEG, 'a.jpg'], [HEIC_CORRUPTO, 'b.heic']]);
    expect(res.status).toBe(500);
    expect(res.body.message).toBe('Error al procesar los archivos');
    expect(archivosEnDisco()).toHaveLength(0);
  });
});
