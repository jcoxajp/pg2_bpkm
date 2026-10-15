-- ====================================================================
-- Script: 02_sucursales_coordenadas.sql
-- Descripción: Agrega latitud/longitud a usuarios.tbl_sucursales (origen
--              para Google Maps Distance Matrix). Sin backfill.
-- Feature: Portal de Pilotos (entregafacturas)
-- ====================================================================

ALTER TABLE usuarios.tbl_sucursales
  ADD COLUMN IF NOT EXISTS latitud numeric(10, 7),
  ADD COLUMN IF NOT EXISTS longitud numeric(10, 7);
