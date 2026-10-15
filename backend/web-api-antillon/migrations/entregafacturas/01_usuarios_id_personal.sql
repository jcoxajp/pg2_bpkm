-- ====================================================================
-- Script: 01_usuarios_id_personal.sql
-- Descripción: Vincula usuarios.tbl_usuarios con bpkm.tbl_personal (login de
--              piloto). A diferencia de id_proveedor, es UNIQUE.
-- Feature: Portal de Pilotos (entregafacturas)
-- ====================================================================

ALTER TABLE usuarios.tbl_usuarios
  ADD COLUMN IF NOT EXISTS id_personal integer
    CONSTRAINT fk_id_personal REFERENCES bpkm.tbl_personal;

ALTER TABLE usuarios.tbl_usuarios
  ADD CONSTRAINT uq_usuarios_id_personal UNIQUE (id_personal);

CREATE INDEX IF NOT EXISTS idx_usuarios_id_personal
  ON usuarios.tbl_usuarios (id_personal);
