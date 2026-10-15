const axios        = require('axios');
const ClienteTe    = require('../../../models/bpkm/te/ClienteTe');
const ContactoTe   = require('../../../models/bpkm/te/ContactoTe');
const DireccionTe  = require('../../../models/bpkm/te/DireccionTe');
const { successResponse, errorResponse } = require('../../../../../../packages/shared-utils');
const { getUserSucursales } = require('../../../middleware/bpkm/tePermMiddleware');
const { parsePagination }   = require('../../flota/includeUtils');

function getUserId(req) {
  return req.user?.id_usuario || req.user?.id || null;
}

function sapUrl() {
  return process.env.SAP_API_URL || 'http://localhost:5532';
}

async function buscarEnSap(cardCode) {
  const { data } = await axios.get(`${sapUrl()}/sap/te/clientes`, {
    params:  { card_code: cardCode },
    timeout: 10000,
  });
  return data;
}

function handleError(res, err, method) {
  if (err.code === '23505') return errorResponse(res, 'Ya existe un registro con esos datos', 409);
  if (err.code === '23503') return errorResponse(res, 'Referencia no válida', 400);
  console.error(`[clienteTeController.${method}]`, err);
  return errorResponse(res, 'Error interno del servidor', 500);
}

// ── Clientes ─────────────────────────────────────────────────────────────────

async function buscarClienteSap(req, res) {
  try {
    const cardCode = req.query.card_code?.trim();
    if (!cardCode) return errorResponse(res, 'card_code requerido', 400);
    if (cardCode.toUpperCase().startsWith('CT')) {
      return errorResponse(res, 'Los clientes de tipo CT (cliente contado) no pueden registrarse como cliente TE', 400);
    }
    const sapCliente = await buscarEnSap(cardCode);
    return successResponse(res, sapCliente);
  } catch (axiosErr) {
    if (axiosErr.response?.status === 404) return errorResponse(res, 'Cliente no encontrado en SAP', 404);
    console.error('[clienteTeController.buscarClienteSap]', axiosErr.message);
    return errorResponse(res, 'No se pudo consultar SAP', 502);
  }
}

async function listar(req, res) {
  try {
    const pool       = req.app.locals.pool;
    const userId     = getUserId(req);
    const idSucursal = parseInt(req.query.id_sucursal, 10);
    if (!idSucursal || idSucursal <= 0) return errorResponse(res, 'id_sucursal requerido', 400);

    const sucursales = await getUserSucursales(userId, pool);
    if (!sucursales.includes(idSucursal)) return errorResponse(res, 'Sin acceso a esta sucursal', 403);

    const pagination = parsePagination(req.query.page, req.query.limit, { defaultLimit: 25, maxLimit: 200 });
    if (pagination.error) return errorResponse(res, pagination.error, 400);

    const result = await ClienteTe.findAll(
      { q: req.query.q, idSucursal, page: pagination.page, limit: pagination.limit },
      pool
    );
    return successResponse(res, result.items, 'Operación exitosa', 200, { pagination: result.pagination });
  } catch (err) {
    return handleError(res, err, 'listar');
  }
}

async function obtener(req, res) {
  return successResponse(res, req.teCliente);
}

async function crear(req, res) {
  try {
    const pool       = req.app.locals.pool;
    const userId     = getUserId(req);
    const { card_code, id_sucursal, observaciones } = req.body || {};

    if (!card_code?.trim()) return errorResponse(res, 'card_code requerido', 400);
    const cardCode = card_code.trim();
    if (cardCode.toUpperCase().startsWith('CT')) {
      return errorResponse(res, 'Los clientes de tipo CT (cliente contado) no pueden registrarse como cliente TE', 400);
    }

    const idSucursal = parseInt(id_sucursal, 10);
    if (!idSucursal || idSucursal <= 0) return errorResponse(res, 'id_sucursal requerido', 400);

    const sucursales = await getUserSucursales(userId, pool);
    if (!sucursales.includes(idSucursal)) return errorResponse(res, 'Sin acceso a esta sucursal', 403);

    let sapCliente;
    try {
      sapCliente = await buscarEnSap(cardCode);
    } catch (axiosErr) {
      if (axiosErr.response?.status === 404) {
        return errorResponse(res, 'El código SAP no existe en el catálogo de clientes', 404);
      }
      console.error('[clienteTeController.crear] Error SAP:', axiosErr.message);
      return errorResponse(res, 'No se pudo verificar el código en SAP', 502);
    }

    const cliente = await ClienteTe.create(
      {
        cardCode,
        cardName:     sapCliente.cardName,
        nit:          sapCliente.nit,
        idSucursal,
        observaciones,
        creadoPor:    userId,
      },
      pool
    );
    return successResponse(res, cliente, 'Cliente TE registrado', 201);
  } catch (err) {
    return handleError(res, err, 'crear');
  }
}

async function actualizar(req, res) {
  try {
    const pool   = req.app.locals.pool;
    const userId = getUserId(req);
    const { observaciones } = req.body || {};

    const cliente = await ClienteTe.update(
      req.teCliente.idTeCliente,
      { observaciones, actualizadoPor: userId },
      pool
    );
    if (!cliente) return errorResponse(res, 'Cliente TE no encontrado', 404);
    return successResponse(res, cliente, 'Cliente TE actualizado');
  } catch (err) {
    return handleError(res, err, 'actualizar');
  }
}

// ── Contactos ─────────────────────────────────────────────────────────────────

async function listarContactos(req, res) {
  try {
    const pool             = req.app.locals.pool;
    const incluirInactivos = req.query.incluir_inactivos === 'true';
    const contactos        = await ContactoTe.findAll(req.teCliente.idTeCliente, incluirInactivos, pool);
    return successResponse(res, contactos);
  } catch (err) {
    return handleError(res, err, 'listarContactos');
  }
}

async function crearContacto(req, res) {
  try {
    const pool   = req.app.locals.pool;
    const userId = getUserId(req);
    const { nombre, telefono, es_default } = req.body || {};

    if (!nombre?.trim()) return errorResponse(res, 'nombre requerido', 400);

    const telefonoTrimmed = telefono?.trim() || null;
    if (telefonoTrimmed) {
      const soloNumero = /^\d{8}$/.test(telefonoTrimmed);
      const conExt     = /^\d{8}\s+ext\.?\s*\d+$/i.test(telefonoTrimmed);
      const tieneExt   = /ext/i.test(telefonoTrimmed);

      if (!soloNumero && !conExt) {
        const msg = tieneExt
          ? 'Extensión inválida. Debe ser numérica (ej. 12345678 ext 123)'
          : 'Teléfono inválido. Debe tener 8 dígitos, opcionalmente con extensión (ej. 12345678 ext 123)';
        return errorResponse(res, msg, 400);
      }
    }
    if (telefonoTrimmed) {
      const duplicate = await ContactoTe.phoneExists(req.teCliente.idTeCliente, telefonoTrimmed, pool);
      if (duplicate) return errorResponse(res, 'Ya existe un contacto activo con este número de teléfono para este cliente', 409);
    }

    const contacto = await ContactoTe.create(
      {
        idTeCliente: req.teCliente.idTeCliente,
        nombre:      nombre.trim(),
        telefono:    telefonoTrimmed,
        esDefault:   Boolean(es_default),
        creadoPor:   userId,
      },
      pool
    );
    return successResponse(res, contacto, 'Contacto registrado', 201);
  } catch (err) {
    return handleError(res, err, 'crearContacto');
  }
}

async function desactivarContacto(req, res) {
  try {
    const pool       = req.app.locals.pool;
    const userId     = getUserId(req);
    const idContacto = parseInt(req.params.id_contacto, 10);
    if (!idContacto || idContacto <= 0) return errorResponse(res, 'id_contacto inválido', 400);

    const pertenece = await ContactoTe.belongsToCliente(idContacto, req.teCliente.idTeCliente, pool);
    if (!pertenece) return errorResponse(res, 'Contacto no encontrado', 404);

    const ok = await ContactoTe.deactivate(idContacto, userId, pool);
    if (!ok) return errorResponse(res, 'El contacto ya está desactivado', 409);
    return successResponse(res, { idTeContacto: idContacto }, 'Contacto desactivado');
  } catch (err) {
    return handleError(res, err, 'desactivarContacto');
  }
}

async function setDefaultContacto(req, res) {
  try {
    const pool       = req.app.locals.pool;
    const userId     = getUserId(req);
    const idContacto = parseInt(req.params.id_contacto, 10);
    if (!idContacto || idContacto <= 0) return errorResponse(res, 'id_contacto inválido', 400);

    const pertenece = await ContactoTe.belongsToCliente(idContacto, req.teCliente.idTeCliente, pool);
    if (!pertenece) return errorResponse(res, 'Contacto no encontrado', 404);

    const contacto = await ContactoTe.setDefault(req.teCliente.idTeCliente, idContacto, userId, pool);
    if (!contacto) return errorResponse(res, 'Contacto no encontrado o inactivo', 404);
    return successResponse(res, contacto, 'Contacto predeterminado actualizado');
  } catch (err) {
    return handleError(res, err, 'setDefaultContacto');
  }
}

// ── Direcciones ──────────────────────────────────────────────────────────────

async function listarDirecciones(req, res) {
  try {
    const pool             = req.app.locals.pool;
    const incluirInactivos = req.query.incluir_inactivos === 'true';
    const direcciones      = await DireccionTe.findAll(req.teCliente.idTeCliente, incluirInactivos, pool);
    return successResponse(res, direcciones);
  } catch (err) {
    return handleError(res, err, 'listarDirecciones');
  }
}

async function crearDireccion(req, res) {
  try {
    const pool   = req.app.locals.pool;
    const userId = getUserId(req);
    const {
      alias,
      id_municipio,
      direccion,
      instrucciones_entrega,
      id_transporte_externo,
      es_default,
    } = req.body || {};

    if (!alias?.trim())     return errorResponse(res, 'alias requerido', 400);
    if (!direccion?.trim()) return errorResponse(res, 'direccion requerida', 400);

    const aliasDuplicate = await DireccionTe.aliasExists(req.teCliente.idTeCliente, alias.trim(), pool);
    if (aliasDuplicate) return errorResponse(res, 'Ya existe una dirección activa con ese alias para este cliente', 409);

    const dir = await DireccionTe.create(
      {
        idTeCliente:         req.teCliente.idTeCliente,
        alias:               alias.trim(),
        idMunicipio:         id_municipio ? parseInt(id_municipio, 10) : null,
        direccion:           direccion.trim(),
        instrucciones:       instrucciones_entrega?.trim() || null,
        idTransporteExterno: id_transporte_externo ? parseInt(id_transporte_externo, 10) : null,
        esDefault:           Boolean(es_default),
        creadoPor:           userId,
      },
      pool
    );
    return successResponse(res, dir, 'Dirección registrada', 201);
  } catch (err) {
    return handleError(res, err, 'crearDireccion');
  }
}

async function desactivarDireccion(req, res) {
  try {
    const pool        = req.app.locals.pool;
    const userId      = getUserId(req);
    const idDireccion = parseInt(req.params.id_direccion, 10);
    if (!idDireccion || idDireccion <= 0) return errorResponse(res, 'id_direccion inválido', 400);

    const pertenece = await DireccionTe.belongsToCliente(idDireccion, req.teCliente.idTeCliente, pool);
    if (!pertenece) return errorResponse(res, 'Dirección no encontrada', 404);

    const ok = await DireccionTe.deactivate(idDireccion, userId, pool);
    if (!ok) return errorResponse(res, 'La dirección ya está desactivada', 409);
    return successResponse(res, { idTeDireccion: idDireccion }, 'Dirección desactivada');
  } catch (err) {
    return handleError(res, err, 'desactivarDireccion');
  }
}

async function setDefaultDireccion(req, res) {
  try {
    const pool        = req.app.locals.pool;
    const userId      = getUserId(req);
    const idDireccion = parseInt(req.params.id_direccion, 10);
    if (!idDireccion || idDireccion <= 0) return errorResponse(res, 'id_direccion inválido', 400);

    const pertenece = await DireccionTe.belongsToCliente(idDireccion, req.teCliente.idTeCliente, pool);
    if (!pertenece) return errorResponse(res, 'Dirección no encontrada', 404);

    const dir = await DireccionTe.setDefault(req.teCliente.idTeCliente, idDireccion, userId, pool);
    if (!dir) return errorResponse(res, 'Dirección no encontrada o inactiva', 404);
    return successResponse(res, dir, 'Dirección predeterminada actualizada');
  } catch (err) {
    return handleError(res, err, 'setDefaultDireccion');
  }
}

module.exports = {
  buscarClienteSap,
  listar,
  obtener,
  crear,
  actualizar,
  listarContactos,
  crearContacto,
  desactivarContacto,
  setDefaultContacto,
  listarDirecciones,
  crearDireccion,
  desactivarDireccion,
  setDefaultDireccion,
};
