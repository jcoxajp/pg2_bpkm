-- ====================================================================
-- Script: 01_te_clientes.sql
-- Descripción: Módulo de clientes TE — tablas de clientes, contactos
--              y direcciones para hojas de identificación de
--              Transporte Externo. También agrega id_te_contacto e
--              id_te_direccion a tbl_factura_seleccion.
-- Fecha: 08/07/2026
-- Feature: feat 07-07 — Etiquetas TE
-- ====================================================================

-- --------------------------------------------------------------------
-- tbl_te_clientes
-- Agrupa contactos y direcciones de un card_code dentro de una sucursal.
-- nit: copiado de ndc.tbl_cat_facturas al crear el registro local
--      (evita JOIN en cada generación de etiqueta).
-- card_name se sigue leyendo de ndc en tiempo de consulta, no se cachea.
-- --------------------------------------------------------------------
CREATE TABLE bpkm.tbl_te_clientes (
    id_te_cliente       INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    card_code           VARCHAR(50)             NOT NULL,
    card_name           VARCHAR(200),
    nit                 VARCHAR(20),
    id_sucursal         INTEGER                 NOT NULL
        REFERENCES usuarios.tbl_sucursales,
    observaciones       VARCHAR(500),
    estado              INTEGER   DEFAULT 1     NOT NULL
        CHECK (estado = ANY (ARRAY [0, 1])),
    creado_por          INTEGER                 NOT NULL,
    fecha_creacion      TIMESTAMP DEFAULT NOW() NOT NULL,
    actualizado_por     INTEGER,
    fecha_actualizacion TIMESTAMP,
    CONSTRAINT ux_te_cliente_card_sucursal UNIQUE (card_code, id_sucursal)
);

ALTER TABLE bpkm.tbl_te_clientes OWNER TO antillonuser;

CREATE INDEX idx_te_clientes_card_code   ON bpkm.tbl_te_clientes (card_code);
CREATE INDEX idx_te_clientes_id_sucursal ON bpkm.tbl_te_clientes (id_sucursal);

COMMENT ON TABLE bpkm.tbl_te_clientes IS 'Clientes TE por sucursal. card_code referencia lógica a ndc.tbl_cat_facturas. nit cacheado para etiquetas.';

-- --------------------------------------------------------------------
-- tbl_te_contactos
-- Personas de contacto de un cliente TE. Solo nombre y teléfono —
-- los transportistas se comunican por teléfono, no por correo.
-- Sin PUT: para "editar" un contacto ya usado en facturas históricas
-- se desactiva (estado=0) y se crea uno nuevo, preservando trazabilidad.
-- --------------------------------------------------------------------
CREATE TABLE bpkm.tbl_te_contactos (
    id_te_contacto      INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    id_te_cliente       INTEGER                 NOT NULL
        REFERENCES bpkm.tbl_te_clientes,
    nombre              VARCHAR(200)            NOT NULL,
    telefono            VARCHAR(30),
    es_default          BOOLEAN   DEFAULT FALSE NOT NULL,
    estado              INTEGER   DEFAULT 1     NOT NULL
        CHECK (estado = ANY (ARRAY [0, 1])),
    creado_por          INTEGER                 NOT NULL,
    fecha_creacion      TIMESTAMP DEFAULT NOW() NOT NULL,
    actualizado_por     INTEGER,
    fecha_actualizacion TIMESTAMP
);

ALTER TABLE bpkm.tbl_te_contactos OWNER TO antillonuser;

CREATE INDEX idx_te_contactos_id_te_cliente ON bpkm.tbl_te_contactos (id_te_cliente);

COMMENT ON TABLE bpkm.tbl_te_contactos IS 'Contactos de recepción de un cliente TE. Sin PUT — inmutable para trazabilidad histórica.';

-- --------------------------------------------------------------------
-- tbl_te_direcciones
-- Direcciones de entrega de un cliente TE.
-- id_municipio es suficiente: tbl_municipios tiene id_ciudad internamente.
-- id_transporte_externo: transportista predeterminado para esta dirección
--   (nullable, el usuario puede sobreescribir al armar la ruta).
-- Sin PUT por la misma razón que tbl_te_contactos (trazabilidad).
-- --------------------------------------------------------------------
CREATE TABLE bpkm.tbl_te_direcciones (
    id_te_direccion         INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    id_te_cliente           INTEGER                 NOT NULL
        REFERENCES bpkm.tbl_te_clientes,
    alias                   VARCHAR(100)            NOT NULL,
    id_municipio            INTEGER
        REFERENCES catalogos.tbl_municipios,
    direccion               VARCHAR(500)            NOT NULL,
    instrucciones_entrega   TEXT,
    id_transporte_externo   INTEGER
        REFERENCES bpkm.tbl_transporte_externo,
    es_default              BOOLEAN   DEFAULT FALSE NOT NULL,
    estado                  INTEGER   DEFAULT 1     NOT NULL
        CHECK (estado = ANY (ARRAY [0, 1])),
    creado_por              INTEGER                 NOT NULL,
    fecha_creacion          TIMESTAMP DEFAULT NOW() NOT NULL,
    actualizado_por         INTEGER,
    fecha_actualizacion     TIMESTAMP
);

ALTER TABLE bpkm.tbl_te_direcciones OWNER TO antillonuser;

CREATE INDEX idx_te_direcciones_id_te_cliente ON bpkm.tbl_te_direcciones (id_te_cliente);

COMMENT ON TABLE bpkm.tbl_te_direcciones IS 'Direcciones de entrega TE con transportista predeterminado. Sin PUT — inmutable para trazabilidad histórica.';

-- --------------------------------------------------------------------
-- ALTER tbl_factura_seleccion
-- Nullable: solo aplican cuando id_forma_entrega = EXT (TE).
-- Las columnas legacy id_municipio/id_departamento/direccion_entrega
-- se conservan para facturas no-TE.
-- --------------------------------------------------------------------
ALTER TABLE bpkm.tbl_factura_seleccion
    ADD COLUMN id_te_contacto  INTEGER REFERENCES bpkm.tbl_te_contactos,
    ADD COLUMN id_te_direccion INTEGER REFERENCES bpkm.tbl_te_direcciones;

CREATE INDEX idx_factura_sel_te_contacto  ON bpkm.tbl_factura_seleccion (id_te_contacto)
    WHERE id_te_contacto IS NOT NULL;
CREATE INDEX idx_factura_sel_te_direccion ON bpkm.tbl_factura_seleccion (id_te_direccion)
    WHERE id_te_direccion IS NOT NULL;
