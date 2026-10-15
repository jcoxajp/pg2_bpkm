-- ====================================================================
-- Script: 08_distancias_ruta_reintentos.sql
-- Descripción: Soporte para reintentos del cálculo de distancia. UNIQUE
--              habilita upsert (un intento actualiza la fila existente,
--              no crea una nueva) — necesario porque el disparo
--              inmediato y el barrido diario pueden coincidir sobre la
--              misma factura. intentos cuenta los fallos, tope de 3
--              aplicado por GoogleRouteService, no por la BD.
-- Feature: Portal de Pilotos (entregafacturas) — GoogleRouteService
-- ====================================================================

ALTER TABLE bpkm.tbl_distancias_ruta
  ADD CONSTRAINT uq_distancias_ruta_detalle_ruta UNIQUE (id_detalle_ruta);

ALTER TABLE bpkm.tbl_distancias_ruta
  ADD COLUMN intentos integer NOT NULL DEFAULT 0;
