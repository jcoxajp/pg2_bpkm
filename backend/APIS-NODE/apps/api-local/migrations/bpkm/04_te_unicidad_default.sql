-- ====================================================================
-- Script: 04_te_unicidad_default.sql
-- Descripción: Índices únicos parciales que garantizan un solo registro
--              es_default = true por cliente TE, en contactos y
--              direcciones. Blindaje a nivel de BD: aunque falle la
--              lógica de aplicación (o dos requests concurrentes
--              coincidan), la segunda inserción/actualización que
--              intente dejar dos defaults activos para el mismo
--              cliente será rechazada con 23505 (ya manejado por
--              clienteTeController.handleError → 409).
-- Fecha: 14/07/2026
-- Feature: feat 07-07 — Etiquetas TE
-- ====================================================================

CREATE UNIQUE INDEX idx_te_contactos_uniq_default
  ON bpkm.tbl_te_contactos (id_te_cliente)
  WHERE estado = 1 AND es_default = true;

CREATE UNIQUE INDEX idx_te_direcciones_uniq_default
  ON bpkm.tbl_te_direcciones (id_te_cliente)
  WHERE estado = 1 AND es_default = true;
