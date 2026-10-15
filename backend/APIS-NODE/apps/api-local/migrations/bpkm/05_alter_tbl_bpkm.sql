-- ====================================================================
-- Script: 06_alter_tbl_bpkm.sql
-- Descripción: Agrega el campo distancia_insertada a la tabla bpkm.tbl_bpkm.
-- Fecha: 21/07/2026
-- Feature: BPKM Distancia Insertada
-- ====================================================================

ALTER TABLE bpkm.tbl_bpkm 
  ADD COLUMN IF NOT EXISTS distancia_insertada NUMERIC(8, 2);
