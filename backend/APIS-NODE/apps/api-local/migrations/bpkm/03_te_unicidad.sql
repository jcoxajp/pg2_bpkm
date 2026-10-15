-- ====================================================================
-- Script: 03_te_unicidad.sql
-- Descripción: Índices únicos parciales para evitar duplicados activos
--              en contactos y direcciones TE.
--              La separación por sucursal es implícita: id_te_cliente
--              ya es único por (card_code, id_sucursal).
-- Fecha: 08/07/2026
-- Feature: feat 07-07 — Etiquetas TE
-- ====================================================================

-- Un cliente no puede tener dos contactos activos con el mismo teléfono.
-- Excluye NULLs: dos contactos sin teléfono son permitidos.
CREATE UNIQUE INDEX idx_te_contactos_uniq_telefono
  ON bpkm.tbl_te_contactos (id_te_cliente, telefono)
  WHERE estado = 1 AND telefono IS NOT NULL;

-- Un cliente no puede tener dos direcciones activas con el mismo alias
-- (case-insensitive: "Bodega Central" == "bodega central").
CREATE UNIQUE INDEX idx_te_direcciones_uniq_alias
  ON bpkm.tbl_te_direcciones (id_te_cliente, LOWER(alias))
  WHERE estado = 1;
