-- ====================================================================
-- Script: 07_entregas_piloto_unique_detalle_ruta.sql
-- Descripción: Una sola entrega por factura de ruta — sin reenvío. El
--              usuario ya ve la foto antes de guardar, no hace falta
--              tolerar reintentos server-side.
-- Feature: Portal de Pilotos (entregafacturas)
-- ====================================================================

ALTER TABLE bpkm.tbl_entregas_piloto
  ADD CONSTRAINT uq_entregas_piloto_detalle_ruta UNIQUE (id_detalle_ruta);
