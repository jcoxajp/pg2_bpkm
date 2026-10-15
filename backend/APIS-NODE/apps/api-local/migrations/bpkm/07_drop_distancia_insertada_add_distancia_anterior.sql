-- ====================================================================
-- Script: 07_drop_distancia_insertada_add_distancia_anterior.sql
-- Descripción: Elimina la columna distancia_insertada y agrega la columna distancia_anterior en bpkm.tbl_bpkm.
-- Fecha: 23/07/2026
-- Feature: BPKM Distancia Anterior
-- ====================================================================

ALTER TABLE bpkm.tbl_bpkm 
  DROP COLUMN IF EXISTS distancia_insertada;

ALTER TABLE bpkm.tbl_bpkm 
  ADD COLUMN IF NOT EXISTS distancia_anterior NUMERIC(8, 2);
