-- ====================================================================
-- Script: 09_entregas_piloto_motivo.sql
-- Descripción: Motivo obligatorio en PARC/FALL — la foto sola no explica
--              por qué fue parcial o fallida. Nombre de campo consistente
--              con motivo en proveedores.tbl_excepciones y en el histórico
--              de legrand.tbl_cotizaciones.
-- Feature: Portal de Pilotos (entregafacturas)
-- ====================================================================

ALTER TABLE bpkm.tbl_entregas_piloto
  ADD COLUMN motivo varchar(500);
