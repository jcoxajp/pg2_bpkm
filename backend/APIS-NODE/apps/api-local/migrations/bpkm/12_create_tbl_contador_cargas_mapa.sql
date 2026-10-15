-- ====================================================================
-- Script: 12_create_tbl_contador_cargas_mapa.sql
-- Descripción: Control y tope de cargas mensuales de Google Maps
-- Feature: Mapa de entregas y distancias BPKM
-- ====================================================================

CREATE TABLE IF NOT EXISTS bpkm.tbl_contador_cargas_mapa (
    anio integer NOT NULL,
    mes integer NOT NULL,
    contador integer NOT NULL DEFAULT 0,
    fecha_actualizacion timestamp without time zone DEFAULT NOW(),
    CONSTRAINT pk_tbl_contador_cargas_mapa PRIMARY KEY (anio, mes),
    CONSTRAINT chk_contador_no_negativo CHECK (contador >= 0)
);

ALTER TABLE bpkm.tbl_contador_cargas_mapa OWNER TO antillonuser;

COMMENT ON TABLE bpkm.tbl_contador_cargas_mapa IS 'Contador global de cargas de Google Maps JavaScript API por mes calendario para respetar el límite gratuito de 10,000.';
