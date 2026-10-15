import axios from 'axios';
import { formatDateTimeGT, toISODateLocal } from '@utils/dateSafe';

const FMT = new Intl.NumberFormat('es-GT', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

let _cacheFormasEntrega = null;
let _cacheCamiones = null;
let _cacheTransportes = null;
let _cacheSucursales = null;
let _cacheCiudades = null;
const _cacheMunicipiosPorDepto = {};

export const fmt2 = (n) => FMT.format(Number(n || 0));

export async function postRuta(payload) {
  const { data } = await axios.post('/api/bpkm/post_ruta', payload);
  return data;
}

export async function putRutaFinalizar({ id_ruta, usuario }) {
  const { data } = await axios.post('/api/bpkm/put_ruta_finalizar', { id_ruta, usuario });
  return data;
}

export async function getRutas(filtros) {
  const { data } = await axios.post('/api/bpkm/get_rutas', filtros || {});
  const payload = data?.data ?? data;
  return payload || { items: [], total: 0, page: 1, limit: 25 };
}

export async function getRutasLocales(params = {}) {
  const { data } = await axios.get('/api/bpkm/rutas-locales', { params });
  return data || {};
}

export async function getRutaLocalDetalle(id_ruta) {
  const { data } = await axios.get(`/api/bpkm/rutas-locales/${id_ruta}`);
  return data || null;
}

export async function getRutaDestinos(id_ruta) {
  const id = typeof id_ruta === 'object' ? id_ruta?.id_ruta : id_ruta;
  const { data } = await axios.get(`/api/bpkm/rutas/${id}/destinos`);
  return Array.isArray(data) ? data : [];
}

export async function getDetallesPorRuta({ id_ruta }) {
  const { data } = await axios.post('/api/bpkm/get_detalles_por_ruta', { id_ruta });
  return data || [];
}

export async function putDetalleResultado(payload) {
  const { data } = await axios.post('/api/bpkm/put_detalle_resultado', payload);
  return data;
}

export async function getFormasEntrega() {
  if (_cacheFormasEntrega) return _cacheFormasEntrega;
  const { data } = await axios.get('/api/bpkm/get_formas_entrega');
  _cacheFormasEntrega = Array.isArray(data) ? data : [];
  return _cacheFormasEntrega;
}

// POST /api/bpkm/get_camiones  { id_camion, placa_like, estado, id_sucursal }
export async function getCamionesActivos(filters = {}) {
  if (_cacheCamiones && !Object.keys(filters).length) return _cacheCamiones;
  const payload = { id_camion: '', placa_like: '', estado: 1, id_sucursal: 0, ...filters };
  const { data } = await axios.post('/api/bpkm/get_camiones', payload);
  const arr = Array.isArray(data) ? data : [];
  if (!Object.keys(filters).length) _cacheCamiones = arr;
  return arr;
}

// POST /api/bpkm/get_transportes  { id_transporte, nombre_like, estado }
export async function getTransportesExternos(filters = {}) {
  if (_cacheTransportes && !Object.keys(filters).length) return _cacheTransportes;
  const payload = { id_transporte: 0, nombre_like: '', estado: 1, ...filters };
  const { data } = await axios.post('/api/bpkm/get_transportes', payload);
  const arr = Array.isArray(data) ? data : [];
  if (!Object.keys(filters).length) _cacheTransportes = arr;
  return arr;
}

// POST /api/bpkm/get_personal { rol, estado, id_sucursal } – filtramos por rolId 14/15
const ROLE_MAP = { PILOTO: 14, AUXILIAR: 15 };

export async function getPersonal({ rol, estado = 1, id_sucursal = 0 } = {}) {
  const rolId = typeof rol === 'number'
    ? rol
    : ROLE_MAP[String(rol || '').toUpperCase()] || null;

  const body = {
    id_personal: 0,
    id_rol: rolId || 0,
    nombre_like: '',
    estado,
    id_sucursal
  };
  const { data } = await axios.post('/api/bpkm/get_personal', body);
  let arr = Array.isArray(data) ? data : [];
  if (rolId) arr = arr.filter(p => Number(p.int_id_rol) === rolId);
  return arr;
}

export async function getSucursalesList() {
  if (_cacheSucursales) return _cacheSucursales;
  const { data } = await axios.get('/api/bpkm/get_sucursales_list');
  _cacheSucursales = Array.isArray(data) ? data : [];
  return _cacheSucursales;
}

export async function getCiudades() {
  if (_cacheCiudades) return _cacheCiudades;
  const { data } = await axios.get('/api/bpkm/get_ciudades');
  _cacheCiudades = Array.isArray(data) ? data : [];
  return _cacheCiudades;
}

export async function getMunicipios({ p_departamento }) {
  if (_cacheMunicipiosPorDepto[p_departamento]) return _cacheMunicipiosPorDepto[p_departamento];
  const { data } = await axios.post('/api/bpkm/get_municipios', { p_departamento });
  _cacheMunicipiosPorDepto[p_departamento] = Array.isArray(data) ? data : [];
  return _cacheMunicipiosPorDepto[p_departamento];
}

export async function findFacturaByFolio({ folio, cardCode }) {
  const payload = {
    folio: String(folio || '').trim(),
    cardCode: String(cardCode || '').trim()
  };
  const { data } = await axios.post('/sap/bpkm/get_factura_by_folio', payload);
  return data;
}

export async function exportRutasToXlsx(rows) {
  const XLSX = (await import('xlsx')).default || (await import('xlsx'));
  const data = (rows || []).map(r => ({
    NumeroRuta: r.codigo_ruta,
    Estado: r.estado_nombre || r.estado_codigo,
    SalidaPlan: formatDateTimeGT(r.fecha_salida_plan) || '',
    EntradaPlan: formatDateTimeGT(r.fecha_entrada_plan) || '',
    Camion: r.camion || r.placa || r.str_placa || '',
    Piloto: r.piloto || '',
    Auxiliar: r.auxiliar || ''
  }));
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.json_to_sheet(data);
  XLSX.utils.book_append_sheet(wb, ws, 'Rutas');
  const fecha = toISODateLocal(new Date());
  XLSX.writeFile(wb, `rutas_${fecha}.xlsx`);
}

export async function postRutaCompleta(payload) {
  const { data } = await axios.post('/api/bpkm/post_ruta_completa', payload);
  return data;
}

// Obtener datos para PDF
export async function getRutaPDF({ id_ruta }) {
  const { data } = await axios.post('/api/bpkm/get_ruta_pdf', { id_ruta });
  return data || {};
}

// Recalcular monto de ruta
export async function putRutaRecalcularMonto({ id_ruta, usuario }) {
  const { data } = await axios.post('/api/bpkm/put_ruta_recalcular_monto', {
    id_ruta,
    usuario
  });
  return data;
}

export async function postLiquidarDetalleRuta({
  id_detalle_ruta,
  estado_codigo,
  motivo_fallo = null,
  observaciones = null,
  puede_reenviar = true,
  fecha_hora_intento = null,
  usuario
}) {
  const { data } = await axios.post('/api/bpkm/post_liquidar_detalle_ruta', {
    id_detalle_ruta,
    estado_codigo,
    motivo_fallo,
    observaciones,
    puede_reenviar,
    fecha_hora_intento,
    usuario
  });
  return data;
}

// Obtener detalles para liquidar (NUEVA FUNCIÓN)
export async function getRutaParaLiquidar({ id_ruta }) {
  const { data } = await axios.post('/api/bpkm/get_ruta_para_liquidar', {
    id_ruta
  });
  return Array.isArray(data) ? data : [];
}

// Actualizar piloto/auxiliar de ruta
export async function putRutaActualizarPersonal({ id_ruta, id_piloto, id_auxiliar, usuario }) {
  const { data } = await axios.post('/api/bpkm/put_ruta_actualizar_personal', {
    id_ruta,
    id_piloto,
    id_auxiliar,
    usuario
  });
  return data;
}

// Guardar productos de entrega parcial
export async function postProductosEntregaParcial({ id_liquidacion, productos, usuario }) {
  const { data } = await axios.post('/api/bpkm/post_productos_entrega_parcial', {
    id_liquidacion,
    productos,
    usuario
  });
  return data;
}

// Obtener productos de una liquidación
export async function getProductosEntregaParcial({ id_liquidacion }) {
  const { data } = await axios.post('/api/bpkm/get_productos_entrega_parcial', {
    id_liquidacion
  });
  return Array.isArray(data) ? data : [];
}

// Obtener permisos BPKM granulares de un usuario
export async function getPermisosBPKM(p_id_usuario) {
  const { data } = await axios.post('/api/bpkm/get_permisos_bpkm', { p_id_usuario });
  return Array.isArray(data) ? data : [];
}

// Agregar comentario a una ruta
export async function postComentarioRuta({ id_ruta, comentario, usuario }) {
  const { data } = await axios.post('/api/bpkm/post_comentario_ruta', {
    id_ruta,
    comentario,
    usuario
  });
  return data;
}

// Obtener comentarios de una ruta
export async function getComentariosRuta({ id_ruta }) {
  const { data } = await axios.post('/api/bpkm/get_comentarios_ruta', {
    id_ruta
  });
  return Array.isArray(data) ? data : [];
}