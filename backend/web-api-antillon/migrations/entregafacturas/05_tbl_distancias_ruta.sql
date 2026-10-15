-- ====================================================================
-- Script: 05_tbl_distancias_ruta.sql
-- Descripción: Distancia sucursal->factura por Google Maps, calculada por
--              el cron. Dato de referencia para mayoreo, no reemplaza
--              PATCH /distancia. Ligada a id_detalle_ruta, no a id_bpkm.
--              creado_por nullable: lo llena un proceso automático.
-- Feature: Portal de Pilotos (entregafacturas)
-- ====================================================================

CREATE TABLE IF NOT EXISTS bpkm.tbl_distancias_ruta
(
    id_distancia_ruta   bigserial
        CONSTRAINT tbl_distancias_ruta_pkey
            PRIMARY KEY,
    id_detalle_ruta     integer                 NOT NULL
        CONSTRAINT fk_distancia_ruta_detalle_ruta
            REFERENCES bpkm.tbl_detalles_ruta,
    distancia_km        numeric(8, 2),
    estado_calculo      varchar(10)             NOT NULL
        CONSTRAINT ck_distancia_ruta_estado_calculo
            CHECK (estado_calculo IN ('OK', 'ERROR')),
    mensaje_error       varchar(500),
    fecha_calculo       timestamp               NOT NULL,
    creado_por          integer
        CONSTRAINT fk_distancia_ruta_creado_por
            REFERENCES usuarios.tbl_usuarios,
    fecha_creacion      timestamp default now() NOT NULL
);

ALTER TABLE bpkm.tbl_distancias_ruta
    OWNER TO antillonuser;

CREATE INDEX IF NOT EXISTS idx_distancias_ruta_detalle_ruta
    ON bpkm.tbl_distancias_ruta (id_detalle_ruta);
