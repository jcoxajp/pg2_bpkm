const rateLimit = require('express-rate-limit');

// Un solo contador por IP compartido por todos los routers de BPKM; el detalle está en el AGENTS.md del módulo.
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 500,
  message: { ok: false, message: 'Demasiadas solicitudes, intenta más tarde' },
});

module.exports = { apiLimiter };
