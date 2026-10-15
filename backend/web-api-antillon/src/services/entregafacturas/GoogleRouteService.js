const pool = require('../../config/database');

const ROUTES_API_URL = 'https://routes.googleapis.com/distanceMatrix/v2:computeRouteMatrix';
const FIELD_MASK = 'originIndex,destinationIndex,distanceMeters,status,condition';
const MAX_INTENTOS = 3;
// Estimado conservador, sin medir latencia real de Routes API todavía — ajustar con datos reales.
const DEFAULT_TIMEOUT_MS = 15000;

class GoogleRouteService {
  /**
   * Se llama justo después de registrar una entrega. Si la ruta ya no tiene
   * ninguna factura pendiente, dispara el cálculo en segundo plano — nunca
   * bloquea ni hace fallar la respuesta al piloto.
   */
  static async dispararSiListo(idRuta) {
    try {
      const { rows } = await pool.query(
        `SELECT EXISTS (
           SELECT 1 FROM bpkm.tbl_detalles_ruta dr
           LEFT JOIN bpkm.tbl_estado_bpkm eDet ON eDet.id_estado_bpkm = dr.id_estado
           LEFT JOIN bpkm.tbl_entregas_piloto ep ON ep.id_detalle_ruta = dr.id_detalle_ruta
           WHERE dr.id_ruta = $1
             AND (eDet.codigo IS NULL OR eDet.codigo != 'ANULADO')
             AND ep.id_entrega_piloto IS NULL
         ) AS pendientes`,
        [idRuta]
      );
      if (rows[0]?.pendientes) return;
      await GoogleRouteService.calcularDistanciasRuta(idRuta);
    } catch (err) {
      console.error(`[GoogleRouteService] Error en disparo inmediato (ruta ${idRuta}):`, err.message);
    }
  }

  /**
   * Revisión diaria: rutas sin ninguna factura pendiente de registrar, que
   * todavía tienen al menos una factura sin distancia calculada (o en ERROR
   * con reintentos disponibles). Cubre lo que el disparo inmediato no pudo
   * (reinicio a medio camino, error transitorio) y reintenta los ERROR.
   */
  static async calcularRutasListas() {
    const { rows } = await pool.query(
      `SELECT r.id_ruta
       FROM bpkm.tbl_rutas r
       WHERE NOT EXISTS (
         SELECT 1 FROM bpkm.tbl_detalles_ruta dr
         LEFT JOIN bpkm.tbl_estado_bpkm eDet ON eDet.id_estado_bpkm = dr.id_estado
         LEFT JOIN bpkm.tbl_entregas_piloto ep ON ep.id_detalle_ruta = dr.id_detalle_ruta
         WHERE dr.id_ruta = r.id_ruta
           AND (eDet.codigo IS NULL OR eDet.codigo != 'ANULADO')
           AND ep.id_entrega_piloto IS NULL
       )
       AND EXISTS (
         SELECT 1 FROM bpkm.tbl_detalles_ruta dr
         LEFT JOIN bpkm.tbl_estado_bpkm eDet ON eDet.id_estado_bpkm = dr.id_estado
         LEFT JOIN bpkm.tbl_distancias_ruta dist ON dist.id_detalle_ruta = dr.id_detalle_ruta
         WHERE dr.id_ruta = r.id_ruta
           AND (eDet.codigo IS NULL OR eDet.codigo != 'ANULADO')
           AND (dist.id_distancia_ruta IS NULL OR (dist.estado_calculo = 'ERROR' AND dist.intentos < $1))
       )`,
      [MAX_INTENTOS]
    );

    for (const { id_ruta: idRuta } of rows) {
      try {
        await GoogleRouteService.calcularDistanciasRuta(idRuta);
      } catch (err) {
        console.error(`[GoogleRouteService] Error calculando ruta ${idRuta}:`, err.message);
      }
    }
    return { rutasProcesadas: rows.length };
  }

  /**
   * Un origen (sucursal de salida) + destinos (geolocalización de la entrega de cada
   * factura pendiente de cálculo de esta ruta), en una sola llamada a Routes API.
   * Nunca agrupa entre rutas — el volumen real no lo justifica frente a la
   * complejidad de repartir una respuesta combinada entre varias rutas.
   */
  static async calcularDistanciasRuta(idRuta) {
    const { rows: rutaRows } = await pool.query(
      `SELECT s.latitud AS origen_lat, s.longitud AS origen_lng
       FROM bpkm.tbl_rutas r
       LEFT JOIN usuarios.tbl_sucursales s ON s.id_sucursal = r.id_sucursal_salida
       WHERE r.id_ruta = $1`,
      [idRuta]
    );
    const ruta = rutaRows[0];
    if (!ruta || ruta.origen_lat == null || ruta.origen_lng == null) {
      console.error(`[GoogleRouteService] Ruta ${idRuta}: sucursal sin coordenadas, se omite.`);
      return;
    }

    const destinos = await GoogleRouteService._destinosPendientes(idRuta);
    if (destinos.length === 0) {
      console.log(`[GoogleRouteService] Ruta ${idRuta}: sin facturas pendientes de cálculo, nada que hacer.`);
      return;
    }

    console.log(`[GoogleRouteService] Ruta ${idRuta}: calculando ${destinos.length} distancia(s)...`);

    let elementos;
    try {
      elementos = await GoogleRouteService._llamarRoutesApi(
        { latitude: Number(ruta.origen_lat), longitude: Number(ruta.origen_lng) },
        destinos.map((d) => ({ latitude: Number(d.latitud), longitude: Number(d.longitud) }))
      );
    } catch (err) {
      console.error(`[GoogleRouteService] Ruta ${idRuta}: falló la llamada a Routes API:`, err.message);
      await GoogleRouteService._registrarError(destinos.map((d) => d.id_detalle_ruta), err.message);
      return;
    }

    let okCount = 0;
    let errorCount = 0;
    const cubiertos = new Set();
    for (const el of elementos) {
      const destino = destinos[el.destinationIndex];
      if (!destino) continue;
      cubiertos.add(destino.id_detalle_ruta);

      const evaluado = GoogleRouteService._evaluarElemento(el);
      if (evaluado.exito) {
        await GoogleRouteService._registrarResultado(destino.id_detalle_ruta, evaluado.distanciaKm);
        okCount++;
      } else {
        await GoogleRouteService._registrarError([destino.id_detalle_ruta], evaluado.mensaje);
        errorCount++;
      }
    }

    const sinRespuesta = destinos.filter((d) => !cubiertos.has(d.id_detalle_ruta)).map((d) => d.id_detalle_ruta);
    if (sinRespuesta.length > 0) {
      await GoogleRouteService._registrarError(sinRespuesta, 'Sin elemento de respuesta de Routes API para este destino');
      errorCount += sinRespuesta.length;
    }

    console.log(`[GoogleRouteService] Ruta ${idRuta}: completado — ${okCount} OK, ${errorCount} ERROR.`);
  }

  /**
   * Facturas con entrega y sin distancia calculada (o en ERROR con reintentos disponibles).
   */
  static async _destinosPendientes(idRuta) {
    const { rows } = await pool.query(
      `SELECT dr.id_detalle_ruta, ep.latitud, ep.longitud
       FROM bpkm.tbl_detalles_ruta dr
       LEFT JOIN bpkm.tbl_estado_bpkm eDet ON eDet.id_estado_bpkm = dr.id_estado
       LEFT JOIN bpkm.tbl_distancias_ruta dist ON dist.id_detalle_ruta = dr.id_detalle_ruta
       JOIN bpkm.tbl_entregas_piloto ep ON ep.id_detalle_ruta = dr.id_detalle_ruta
       WHERE dr.id_ruta = $1
         AND (eDet.codigo IS NULL OR eDet.codigo != 'ANULADO')
         AND (dist.id_distancia_ruta IS NULL OR (dist.estado_calculo = 'ERROR' AND dist.intentos < $2))`,
      [idRuta, MAX_INTENTOS]
    );
    return rows;
  }

  static async _llamarRoutesApi(origen, destinos) {
    const apiKey = process.env.GOOGLE_MAPS_API_KEY;
    if (!apiKey) throw new Error('GOOGLE_MAPS_API_KEY no configurada');

    const timeoutMs = parseInt(process.env.GOOGLE_ROUTES_TIMEOUT_MS || String(DEFAULT_TIMEOUT_MS));
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const res = await fetch(ROUTES_API_URL, {
        method: 'POST',
        signal: controller.signal,
        headers: {
          'Content-Type': 'application/json',
          'X-Goog-Api-Key': apiKey,
          'X-Goog-FieldMask': FIELD_MASK,
        },
        body: JSON.stringify(GoogleRouteService._construirRequestBody(origen, destinos)),
      });
      if (!res.ok) {
        const texto = await res.text().catch(() => '');
        throw new Error(`Routes API respondió ${res.status}: ${texto.slice(0, 300)}`);
      }
      return await res.json();
    } finally {
      clearTimeout(timer);
    }
  }

  /** Pura — forma exacta que exige Routes API (sin transformación de lat/lng). */
  static _construirRequestBody(origen, destinos) {
    return {
      origins: [{ waypoint: { location: { latLng: origen } } }],
      destinations: destinos.map((d) => ({ waypoint: { location: { latLng: d } } })),
      travelMode: 'DRIVE',
    };
  }

  /**
   * Pura — un elemento cuenta como éxito solo si Google encontró ruta
   * (`condition`) y trae distancia numérica, sin código de error en `status`.
   */
  static _evaluarElemento(el) {
    const exito = el.condition === 'ROUTE_EXISTS' && typeof el.distanceMeters === 'number' && !el.status?.code;
    if (exito) return { exito: true, distanciaKm: el.distanceMeters / 1000 };
    return {
      exito: false,
      mensaje: el.status?.message || `Sin ruta encontrada (condition: ${el.condition || 'desconocida'})`,
    };
  }

  static async _registrarResultado(idDetalleRuta, distanciaKm) {
    await pool.query(
      `INSERT INTO bpkm.tbl_distancias_ruta
         (id_detalle_ruta, distancia_km, estado_calculo, mensaje_error, fecha_calculo, intentos)
       VALUES ($1, $2, 'OK', NULL, now(), 0)
       ON CONFLICT (id_detalle_ruta) DO UPDATE
         SET distancia_km = EXCLUDED.distancia_km,
             estado_calculo = 'OK',
             mensaje_error = NULL,
             fecha_calculo = now(),
             intentos = 0`,
      [idDetalleRuta, distanciaKm]
    );
  }

  static async _registrarError(idsDetalleRuta, mensaje) {
    if (idsDetalleRuta.length === 0) return;
    await pool.query(
      `INSERT INTO bpkm.tbl_distancias_ruta
         (id_detalle_ruta, distancia_km, estado_calculo, mensaje_error, fecha_calculo, intentos)
       SELECT unnest($1::int[]), NULL, 'ERROR', $2, now(), 1
       ON CONFLICT (id_detalle_ruta) DO UPDATE
         SET estado_calculo = 'ERROR',
             mensaje_error = $2,
             fecha_calculo = now(),
             intentos = bpkm.tbl_distancias_ruta.intentos + 1`,
      [idsDetalleRuta, String(mensaje).slice(0, 500)]
    );
  }
}

module.exports = GoogleRouteService;
