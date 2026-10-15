-- ====================================================================
-- Script: 03_tbl_entregas_piloto.sql
-- Descripción: Resultado que el piloto marca por factura de la ruta. Tabla propia,
--              no toca bpkm.tbl_liquidacion_detalle. resultado usa el
--              vocabulario de bpkm.tbl_estado_bpkm (ENT/PARC/FALL), no el
--              cumplimiento (T/P/F) de tbl_bpkm, que es a nivel de ruta.
-- Feature: Portal de Pilotos (entregafacturas)
-- ====================================================================

CREATE TABLE IF NOT EXISTS bpkm.tbl_entregas_piloto
(
    id_entrega_piloto   bigserial
        CONSTRAINT tbl_entregas_piloto_pkey
            PRIMARY KEY,
    uuid                uuid      default gen_random_uuid() NOT NULL,
    id_detalle_ruta     integer                 NOT NULL
        CONSTRAINT fk_entrega_piloto_detalle_ruta
            REFERENCES bpkm.tbl_detalles_ruta,
    resultado           varchar(10)             NOT NULL
        CONSTRAINT ck_entrega_piloto_resultado
            CHECK (resultado IN ('ENT', 'PARC', 'FALL')),
    id_usuario          integer                 NOT NULL
        CONSTRAINT fk_entrega_piloto_usuario
            REFERENCES usuarios.tbl_usuarios,
    fecha_hora          timestamp               NOT NULL,
    creado_por          integer                 NOT NULL
        CONSTRAINT fk_entrega_piloto_creado_por
            REFERENCES usuarios.tbl_usuarios,
    fecha_creacion      timestamp default now() NOT NULL
);

ALTER TABLE bpkm.tbl_entregas_piloto
    OWNER TO antillonuser;

CREATE UNIQUE INDEX IF NOT EXISTS idx_entregas_piloto_uuid
    ON bpkm.tbl_entregas_piloto (uuid);

CREATE INDEX IF NOT EXISTS idx_entregas_piloto_detalle_ruta
    ON bpkm.tbl_entregas_piloto (id_detalle_ruta);

CREATE INDEX IF NOT EXISTS idx_entregas_piloto_usuario
    ON bpkm.tbl_entregas_piloto (id_usuario);
