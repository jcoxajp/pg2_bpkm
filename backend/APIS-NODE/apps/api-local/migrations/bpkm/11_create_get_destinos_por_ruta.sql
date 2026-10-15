-- ====================================================================
-- Script: 11_create_get_destinos_por_ruta.sql
-- Descripción: Retorna el desglose de monto transportado por departamento y municipio para una ruta
-- Feature: Desglose de destinos BPKM
-- ====================================================================

DROP FUNCTION IF EXISTS bpkm.get_destinos_por_ruta(bigint);

CREATE OR REPLACE FUNCTION bpkm.get_destinos_por_ruta(p_id_ruta bigint)
RETURNS TABLE(
    sucursal character varying,
    numero_ruta character varying,
    departamento character varying,
    municipio character varying,
    monto numeric,
    total_facturas bigint
)
STABLE
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    COALESCE(ts.nombre, 'Sin Sucursal')::VARCHAR AS sucursal,
    tr.numero_ruta::VARCHAR,
    COALESCE(tc.nombre, 'Sin Departamento')::VARCHAR AS departamento,
    COALESCE(tm.nombre, 'Sin Municipio')::VARCHAR AS municipio,
    COALESCE(SUM(COALESCE(tcf.doc_total, tdr.total_factura, 0)), 0)::NUMERIC AS monto,
    COUNT(tdr.id_detalle_ruta)::BIGINT AS total_facturas
  FROM bpkm.tbl_rutas tr
  JOIN bpkm.tbl_detalles_ruta tdr ON tr.id_ruta = tdr.id_ruta
  JOIN bpkm.tbl_factura_seleccion tfs ON tdr.id_factura_sel = tfs.id_factura_sel
  LEFT JOIN ndc.tbl_cat_facturas tcf ON tfs.id_factura = tcf.id
  LEFT JOIN catalogos.tbl_ciudades tc ON tdr.id_departamento_snap = tc.id_ciudad
  LEFT JOIN catalogos.tbl_municipios tm ON tdr.id_municipio_snap = tm.id_municipio
  LEFT JOIN usuarios.tbl_sucursales ts ON tr.id_sucursal_salida = ts.id_sucursal
  WHERE tr.id_ruta = p_id_ruta
    AND tr.tipo_ruta IN ('RL', 'RC')
    AND (tdr.id_estado IS NULL OR tdr.id_estado != bpkm._estado_id('DETALLE', 'ANULADO'))
    AND (tfs.anulada IS NULL OR tfs.anulada = 0)
  GROUP BY ts.nombre, tr.numero_ruta, tc.nombre, tm.nombre
  ORDER BY tc.nombre, tm.nombre;
END;
$$;

ALTER FUNCTION bpkm.get_destinos_por_ruta(bigint) OWNER TO antillonuser;
