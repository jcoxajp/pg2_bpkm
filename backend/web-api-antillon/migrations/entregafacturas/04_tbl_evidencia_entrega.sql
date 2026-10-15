-- ====================================================================
-- Script: 04_tbl_evidencia_entrega.sql
-- Descripción: Fotos + geolocalización por cada tbl_entregas_piloto.
--              Tabla separada (no columnas ahí) para soportar N fotos.
-- Feature: Portal de Pilotos (entregafacturas)
-- ====================================================================

CREATE TABLE IF NOT EXISTS bpkm.tbl_evidencia_entrega
(
    id_evidencia        bigserial
        CONSTRAINT tbl_evidencia_entrega_pkey
            PRIMARY KEY,
    uuid                uuid      default gen_random_uuid() NOT NULL,
    id_entrega_piloto   bigint                  NOT NULL
        CONSTRAINT fk_evidencia_entrega_piloto
            REFERENCES bpkm.tbl_entregas_piloto,
    ruta_archivo        varchar(500)            NOT NULL,
    latitud             numeric(10, 7),
    longitud            numeric(10, 7),
    precision_metros    numeric(8, 2),
    fecha_captura       timestamp               NOT NULL,
    creado_por          integer                 NOT NULL
        CONSTRAINT fk_evidencia_creado_por
            REFERENCES usuarios.tbl_usuarios,
    fecha_creacion      timestamp default now() NOT NULL
);

ALTER TABLE bpkm.tbl_evidencia_entrega
    OWNER TO antillonuser;

CREATE UNIQUE INDEX IF NOT EXISTS idx_evidencia_entrega_uuid
    ON bpkm.tbl_evidencia_entrega (uuid);

CREATE INDEX IF NOT EXISTS idx_evidencia_entrega_piloto
    ON bpkm.tbl_evidencia_entrega (id_entrega_piloto);
