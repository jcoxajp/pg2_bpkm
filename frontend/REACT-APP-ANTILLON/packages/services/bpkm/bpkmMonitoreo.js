import axios from 'axios';

/**
 * Registra un evento de monitoreo (Salida o Entrada) de una ruta.
 * PATCH /api/bpkm/monitoreo/:id_ruta
 * @param {Object} payload
 * @param {number} payload.id_ruta - ID de la ruta (va en la URL, no en el body)
 * @param {string} payload.tipo - Tipo: 'S' (Salida) o 'E' (Entrada)
 * @param {Date|string} payload.fecha_hora - Fecha y hora del evento
 * @param {string} [payload.comentario] - Comentario opcional
 * @returns {Promise<Object>} Resultado del registro
 */
export async function patchMonitoreoBpkm({ id_ruta, ...resto }) {
  const { data } = await axios.patch(`/api/bpkm/monitoreo/${id_ruta}`, resto);
  return data;
}

/**
 * Obtiene los eventos de monitoreo de una ruta específica
 * @param {number} id_ruta - ID de la ruta
 * @returns {Promise<Array>} Array de eventos de monitoreo
 */
export async function getMonitoreoPorRuta(id_ruta) {
  const { data } = await axios.post('/api/bpkm/get_monitoreo_por_ruta', { id_ruta });
  return Array.isArray(data) ? data : [];
}

// Agrega monitoreo_salida/monitoreo_entrada (forma que ya espera MonitoreoRegistro.jsx) a una fila
// cruda del backend, sin importar si viene de "items" o de "destacadas" - ambos bloques traen las
// mismas columnas salida_fecha_hora/salida_comentario/entrada_fecha_hora/entrada_comentario.
function conMonitoreoEmbebido(ruta) {
  return {
    ...ruta,
    monitoreo_salida: ruta.salida_fecha_hora ? {
      tipo: 'S',
      fecha_hora: ruta.salida_fecha_hora,
      comentario: ruta.salida_comentario
    } : null,
    monitoreo_entrada: ruta.entrada_fecha_hora ? {
      tipo: 'E',
      fecha_hora: ruta.entrada_fecha_hora,
      comentario: ruta.entrada_comentario
    } : null
  };
}

/**
 * Bandeja de Monitoreo, paginada del lado del servidor.
 * GET /api/bpkm/monitoreo
 * @param {Object} filtros - Filtros + page/limit
 * @returns {Promise<Object>} { items, total, page, limit, resumen: {sin_salida, sin_entrada},
 *   destacadas: {proximas_salir, que_regresaron} }
 */
export async function getRutasConMonitoreo(filtros = {}) {
  const { data } = await axios.get('/api/bpkm/monitoreo', { params: filtros });
  const payload = data?.data ?? data ?? {};

  const items = Array.isArray(payload.items) ? payload.items.map(conMonitoreoEmbebido) : [];
  const proximasSalir = Array.isArray(payload?.destacadas?.proximas_salir)
    ? payload.destacadas.proximas_salir.map(conMonitoreoEmbebido)
    : [];
  const queRegresaron = Array.isArray(payload?.destacadas?.que_regresaron)
    ? payload.destacadas.que_regresaron.map(conMonitoreoEmbebido)
    : [];

  return {
    items,
    total: Number(payload.total ?? items.length ?? 0),
    page: Number(payload.page ?? filtros.page ?? 1),
    limit: Number(payload.limit ?? filtros.limit ?? 25),
    resumen: {
      sin_salida: Number(payload?.resumen?.sin_salida ?? 0),
      sin_entrada: Number(payload?.resumen?.sin_entrada ?? 0)
    },
    destacadas: {
      proximas_salir: proximasSalir,
      que_regresaron: queRegresaron
    }
  };
}

/**
 * Valida que se pueda registrar una entrada
 * @param {number} id_ruta - ID de la ruta
 * @returns {Promise<Object>} { valido: boolean, mensaje: string }
 */
export async function validarRegistroEntrada(id_ruta) {
  try {
    const eventos = await getMonitoreoPorRuta(id_ruta);
    const salida = eventos.find(e => e.tipo === 'S');

    if (!salida) {
      return {
        valido: false,
        mensaje: 'No se puede registrar la entrada porque no se ha registrado la salida'
      };
    }

    return { valido: true, mensaje: 'OK' };
  } catch (error) {
    return {
      valido: false,
      mensaje: 'Error al validar: ' + (error.message || 'Error desconocido')
    };
  }
}
