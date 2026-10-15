// src/services/bpkm/bpkmRrhh.js
import axios from 'axios';
import { formatDateTimeGT, toISODateLocal } from '@utils/dateSafe';
import * as XLSX from 'xlsx';

const BASE = '/api/bpkm';

// Nombres de estado desde el punto de vista de RRHH - la base de datos los nombra desde el de Gerencia
// ("Aprobado Gerencia"), que a RRHH le confunde. Se traduce por código solo en esta pantalla.
const ESTADO_RRHH = { APR: 'Pendiente', FIN_RRHH: 'Finalizado' };

export function nombreEstadoRrhh(codigo, nombreOriginal = '') {
  return ESTADO_RRHH[codigo] ?? nombreOriginal;
}

/**
 * Obtiene lista de BPKMs para RRHH con filtros, paginada del lado del servidor.
 * @param {Object} params
 * @param {String} params.estado_codigo - '', 'APR', 'FIN_RRHH'
 * @param {Date} params.fecha_desde
 * @param {Date} params.fecha_hasta
 * @param {Number} params.page
 * @param {Number} params.limit
 * @returns {Object} { items, total, page, limit, resumen: { por_estado: { PEND, APR } } }
 */
export async function getBPKMsParaRRHH({
  estado_codigo = 'APR',
  fecha_desde = null,
  fecha_hasta = null,
  page = 1,
  limit = 50
}) {
  const { data } = await axios.post(`${BASE}/get_bpkm`, {
    estado_codigo,
    estado_excluido: estado_codigo ? null : 'PEND',
    fecha_desde,
    fecha_hasta,
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
 * Igual que getBPKMsParaRRHH pero sin límite de página - para el botón "Exportar",
 * que necesita todas las filas bajo los filtros activos, no solo la página visible.
 * @returns {Array} Lista completa de BPKMs bajo los filtros
 */
export async function getBPKMsParaRRHHExport({
  estado_codigo = 'APR',
  fecha_desde = null,
  fecha_hasta = null
}) {
  const { data } = await axios.post(`${BASE}/get_bpkm`, {
    estado_codigo,
    estado_excluido: estado_codigo ? null : 'PEND',
    fecha_desde,
    fecha_hasta,
    exportar: true
  });
  const payload = data?.data ?? data;
  return Array.isArray(payload?.items) ? payload.items : [];
}

/**
 * Obtiene detalle completo de un BPKM
 * @param {Object} params
 * @param {Number} params.id_bpkm - ID del BPKM
 * @returns {Object} Detalle del BPKM
 */
export async function getBPKMDetalleRRHH({ id_bpkm }) {
  const { data } = await axios.post(`${BASE}/get_bpkm_detalle`, { id_bpkm });
  return data || {};
}

/**
 * Finaliza un BPKM (RRHH confirma pago)
 * @param {Object} params
 * @param {Number} params.id_bpkm - ID del BPKM a finalizar
 * @param {Number} params.usuario_rrhh - ID del usuario RRHH
 * @returns {Object} Resultado de la finalización
 */
export async function postFinalizarBPKMRrhh({ id_bpkm, usuario_rrhh }) {
  const { data } = await axios.post(`${BASE}/post_finalizar_bpkm_rrhh`, {
    id_bpkm,
    usuario_rrhh
  });
  return data;
}

/**
 * Obtiene detalles completos de facturas de una ruta
 * (Incluye dirección completa, total de factura, estado, comentarios, etc.)
 * @param {Object} params
 * @param {Number} params.id_ruta - ID de la ruta
 * @returns {Array} Lista detallada de facturas con toda la información
 */
export async function getDetallesPorRutaRrhh({ id_ruta }) {
  const { data } = await axios.post(`${BASE}/get_detalles_por_ruta_gerencia`, { id_ruta });
  return Array.isArray(data) ? data : [];
}

/**
 * Obtiene la bitácora/historial de un BPKM
 * @param {Object} params
 * @param {Number} params.id_bpkm - ID del BPKM
 * @returns {Array} Lista de eventos del historial
 */
export async function getBitacoraBPKMRrhh({ id_bpkm }) {
  const { data } = await axios.post(`${BASE}/get_bitacora_bpkm`, { id_bpkm });
  return Array.isArray(data) ? data : [];
}

/**
 * Obtiene registros de monitoreo de una ruta
 * @param {Object} params
 * @param {Number} params.id_ruta - ID de la ruta
 * @returns {Array} Lista de registros de monitoreo (tipo S=Salida, E=Entrada)
 */
export async function getMonitoreoPorRutaRrhh({ id_ruta }) {
  const { data } = await axios.post(`${BASE}/get_monitoreo_por_ruta`, { id_ruta });
  return Array.isArray(data) ? data : [];
}

/**
 * Exporta BPKMs a archivo Excel
 * @param {Array} rows - Array de BPKMs a exportar
 */
export function exportBPKMsToXlsx(rows) {
  const data = (rows || []).map(r => ({
    CodigoRuta: r.codigo_ruta || '',
    Estado: nombreEstadoRrhh(r.estado_codigo, r.estado_nombre) || '',
    Piloto: r.nombre_piloto || '',
    Auxiliar: r.nombre_auxiliar || '',
    Camion: r.placa_camion || '',
    Departamento: r.departamento || '',
    MunicipioLejano: r.municipio_lejano || '',
    DistanciaKmMasLejana: Number(r.distancia_mas_lejana || 0).toFixed(2),
    MontoAprobadoPiloto: Number(r.monto_aprobado_piloto || 0).toFixed(2),
    MontoAprobadoAuxiliar: Number(r.monto_aprobado_auxiliar || 0).toFixed(2),
    FechaCreacion: formatDateTimeGT(r.fecha_creacion) || '',
    FechaAprobacion: formatDateTimeGT(r.fecha_aprobacion) || '',
    FechaFinalizacion: formatDateTimeGT(r.fecha_rrhh) || ''
  }));

  const ws = XLSX.utils.json_to_sheet(data);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'BPKM');

  const fecha = toISODateLocal(new Date());
  XLSX.writeFile(wb, `bpkm_rrhh_${fecha}.xlsx`);
}
