-- ====================================================================
-- Script: 10_update_get_bpkm_detalle_distancia_anterior.sql
-- Descripción: Actualiza la función bpkm.get_bpkm_detalle para retornar la columna distancia_anterior.
-- Fecha: 23/07/2026
-- Feature: BPKM Distancia Anterior
-- ====================================================================

DROP FUNCTION IF EXISTS bpkm.get_bpkm_detalle(bigint);

CREATE OR REPLACE FUNCTION bpkm.get_bpkm_detalle(p_id_bpkm bigint)
RETURNS TABLE(
    id_bpkm integer, 
    id_ruta integer, 
    codigo_ruta character varying, 
    estado_bpkm character varying, 
    estado_codigo character varying, 
    tipo_ruta character varying, 
    distancia_mas_lejana numeric, 
    distancia_anterior numeric, -- << NUEVA COLUMNA RETORNADA
    municipio_lejano character varying, 
    monto_total_transportado numeric, 
    monto_sugerido_piloto numeric, 
    monto_sugerido_auxiliar numeric, 
    monto_aprobado_piloto numeric, 
    monto_aprobado_auxiliar numeric, 
    observaciones_gerencia character varying, 
    nombre_piloto character varying, 
    nombre_auxiliar character varying, 
    placa_camion character varying, 
    fecha_salida_plan timestamp without time zone, 
    fecha_entrada_plan timestamp without time zone, 
    total_facturas bigint, 
    fecha_creacion timestamp without time zone, 
    fecha_aprobacion timestamp without time zone, 
    usuario_gerencia_nombre character varying, 
    fecha_rrhh timestamp without time zone, 
    usuario_rrhh_nombre character varying, 
    cumplimiento character varying, 
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
    b.id_ruta,
    r.numero_ruta,
    e.nombre AS estado_bpkm,
    e.codigo AS estado_codigo,
    r.tipo_ruta,
    b.distancia_mas_lejana,
    b.distancia_anterior, -- << SE SELECCIONA EL NUEVO CAMPO
    m.nombre AS municipio_lejano,
    b.monto_total_transportado,
    b.monto_sugerido_piloto,
    b.monto_sugerido_auxiliar,
    b.monto_aprobado_piloto,
    b.monto_aprobado_auxiliar,
    b.observaciones_gerencia,
    p.nombre AS nombre_piloto,
    a.nombre AS nombre_auxiliar,
    c.placa AS placa_camion,
    r.fecha_salida_plan,
    r.fecha_entrada_plan,
    COUNT(dr.id_detalle_ruta) AS total_facturas,
    b.fecha_creacion,
    b.fecha_aprobacion,
    ug.nombre AS usuario_gerencia_nombre,
    b.fecha_rrhh,
    ur.nombre AS usuario_rrhh_nombre,
    b.cumplimiento,
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
         WHERE tdr.id_ruta = b.id_ruta
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
  LEFT JOIN usuarios.tbl_usuarios ug ON ug.id_usuario = b.usuario_gerencia
  LEFT JOIN usuarios.tbl_usuarios ur ON ur.id_usuario = b.usuario_rrhh
  LEFT JOIN catalogos.tbl_ciudades tc ON tc.id_ciudad = m.id_ciudad
  LEFT JOIN LATERAL (
    SELECT fecha_hora
    FROM bpkm.tbl_monitoreo_bpkm mbm
    WHERE mbm.id_ruta = r.id_ruta AND mbm.tipo = 'E'
    ORDER BY fecha_hora DESC
    LIMIT 1
  ) mon_entrada ON true

  WHERE b.id_bpkm = p_id_bpkm

  GROUP BY b.id_bpkm, b.id_ruta, r.numero_ruta, e.nombre, e.codigo, r.tipo_ruta, m.nombre,
           b.distancia_mas_lejana, b.distancia_anterior, b.monto_total_transportado,
           b.monto_sugerido_piloto, b.monto_sugerido_auxiliar,
           b.monto_aprobado_piloto, b.monto_aprobado_auxiliar,
           b.observaciones_gerencia, p.nombre, a.nombre, c.placa,
           r.fecha_salida_plan, r.fecha_entrada_plan,
           b.fecha_creacion, b.fecha_aprobacion, ug.nombre,
           b.fecha_rrhh, ur.nombre, b.cumplimiento, tc.nombre, mon_entrada.fecha_hora;
END;
$$;

ALTER FUNCTION bpkm.get_bpkm_detalle(bigint) OWNER TO antillonuser;
