import { apiFetch } from './apiClient.js';

/**
 * Obtiene la lista de rutas de entrega de facturas
 * Endpoint: GET /api/v1/entregafacturas
 * @returns {Promise<{ ok: boolean, rutas?: Array, message?: string }>}
 */
export async function obtenerRutasEntregaFacturas() {
  const res = await apiFetch('/api/v1/entregafacturas');
  return res.json();
}

/**
 * Obtiene el detalle de una ruta con sus facturas asociadas
 * Endpoint: GET /api/v1/entregafacturas/{uuid}
 * @param {string} uuid - UUID de la ruta
 * @returns {Promise<{ ok: boolean, ruta?: object, message?: string }>}
 */
export async function obtenerDetalleRutaEntrega(uuid) {
  const res = await apiFetch(`/api/v1/entregafacturas/${uuid}`);
  return res.json();
}

/**
 * Registra el resultado y la foto/geolocalización de una factura específica
 * Endpoint: POST /api/v1/entregafacturas
 * Body: FormData con factura, resultado, motivo, latitud, longitud, precision_metros, foto
 * @param {object} payload
 * @returns {Promise<{ ok: boolean, message?: string }>}
 */
export async function registrarEntregaFactura({
  factura,
  resultado,
  motivo,
  latitud,
  longitud,
  precision_metros,
  foto,
  fotos,
}) {
  const formData = new FormData();
  formData.append('factura', factura);
  formData.append('resultado', resultado);
  if (motivo !== undefined && motivo !== null && String(motivo).trim() !== '') {
    formData.append('motivo', String(motivo).trim());
  }
  if (latitud !== undefined && latitud !== null && latitud !== '' && latitud !== 0) {
    formData.append('latitud', String(latitud));
  }
  if (longitud !== undefined && longitud !== null && longitud !== '' && longitud !== 0) {
    formData.append('longitud', String(longitud));
  }
  if (precision_metros !== undefined && precision_metros !== null && precision_metros !== '' && precision_metros !== 0) {
    formData.append('precision_metros', String(precision_metros));
  }
  const listaFotos = Array.isArray(fotos) && fotos.length > 0 ? fotos : (foto ? [foto] : []);
  listaFotos.forEach((f) => {
    if (f instanceof File || f instanceof Blob) {
      formData.append('foto', f);
    }
  });

  const res = await apiFetch('/api/v1/entregafacturas', {
    method: 'POST',
    body: formData,
  });
  return res.json();
}

/**
 * Obtiene el archivo / foto comprobante de una evidencia
 * Endpoint: GET /api/v1/entregafacturas/{evidencia_uuid}/archivo
 * @param {string} evidenciaUuid - UUID de la evidencia
 * @returns {Promise<string|null>} URL de objeto blob
 */
export async function obtenerArchivoFactura(evidenciaUuid) {
  const res = await apiFetch(`/api/v1/entregafacturas/${evidenciaUuid}/archivo`);
  if (res.ok) {
    const blob = await res.blob();
    return URL.createObjectURL(blob);
  }
  return null;
}
