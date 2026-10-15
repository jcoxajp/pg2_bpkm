-- ====================================================================
-- Script: 10_entregas_piloto_geolocalizacion.sql
-- Descripción: Geolocalización por entrega (no por foto). Paso 1 de 2:
--              columnas en tbl_entregas_piloto + copia desde evidencia.
--              Se corre ANTES del deploy. Re-ejecutable.
-- Feature: Portal de Pilotos (entregafacturas) — hasta 3 fotos por entrega
-- ====================================================================

BEGIN;

ALTER TABLE bpkm.tbl_entregas_piloto
  ADD COLUMN IF NOT EXISTS latitud          numeric(10, 7),
  ADD COLUMN IF NOT EXISTS longitud         numeric(10, 7),
  ADD COLUMN IF NOT EXISTS precision_metros numeric(8, 2);

-- Copia la geo de la primera evidencia que la tenga.
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
  AND ep.latitud IS NULL;

COMMIT;
