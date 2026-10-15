import { describe, it, expect } from 'vitest';
import express from 'express';
import request from 'supertest';
import { apiLimiter } from '../../../../src/middleware/bpkm/bpkmRateLimit';

describe('middleware/bpkm/bpkmRateLimit', () => {
  it('permite 500 solicitudes cada 15 minutos', async () => {
    const app = express();
    app.get('/a', apiLimiter, (_req, res) => res.json({ ok: true }));

    const res = await request(app).get('/a');

    expect(res.headers['x-ratelimit-limit']).toBe('500');
  });

  it('es un solo contador compartido entre todas las rutas que lo usan', async () => {
    const app = express();
    app.get('/rutas', apiLimiter, (_req, res) => res.json({ ok: true }));
    app.get('/catalogos', apiLimiter, (_req, res) => res.json({ ok: true }));

    const primera = await request(app).get('/rutas');
    const segunda = await request(app).get('/catalogos');

    const restantesPrimera = Number(primera.headers['x-ratelimit-remaining']);
    const restantesSegunda = Number(segunda.headers['x-ratelimit-remaining']);
    expect(restantesSegunda).toBe(restantesPrimera - 1);
  });
});
