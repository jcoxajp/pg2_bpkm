-- ====================================================================
-- Script: 08_update_get_bpkm_distancia_anterior.sql
-- Descripción: Actualiza la función bpkm.get_bpkm para retornar la columna distancia_anterior.
-- Fecha: 23/07/2026
-- Feature: BPKM Distancia Anterior
-- ====================================================================

DROP FUNCTION IF EXISTS bpkm.get_bpkm(character varying, date, date, integer, integer, character varying);

CREATE OR REPLACE FUNCTION bpkm.get_bpkm(
    p_estado_codigo character varying, 
    p_fecha_desde date, 
    p_fecha_hasta date, 
    p_id_sucursal integer DEFAULT 0, 
    p_id_camion integer DEFAULT 0, 
    p_folio_factura character varying DEFAULT NULL::character varying
)
RETURNS TABLE(
    id_bpkm integer, 
    codigo_ruta character varying, 
    estado_nombre character varying, 
    estado_codigo character varying, 
    distancia_mas_lejana numeric, 
    distancia_anterior numeric, -- << NUEVA COLUMNA RETORNADA
    municipio_lejano character varying, 
    monto_total_transportado numeric, 
    monto_sugerido_piloto numeric, 
    monto_aprobado_piloto numeric, 
    nombre_piloto character varying, 
    nombre_auxiliar character varying, 
    placa_camion character varying, 
    total_facturas bigint, 
    tipo_ruta character varying, 
    fecha_creacion timestamp without time zone, 
    fecha_aprobacion timestamp without time zone, 
    fecha_rrhh timestamp without time zone, 
    ruta_cumplida boolean, 
    cumplimiento character varying, 
    sucursal_salida character varying, 
    monto_aprobado_auxiliar numeric, 
    departamento character varying, 
    cumplimiento_regreso boolean, 
    porcentaje_entrega numeric
)
STABLE
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    b.id_bpkm,
    r.numero_ruta,
    e.nombre AS estado_nombre,
    e.codigo AS estado_codigo,
    b.distancia_mas_lejana,
    b.distancia_anterior, -- << SE SELECCIONA EL NUEVO CAMPO
    m.nombre AS municipio_lejano,
    b.monto_total_transportado,
    b.monto_sugerido_piloto,
    b.monto_aprobado_piloto,
    p.nombre AS nombre_piloto,
    a.nombre AS nombre_auxiliar,
    c.placa AS placa_camion,
    COUNT(dr.id_detalle_ruta) AS total_facturas,
    r.tipo_ruta,
    r.fecha_salida_plan AS fecha_creacion,
    b.fecha_aprobacion,
    b.fecha_rrhh,

    CASE
      WHEN r.fecha_salida_plan IS NULL OR r.fecha_entrada_plan IS NULL THEN NULL
      WHEN mon_salida.fecha_hora IS NULL OR mon_entrada.fecha_hora IS NULL THEN NULL
      WHEN (EXTRACT(EPOCH FROM (mon_salida.fecha_hora - r.fecha_salida_plan)) / 60)::INTEGER
           BETWEEN -15 AND 15
      THEN TRUE
      ELSE FALSE
    END AS ruta_cumplida,

    b.cumplimiento,
    s.nombre AS sucursal_salida,
    b.monto_aprobado_auxiliar,
    tc.nombre AS departamento,

    CASE
      WHEN r.fecha_entrada_plan IS NULL THEN NULL
      WHEN mon_entrada.fecha_hora IS NULL THEN NULL
      WHEN (EXTRACT(EPOCH FROM (mon_entrada.fecha_hora - r.fecha_entrada_plan)) / 60)::INTEGER
           BETWEEN -15 AND 15
      THEN TRUE
      ELSE FALSE
    END AS cumplimiento_regreso,

    CASE
      WHEN b.monto_total_transportado IS NULL OR b.monto_total_transportado = 0 THEN 0.00
      ELSE (
        (SELECT COALESCE(SUM(tcf.doc_total), 0)
         FROM bpkm.tbl_detalles_ruta tdr
         LEFT JOIN bpkm.tbl_estado_bpkm teb ON tdr.id_estado = teb.id_estado_bpkm
         LEFT JOIN bpkm.tbl_factura_seleccion tfs ON tdr.id_factura_sel = tfs.id_factura_sel
         LEFT JOIN ndc.tbl_cat_facturas tcf ON tfs.id_factura = tcf.id
         WHERE tdr.id_ruta = r.id_ruta
           AND teb.codigo IN ('ENT', 'PARC')
        ) / b.monto_total_transportado * 100
      )
    END AS porcentaje_entrega

  FROM bpkm.tbl_bpkm b
  JOIN bpkm.tbl_rutas r ON r.id_ruta = b.id_ruta
  LEFT JOIN bpkm.tbl_estado_bpkm e ON e.id_estado_bpkm = b.id_estado_bpkm
  LEFT JOIN catalogos.tbl_municipios m ON m.id_municipio = b.id_municipio_lejano
  LEFT JOIN bpkm.tbl_personal p ON p.id_personal = r.id_piloto
  LEFT JOIN bpkm.tbl_personal a ON a.id_personal = r.id_auxiliar
  LEFT JOIN bpkm.tbl_camiones c ON c.id_camion = r.id_camion
  LEFT JOIN bpkm.tbl_detalles_ruta dr ON dr.id_ruta = r.id_ruta
  LEFT JOIN usuarios.tbl_sucursales s ON s.id_sucursal = r.id_sucursal_salida
  LEFT JOIN catalogos.tbl_ciudades tc ON tc.id_ciudad = m.id_ciudad

  LEFT JOIN LATERAL (
    SELECT fecha_hora
    FROM bpkm.tbl_monitoreo_bpkm
    WHERE id_ruta = r.id_ruta AND tipo = 'S'
    ORDER BY fecha_hora DESC
    LIMIT 1
  ) mon_salida ON true

  LEFT JOIN LATERAL (
    SELECT fecha_hora
    FROM bpkm.tbl_monitoreo_bpkm
    WHERE id_ruta = r.id_ruta AND tipo = 'E'
    ORDER BY fecha_hora DESC
    LIMIT 1
  ) mon_entrada ON true

  WHERE (NULLIF(TRIM(p_estado_codigo),'') IS NULL OR e.codigo = UPPER(TRIM(p_estado_codigo)))
    AND (p_fecha_desde IS NULL OR r.fecha_salida_plan::DATE >= p_fecha_desde)
    AND (p_fecha_hasta IS NULL OR r.fecha_salida_plan::DATE <= p_fecha_hasta)
    AND (p_id_sucursal = 0 OR r.id_sucursal_salida = p_id_sucursal)
    AND (p_id_camion = 0 OR r.id_camion = p_id_camion)
    AND (NULLIF(TRIM(p_folio_factura),'') IS NULL OR EXISTS (
      SELECT 1 FROM bpkm.tbl_detalles_ruta dr2
      WHERE dr2.id_ruta = r.id_ruta
        AND dr2.folio_factura ILIKE '%'||TRIM(p_folio_factura)||'%'
    ))

  GROUP BY b.id_bpkm, r.numero_ruta, e.nombre, e.codigo, b.distancia_mas_lejana,
           b.distancia_anterior, -- << NUEVO CAMPO AGRUPADO
           m.nombre, b.monto_total_transportado, b.monto_sugerido_piloto,
           b.monto_aprobado_piloto, p.nombre, a.nombre, c.placa, r.tipo_ruta,
           b.fecha_aprobacion, b.fecha_rrhh, r.fecha_salida_plan,
           r.fecha_entrada_plan, mon_salida.fecha_hora, mon_entrada.fecha_hora,
           b.cumplimiento, s.nombre, b.monto_aprobado_auxiliar, tc.nombre, r.id_ruta

  ORDER BY
    CASE
      WHEN UPPER(TRIM(p_estado_codigo)) = 'PEND'
      THEN r.fecha_salida_plan
    END ASC NULLS LAST,
    CASE
      WHEN UPPER(TRIM(p_estado_codigo)) != 'PEND'
           OR NULLIF(TRIM(p_estado_codigo),'') IS NULL
      THEN r.fecha_salida_plan
    END DESC NULLS LAST;
END;
$$;

ALTER FUNCTION bpkm.get_bpkm(character varying, date, date, integer, integer, character varying) OWNER TO antillonuser;
