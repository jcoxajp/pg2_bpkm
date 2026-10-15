import { vi } from 'vitest';
import express from 'express';
import jwt from 'jsonwebtoken';

export function createToken(id_usuario) {
  return jwt.sign({ id_usuario }, process.env.JWT_SECRET, { algorithm: 'HS256' });
}

// Simula usuarios.tbl_modulos/tbl_permisos y bpkm.get_permisos_bpkm sin Postgres real; cualquier otra consulta devuelve un stub genérico de una fila.
export function makeMockPool({ permisosPorUsuario = {}, bpkmPermsPorUsuario = {} } = {}) {
  return {
    query: vi.fn((sql, params = []) => {
      if (sql.includes('tbl_modulos')) {
        const [codigoModulo, idUsuario] = params;
        const tiene = (permisosPorUsuario[idUsuario] || []).includes(codigoModulo);
        return Promise.resolve({ rows: [{ total: tiene ? '1' : '0' }] });
      }
      if (sql.includes('bpkm.get_permisos_bpkm')) {
        const [idUsuario] = params;
        return Promise.resolve({ rows: bpkmPermsPorUsuario[idUsuario] || [] });
      }
      return Promise.resolve({ rows: [{ ok: true }] });
    }),
  };
}

export function buildApp(pool, routerFactory) {
  const app = express();
  app.use(express.json());
  app.locals.pool = pool;
  app.use('/api/bpkm', routerFactory({ pool }));
  return app;
}
