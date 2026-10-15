-- ====================================================================
-- Script: 11_evidencia_entrega_drop_geolocalizacion.sql
-- Descripción: Geolocalización por entrega (no por foto). Paso 2 de 2:
--              completa la copia, latitud/longitud NOT NULL y quita las
--              columnas de geo de tbl_evidencia_entrega.
--              Se corre DESPUÉS del deploy. Re-ejecutable.
-- Feature: Portal de Pilotos (entregafacturas) — hasta 3 fotos por entrega
-- ====================================================================

BEGIN;

-- Completa la copia de la migración 10 (dinámico: en una re-ejecución las
-- columnas de evidencia ya no existen).
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'bpkm'
      AND table_name   = 'tbl_evidencia_entrega'
      AND column_name  = 'latitud'
  ) THEN
    EXECUTE $sql$
      UPDATE bpkm.tbl_entregas_piloto ep
      SET latitud          = ev.latitud,
          longitud         = ev.longitud,
          precision_metros = ev.precision_metros
      FROM (
        SELECT DISTINCT ON (id_entrega_piloto)
               id_entrega_piloto, latitud, longitud, precision_metros
        FROM bpkm.tbl_evidencia_entrega
        WHERE latitud IS NOT NULL
          AND longitud IS NOT NULL
        ORDER BY id_entrega_piloto, id_evidencia
      ) ev
      WHERE ev.id_entrega_piloto = ep.id_entrega_piloto
        AND ep.latitud IS NULL
    $sql$;
  END IF;
END
$$;

-- Si alguna entrega quedó sin geo, falla y no se aplica nada.
ALTER TABLE bpkm.tbl_entregas_piloto
  ALTER COLUMN latitud  SET NOT NULL,
  ALTER COLUMN longitud SET NOT NULL;

ALTER TABLE bpkm.tbl_evidencia_entrega
  DROP COLUMN IF EXISTS latitud,
  DROP COLUMN IF EXISTS longitud,
  DROP COLUMN IF EXISTS precision_metros;

COMMIT;
