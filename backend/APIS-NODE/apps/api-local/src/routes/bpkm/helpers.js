// routes/bpkm/v1/helpers.js

// Actor real de la solicitud: siempre del JWT (req.user), nunca del body.
const getUserId = (req) => req.user?.id_usuario || req.user?.id || null;

function makeHelpers({ pool }) {
  const q = (sql, params) => pool.query(sql, params).then(r => r.rows);

  const isEmptyish = (v) =>
    v === undefined ||
    v === null ||
    (typeof v === 'string' && v.trim() === '') ||
    (typeof v === 'string' && ['null', 'undefined'].includes(v.trim().toLowerCase()));

  const toStrOrNull = (v) => (isEmptyish(v) ? null : String(v).trim());

  const toInt = (v) => {
    if (isEmptyish(v)) return null;
    const n = parseInt(v, 10);
    return Number.isInteger(n) ? n : null;
  };

  const toDateOrNull = (v) => (isEmptyish(v) ? null : String(v).trim());

  // Convención de paginación del proyecto (AGENTS.md raíz): limit acotado 10-100, page >= 1.
  const clampLimit = (limit, def = 25) => {
    const n = parseInt(limit, 10);
    if (!Number.isFinite(n)) return def;
    return Math.min(100, Math.max(10, n));
  };
  const clampPage = (page) => {
    const n = parseInt(page, 10);
    return Number.isFinite(n) && n > 0 ? n : 1;
  };

  const toJsonArray = (v) => {
    if (Array.isArray(v)) return v;
    if (typeof v === 'string') {
      try { const arr = JSON.parse(v); return Array.isArray(arr) ? arr : []; } catch { return []; }
    }
    if (v && typeof v === 'object') return [v];
    return [];
  };

  const ok = (res, data) => res.json(data ?? []);
  const bad = (res, msg, code = 400) => res.status(code).json({ error: msg });

  const RANK_BPKM_PERM = { viewer: 1, editor: 2, admin: 3 };
  const checkBPKMPerm = async (userId, permKey, minLevel = 'viewer') => {
    const perms = await q(`SELECT * FROM bpkm.get_permisos_bpkm($1)`, [toInt(userId)]);
    const perm = perms.find(p => p.key === permKey);
    if (!perm) return false;
    return (RANK_BPKM_PERM[perm.nivel_permiso] || 0) >= (RANK_BPKM_PERM[minLevel] || 1);
  };

  return {
    q, isEmptyish, toStrOrNull, toInt, toDateOrNull, toJsonArray, ok, bad, checkBPKMPerm,
    clampLimit, clampPage
  };
}

module.exports = makeHelpers;
module.exports.getUserId = getUserId;
