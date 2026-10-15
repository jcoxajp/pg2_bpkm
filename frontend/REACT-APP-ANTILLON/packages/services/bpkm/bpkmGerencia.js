// src/services/bpkm/bpkmGerencia.js
import axios from 'axios';

const BASE = '/api/bpkm';

/**
 * Obtiene lista de BPKMs con filtros, paginada del lado del servidor.
 * @param {Object} params
 * @param {String} params.estado_codigo - '', 'PEND', 'APR', 'FIN_RRHH'
 * @param {Date} params.fecha_desde
 * @param {Date} params.fecha_hasta
 * @param {Number} params.page
 * @param {Number} params.limit
 * @returns {Object} { items, total, page, limit, resumen: { por_estado: { PEND, APR } } }
 */
export async function getBPKMs({
  estado_codigo = '',
  fecha_desde = null,
  fecha_hasta = null,
  id_sucursal = 0,
  id_camion = 0,
  folio_factura = '',
  page = 1,
  limit = 25
}) {
  const { data } = await axios.post(`${BASE}/get_bpkm`, {
    estado_codigo,
    fecha_desde,
    fecha_hasta,
    id_sucursal,
    id_camion,
    folio_factura,
    page,
    limit
  });
  const payload = data?.data ?? data;
  return {
    items: Array.isArray(payload?.items) ? payload.items : [],
    total: payload?.total ?? 0,
    page: payload?.page ?? page,
    limit: payload?.limit ?? limit,
    resumen: payload?.resumen ?? { por_estado: { PEND: 0, APR: 0 } }
  };
}

/**
 * Obtiene lista de BPKMs para módulo Distancia de Rutas
 * GET /api/bpkm/get_bpkm
 * @param {Object} params - { estado_distancia, codigo_ruta, fecha_desde, fecha_hasta, id_sucursal, id_camion, page, limit }
 * @returns {Object} { items, total }
 */
export async function getBpkmDistancias(params = {}) {
  const { data } = await axios.get(`${BASE}/distancia`, { params });
  const payload = data?.data ?? data;

  if (Array.isArray(payload)) {
    return { items: payload, total: payload.length, total_pendientes: 0 };
  }
  if (payload && Array.isArray(payload.items)) {
    return {
      items: payload.items,
      total: payload.pagination?.total ?? payload.items.length,
      total_pendientes: payload.pagination?.total_pendientes ?? payload.total_pendientes ?? 0
    };
  }
  return { items: [], total: 0, total_pendientes: 0 };
}

/**
 * Obtiene catálogo de camiones para el filtro, con la sucursal de SALIDA de sus rutas
 * (un camión viene repetido una vez por cada sucursal desde la que salió).
 * GET /api/bpkm/camiones
 * @returns {Array} Lista de { id_camion, placa, id_sucursal, sucursal }
 */
export async function getCamionesGerencia() {
  const { data } = await axios.get(`${BASE}/camiones`);
  const payload = data?.data ?? data;
  return Array.isArray(payload) ? payload : [];
}

/**
 * Obtiene catálogo de sucursales
 * GET /api/bpkm/sucursales
 * @returns {Array} Lista de sucursales
 */
export async function getSucursalesGerencia() {
  const { data } = await axios.get(`${BASE}/sucursales`);
  return Array.isArray(data) ? data : [];
}

/**
 * Obtiene detalle completo de un BPKM
 * @param {Object} params
 * @param {Number} params.id_bpkm - ID del BPKM
 * @returns {Object} Detalle del BPKM
 */
export async function getBPKMDetalle({ id_bpkm }) {
  const { data } = await axios.post(`${BASE}/get_bpkm_detalle`, { id_bpkm });
  return data || {};
}

/**
 * Aprueba un BPKM con montos editables
 * @param {Object} params
 * @param {Number} params.id_bpkm
 * @param {Number} params.monto_aprobado_piloto
 * @param {Number} params.monto_aprobado_auxiliar
 * @param {String} params.observaciones
 * @param {Number} params.usuario_gerencia
 * @returns {Object} Resultado de la aprobación
 */
export async function postAprobarBPKMGerencia({
  id_bpkm,
  monto_aprobado_piloto,
  monto_aprobado_auxiliar,
  observaciones,
  usuario_gerencia
}) {
  const { data } = await axios.post(`${BASE}/post_aprobar_bpkm_gerencia`, {
    id_bpkm,
    monto_aprobado_piloto,
    monto_aprobado_auxiliar,
    observaciones,
    usuario_gerencia
  });
  return data;
}

/**
 * Actualiza la distancia más lejana del BPKM
 * @param {Object} params
 * @param {Number} params.id_bpkm
 * @param {Number} params.distancia
 * @param {Number} params.usuario_gerencia
 * @returns {Object} Resultado de la actualización
 */
export async function patchDistanciaLejanaBPKM({
  id_bpkm,
  distancia,
  usuario_gerencia,
  usuario
}) {
  const userVal = usuario_gerencia !== undefined ? usuario_gerencia : usuario;
  const { data } = await axios.patch(`${BASE}/distancia`, {
    id_bpkm: Number(id_bpkm),
    distancia: Number(distancia),
    usuario: Number(userVal)
  });
  return data;
}

/**
 * Actualiza la distancia del BPKM
 * PATCH /api/bpkm/distancia
 * @param {Object} params
 * @param {Number} params.id_bpkm
 * @param {Number} params.distancia
 * @param {Number} params.usuario
 * @returns {Object} Resultado de la actualización
 */
export async function patchDistanciaBPKM({
  id_bpkm,
  distancia,
  usuario
}) {
  const { data } = await axios.patch(`${BASE}/distancia`, {
    id_bpkm: Number(id_bpkm),
    distancia: Number(distancia),
    usuario: Number(usuario)
  });
  return data;
}

/**
 * Obtiene maestro y detalle de una factura desde SAP
 * @param {Object} params
 * @param {Number} params.p_id_factura - ID de factura (opcional)
 * @param {String} params.p_folio - Folio de factura (opcional)
 * @returns {Object} { ok, header, lines }
 */
export async function getFacturaMD({ p_id_factura = null, p_folio = null }) {
  const { data } = await axios.post(`${BASE}/get_factura_md`, {
    p_id_factura,
    p_folio
  });
  return data || null;
}

/**
 * Obtiene registros de monitoreo de una ruta
 * @param {Object} params
 * @param {Number} params.id_ruta - ID de la ruta
 * @returns {Array} Lista de registros de monitoreo (tipo S=Salida, E=Entrada)
 */
export async function getMonitoreoPorRuta({ id_ruta }) {
  const { data } = await axios.post(`${BASE}/get_monitoreo_por_ruta`, { id_ruta });
  return Array.isArray(data) ? data : [];
}

/**
 * Obtiene la bitácora/historial de un BPKM
 * @param {Object} params
 * @param {Number} params.id_bpkm - ID del BPKM
 * @returns {Array} Lista de eventos del historial
 */
export async function getBitacoraBPKM({ id_bpkm }) {
  const { data } = await axios.post(`${BASE}/get_bitacora_bpkm`, { id_bpkm });
  return Array.isArray(data) ? data : [];
}

/**
 * Obtiene detalles completos de facturas de una ruta para Gerencia
 * (Incluye dirección completa, total de factura, estado, comentarios, etc.)
 * @param {Object} params
 * @param {Number} params.id_ruta - ID de la ruta
 * @returns {Array} Lista detallada de facturas con toda la información
 */
export async function getDetallesPorRutaGerencia({ id_ruta }) {
  const { data } = await axios.post(`${BASE}/get_detalles_por_ruta_gerencia`, { id_ruta });
  return Array.isArray(data) ? data : [];
}
