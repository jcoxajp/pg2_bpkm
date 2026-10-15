// src/services/bpkm/rutas.js
import axios from 'axios';

export async function postCrearRutaCompleta({
  id_sucursal_salida,
  id_sucursal_regreso,
  id_camion,
  id_piloto,
  id_auxiliar = null,
  fecha_salida_plan = null,
  fecha_entrada_plan = null,
  facturas = [],
  usuario
}) {
  const { data } = await axios.post('/api/bpkm/post_ruta_completa', {
    id_sucursal_salida,
    id_sucursal_regreso,
    id_camion,
    id_piloto,
    id_auxiliar,
    fecha_salida_plan,
    fecha_entrada_plan,
    facturas,
    usuario
  });
  return data;
}

export async function postRuta({
  id_sucursal_salida,
  id_sucursal_regreso,
  id_camion,
  id_piloto,
  id_auxiliar = null,
  fecha_salida_plan = null,
  fecha_entrada_plan = null,
  usuario
}) {
  const { data } = await axios.post('/api/bpkm/post_ruta', {
    id_sucursal_salida,
    id_sucursal_regreso,
    id_camion,
    id_piloto,
    id_auxiliar,
    fecha_salida_plan,
    fecha_entrada_plan,
    usuario
  });
  return data;
}

export async function postAgregarFacturaARuta({
  id_ruta,
  id_factura_sel,
  usuario
}) {
  const { data } = await axios.post('/api/bpkm/post_agregar_factura_a_ruta', {
    id_ruta,
    id_factura_sel,
    usuario
  });
  return data;
}

export async function deleteFacturaDeRuta({
  id_detalle_ruta,
  usuario
}) {
  const { data } = await axios.post('/api/bpkm/delete_factura_de_ruta', {
    id_detalle_ruta,
    usuario
  });
  return data;
}

export async function getFacturasDisponibles({
  buscar = '',
  limite = 50,
  offset = 0,
  id_sucursal = 0,
  tipo_ruta = ''
}) {
  const { data } = await axios.post('/api/bpkm/get_facturas_disponibles', {
    buscar,
    limite,
    offset,
    id_sucursal,
    tipo_ruta
  });
  return Array.isArray(data) ? data : [];
}

export async function postLiquidarDetalleRuta({
  id_detalle_ruta,
  estado_codigo,
  motivo_fallo = null,
  observaciones = null,
  fecha_hora_intento = null,
  usuario
}) {
  const { data } = await axios.post('/api/bpkm/post_liquidar_detalle_ruta', {
    id_detalle_ruta,
    estado_codigo,
    motivo_fallo,
    observaciones,
    fecha_hora_intento,
    usuario
  });
  return data;
}

export async function putRutaRecalcularMonto({ id_ruta, usuario }) {
  const { data } = await axios.post('/api/bpkm/put_ruta_recalcular_monto', {
    id_ruta,
    usuario
  });
  return data;
}

export async function putRutaFinalizar({ id_ruta, usuario }) {
  const { data } = await axios.post('/api/bpkm/put_ruta_finalizar', {
    id_ruta,
    usuario
  });
  return data;
}

export async function getRutaPDF({ id_ruta }) {
  const { data } = await axios.post('/api/bpkm/get_ruta_pdf', {
    id_ruta
  });
  return data || {};
}

export async function getRutas({
  estado_codigo = '',
  fecha_desde = null,
  fecha_hasta = null,
  id_suc_salida = 0,
  id_camion = 0,
  id_piloto = 0,
  id_auxiliar = 0,
  creado_por = 0
}) {
  const { data } = await axios.post('/api/bpkm/get_rutas', {
    estado_codigo,
    fecha_desde,
    fecha_hasta,
    id_suc_salida,
    id_camion,
    id_piloto,
    id_auxiliar,
    creado_por
  });
  return Array.isArray(data) ? data : [];
}

export async function getRutaParaLiquidar({ id_ruta }) {
  const { data } = await axios.post('/api/bpkm/get_ruta_para_liquidar', {
    id_ruta
  });
  return Array.isArray(data) ? data : [];
}

export async function getDetallesPorRuta({ id_ruta }) {
  const { data } = await axios.post('/api/bpkm/get_detalles_por_ruta', {
    id_ruta
  });
  return Array.isArray(data) ? data : [];
}