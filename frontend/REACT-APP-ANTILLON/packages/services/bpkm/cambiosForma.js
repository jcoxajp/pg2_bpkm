// src/services/bpkm/cambiosForma.js
import axios from 'axios';

export async function getSolicitudesCambio({
  estado_codigo = 'PEND',
  fecha_desde = null,
  fecha_hasta = null,
  folio_like = '',
  id_usuario = null,
  limit = 50,
  offset = 0
}) {
  const { data } = await axios.post('/api/bpkm/get_solicitudes_cambio', {
    estado_codigo,
    fecha_desde,
    fecha_hasta,
    folio_like,
    id_usuario,
    limit,
    offset
  });
  return {
    total: Number(data?.total || 0),
    items: Array.isArray(data?.items) ? data.items : []
  };
}

export async function resolverCambioForma({
  id_sel_cambio,
  decision_codigo,
  id_autorizador,
  comentario_autorizador = null
}) {
  const { data } = await axios.post('/api/bpkm/put_sel_cambio_resolver', {
    id_sel_cambio,
    decision_codigo,
    id_autorizador,
    comentario_autorizador
  });
  return data;
}

export async function getCambiosPorSeleccion({ id_factura_sel }) {
  const { data } = await axios.post('/api/bpkm/get_cambios_por_seleccion', {
    id_factura_sel
  });
  return Array.isArray(data) ? data : [];
}