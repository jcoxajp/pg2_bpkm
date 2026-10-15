-- ====================================================================
-- Script: 02_te_permisos.sql
-- Descripción: Permission keys para el módulo TE / Clientes.
--              Se insertan en bpkm.tbl_perm_key (mismo sistema que
--              el resto del módulo bpkm).
--              Para asignar a un usuario: INSERT en tbl_permisos_usuario.
-- Fecha: 08/07/2026
-- Feature: feat 07-07 — Etiquetas TE
-- ====================================================================

-- view: puede consultar clientes, contactos y direcciones TE
-- edit: puede crear, desactivar y marcar default (incluye capacidad de view)
INSERT INTO bpkm.tbl_perm_key (key, nivel, label, descripcion, creado_por)
VALUES
  (
    'bpkm.te.clientes.view',
    'viewer',
    'Ver clientes TE',
    'Consultar clientes, contactos y direcciones de Transporte Externo',
    1
  ),
  (
    'bpkm.te.clientes.edit',
    'editor',
    'Gestionar clientes TE',
    'Crear y desactivar contactos y direcciones de Transporte Externo, y marcar predeterminados',
    1
  )
ON CONFLICT (key) DO NOTHING;
