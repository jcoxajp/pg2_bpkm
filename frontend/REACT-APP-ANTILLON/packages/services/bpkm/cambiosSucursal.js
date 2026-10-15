// src/services/bpkm/cambiosSucursal.js
import axios from 'axios';

export async function getCambiosSucursal({
  estado_codigo = '',
  id_sucursal = 0,
  limit = 50,
  offset = 0
}) {
  const { data } = await axios.post('/api/bpkm/get_cambios_sucursal', {
    estado_codigo,
    id_sucursal,
    limit,
    offset
  });
  return {
    total: Number(data?.total_count || 0),
    items: Array.isArray(data?.items) ? data.items : []
  };
}

export async function postSolicitarCambioSucursal({
  id_factura_sel,
  id_sucursal_destino,
  motivo,
  usuario
}) {
  const { data } = await axios.post('/api/bpkm/post_solicitar_cambio_sucursal', {
    id_factura_sel,
    id_sucursal_destino,
    motivo,
    usuario
  });
  return data;
}

export async function postAprobarCambioSucursal({
  id_cambio,
  observaciones = null,
  usuario
}) {
  const { data } = await axios.post('/api/bpkm/post_aprobar_cambio_sucursal', {
    id_cambio,
    observaciones,
    usuario
  });
  return data;
}

export async function postRechazarCambioSucursal({
  id_cambio,
  observaciones = null,
  usuario
}) {
  const { data } = await axios.post('/api/bpkm/post_rechazar_cambio_sucursal', {
    id_cambio,
    observaciones,
    usuario
  });
  return data;
}
