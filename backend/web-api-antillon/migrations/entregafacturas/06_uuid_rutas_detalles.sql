-- ====================================================================
-- Script: 06_uuid_rutas_detalles.sql
-- Descripción: Agrega uuid a bpkm.tbl_rutas y bpkm.tbl_detalles_ruta
--              (no la tenían) — identificador externo para la API.
--              Aditivo, no afecta los SP existentes de BPKM.
-- Feature: Portal de Pilotos (entregafacturas)
-- ====================================================================

ALTER TABLE bpkm.tbl_rutas
  ADD COLUMN IF NOT EXISTS uuid uuid DEFAULT gen_random_uuid() NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_rutas_uuid
  ON bpkm.tbl_rutas (uuid);

ALTER TABLE bpkm.tbl_detalles_ruta
  ADD COLUMN IF NOT EXISTS uuid uuid DEFAULT gen_random_uuid() NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_detalles_ruta_uuid
  ON bpkm.tbl_detalles_ruta (uuid);
