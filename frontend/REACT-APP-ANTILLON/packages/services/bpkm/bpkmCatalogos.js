// src/services/bpkm/bpkmCatalogos.js
import axios from 'axios';
const BASE = '/api/bpkm';

const rowsOf = (d) =>
  Array.isArray(d) ? d :
  Array.isArray(d?.rows) ? d.rows :
  Array.isArray(d?.data) ? d.data :
  Array.isArray(d?.result) ? d.result : [];

export async function getPermisosBPKM(p_id_usuario) {
  const { data } = await axios.post(`${BASE}/get_permisos_bpkm`, { p_id_usuario } );
  return rowsOf(data) || data;
}

export async function rolesPersonal() {
  const { data } = await axios.get(`${BASE}/get_roles_personal`);
  return rowsOf(data);
}

export async function personalList(params) {
  const { data } = await axios.post(`${BASE}/get_personal_admin`, params);
  return rowsOf(data);
}
export async function personalCreate(payload) {
  const { data } = await axios.post(`${BASE}/post_personal`, payload);
  return data;
}
export async function personalUpdate(payload) {
  const { data } = await axios.put(`${BASE}/put_personal`, payload);
  return data;
}

export async function camionesList(params) {
  const { data } = await axios.post(`${BASE}/get_camiones_admin`, params);
  return rowsOf(data);
}
export async function camionCreate(payload) {
  const { data } = await axios.post(`${BASE}/post_camion`, payload);
  return data;
}
export async function camionUpdate(payload) {
  const { data } = await axios.put(`${BASE}/put_camion`, payload);
  return data;
}

export async function transportesList(params) {
  const { data } = await axios.post(`${BASE}/get_transportes_admin`, params);
  return rowsOf(data);
}
export async function transporteCreate(payload) {
  const { data } = await axios.post(`${BASE}/post_transporte`, payload);
  return data;
}
export async function transporteUpdate(payload) {
  const { data } = await axios.put(`${BASE}/put_transporte`, payload);
  return data;
}

export async function getFacturasParaRuta({
  creado_por = 0,
  estado_codigo = 'ACT',
  folio_like = '',
  fecha_desde = null,
  fecha_hasta = null,
  limit = 200,
  offset = 0,
  id_sucursal = 0,
  forma_entrega_codigo = null,
  id_transporte_externo = 0,
  id_sucursal_salida = 0
}) {
  const { data } = await axios.post(`${BASE}/get_facturas_para_ruta`, {
    creado_por,
    estado_codigo,
    folio_like,
    fecha_desde,
    fecha_hasta,
    limit,
    offset,
    id_sucursal,
    forma_entrega_codigo,
    id_transporte_externo,
    id_sucursal_salida
  });
  return {
    total: Number(data?.total || 0),
    items: Array.isArray(data?.items) ? data.items : []
  };
}

// Camiones activos
export async function getCamionesActivos(id_sucursal = 0) {
  const { data } = await axios.post(`${BASE}/get_camiones`, { id_sucursal });
  return rowsOf(data);
}

// Personal (pilotos y auxiliares)
export async function getPersonalActivo(id_sucursal = 0) {
  const { data } = await axios.post(`${BASE}/get_personal`, { id_sucursal });
  return rowsOf(data);
}

// Sucursales - CORREGIDO: usar GET
export async function getSucursalesList() {
  const { data } = await axios.get(`${BASE}/get_sucursales_list`);
  return rowsOf(data);
}

// Transportes externos activos
export async function getTransportesActivos() {
  const { data } = await axios.post(`${BASE}/get_transportes`, { estado: 1 });
  return rowsOf(data);
}
