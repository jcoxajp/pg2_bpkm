-- ====================================================================
-- Script: 09_patch_distancia_lejana_anterior.sql
-- Descripción: Actualiza la función bpkm.patch_bpkm_distancia_lejana para respaldar
--              la distancia anterior la 1a vez (cambiando estado a INGRESADO) y permitir
--              re-ediciones ilimitadas recalculando comisiones y guardando bitácora.
-- Fecha: 24/07/2026
-- Feature: BPKM Distancia Anterior - Cambio de estado 1a vez y re-ediciones ilimitadas
-- ====================================================================

CREATE OR REPLACE FUNCTION bpkm.patch_bpkm_distancia_lejana(
    p_id_bpkm integer, 
    p_distancia numeric, 
    p_usuario integer
)
RETURNS TABLE(ok boolean, mensaje character varying)
LANGUAGE plpgsql
AS $$
DECLARE
  v_estado_codigo      VARCHAR;
  v_distancia_actual   NUMERIC;
  v_distancia_anterior NUMERIC;
  v_nuevo_piloto       NUMERIC;
  v_nuevo_auxiliar     NUMERIC;
BEGIN
  -- 1. Verificar existencia y estado actual del BPKM
  SELECT e.codigo, b.distancia_mas_lejana, b.distancia_anterior
  INTO v_estado_codigo, v_distancia_actual, v_distancia_anterior
  FROM bpkm.tbl_bpkm b
  LEFT JOIN bpkm.tbl_estado_bpkm e ON e.id_estado_bpkm = b.id_estado_bpkm
  WHERE b.id_bpkm = p_id_bpkm;

  IF NOT FOUND THEN
    RETURN QUERY SELECT false, 'BPKM no encontrado'::varchar;
    RETURN;
  END IF;

  IF v_estado_codigo != 'PEND' THEN
    RETURN QUERY SELECT false, 'Solo se puede modificar en estado Pendiente'::varchar;
    RETURN;
  END IF;

  -- 2. Validar rango de distancia
  IF p_distancia <= 0 THEN
    RETURN QUERY SELECT false, 'La distancia debe ser mayor a 0'::varchar;
    RETURN;
  END IF;

  IF p_distancia > 1000 THEN
    RETURN QUERY SELECT false, 'La distancia no puede superar 1000 km'::varchar;
    RETURN;
  END IF;

  -- 3. Recalcular comisiones sugeridas con bpkm.calcular_comision_bpkm
  v_nuevo_piloto   := bpkm.calcular_comision_bpkm(p_distancia);
  v_nuevo_auxiliar := v_nuevo_piloto * 0.50;

  -- 4. Actualizar tbl_bpkm
  -- La 1a vez respalda distancia_mas_lejana en distancia_anterior (cambiando estado a INGRESADO).
  -- En subsiguientes modificaciones, conserva la distancia_anterior original y actualiza distancia_mas_lejana.
  UPDATE bpkm.tbl_bpkm
  SET distancia_anterior     = COALESCE(distancia_anterior, distancia_mas_lejana),
      distancia_mas_lejana    = p_distancia,
      km_punto_lejano         = p_distancia::integer,
      monto_sugerido_piloto   = v_nuevo_piloto,
      monto_sugerido_auxiliar = v_nuevo_auxiliar,
      actualizado_por         = p_usuario,
      fecha_actualizacion     = NOW()
  WHERE id_bpkm = p_id_bpkm;

  -- 5. Registrar en bitácora de auditoría
  PERFORM bpkm.post_bitacora(
    'bpkm',
    p_id_bpkm,
    'DISTANCIA_MODIFICADA',
    CONCAT('Distancia modificada: ', COALESCE(v_distancia_actual::TEXT, 'N/A'), ' km → ', p_distancia, ' km. ',
           'Nuevas comisiones sugeridas -> Piloto: Q', ROUND(v_nuevo_piloto, 2), 
           ', Auxiliar: Q', ROUND(v_nuevo_auxiliar, 2)),
    p_usuario
  );

  RETURN QUERY SELECT true, 'Distancia y comisiones actualizadas correctamente'::varchar;
END;
$$;

ALTER FUNCTION bpkm.patch_bpkm_distancia_lejana(integer, numeric, integer) OWNER TO antillonuser;
