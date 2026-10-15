// src/services/bpkm/selecciones.js
import axios from 'axios';

//GET Facturas selección
export async function getMisSelecciones({
  estado_codigo = '',
  fecha_desde = null,
  fecha_hasta = null,
  folio_like = '',
  limit = 50,
  offset = 0
}) {
  const { data } = await axios.get('/api/bpkm/facturas_seleccion', {
    params: {
      estado_codigo,
      fecha_desde,
      fecha_hasta,
      folio_like,
      limit,
      offset
    }
  });
  return {
    total: Number(data?.resumen?.pagination?.total ?? data?.total ?? 0),
    items: Array.isArray(data?.items) ? data.items : [],
    resumen: data?.resumen || {}
  };
}

//Endpoint POST anterior
/*
export async function getMisSeleccionesOld({
  id_vendedor = null,
  forma_codigo = null,
  creado_por = null,
  fecha_desde = null,
  fecha_hasta = null,
  folio_like = '',
  estado_codigo = '',
  limit = 50,
  offset = 0
}) {
  const { data } = await axios.post('/api/bpkm/get_mis_facturas_seleccion', {
    id_vendedor,
    forma_codigo,
    folio_like,
    estado_codigo,
    fecha_desde,
    fecha_hasta,
    creado_por,
    limit,
    offset
  });
  return {
    total: Number(data?.total || 0),
    items: Array.isArray(data?.items) ? data.items : []
  };
}
*/

export async function postCrearSeleccion({
  id_factura,
  folio,
  forma,
  transporte_externo,
  departamento,
  municipio,
  direccion,
  id_sucursal,
  creado_por
}) {
  const { data } = await axios.post('/api/bpkm/post_factura_seleccion', {
    id_factura, folio, forma,
    transporte_externo,
    departamento, municipio, direccion,
    id_sucursal,
    creado_por
  });
  return data;
}

export async function postAnularSeleccion({
  id_factura_sel,
  folio_nc,
  usuario,
  fecha_anulacion = null,
  comentario = null
}) {
  const { data } = await axios.post('/api/bpkm/post_factura_seleccion_anular', {
    id_factura_sel,
    folio_nc,
    usuario,
    fecha_anulacion: fecha_anulacion || null,
    comentario: comentario || null
  });
  return data;
}

export async function postSolicitarCambio({
  id_factura_sel,
  id_solicitante,
  id_forma_nueva,
  id_transporte_externo_new = null,
  id_departamento_new = null,
  id_municipio_new = null,
  direccion_new = null,
  comentario_solicitante = null
}) {
  const { data } = await axios.post('/api/bpkm/post_sel_cambio', {
    id_factura_sel,
    id_solicitante,
    id_forma_nueva,
    id_transporte_externo_new,
    id_departamento_new,
    id_municipio_new,
    direccion_new,
    comentario_solicitante
  });
  return data;
}

export async function postReciclarFacturaFallida({
  id_factura_sel,
  usuario
}) {
  const { data } = await axios.post('/api/bpkm/post_reciclar_factura_fallida', {
    id_factura_sel,
    usuario
  });
  return data;
}

export async function getSelResumenPorFactura({ id_factura = null, folio = null }) {
  const { data } = await axios.post('/api/bpkm/get_sel_resumen_por_factura', {
    id_factura, folio
  });
  return data || {};
}

export async function getBitacoraSel({ id_factura_sel, scope = 'ADMIN', usuario = 0 }) {
  const { data } = await axios.post('/api/bpkm/get_bitacora_sel', {
    id_factura_sel,
    scope,
    usuario
  });
  return Array.isArray(data) ? data : [];
}

/**
 * Obtiene el estado de entrega de una factura por su folio
 * @param {string} folio_factura - Folio de la factura
 * @returns {Promise<{id_factura_sel: number, estado: string, forma_entrega: string} | null>}
 */
export async function getEstadoEntregaByFolio(folio_factura) {
  try {
    const { data } = await axios.post('/api/bpkm/get_estado_entrega_by_folio', {
      folio_factura
    });
    return data || null;
  } catch (error) {
    console.error('Error al obtener estado de entrega:', error);
    return null;
  }
}

export async function validateNcInSap({ folio_nc }) {
  const { data } = await axios.post('/sap/ndc/by-folio', { folio: String(folio_nc || '').trim() });
  if (!data?.ok) return { ok: false };
  const fecha = data?.header?.FechaDocumento || null;
  return { ok: true, fecha_doc: fecha, raw: data };
}

export async function postLiquidarSelDespachoSucursal({
  id_factura_sel,
  usuario,
  comentario = null
}) {
  const { data } = await axios.post('/api/bpkm/post_liquidar_sel_despacho_sucursal', {
    id_factura_sel,
    usuario,
    comentario: comentario || null
  });
  return data;
}

/**
 * Consulta la lista de evidencias fotográficas de una factura de selección.
 * @param {number} idFacturaSel - ID de la factura de selección (id_factura_sel)
 * @returns {Promise<Array<{ id_evidencia: number, resultado: string, fecha: string }>>}
 */
export async function getEvidenciasFactura(idFacturaSel) {
  if (!idFacturaSel) return [];
  const { data } = await axios.get('/api/bpkm/facturas/evidencias', {
    params: { id: idFacturaSel }
  });
  return Array.isArray(data?.data) ? data.data : [];
}

/**
 * Retorna la URL para acceder al archivo binario de una evidencia.
 * @param {number} idEvidencia - ID de la evidencia (id_evidencia)
 * @returns {string} URL del recurso de la imagen
 */
export function getEvidenciaArchivoUrl(idEvidencia) {
  return `/api/bpkm/evidencias/archivo?id=${idEvidencia}`;
}
