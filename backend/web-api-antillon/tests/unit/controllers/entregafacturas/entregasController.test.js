import { describe, it, expect, vi, beforeEach, afterEach, afterAll } from 'vitest';
import { createRequire } from 'module';
import os from 'os';
import path from 'path';
import fs from 'fs';

// El middleware de subida (lo importa el controller) exige UPLOAD_ROOT al cargarse: carpeta temporal.
process.env.UPLOAD_ROOT = path.join(os.tmpdir(), 'wa-tests-entregas-controller');

const require = createRequire(import.meta.url);
const EntregasController = require('../../../../src/controllers/entregafacturas/entregasController');
const Entrega = require('../../../../src/models/entregafacturas/Entrega');
const GoogleRouteService = require('../../../../src/services/entregafacturas/GoogleRouteService');
const { UPLOAD_ROOT } = require('../../../../src/middleware/entregafacturas/entregaEvidenciaUploadMiddleware');

const CARPETA = path.join(UPLOAD_ROOT, 'entregafacturas', 'test-controller');
const FACTURA = '550e8400-e29b-41d4-a716-446655440000';

function createMockRes() {
  const res = {};
  res.statusCode = 200;
  res.status = vi.fn().mockImplementation((code) => {
    res.statusCode = code;
    return res;
  });
  res.json = vi.fn().mockImplementation((payload) => {
    res.body = payload;
    return res;
  });
  return res;
}

function crearArchivos(n) {
  fs.mkdirSync(CARPETA, { recursive: true });
  return Array.from({ length: n }, (_, i) => {
    const filePath = path.join(CARPETA, `foto_${i + 1}_${Date.now()}.jpg`);
    fs.writeFileSync(filePath, 'x');
    return { path: filePath };
  });
}

function reqCon(files, body = {}) {
  return {
    files,
    body: { factura: FACTURA, resultado: 'ENT', latitud: '14.6349', longitud: '-90.5069', ...body },
    user: { idUsuario: 7, idPersonal: 3 },
  };
}

// El controller borra sin esperar.
async function esperarBorrados(files) {
  await vi.waitFor(() => {
    for (const f of files) expect(fs.existsSync(f.path)).toBe(false);
  });
}

beforeEach(() => {
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
});

afterAll(() => {
  fs.rmSync(CARPETA, { recursive: true, force: true });
});

describe('EntregasController.crear — con 1..3 fotos', () => {
  it('201 con { uuid, evidencias } y pasa al Model las rutas relativas en el orden de subida', async () => {
    const files = crearArchivos(3);
    const spyCrear = vi.spyOn(Entrega, 'crear').mockResolvedValueOnce({
      error: false, entregaUuid: 'ent-1', evidenciaUuids: ['ev-1', 'ev-2', 'ev-3'], idRuta: 55,
    });
    const spyDisparo = vi.spyOn(GoogleRouteService, 'dispararSiListo').mockResolvedValueOnce(undefined);
    const res = createMockRes();

    await EntregasController.crear(reqCon(files, { precision_metros: '12.5' }), res);

    expect(res.statusCode).toBe(201);
    expect(res.body).toEqual({ ok: true, uuid: 'ent-1', evidencias: ['ev-1', 'ev-2', 'ev-3'] });

    const [datos, idUsuario, idPersonal] = spyCrear.mock.calls[0];
    expect(datos).toMatchObject({
      facturaUuid: FACTURA,
      resultado: 'ENT',
      latitud: 14.6349,
      longitud: -90.5069,
      precisionMetros: 12.5,
      rutasArchivo: files.map((f) => path.relative(UPLOAD_ROOT, f.path).replace(/\\/g, '/')),
    });
    expect(idUsuario).toBe(7);
    expect(idPersonal).toBe(3);
    expect(spyDisparo).toHaveBeenCalledWith(55);
    for (const f of files) expect(fs.existsSync(f.path)).toBe(true);
  });

  it('validación fallida (resultado inválido), 400 y borra todas las fotos', async () => {
    const files = crearArchivos(3);
    const spyCrear = vi.spyOn(Entrega, 'crear');
    const res = createMockRes();

    await EntregasController.crear(reqCon(files, { resultado: 'XX' }), res);

    expect(res.statusCode).toBe(400);
    expect(spyCrear).not.toHaveBeenCalled();
    await esperarBorrados(files);
  });

  it('factura que no es uuid, 400 y borra todas las fotos', async () => {
    const files = crearArchivos(2);
    const res = createMockRes();

    await EntregasController.crear(reqCon(files, { factura: 'no-es-uuid' }), res);

    expect(res.statusCode).toBe(400);
    await esperarBorrados(files);
  });

  it.each([
    [404, 'Factura no disponible para registrar entrega'],
    [409, 'Ya se registró una entrega para esta factura'],
  ])('el Model rechaza con %i, se propaga y borra todas las fotos', async (status, message) => {
    const files = crearArchivos(3);
    vi.spyOn(Entrega, 'crear').mockResolvedValueOnce({ error: true, status, message });
    const spyDisparo = vi.spyOn(GoogleRouteService, 'dispararSiListo');
    const res = createMockRes();

    await EntregasController.crear(reqCon(files), res);

    expect(res.statusCode).toBe(status);
    expect(res.body.message).toBe(message);
    expect(spyDisparo).not.toHaveBeenCalled();
    await esperarBorrados(files);
  });

  it('carrera con el UNIQUE (23505), 409 y borra todas las fotos', async () => {
    const files = crearArchivos(3);
    vi.spyOn(Entrega, 'crear').mockRejectedValueOnce(Object.assign(new Error('duplicate'), { code: '23505' }));
    const res = createMockRes();

    await EntregasController.crear(reqCon(files), res);

    expect(res.statusCode).toBe(409);
    await esperarBorrados(files);
  });

  it('error inesperado del Model, 500 y borra todas las fotos', async () => {
    const files = crearArchivos(2);
    vi.spyOn(Entrega, 'crear').mockRejectedValueOnce(new Error('se cayó la BD'));
    const res = createMockRes();

    await EntregasController.crear(reqCon(files), res);

    expect(res.statusCode).toBe(500);
    await esperarBorrados(files);
  });
});
