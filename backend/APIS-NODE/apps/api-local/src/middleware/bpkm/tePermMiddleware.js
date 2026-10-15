const ClienteTe = require('../../models/bpkm/te/ClienteTe');

const RANK = { viewer: 1, editor: 2, admin: 3 };

// Retorna las sucursales activas asignadas al usuario
async function getUserSucursales(userId, pool) {
  const { rows } = await pool.query(
    `SELECT id_sucursal
     FROM usuarios.tbl_asignaciones_usuario_rol_sucursal
     WHERE id_usuario = $1 AND estado = 1`,
    [userId]
  );
  return rows.map(r => r.id_sucursal);
}

// Retorna los permisos bpkm activos del usuario
async function getUserPerms(userId, pool) {
  const { rows } = await pool.query(
    'SELECT key, nivel_permiso FROM bpkm.get_permisos_bpkm($1)',
    [userId]
  );
  return rows;
}

function hasKey(perms, key, minLevel = 'viewer') {
  const perm = perms.find(p => p.key === key);
  return perm && (RANK[perm.nivel_permiso] || 0) >= (RANK[minLevel] || 1);
}

// ── Middleware de permisos ────────────────────────────────────────────────────

// Requiere bpkm.te.clientes.view (viewer) O bpkm.te.clientes.edit (editor)
function requireTeViewPerm(req, res, next) {
  const pool   = req.app.locals.pool;
  const userId = req.user?.id_usuario || req.user?.id;
  if (!userId) return res.status(401).json({ ok: false, message: 'Usuario no autenticado' });

  getUserPerms(userId, pool)
    .then(perms => {
      const canView = hasKey(perms, 'bpkm.te.clientes.view', 'viewer')
                   || hasKey(perms, 'bpkm.te.clientes.edit', 'editor');
      if (!canView) return res.status(403).json({ ok: false, message: 'Sin permiso para ver clientes TE' });
      next();
    })
    .catch(err => {
      console.error('[tePermMiddleware.requireTeViewPerm]', err);
      res.status(500).json({ ok: false, message: 'Error al verificar permisos' });
    });
}

// Requiere bpkm.te.clientes.edit (editor)
function requireTeEditPerm(req, res, next) {
  const pool   = req.app.locals.pool;
  const userId = req.user?.id_usuario || req.user?.id;
  if (!userId) return res.status(401).json({ ok: false, message: 'Usuario no autenticado' });

  getUserPerms(userId, pool)
    .then(perms => {
      if (!hasKey(perms, 'bpkm.te.clientes.edit', 'editor')) {
        return res.status(403).json({ ok: false, message: 'Sin permiso para modificar clientes TE' });
      }
      next();
    })
    .catch(err => {
      console.error('[tePermMiddleware.requireTeEditPerm]', err);
      res.status(500).json({ ok: false, message: 'Error al verificar permisos' });
    });
}

// ── Middleware de sucursal ────────────────────────────────────────────────────

// Carga el cliente por :id, valida que su sucursal sea accesible al usuario,
// y adjunta req.teCliente para que el controller no vuelva a consultar.
function loadAndValidateTeCliente(req, res, next) {
  const pool   = req.app.locals.pool;
  const userId = req.user?.id_usuario || req.user?.id;
  const id     = parseInt(req.params.id, 10);

  Promise.all([
    ClienteTe.findById(id, pool),
    getUserSucursales(userId, pool),
  ])
    .then(([cliente, sucursales]) => {
      if (!cliente) {
        return res.status(404).json({ ok: false, message: 'Cliente TE no encontrado' });
      }
      if (!sucursales.includes(cliente.idSucursal)) {
        return res.status(403).json({ ok: false, message: 'Sin acceso a este cliente TE' });
      }
      req.teCliente = cliente;
      next();
    })
    .catch(err => {
      console.error('[tePermMiddleware.loadAndValidateTeCliente]', err);
      res.status(500).json({ ok: false, message: 'Error interno del servidor' });
    });
}

module.exports = {
  requireTeViewPerm,
  requireTeEditPerm,
  loadAndValidateTeCliente,
  getUserSucursales,
};
