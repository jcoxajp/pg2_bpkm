create table if not exists bpkm.tbl_camiones
(
    id_camion           integer generated always as identity
        constraint tbl_camiones_pkey
            primary key,
    placa               varchar                 not null
        constraint ux_camion_placa
            unique,
    estado              integer   default 1     not null
        constraint ck_camion_estado
            check (estado = ANY (ARRAY [0, 1])),
    creado_por          integer                 not null,
    fecha_creacion      timestamp default now() not null,
    actualizado_por     integer,
    fecha_actualizacion timestamp,
    id_sucursal         integer
        constraint tbl_camiones_id_sucursal_fkey
            references usuarios.tbl_sucursales
);

alter table bpkm.tbl_camiones
    owner to antillonuser;

create index if not exists ix_camion_estado
    on bpkm.tbl_camiones (estado);

create index if not exists ix_camion_sucursal
    on bpkm.tbl_camiones (id_sucursal);

create table if not exists bpkm.tbl_forma_entrega
(
    id_forma_entrega    integer generated always as identity
        constraint tbl_forma_entrega_pkey
            primary key,
    nombre              varchar,
    codigo              varchar                 not null
        constraint ux_forma_entrega_codigo
            unique,
    estado              integer   default 1     not null
        constraint ck_forma_entrega_estado
            check (estado = ANY (ARRAY [0, 1])),
    creado_por          integer                 not null,
    fecha_creacion      timestamp default now() not null,
    actualizado_por     integer,
    fecha_actualizacion timestamp
);

alter table bpkm.tbl_forma_entrega
    owner to antillonuser;

create table if not exists bpkm.tbl_transporte_externo
(
    id_transporte_externo integer generated always as identity
        constraint tbl_transporte_externo_pkey
            primary key,
    nombre                varchar                 not null,
    estado                integer   default 1     not null
        constraint ck_transp_ext_estado
            check (estado = ANY (ARRAY [0, 1])),
    creado_por            integer                 not null,
    fecha_creacion        timestamp default now() not null,
    actualizado_por       integer,
    fecha_actualizacion   timestamp
);

alter table bpkm.tbl_transporte_externo
    owner to antillonuser;

create table if not exists bpkm.tbl_personal
(
    id_personal         integer generated always as identity
        constraint tbl_personal_pkey
            primary key,
    id_rol              integer
        constraint tbl_personal_id_rol_fkey
            references usuarios.tbl_roles,
    nombre              varchar                 not null,
    telefono            varchar,
    estado              integer   default 1     not null
        constraint ck_personal_estado
            check (estado = ANY (ARRAY [0, 1])),
    creado_por          integer                 not null,
    fecha_creacion      timestamp default now() not null,
    actualizado_por     integer,
    fecha_actualizacion timestamp,
    id_sucursal         integer
        constraint tbl_personal_id_sucursal_fkey
            references usuarios.tbl_sucursales
);

alter table bpkm.tbl_personal
    owner to antillonuser;

create index if not exists ix_personal_rol
    on bpkm.tbl_personal (id_rol);

create index if not exists ix_personal_estado
    on bpkm.tbl_personal (estado);

create index if not exists ix_personal_nombre
    on bpkm.tbl_personal (lower(nombre::text));

create index if not exists ix_personal_sucursal
    on bpkm.tbl_personal (id_sucursal);

create table if not exists bpkm.tbl_estado_bpkm
(
    id_estado_bpkm      integer generated always as identity
        constraint tbl_estado_bpkm_pkey
            primary key,
    tabla               varchar,
    nombre              varchar,
    codigo              varchar                 not null,
    orden               integer,
    estado              integer   default 1     not null
        constraint ck_estado_bpkm_estado
            check (estado = ANY (ARRAY [0, 1])),
    creado_por          integer                 not null,
    fecha_creacion      timestamp default now() not null,
    actualizado_por     integer,
    fecha_actualizacion timestamp,
    constraint ux_estado_bpkm_tabla_codigo
        unique (tabla, codigo)
);

alter table bpkm.tbl_estado_bpkm
    owner to antillonuser;

create index if not exists ix_estado_bpkm_nombre
    on bpkm.tbl_estado_bpkm (lower(nombre::text));

create table if not exists bpkm.tbl_rutas
(
    id_ruta                  integer generated always as identity
        constraint tbl_rutas_pkey
            primary key,
    id_transporte_externo    integer
        constraint tbl_rutas_id_transporte_externo_fkey
            references bpkm.tbl_transporte_externo,
    id_sucursal_salida       integer
        constraint tbl_rutas_id_sucursal_salida_fkey
            references usuarios.tbl_sucursales,
    id_sucursal_regreso      integer
        constraint tbl_rutas_id_sucursal_regreso_fkey
            references usuarios.tbl_sucursales,
    id_camion                integer
        constraint tbl_rutas_id_camion_fkey
            references bpkm.tbl_camiones,
    id_piloto                integer
        constraint tbl_rutas_id_piloto_fkey
            references bpkm.tbl_personal,
    id_auxiliar              integer
        constraint tbl_rutas_id_auxiliar_fkey
            references bpkm.tbl_personal,
    id_estado_ruta           integer                                        not null
        constraint tbl_rutas_id_estado_fkey
            references bpkm.tbl_estado_bpkm,
    numero_ruta              varchar                                        not null
        constraint ux_rutas_numero
            unique,
    monto_total              numeric(12, 2) default 0                       not null,
    fecha_salida             timestamp,
    fecha_entrada            timestamp,
    creado_por               integer                                        not null,
    fecha_creacion           timestamp      default now()                   not null,
    actualizado_por          integer,
    fecha_actualizacion      timestamp,
    fecha_salida_plan        timestamp,
    fecha_entrada_plan       timestamp,
    periodo                  tsrange generated always as (tsrange(COALESCE(fecha_salida, fecha_salida_plan),
                                                                  COALESCE(fecha_entrada, fecha_entrada_plan))) stored,
    tipo_ruta                varchar(2)     default 'RL'::character varying not null
        constraint tbl_rutas_tipo_ruta_check
            check ((tipo_ruta)::text = ANY
                   (ARRAY [('RT'::character varying)::text, ('RL'::character varying)::text, ('TE'::character varying)::text, ('RC'::character varying)::text])),
    monto_total_transportado numeric(18, 2) default 0,
    id_sucursal_creador      integer
        constraint tbl_rutas_id_sucursal_creador_fkey
            references usuarios.tbl_sucursales,
    genera_bpkm              boolean        default true                    not null,
    uuid                     uuid           default gen_random_uuid()       not null,
    constraint ex_camion_sin_solape
        exclude using gist (id_camion with pg_catalog.=, periodo with pg_catalog.&&),
    constraint ex_piloto_sin_solape
        exclude using gist (id_piloto with pg_catalog.=, periodo with pg_catalog.&&),
    constraint ex_auxiliar_sin_solape
        exclude using gist (id_auxiliar with pg_catalog.=, periodo with pg_catalog.&&),
    constraint ck_rutas_plan_completo
        check (((fecha_salida_plan IS NULL) AND (fecha_entrada_plan IS NULL)) OR
               ((fecha_salida_plan IS NOT NULL) AND (fecha_entrada_plan IS NOT NULL) AND
                (fecha_entrada_plan >= fecha_salida_plan))),
    constraint ck_rutas_fechas_coherentes
        check ((fecha_entrada IS NULL) OR (fecha_salida IS NULL) OR (fecha_entrada >= fecha_salida)),
    constraint ck_rutas_tipo_validacion
        check ((((tipo_ruta)::text = 'RT'::text) AND (id_camion IS NOT NULL) AND (id_piloto IS NOT NULL)) OR
               (((tipo_ruta)::text = 'RL'::text) AND (id_camion IS NOT NULL) AND (id_piloto IS NOT NULL)) OR
               (((tipo_ruta)::text = 'TE'::text) AND (id_transporte_externo IS NOT NULL)) OR
               (((tipo_ruta)::text = 'RC'::text) AND (id_camion IS NOT NULL) AND (id_piloto IS NOT NULL)))
);

comment on column bpkm.tbl_rutas.tipo_ruta is 'Tipo de ruta: RT = Camión propio (Ruta), TE = Transporte externo';

alter table bpkm.tbl_rutas
    owner to antillonuser;

create index if not exists ix_rutas_estado
    on bpkm.tbl_rutas (id_estado_ruta);

create index if not exists ix_rutas_fechas
    on bpkm.tbl_rutas (fecha_salida, fecha_entrada);

create index if not exists ix_rutas_camion
    on bpkm.tbl_rutas (id_camion);

create index if not exists ix_rutas_piloto
    on bpkm.tbl_rutas (id_piloto);

create index if not exists ix_rutas_auxiliar
    on bpkm.tbl_rutas (id_auxiliar);

create index if not exists ix_rutas_tipo
    on bpkm.tbl_rutas (tipo_ruta);

create index if not exists ix_rutas_monto_total_transportado
    on bpkm.tbl_rutas (monto_total_transportado);

create index if not exists ix_rutas_sucursal_creador
    on bpkm.tbl_rutas (id_sucursal_creador)
    where (id_sucursal_creador IS NOT NULL);

create unique index if not exists idx_rutas_uuid
    on bpkm.tbl_rutas (uuid);

create table if not exists bpkm.tbl_bpkm
(
    id_bpkm                  integer generated always as identity
        constraint tbl_bpkm_pkey
            primary key,
    id_ruta                  integer                 not null
        constraint ux_bpkm_ruta
            unique
        constraint tbl_bpkm_id_ruta_fkey
            references bpkm.tbl_rutas,
    id_estado_bpkm           integer                 not null
        constraint tbl_bpkm_id_estado_bpkm_fkey
            references bpkm.tbl_estado_bpkm,
    cumplimiento             varchar
        constraint ck_bpkm_cumpl
            check ((cumplimiento IS NULL) OR ((cumplimiento)::text = ANY
                                              ((ARRAY ['T'::character varying, 'P'::character varying, 'F'::character varying])::text[]))),
    observaciones            varchar,
    km_punto_lejano          integer,
    monto_logrado            numeric(12, 2),
    monto_piloto             numeric(10, 2),
    monto_auxiliar           numeric(10, 2),
    fecha_rrhh               timestamp,
    usuario_rrhh             integer,
    creado_por               integer                 not null,
    fecha_creacion           timestamp default now() not null,
    actualizado_por          integer,
    fecha_actualizacion      timestamp,
    id_municipio_lejano      integer
        constraint tbl_bpkm_id_municipio_lejano_fkey
            references catalogos.tbl_municipios,
    distancia_mas_lejana     numeric(8, 2),
    monto_sugerido_piloto    numeric(12, 2),
    monto_sugerido_auxiliar  numeric(12, 2),
    monto_aprobado_piloto    numeric(12, 2),
    monto_aprobado_auxiliar  numeric(12, 2),
    monto_total_transportado numeric(18, 2),
    observaciones_gerencia   varchar,
    usuario_gerencia         integer
        constraint tbl_bpkm_usuario_gerencia_fkey
            references usuarios.tbl_usuarios,
    fecha_aprobacion         timestamp,
    distancia_anterior       numeric(8, 2)
);

alter table bpkm.tbl_bpkm
    owner to antillonuser;

create index if not exists ix_bpkm_ruta
    on bpkm.tbl_bpkm (id_ruta);

create index if not exists ix_bpkm_estado
    on bpkm.tbl_bpkm (id_estado_bpkm);

create table if not exists bpkm.tbl_monitoreo_bpkm
(
    id_monitoreo_bpkm integer generated always as identity
        constraint tbl_monitoreo_bpkm_pkey
            primary key,
    id_ruta           integer                 not null
        constraint tbl_monitoreo_bpkm_id_ruta_fkey
            references bpkm.tbl_rutas,
    id_usuario        integer                 not null
        constraint tbl_monitoreo_bpkm_id_usuario_fkey
            references usuarios.tbl_usuarios,
    tipo              varchar                 not null
        constraint ck_mon_bpkm_tipo
            check ((tipo)::text = ANY ((ARRAY ['S'::character varying, 'E'::character varying])::text[])),
    fecha_hora        timestamp               not null,
    comentario        varchar,
    fecha_creacion    timestamp default now() not null
);

alter table bpkm.tbl_monitoreo_bpkm
    owner to antillonuser;

create unique index if not exists ux_mon_bpkm_ruta_tipo
    on bpkm.tbl_monitoreo_bpkm (id_ruta, tipo);

create index if not exists ix_mon_bpkm_usuario
    on bpkm.tbl_monitoreo_bpkm (id_usuario);

create index if not exists ix_mon_bpkm_fecha
    on bpkm.tbl_monitoreo_bpkm (fecha_hora);

create table if not exists bpkm.tbl_bitacora_ruta
(
    id_bitacora_ruta integer generated always as identity
        constraint tbl_bitacora_ruta_pkey
            primary key,
    id_ruta          integer                 not null
        constraint tbl_bitacora_ruta_id_ruta_fkey
            references bpkm.tbl_rutas,
    accion           varchar,
    detalle          varchar,
    creado_por       integer                 not null,
    fecha_creacion   timestamp default now() not null
);

alter table bpkm.tbl_bitacora_ruta
    owner to antillonuser;

create index if not exists ix_bitacora_ruta_ruta
    on bpkm.tbl_bitacora_ruta (id_ruta);

create table if not exists bpkm.tbl_perm_key
(
    id_perm_key         bigserial
        constraint tbl_perm_key_pkey
            primary key,
    key                 varchar(120)            not null
        constraint tbl_perm_key_key_key
            unique,
    nivel               varchar(16)             not null
        constraint tbl_perm_key_nivel_check
            check ((nivel)::text = ANY
                   ((ARRAY ['viewer'::character varying, 'editor'::character varying, 'admin'::character varying])::text[])),
    label               varchar(120)            not null,
    descripcion         varchar(400),
    estado              integer   default 1     not null
        constraint tbl_perm_key_estado_check
            check (estado = ANY (ARRAY [0, 1])),
    creado_por          integer                 not null
        constraint tbl_perm_key_creado_por_fkey
            references usuarios.tbl_usuarios
            on update cascade,
    fecha_creacion      timestamp default now() not null,
    actualizado_por     integer
        constraint tbl_perm_key_actualizado_por_fkey
            references usuarios.tbl_usuarios
            on update cascade,
    fecha_actualizacion timestamp
);

alter table bpkm.tbl_perm_key
    owner to antillonuser;

create index if not exists ix_perm_key_estado
    on bpkm.tbl_perm_key (estado);

create index if not exists ix_perm_key_nivel
    on bpkm.tbl_perm_key (nivel);

create table if not exists bpkm.tbl_permisos_usuario
(
    id_permiso_usuario  bigserial
        constraint tbl_permisos_usuario_pkey
            primary key,
    id_usuario          integer                 not null
        constraint tbl_permisos_usuario_id_usuario_fkey
            references usuarios.tbl_usuarios
            on update cascade on delete cascade,
    id_perm_key         bigint                  not null
        constraint tbl_permisos_usuario_id_perm_key_fkey
            references bpkm.tbl_perm_key
            on update cascade on delete cascade,
    estado              integer   default 1     not null
        constraint tbl_permisos_usuario_estado_check
            check (estado = ANY (ARRAY [0, 1])),
    creado_por          integer                 not null
        constraint tbl_permisos_usuario_creado_por_fkey
            references usuarios.tbl_usuarios
            on update cascade,
    fecha_creacion      timestamp default now() not null,
    actualizado_por     integer
        constraint tbl_permisos_usuario_actualizado_por_fkey
            references usuarios.tbl_usuarios
            on update cascade,
    fecha_actualizacion timestamp,
    constraint uq_perm_usuario_key
        unique (id_usuario, id_perm_key)
);

alter table bpkm.tbl_permisos_usuario
    owner to antillonuser;

create index if not exists ix_perm_usuario_estado
    on bpkm.tbl_permisos_usuario (estado);

create index if not exists ix_perm_usuario_usuario
    on bpkm.tbl_permisos_usuario (id_usuario);

create table if not exists bpkm.tbl_factura_seleccion
(
    id_factura_sel        bigserial
        constraint tbl_factura_seleccion_pkey
            primary key,
    id_factura            integer                 not null,
    folio_factura         varchar                 not null,
    id_vendedor           integer                 not null
        constraint tbl_factura_seleccion_id_vendedor_fkey
            references usuarios.tbl_usuarios,
    id_forma_entrega      integer                 not null
        constraint tbl_factura_seleccion_id_forma_entrega_fkey
            references bpkm.tbl_forma_entrega,
    id_transporte_externo integer
        constraint tbl_factura_seleccion_id_transporte_externo_fkey
            references bpkm.tbl_transporte_externo,
    id_departamento       integer
        constraint tbl_factura_seleccion_id_departamento_fkey
            references catalogos.tbl_ciudades,
    id_municipio          integer
        constraint tbl_factura_seleccion_id_municipio_fkey
            references catalogos.tbl_municipios,
    direccion_entrega     varchar,
    id_estado_sel         integer                 not null
        constraint tbl_factura_seleccion_id_estado_sel_fkey
            references bpkm.tbl_estado_bpkm,
    en_ruta               integer   default 0     not null
        constraint tbl_factura_seleccion_en_ruta_check
            check (en_ruta = ANY (ARRAY [0, 1])),
    anulada               integer   default 0     not null
        constraint tbl_factura_seleccion_anulada_check
            check (anulada = ANY (ARRAY [0, 1])),
    folio_nc              varchar,
    fecha_anulacion       timestamp,
    creado_por            integer                 not null,
    fecha_creacion        timestamp default now() not null,
    actualizado_por       integer,
    fecha_actualizacion   timestamp,
    comentario_anulacion  varchar(400),
    intentos_envio        integer   default 0     not null,
    id_sucursal_creador   integer
        constraint tbl_factura_seleccion_id_sucursal_creador_fkey
            references usuarios.tbl_sucursales
);

alter table bpkm.tbl_factura_seleccion
    owner to antillonuser;

create table if not exists bpkm.tbl_detalles_ruta
(
    id_detalle_ruta       integer generated always as identity
        constraint tbl_detalles_ruta_pkey
            primary key,
    id_ruta               integer                             not null
        constraint tbl_detalles_ruta_id_ruta_fkey
            references bpkm.tbl_rutas,
    id_estado             integer                             not null
        constraint tbl_detalles_ruta_id_estado_fkey
            references bpkm.tbl_estado_bpkm,
    direccion             varchar,
    folio_factura         varchar,
    total_factura         numeric(12, 2),
    intentos_entrega      integer   default 0                 not null,
    comentario            varchar(255),
    creado_por            integer                             not null,
    fecha_creacion        timestamp default now()             not null,
    actualizado_por       integer,
    fecha_actualizacion   timestamp,
    id_factura_sel        bigint
        constraint tbl_detalles_ruta_id_factura_sel_fkey
            references bpkm.tbl_factura_seleccion,
    id_forma_entrega_snap integer
        constraint tbl_detalles_ruta_id_forma_entrega_snap_fkey
            references bpkm.tbl_forma_entrega,
    id_transp_ext_snap    integer
        constraint tbl_detalles_ruta_id_transp_ext_snap_fkey
            references bpkm.tbl_transporte_externo,
    id_departamento_snap  integer
        constraint tbl_detalles_ruta_id_departamento_snap_fkey
            references catalogos.tbl_ciudades,
    id_municipio_snap     integer
        constraint tbl_detalles_ruta_id_municipio_snap_fkey
            references catalogos.tbl_municipios,
    direccion_snap        varchar(500),
    intento_numero        integer   default 1                 not null,
    distancia_km          numeric(8, 2),
    id_factura            integer,
    folio_nc              varchar,
    fecha_anulacion       timestamp,
    uuid                  uuid      default gen_random_uuid() not null
);

alter table bpkm.tbl_detalles_ruta
    owner to antillonuser;

create index if not exists ix_det_ruta_ruta
    on bpkm.tbl_detalles_ruta (id_ruta);

create index if not exists ix_det_ruta_estado
    on bpkm.tbl_detalles_ruta (id_estado);

create unique index if not exists idx_detalles_ruta_uuid
    on bpkm.tbl_detalles_ruta (uuid);

create unique index if not exists ux_sel_factura_unica
    on bpkm.tbl_factura_seleccion (id_factura)
    where ((anulada = 0) AND (id_estado_sel = ANY (ARRAY [34, 35])));

create index if not exists ix_sel_fecha_creacion
    on bpkm.tbl_factura_seleccion (fecha_creacion desc);

create index if not exists ix_sel_vendedor_fecha
    on bpkm.tbl_factura_seleccion (id_vendedor asc, fecha_creacion desc);

create index if not exists ix_sel_creado_por_fecha
    on bpkm.tbl_factura_seleccion (creado_por asc, fecha_creacion desc);

create index if not exists ix_sel_estado_ruta
    on bpkm.tbl_factura_seleccion (id_estado_sel, anulada, en_ruta);

create index if not exists ix_sel_folio_trgm
    on bpkm.tbl_factura_seleccion using gin (folio_factura public.gin_trgm_ops);

create unique index if not exists ux_sel_folio_nc_unq
    on bpkm.tbl_factura_seleccion (lower(btrim(folio_nc::text)))
    where ((anulada = 1) AND (folio_nc IS NOT NULL) AND (btrim((folio_nc)::text) <> ''::text));

create index if not exists ix_factura_sel_sucursal
    on bpkm.tbl_factura_seleccion (id_sucursal_creador);

create table if not exists bpkm.tbl_factura_sel_cambio
(
    id_sel_cambio             bigserial
        constraint tbl_factura_sel_cambio_pkey
            primary key,
    id_factura_sel            bigint                  not null
        constraint tbl_factura_sel_cambio_id_factura_sel_fkey
            references bpkm.tbl_factura_seleccion,
    id_solicitante            integer                 not null
        constraint tbl_factura_sel_cambio_id_solicitante_fkey
            references usuarios.tbl_usuarios,
    id_forma_anterior         integer                 not null
        constraint tbl_factura_sel_cambio_id_forma_anterior_fkey
            references bpkm.tbl_forma_entrega,
    id_forma_nueva            integer                 not null
        constraint tbl_factura_sel_cambio_id_forma_nueva_fkey
            references bpkm.tbl_forma_entrega,
    id_transporte_externo_new integer
        constraint tbl_factura_sel_cambio_id_transporte_externo_new_fkey
            references bpkm.tbl_transporte_externo,
    id_departamento_new       integer
        constraint tbl_factura_sel_cambio_id_departamento_new_fkey
            references catalogos.tbl_ciudades,
    id_municipio_new          integer
        constraint tbl_factura_sel_cambio_id_municipio_new_fkey
            references catalogos.tbl_municipios,
    direccion_new             varchar,
    id_autorizador            integer
        constraint tbl_factura_sel_cambio_id_autorizador_fkey
            references usuarios.tbl_usuarios,
    id_estado                 integer                 not null
        constraint tbl_factura_sel_cambio_id_estado_fkey
            references bpkm.tbl_estado_bpkm,
    comentario_solicitante    varchar,
    comentario_autorizador    varchar,
    creado_por                integer                 not null,
    fecha_creacion            timestamp default now() not null,
    actualizado_por           integer,
    fecha_actualizacion       timestamp
);

alter table bpkm.tbl_factura_sel_cambio
    owner to antillonuser;

create unique index if not exists ux_sel_cambio_pend
    on bpkm.tbl_factura_sel_cambio (id_factura_sel)
    where (id_estado = 38);

create table if not exists bpkm.tbl_bitacora
(
    id_bitacora    bigserial
        constraint tbl_bitacora_pkey
            primary key,
    tabla          varchar(16)             not null,
    id_registro    bigint                  not null,
    accion         varchar(32)             not null,
    detalle        varchar(400)            not null,
    creado_por     integer                 not null
        constraint tbl_bitacora_creado_por_fkey
            references usuarios.tbl_usuarios,
    fecha_creacion timestamp default now() not null
);

alter table bpkm.tbl_bitacora
    owner to antillonuser;

create index if not exists ix_bitacora_scope
    on bpkm.tbl_bitacora (tabla asc, id_registro asc, fecha_creacion desc);

create index if not exists ix_bitacora_usuario
    on bpkm.tbl_bitacora (creado_por asc, fecha_creacion desc);

create table if not exists bpkm.tbl_liquidacion_detalle
(
    id_liquidacion     bigserial
        constraint tbl_liquidacion_detalle_pkey
            primary key,
    id_detalle_ruta    bigint                  not null
        constraint tbl_liquidacion_detalle_id_detalle_ruta_fkey
            references bpkm.tbl_detalles_ruta,
    id_estado_liq      integer                 not null
        constraint tbl_liquidacion_detalle_id_estado_liq_fkey
            references bpkm.tbl_estado_bpkm,
    motivo_fallo       varchar(500),
    observaciones      varchar(500),
    fecha_hora_intento timestamp               not null,
    usuario_liquida    integer                 not null
        constraint tbl_liquidacion_detalle_usuario_liquida_fkey
            references usuarios.tbl_usuarios,
    fecha_creacion     timestamp default now() not null,
    puede_reenviar     boolean   default true  not null
);

alter table bpkm.tbl_liquidacion_detalle
    owner to antillonuser;

create index if not exists ix_liq_detalle_ruta
    on bpkm.tbl_liquidacion_detalle (id_detalle_ruta);

create table if not exists bpkm.tbl_modificacion_ruta
(
    id_modificacion_ruta      serial
        constraint tbl_modificacion_ruta_pkey
            primary key,
    id_ruta                   integer                 not null
        constraint tbl_modificacion_ruta_id_ruta_fkey
            references bpkm.tbl_rutas,
    id_solicitante            integer                 not null
        constraint tbl_modificacion_ruta_id_solicitante_fkey
            references usuarios.tbl_usuarios,
    id_forma_entrega_anterior integer
        constraint tbl_modificacion_ruta_id_forma_entrega_anterior_fkey
            references bpkm.tbl_forma_entrega,
    id_forma_entrega_nuevo    integer
        constraint tbl_modificacion_ruta_id_forma_entrega_nuevo_fkey
            references bpkm.tbl_forma_entrega,
    id_transporte_externo_new integer
        constraint tbl_modificacion_ruta_id_transporte_externo_new_fkey
            references bpkm.tbl_transporte_externo,
    id_departamento_new       integer
        constraint tbl_modificacion_ruta_id_departamento_new_fkey
            references catalogos.tbl_ciudades,
    id_municipio_new          integer
        constraint tbl_modificacion_ruta_id_municipio_new_fkey
            references catalogos.tbl_municipios,
    direccion_new             varchar,
    id_autorizador            integer
        constraint tbl_modificacion_ruta_id_autorizador_fkey
            references usuarios.tbl_usuarios,
    id_estado                 integer                 not null
        constraint tbl_modificacion_ruta_id_estado_fkey
            references bpkm.tbl_estado_bpkm,
    comentario_solicitante    varchar,
    comentario_autorizador    varchar,
    creado_por                integer                 not null,
    fecha_creacion            timestamp default now() not null,
    actualizado_por           integer,
    fecha_actualizacion       timestamp
);

alter table bpkm.tbl_modificacion_ruta
    owner to antillonuser;

create index if not exists ix_mod_ruta_ruta
    on bpkm.tbl_modificacion_ruta (id_ruta);

create index if not exists ix_mod_ruta_estado
    on bpkm.tbl_modificacion_ruta (id_estado);

create table if not exists bpkm.tbl_consecutivo_ruta
(
    anio_mes       varchar(4)              not null,
    tipo_ruta      varchar(2)              not null
        constraint tbl_consecutivo_ruta_tipo_ruta_check
            check ((tipo_ruta)::text = ANY
                   (ARRAY [('RL'::character varying)::text, ('TE'::character varying)::text, ('RC'::character varying)::text])),
    sec            integer                 not null,
    fecha_creacion timestamp default now() not null,
    constraint tbl_consecutivo_ruta_new_pkey
        primary key (anio_mes, tipo_ruta)
);

alter table bpkm.tbl_consecutivo_ruta
    owner to antillonuser;

create table if not exists bpkm.tbl_entrega_parcial_productos
(
    id_entrega_parcial_prod bigserial
        constraint tbl_entrega_parcial_productos_pkey
            primary key,
    id_liquidacion          bigint                  not null
        constraint tbl_entrega_parcial_productos_id_liquidacion_fkey
            references bpkm.tbl_liquidacion_detalle,
    codigo_producto         varchar(50)             not null,
    nombre_producto         varchar(200)            not null,
    cantidad_pedida         numeric(12, 2)          not null,
    cantidad_entregada      numeric(12, 2)          not null,
    precio_unitario         numeric(18, 6)          not null,
    monto_parcial           numeric(18, 2)          not null,
    creado_por              integer                 not null,
    fecha_creacion          timestamp default now() not null
);

alter table bpkm.tbl_entrega_parcial_productos
    owner to antillonuser;

create index if not exists ix_entrega_parcial_prod_liquidacion
    on bpkm.tbl_entrega_parcial_productos (id_liquidacion);

create table if not exists bpkm.tbl_cambio_sucursal_factura
(
    id_cambio_sucursal  bigserial
        constraint tbl_cambio_sucursal_factura_pkey
            primary key,
    id_factura_sel      bigint                  not null
        constraint tbl_cambio_sucursal_factura_id_factura_sel_fkey
            references bpkm.tbl_factura_seleccion,
    id_sucursal_origen  integer                 not null
        constraint tbl_cambio_sucursal_factura_id_sucursal_origen_fkey
            references usuarios.tbl_sucursales,
    id_sucursal_destino integer                 not null
        constraint tbl_cambio_sucursal_factura_id_sucursal_destino_fkey
            references usuarios.tbl_sucursales,
    motivo_solicitud    varchar(500)            not null,
    id_estado           integer                 not null
        constraint tbl_cambio_sucursal_factura_id_estado_fkey
            references bpkm.tbl_estado_bpkm,
    observaciones_aprob varchar(500),
    usuario_solicita    integer                 not null
        constraint tbl_cambio_sucursal_factura_usuario_solicita_fkey
            references usuarios.tbl_usuarios,
    fecha_solicitud     timestamp default now() not null,
    usuario_aprueba     integer
        constraint tbl_cambio_sucursal_factura_usuario_aprueba_fkey
            references usuarios.tbl_usuarios,
    fecha_aprobacion    timestamp,
    creado_por          integer                 not null,
    fecha_creacion      timestamp default now() not null,
    actualizado_por     integer,
    fecha_actualizacion timestamp
);

alter table bpkm.tbl_cambio_sucursal_factura
    owner to antillonuser;

create index if not exists ix_cambio_sucursal_factura
    on bpkm.tbl_cambio_sucursal_factura (id_factura_sel);

create index if not exists ix_cambio_sucursal_estado
    on bpkm.tbl_cambio_sucursal_factura (id_estado);

create table if not exists bpkm.tbl_comentarios_ruta
(
    id_comentario  bigserial
        constraint tbl_comentarios_ruta_pkey
            primary key,
    id_ruta        bigint                  not null
        constraint tbl_comentarios_ruta_id_ruta_fkey
            references bpkm.tbl_rutas
            on delete cascade,
    comentario     text                    not null
        constraint chk_comentario_no_vacio
            check (length(TRIM(BOTH FROM comentario)) > 0),
    id_usuario     integer                 not null
        constraint tbl_comentarios_ruta_id_usuario_fkey
            references usuarios.tbl_usuarios,
    fecha_creacion timestamp default now() not null,
    estado         integer   default 1     not null
);

alter table bpkm.tbl_comentarios_ruta
    owner to antillonuser;

create index if not exists idx_comentarios_ruta_id_ruta
    on bpkm.tbl_comentarios_ruta (id_ruta);

create index if not exists idx_comentarios_ruta_fecha
    on bpkm.tbl_comentarios_ruta (fecha_creacion desc);

create table if not exists bpkm.tbl_asignacion_usuario_vendedor
(
    id_asignacion       serial
        constraint tbl_asignacion_usuario_vendedor_pkey
            primary key,
    id_usuario          integer                 not null
        constraint tbl_asignacion_usuario_vendedor_id_usuario_fkey
            references usuarios.tbl_usuarios,
    id_vendedor         integer                 not null
        constraint tbl_asignacion_usuario_vendedor_id_vendedor_fkey
            references ndc.tbl_cat_vendedores,
    activo              boolean   default true  not null,
    creado_por          integer
        constraint tbl_asignacion_usuario_vendedor_creado_por_fkey
            references usuarios.tbl_usuarios,
    fecha_creacion      timestamp default now() not null,
    activo_cxc          boolean   default false not null,
    actualizado_por     integer
        constraint fk_asig_usuario_vendedor_actualizado_por
            references usuarios.tbl_usuarios,
    fecha_actualizacion timestamp,
    constraint uq_asig_usuario_vendedor
        unique (id_usuario, id_vendedor)
);

alter table bpkm.tbl_asignacion_usuario_vendedor
    owner to antillonuser;

create index if not exists ix_asig_usuario_vendedor
    on bpkm.tbl_asignacion_usuario_vendedor (id_usuario)
    where (activo = true);

create index if not exists ix_asig_usuario_vendedor_cxc
    on bpkm.tbl_asignacion_usuario_vendedor (id_usuario)
    where ((activo = true) AND (activo_cxc = true));

create table if not exists bpkm.tbl_entregas_piloto
(
    id_entrega_piloto bigserial
        constraint tbl_entregas_piloto_pkey
            primary key,
    uuid              uuid      default gen_random_uuid() not null,
    id_detalle_ruta   integer                             not null
        constraint uq_entregas_piloto_detalle_ruta
            unique
        constraint fk_entrega_piloto_detalle_ruta
            references bpkm.tbl_detalles_ruta,
    resultado         varchar(10)                         not null
        constraint ck_entrega_piloto_resultado
            check ((resultado)::text = ANY
                   ((ARRAY ['ENT'::character varying, 'PARC'::character varying, 'FALL'::character varying])::text[])),
    id_usuario        integer                             not null
        constraint fk_entrega_piloto_usuario
            references usuarios.tbl_usuarios,
    fecha_hora        timestamp                           not null,
    creado_por        integer                             not null
        constraint fk_entrega_piloto_creado_por
            references usuarios.tbl_usuarios,
    fecha_creacion    timestamp default now()             not null,
    motivo            varchar(500)
);

alter table bpkm.tbl_entregas_piloto
    owner to antillonuser;

create unique index if not exists idx_entregas_piloto_uuid
    on bpkm.tbl_entregas_piloto (uuid);

create index if not exists idx_entregas_piloto_detalle_ruta
    on bpkm.tbl_entregas_piloto (id_detalle_ruta);

create index if not exists idx_entregas_piloto_usuario
    on bpkm.tbl_entregas_piloto (id_usuario);

create table if not exists bpkm.tbl_evidencia_entrega
(
    id_evidencia      bigserial
        constraint tbl_evidencia_entrega_pkey
            primary key,
    uuid              uuid      default gen_random_uuid() not null,
    id_entrega_piloto bigint                              not null
        constraint fk_evidencia_entrega_piloto
            references bpkm.tbl_entregas_piloto,
    ruta_archivo      varchar(500)                        not null,
    latitud           numeric(10, 7),
    longitud          numeric(10, 7),
    precision_metros  numeric(8, 2),
    fecha_captura     timestamp                           not null,
    creado_por        integer                             not null
        constraint fk_evidencia_creado_por
            references usuarios.tbl_usuarios,
    fecha_creacion    timestamp default now()             not null
);

alter table bpkm.tbl_evidencia_entrega
    owner to antillonuser;

create unique index if not exists idx_evidencia_entrega_uuid
    on bpkm.tbl_evidencia_entrega (uuid);

create index if not exists idx_evidencia_entrega_piloto
    on bpkm.tbl_evidencia_entrega (id_entrega_piloto);

create table if not exists bpkm.tbl_distancias_ruta
(
    id_distancia_ruta bigserial
        constraint tbl_distancias_ruta_pkey
            primary key,
    id_detalle_ruta   integer                 not null
        constraint uq_distancias_ruta_detalle_ruta
            unique
        constraint fk_distancia_ruta_detalle_ruta
            references bpkm.tbl_detalles_ruta,
    distancia_km      numeric(8, 2),
    estado_calculo    varchar(10)             not null
        constraint ck_distancia_ruta_estado_calculo
            check ((estado_calculo)::text = ANY
                   ((ARRAY ['OK'::character varying, 'ERROR'::character varying])::text[])),
    mensaje_error     varchar(500),
    fecha_calculo     timestamp               not null,
    creado_por        integer
        constraint fk_distancia_ruta_creado_por
            references usuarios.tbl_usuarios,
    fecha_creacion    timestamp default now() not null,
    intentos          integer   default 0     not null
);

alter table bpkm.tbl_distancias_ruta
    owner to antillonuser;

create index if not exists idx_distancias_ruta_detalle_ruta
    on bpkm.tbl_distancias_ruta (id_detalle_ruta);

create or replace view bpkm.v_rutas_resumen
            (id_ruta, numero_ruta, tipo_ruta, genera_bpkm, estado_ruta, estado_ruta_codigo, fecha_salida_plan,
             fecha_entrada_plan, fecha_salida, fecha_entrada, sucursal_salida, nombre_piloto, nombre_auxiliar,
             placa_camion, nombre_transporte_externo, total_facturas, facturas_entregadas, facturas_parciales,
             facturas_fallidas, facturas_vigentes, monto_transportado, monto_entregado, porcentaje_entrega,
             cumplimiento, distancia_max_km, municipio_mas_lejano, fecha_creacion)
as
SELECT r.id_ruta,
       r.numero_ruta,
       r.tipo_ruta,
       r.genera_bpkm,
       e.nombre                                                                                                           AS estado_ruta,
       e.codigo                                                                                                           AS estado_ruta_codigo,
       r.fecha_salida_plan,
       r.fecha_entrada_plan,
       r.fecha_salida,
       r.fecha_entrada,
       s.nombre                                                                                                           AS sucursal_salida,
       p.nombre                                                                                                           AS nombre_piloto,
       a.nombre                                                                                                           AS nombre_auxiliar,
       c.placa                                                                                                            AS placa_camion,
       te.nombre                                                                                                          AS nombre_transporte_externo,
       count(dr.id_detalle_ruta)                                                                                          AS total_facturas,
       count(dr.id_detalle_ruta)
       FILTER (WHERE ed.codigo::text = 'ENT'::text)                                                                       AS facturas_entregadas,
       count(dr.id_detalle_ruta)
       FILTER (WHERE ed.codigo::text = 'PARC'::text)                                                                      AS facturas_parciales,
       count(dr.id_detalle_ruta)
       FILTER (WHERE ed.codigo::text = 'FALL'::text)                                                                      AS facturas_fallidas,
       count(dr.id_detalle_ruta) FILTER (WHERE ed.codigo::text <> ALL
                                               (ARRAY ['ANULADO'::character varying, 'ANUL'::character varying]::text[])) AS facturas_vigentes,
       montos.monto_transportado,
       montos.monto_entregado,
       CASE
           WHEN montos.monto_transportado = 0::numeric THEN 0::numeric
           ELSE round(montos.monto_entregado / montos.monto_transportado * 100::numeric, 2)
           END                                                                                                            AS porcentaje_entrega,
       CASE
           WHEN count(dr.id_detalle_ruta) FILTER (WHERE ed.codigo::text <> ALL
                                                        (ARRAY ['ANULADO'::character varying, 'ANUL'::character varying]::text[])) =
                0 THEN NULL::text
           WHEN count(dr.id_detalle_ruta) FILTER (WHERE ed.codigo::text = 'ENT'::text) = count(dr.id_detalle_ruta)
                                                                                         FILTER (WHERE
                                                                                             ed.codigo::text <> ALL
                                                                                             (ARRAY ['ANULADO'::character varying, 'ANUL'::character varying]::text[]))
               THEN 'T'::text
           WHEN count(dr.id_detalle_ruta) FILTER (WHERE ed.codigo::text = 'FALL'::text) = count(dr.id_detalle_ruta)
                                                                                          FILTER (WHERE
                                                                                              ed.codigo::text <> ALL
                                                                                              (ARRAY ['ANULADO'::character varying, 'ANUL'::character varying]::text[]))
               THEN 'F'::text
           ELSE 'P'::text
           END::character varying                                                                                         AS cumplimiento,
       lejano.distancia_km                                                                                                AS distancia_max_km,
       lejano.municipio_nombre                                                                                            AS municipio_mas_lejano,
       r.fecha_creacion
FROM bpkm.tbl_rutas r
         JOIN bpkm.tbl_estado_bpkm e ON e.id_estado_bpkm = r.id_estado_ruta
         LEFT JOIN bpkm.tbl_personal p ON p.id_personal = r.id_piloto
         LEFT JOIN bpkm.tbl_personal a ON a.id_personal = r.id_auxiliar
         LEFT JOIN bpkm.tbl_camiones c ON c.id_camion = r.id_camion
         LEFT JOIN bpkm.tbl_transporte_externo te ON te.id_transporte_externo = r.id_transporte_externo
         LEFT JOIN usuarios.tbl_sucursales s ON s.id_sucursal = r.id_sucursal_salida
         LEFT JOIN bpkm.tbl_detalles_ruta dr ON dr.id_ruta = r.id_ruta
         LEFT JOIN bpkm.tbl_estado_bpkm ed ON ed.id_estado_bpkm = dr.id_estado
         LEFT JOIN LATERAL ( SELECT m2.nombre AS municipio_nombre,
                                    CASE
                                        WHEN r.id_sucursal_salida = ANY (ARRAY [14, 15, 16])
                                            THEN m2.distancia_desde_xela
                                        ELSE dr2.distancia_km
                                        END   AS distancia_km
                             FROM bpkm.tbl_detalles_ruta dr2
                                      JOIN bpkm.tbl_estado_bpkm ed2 ON ed2.id_estado_bpkm = dr2.id_estado
                                      JOIN catalogos.tbl_municipios m2 ON m2.id_municipio = dr2.id_municipio_snap
                             WHERE dr2.id_ruta = r.id_ruta
                               AND ed2.codigo::text = 'ENT'::text
                             ORDER BY (
                                          CASE
                                              WHEN r.id_sucursal_salida = ANY (ARRAY [14, 15, 16])
                                                  THEN m2.distancia_desde_xela
                                              ELSE dr2.distancia_km
                                              END) DESC NULLS LAST
                             LIMIT 1) lejano ON true
         LEFT JOIN LATERAL ( SELECT COALESCE(sum(f.doc_total) FILTER (WHERE edm.codigo::text <> ALL
                                                                            (ARRAY ['ANULADO'::character varying, 'ANUL'::character varying]::text[])),
                                             0::numeric) AS monto_transportado,
                                    COALESCE(sum(f.doc_total) FILTER (WHERE edm.codigo::text = ANY
                                                                            (ARRAY ['ENT'::character varying, 'PARC'::character varying]::text[])),
                                             0::numeric) AS monto_entregado
                             FROM bpkm.tbl_detalles_ruta drm
                                      JOIN bpkm.tbl_estado_bpkm edm ON edm.id_estado_bpkm = drm.id_estado
                                      JOIN bpkm.tbl_factura_seleccion fsm ON fsm.id_factura_sel = drm.id_factura_sel
                                      JOIN ndc.tbl_cat_facturas f ON f.id = fsm.id_factura
                             WHERE drm.id_ruta = r.id_ruta) montos ON true
GROUP BY r.id_ruta, r.numero_ruta, r.tipo_ruta, r.genera_bpkm, e.nombre, e.codigo, r.fecha_salida_plan,
         r.fecha_entrada_plan, r.fecha_salida, r.fecha_entrada, s.nombre, p.nombre, a.nombre, c.placa, te.nombre,
         montos.monto_transportado, montos.monto_entregado, lejano.distancia_km, lejano.municipio_nombre,
         r.fecha_creacion;

alter table bpkm.v_rutas_resumen
    owner to antillonuser;

create or replace view bpkm.v_bolson_facturas
            (sucursal, folio_factura, forma_entrega, nombre_cliente, fecha_factura, direccion_entrega, direccion,
             transporte_externo, vendedor, total)
as
WITH estado_sel_act AS (SELECT tbl_estado_bpkm.id_estado_bpkm
                        FROM bpkm.tbl_estado_bpkm
                        WHERE tbl_estado_bpkm.tabla::text = 'SEL'::text
                          AND tbl_estado_bpkm.codigo::text = 'ACT'::text
                          AND tbl_estado_bpkm.estado = 1)
SELECT ts.nombre                                                        AS sucursal,
       fs.folio_factura,
       fe.nombre                                                        AS forma_entrega,
       fac.card_name                                                    AS nombre_cliente,
       to_char(fac.fecha::timestamp with time zone, 'DD/MM/YYYY'::text) AS fecha_factura,
       fs.direccion_entrega,
       (c.nombre::text || ', '::text) || m.nombre::text                 AS direccion,
       te.nombre                                                        AS transporte_externo,
       tcv.nombre                                                       AS vendedor,
       round(fac.doc_total, 2)                                          AS total
FROM bpkm.tbl_factura_seleccion fs
         JOIN estado_sel_act esa ON fs.id_estado_sel = esa.id_estado_bpkm
         LEFT JOIN bpkm.tbl_estado_bpkm e ON e.id_estado_bpkm = fs.id_estado_sel
         LEFT JOIN bpkm.tbl_forma_entrega fe ON fe.id_forma_entrega = fs.id_forma_entrega
         LEFT JOIN catalogos.tbl_municipios m ON m.id_municipio = fs.id_municipio
         LEFT JOIN catalogos.tbl_ciudades c ON m.id_ciudad = c.id_ciudad
         LEFT JOIN ndc.tbl_cat_facturas fac ON fs.id_factura = fac.id
         LEFT JOIN ndc.tbl_cat_vendedores tcv ON tcv.id = fac.vendedor_id
         LEFT JOIN bpkm.tbl_transporte_externo te ON te.id_transporte_externo = fs.id_transporte_externo
         LEFT JOIN usuarios.tbl_sucursales ts ON ts.id_sucursal = fs.id_sucursal_creador
WHERE fs.anulada = 0
  AND fs.en_ruta = 0
  AND (fe.codigo IS NULL OR fe.codigo::text = 'EXT'::text AND fs.id_transporte_externo IS NOT NULL OR
       fe.codigo::text = 'CAM'::text AND fs.id_transporte_externo IS NULL OR
       fe.codigo::text = 'LOCAL'::text AND fs.id_transporte_externo IS NULL)
  AND NOT (EXISTS (SELECT 1
                   FROM bpkm.tbl_detalles_ruta dr
                            JOIN bpkm.tbl_liquidacion_detalle ld ON ld.id_detalle_ruta = dr.id_detalle_ruta
                   WHERE dr.id_factura_sel = fs.id_factura_sel
                     AND ld.puede_reenviar = false))
  AND NOT (EXISTS (SELECT 1
                   FROM bpkm.tbl_cambio_sucursal_factura csf
                            JOIN bpkm.tbl_estado_bpkm ecs ON ecs.id_estado_bpkm = csf.id_estado
                   WHERE csf.id_factura_sel = fs.id_factura_sel
                     AND ecs.codigo::text = 'PEND'::text))
  AND NOT (EXISTS (SELECT 1
                   FROM bpkm.tbl_factura_sel_cambio fsc
                            JOIN bpkm.tbl_estado_bpkm esc ON esc.id_estado_bpkm = fsc.id_estado
                   WHERE fsc.id_factura_sel = fs.id_factura_sel
                     AND esc.codigo::text = 'PEND'::text))
ORDER BY fac.fecha;

alter table bpkm.v_bolson_facturas
    owner to antillonuser;

create or replace view bpkm.v_rutas_locales(ruta, fecha_salida, hora_salida, placa, piloto) as
SELECT tr.numero_ruta                                    AS ruta,
       to_char(tr.fecha_salida_plan, 'DD/MM/YYYY'::text) AS fecha_salida,
       to_char(tr.fecha_salida_plan, 'HH24:MI'::text)    AS hora_salida,
       tc.placa,
       tp.nombre                                         AS piloto
FROM bpkm.tbl_rutas tr
         LEFT JOIN bpkm.tbl_personal tp ON tr.id_piloto = tp.id_personal
         LEFT JOIN bpkm.tbl_camiones tc ON tr.id_camion = tc.id_camion
         LEFT JOIN bpkm.tbl_estado_bpkm teb ON tr.id_estado_ruta = teb.id_estado_bpkm
WHERE tr.tipo_ruta::text = 'RC'::text
ORDER BY tr.id_ruta DESC
LIMIT 500;

alter table bpkm.v_rutas_locales
    owner to antillonuser;

create or replace view bpkm.v_facturas_entregadas(sucursal, tipo, factura, f_factura, f_registro, f_liquidacion, dias) as
SELECT ts.nombre                                                                 AS sucursal,
       tr.tipo_ruta                                                              AS tipo,
       tfs.folio_factura                                                         AS factura,
       to_char(tcf.fecha::timestamp with time zone, 'DD/MM/YYYY'::text)          AS f_factura,
       to_char(tfs.fecha_creacion::timestamp with time zone, 'DD/MM/YYYY'::text) AS f_registro,
       to_char(tld.fecha_creacion, 'DD/MM/YYYY'::text)                           AS f_liquidacion,
       tld.fecha_creacion::date - tcf.fecha                                      AS dias
FROM bpkm.tbl_detalles_ruta tdr
         LEFT JOIN bpkm.tbl_rutas tr ON tdr.id_ruta = tr.id_ruta
         LEFT JOIN bpkm.tbl_factura_seleccion tfs ON tdr.id_factura_sel = tfs.id_factura_sel
         LEFT JOIN ndc.tbl_cat_facturas tcf ON tcf.id = tfs.id_factura
         LEFT JOIN bpkm.tbl_liquidacion_detalle tld ON tdr.id_detalle_ruta = tld.id_detalle_ruta
         LEFT JOIN usuarios.tbl_sucursales ts ON tr.id_sucursal_salida = ts.id_sucursal
WHERE (tr.tipo_ruta::text = ANY (ARRAY ['RC'::character varying::text, 'RL'::character varying::text]))
  AND tdr.id_estado = 8
  AND (CURRENT_DATE - tcf.fecha) < 30
ORDER BY tld.fecha_creacion DESC;

alter table bpkm.v_facturas_entregadas
    owner to antillonuser;

create or replace view bpkm.v_montos_departamento(departamento, municipio, en, feb, mar, abr, may, jun, jul, ago) as
SELECT tc.nombre        AS departamento,
       tm.nombre        AS municipio,
       sum(
               CASE
                   WHEN EXTRACT(month FROM tr.fecha_salida_plan) = 1::numeric THEN tcf.doc_total
                   ELSE 0::numeric
                   END) AS en,
       sum(
               CASE
                   WHEN EXTRACT(month FROM tr.fecha_salida_plan) = 2::numeric THEN tcf.doc_total
                   ELSE 0::numeric
                   END) AS feb,
       sum(
               CASE
                   WHEN EXTRACT(month FROM tr.fecha_salida_plan) = 3::numeric THEN tcf.doc_total
                   ELSE 0::numeric
                   END) AS mar,
       sum(
               CASE
                   WHEN EXTRACT(month FROM tr.fecha_salida_plan) = 4::numeric THEN tcf.doc_total
                   ELSE 0::numeric
                   END) AS abr,
       sum(
               CASE
                   WHEN EXTRACT(month FROM tr.fecha_salida_plan) = 5::numeric THEN tcf.doc_total
                   ELSE 0::numeric
                   END) AS may,
       sum(
               CASE
                   WHEN EXTRACT(month FROM tr.fecha_salida_plan) = 6::numeric THEN tcf.doc_total
                   ELSE 0::numeric
                   END) AS jun,
       sum(
               CASE
                   WHEN EXTRACT(month FROM tr.fecha_salida_plan) = 7::numeric THEN tcf.doc_total
                   ELSE 0::numeric
                   END) AS jul,
       sum(
               CASE
                   WHEN EXTRACT(month FROM tr.fecha_salida_plan) = 8::numeric THEN tcf.doc_total
                   ELSE 0::numeric
                   END) AS ago
FROM bpkm.tbl_rutas tr
         JOIN bpkm.tbl_detalles_ruta tdr ON tr.id_ruta = tdr.id_ruta
         JOIN bpkm.tbl_liquidacion_detalle tld ON tdr.id_detalle_ruta = tld.id_detalle_ruta
         JOIN bpkm.tbl_factura_seleccion tfs ON tdr.id_factura_sel = tfs.id_factura_sel
         JOIN ndc.tbl_cat_facturas tcf ON tfs.id_factura = tcf.id
         JOIN catalogos.tbl_ciudades tc ON tdr.id_departamento_snap = tc.id_ciudad
         JOIN catalogos.tbl_municipios tm ON tdr.id_municipio_snap = tm.id_municipio
WHERE (tr.tipo_ruta::text = ANY
       (ARRAY ['RC'::character varying, 'RT'::character varying, 'RL'::character varying]::text[]))
  AND tr.id_estado_ruta = 21
  AND tdr.id_estado = 8
  AND tld.id_estado_liq = 42
  AND EXTRACT(year FROM tr.fecha_salida_plan) = EXTRACT(year FROM CURRENT_DATE)
GROUP BY tc.nombre, tm.nombre
ORDER BY tc.nombre, tm.nombre;

alter table bpkm.v_montos_departamento
    owner to antillonuser;

create or replace view bpkm.v_rutas_activas_montos_departamento(sucursal, numero_ruta, departamento, municipio, monto) as
SELECT ts.nombre          AS sucursal,
       tr.numero_ruta,
       tc.nombre          AS departamento,
       tm.nombre          AS municipio,
       sum(tcf.doc_total) AS monto
FROM bpkm.tbl_rutas tr
         LEFT JOIN bpkm.tbl_detalles_ruta tdr ON tr.id_ruta = tdr.id_ruta
         LEFT JOIN bpkm.tbl_factura_seleccion tfs ON tdr.id_factura_sel = tfs.id_factura_sel
         LEFT JOIN ndc.tbl_cat_facturas tcf ON tfs.id_factura = tcf.id
         LEFT JOIN catalogos.tbl_ciudades tc ON tdr.id_departamento_snap = tc.id_ciudad
         LEFT JOIN catalogos.tbl_municipios tm ON tdr.id_municipio_snap = tm.id_municipio
         LEFT JOIN usuarios.tbl_sucursales ts ON tr.id_sucursal_creador = ts.id_sucursal
WHERE tr.id_estado_ruta = 3
  AND tr.tipo_ruta::text <> 'TE'::text
GROUP BY ts.nombre, tr.numero_ruta, tc.nombre, tm.nombre
ORDER BY ts.nombre, tr.numero_ruta, tc.nombre, tm.nombre;

alter table bpkm.v_rutas_activas_montos_departamento
    owner to antillonuser;

create or replace view bpkm.v_bolson_facturas_montos(sucursal, departamento, municipio, monto) as
WITH estado_sel_act AS (SELECT tbl_estado_bpkm.id_estado_bpkm
                        FROM bpkm.tbl_estado_bpkm
                        WHERE tbl_estado_bpkm.tabla::text = 'SEL'::text
                          AND tbl_estado_bpkm.codigo::text = 'ACT'::text
                          AND tbl_estado_bpkm.estado = 1)
SELECT ts.nombre          AS sucursal,
       c.nombre           AS departamento,
       m.nombre           AS municipio,
       sum(fac.doc_total) AS monto
FROM bpkm.tbl_factura_seleccion fs
         JOIN estado_sel_act esa ON fs.id_estado_sel = esa.id_estado_bpkm
         LEFT JOIN bpkm.tbl_estado_bpkm e ON e.id_estado_bpkm = fs.id_estado_sel
         LEFT JOIN bpkm.tbl_forma_entrega fe ON fe.id_forma_entrega = fs.id_forma_entrega
         LEFT JOIN catalogos.tbl_municipios m ON m.id_municipio = fs.id_municipio
         LEFT JOIN catalogos.tbl_ciudades c ON m.id_ciudad = c.id_ciudad
         LEFT JOIN ndc.tbl_cat_facturas fac ON fs.id_factura = fac.id
         LEFT JOIN bpkm.tbl_transporte_externo te ON te.id_transporte_externo = fs.id_transporte_externo
         LEFT JOIN usuarios.tbl_sucursales ts ON ts.id_sucursal = fs.id_sucursal_creador
WHERE fs.anulada = 0
  AND fs.en_ruta = 0
  AND (fe.codigo::text = ANY (ARRAY ['CAM'::character varying, 'LOCAL'::character varying]::text[]))
  AND NOT (EXISTS (SELECT 1
                   FROM bpkm.tbl_detalles_ruta dr
                            JOIN bpkm.tbl_liquidacion_detalle ld ON ld.id_detalle_ruta = dr.id_detalle_ruta
                   WHERE dr.id_factura_sel = fs.id_factura_sel
                     AND ld.puede_reenviar = false))
  AND NOT (EXISTS (SELECT 1
                   FROM bpkm.tbl_cambio_sucursal_factura csf
                            JOIN bpkm.tbl_estado_bpkm ecs ON ecs.id_estado_bpkm = csf.id_estado
                   WHERE csf.id_factura_sel = fs.id_factura_sel
                     AND ecs.codigo::text = 'PEND'::text))
  AND NOT (EXISTS (SELECT 1
                   FROM bpkm.tbl_factura_sel_cambio fsc
                            JOIN bpkm.tbl_estado_bpkm esc ON esc.id_estado_bpkm = fsc.id_estado
                   WHERE fsc.id_factura_sel = fs.id_factura_sel
                     AND esc.codigo::text = 'PEND'::text))
GROUP BY ts.nombre, c.nombre, m.nombre
ORDER BY ts.nombre, c.nombre, m.nombre;

alter table bpkm.v_bolson_facturas_montos
    owner to antillonuser;

create or replace function bpkm._estado_id(p_tabla character varying, p_codigo character varying) returns integer
    language plpgsql
as
$$
DECLARE v_id INTEGER;
BEGIN
  SELECT id_estado_bpkm INTO v_id
  FROM bpkm.tbl_estado_bpkm
  WHERE tabla = p_tabla AND codigo = p_codigo AND estado=1
  LIMIT 1;

  IF v_id IS NULL THEN
    RAISE EXCEPTION 'Estado %/% no configurado', p_tabla, p_codigo;
  END IF;
  RETURN v_id;
END;
$$;

alter function bpkm._estado_id(varchar, varchar) owner to antillonuser;

create or replace function bpkm.get_formas_entrega()
    returns TABLE(int_id_forma_entrega integer, str_nombre character varying, str_codigo character varying)
    language plpgsql
as
$$
BEGIN
  RETURN QUERY
  SELECT id_forma_entrega, nombre, codigo
  FROM bpkm.tbl_forma_entrega
  WHERE estado = 1
  ORDER BY nombre;
END;
$$;

alter function bpkm.get_formas_entrega() owner to antillonuser;

create or replace function bpkm.get_estados(p_tabla character varying)
    returns TABLE(int_id_estado_bpkm integer, str_tabla character varying, str_nombre character varying, str_codigo character varying, int_orden integer)
    language plpgsql
as
$$
BEGIN
  RETURN QUERY
  SELECT id_estado_bpkm, tabla, nombre, codigo, orden
  FROM bpkm.tbl_estado_bpkm
  WHERE estado = 1
    AND (p_tabla = '' OR tabla = p_tabla)
  ORDER BY tabla, orden;
END;
$$;

alter function bpkm.get_estados(varchar) owner to antillonuser;

create or replace function bpkm.get_transportes(p_id_transporte integer, p_nombre_like character varying, p_estado integer)
    returns TABLE(int_id_transporte_externo integer, str_nombre character varying, int_estado integer)
    language plpgsql
as
$$
BEGIN
  RETURN QUERY
  SELECT id_transporte_externo, nombre, estado
  FROM bpkm.tbl_transporte_externo
  WHERE (p_id_transporte = 0 OR id_transporte_externo = p_id_transporte)
    AND (p_estado = 2 OR estado = p_estado)
    AND (p_nombre_like = '' OR nombre ILIKE p_nombre_like)
  ORDER BY nombre
  LIMIT 1000;
END;
$$;

alter function bpkm.get_transportes(integer, varchar, integer) owner to antillonuser;

create or replace function bpkm.post_transporte(p_nombre character varying, p_estado integer, p_creado_por integer)
    returns TABLE(int_id_transporte_externo integer)
    language plpgsql
as
$$
BEGIN
  INSERT INTO bpkm.tbl_transporte_externo(nombre, estado, creado_por)
  VALUES (p_nombre, COALESCE(p_estado,1), p_creado_por)
  RETURNING id_transporte_externo INTO int_id_transporte_externo;
  RETURN NEXT;
END;
$$;

alter function bpkm.post_transporte(varchar, integer, integer) owner to antillonuser;

create or replace function bpkm.put_transporte(p_id_transporte integer, p_nombre character varying, p_estado integer, p_actualizado_por integer)
    returns TABLE(int_id_transporte_externo integer)
    language plpgsql
as
$$
BEGIN
  UPDATE bpkm.tbl_transporte_externo
  SET nombre = COALESCE(p_nombre, nombre),
      estado = COALESCE(p_estado, estado),
      actualizado_por = p_actualizado_por,
      fecha_actualizacion = NOW()
  WHERE id_transporte_externo = p_id_transporte
  RETURNING id_transporte_externo INTO int_id_transporte_externo;
  RETURN NEXT;
END;
$$;

alter function bpkm.put_transporte(integer, varchar, integer, integer) owner to antillonuser;

create or replace function bpkm.put_rutas_auto_progresar(p_aplicar_regreso integer DEFAULT 1)
    returns TABLE(int_id_ruta integer, str_transicion character varying)
    language plpgsql
as
$$
DECLARE
    v_creada    INTEGER := bpkm._estado_id('RUTA', 'CREADA');
    v_en_curso  INTEGER := bpkm._estado_id('RUTA', 'EN_CURSO');
    v_regresada INTEGER := bpkm._estado_id('RUTA', 'REGRESADA');
BEGIN
    -- CREADA -> EN_CURSO
    RETURN QUERY
        UPDATE bpkm.tbl_rutas r
            SET id_estado_ruta = v_en_curso
            WHERE r.id_estado_ruta = v_creada
              AND r.fecha_salida_plan IS NOT NULL
              AND r.fecha_salida_plan <= NOW()
            RETURNING r.id_ruta, 'CREADA -> EN_CURSO'::CHARACTER VARYING;

    -- Si p_aplicar_regreso=1: EN_CURSO -> REGRESADA
    IF p_aplicar_regreso = 1 THEN
        RETURN QUERY
            UPDATE bpkm.tbl_rutas r
                SET id_estado_ruta = v_regresada
                WHERE r.id_estado_ruta = v_en_curso
                  AND r.fecha_entrada_plan IS NOT NULL
                  AND r.fecha_entrada_plan <= NOW()
                RETURNING r.id_ruta, 'EN_CURSO -> REGRESADA'::CHARACTER VARYING;
    END IF;
END;
$$;

alter function bpkm.put_rutas_auto_progresar(integer) owner to antillonuser;

create or replace function bpkm.put_ruta_auto_progresar_uno(p_id_ruta integer, p_aplicar_regreso integer DEFAULT 1)
    returns TABLE(int_id_ruta integer, str_transicion character varying)
    language plpgsql
as
$$

DECLARE
  v_creada    INTEGER := bpkm._estado_id('RUTA','CREADA');
  v_en_curso  INTEGER := bpkm._estado_id('RUTA','EN_CURSO');
  v_regresada INTEGER := bpkm._estado_id('RUTA','REGRESADA');
  v_estado    INTEGER; v_hizo BOOLEAN := FALSE;
BEGIN
  -- CORREGIDO: id_estado_ruta
  SELECT id_estado_ruta INTO v_estado FROM bpkm.tbl_rutas WHERE id_ruta = p_id_ruta;

  IF v_estado = v_creada THEN
    UPDATE bpkm.tbl_rutas
    SET id_estado_ruta = v_en_curso,
        fecha_salida = COALESCE(fecha_salida, NOW()),
        fecha_actualizacion = NOW()
    WHERE id_ruta = p_id_ruta
      AND fecha_salida_plan IS NOT NULL
      AND fecha_salida_plan <= NOW();
    IF FOUND THEN
      PERFORM bpkm.post_bitacora_ruta(p_id_ruta, 'AUTO', 'Ruta CREADA → EN_CURSO por plan', 0);
      int_id_ruta := p_id_ruta; str_transicion := 'CREADA->EN_CURSO'; v_hizo := TRUE; RETURN NEXT;
    END IF;
  END IF;

  IF p_aplicar_regreso = 1 THEN
    -- CORREGIDO: id_estado_ruta
    SELECT id_estado_ruta INTO v_estado FROM bpkm.tbl_rutas WHERE id_ruta = p_id_ruta;
    IF v_estado = v_en_curso THEN
      UPDATE bpkm.tbl_rutas
      SET id_estado_ruta = v_regresada,
          fecha_entrada = COALESCE(fecha_entrada, NOW()),
          fecha_actualizacion = NOW()
      WHERE id_ruta = p_id_ruta
        AND fecha_entrada_plan IS NOT NULL
        AND fecha_entrada_plan <= NOW();
      IF FOUND THEN
        PERFORM bpkm.post_bitacora_ruta(p_id_ruta, 'AUTO', 'Ruta EN_CURSO → REGRESADA por plan', 0);
        int_id_ruta := p_id_ruta; str_transicion := 'EN_CURSO->REGRESADA'; v_hizo := TRUE; RETURN NEXT;
      END IF;
    END IF;
  END IF;

  IF NOT v_hizo THEN
    -- no hubo transición; devolver N/A opcionalmente
    -- int_id_ruta := p_id_ruta; str_transicion := 'SIN_CAMBIO'; RETURN NEXT;
    RETURN;
  END IF;
END;
$$;

alter function bpkm.put_ruta_auto_progresar_uno(integer, integer) owner to antillonuser;

create or replace function bpkm.post_monitoreo_bpkm(p_id_ruta integer, p_id_usuario integer, p_tipo character varying, p_fecha_hora timestamp without time zone, p_comentario character varying)
    returns TABLE(int_id_monitoreo_bpkm integer)
    language plpgsql
as
$$
BEGIN
  INSERT INTO bpkm.tbl_monitoreo_bpkm(id_ruta, id_usuario, tipo, fecha_hora, comentario)
  VALUES (p_id_ruta, p_id_usuario, p_tipo, p_fecha_hora, p_comentario)
  ON CONFLICT (id_ruta, tipo)
  DO UPDATE SET
    id_usuario = EXCLUDED.id_usuario,
    fecha_hora = EXCLUDED.fecha_hora,
    comentario = EXCLUDED.comentario
  RETURNING id_monitoreo_bpkm INTO int_id_monitoreo_bpkm;
  RETURN NEXT;
END;
$$;

alter function bpkm.post_monitoreo_bpkm(integer, integer, varchar, timestamp, varchar) owner to antillonuser;

create or replace function bpkm.put_modificacion_ruta_resolver(p_id_modificacion_ruta integer, p_decision_codigo character varying, p_id_autorizador integer, p_comentario_autorizador character varying)
    returns TABLE(int_id_modificacion_ruta integer)
    language plpgsql
as
$$
DECLARE v_id_ruta INTEGER; v_nuevo INTEGER; v_estado_target INTEGER;
BEGIN
  v_estado_target := bpkm._estado_id('MOD_RUTA', p_decision_codigo);

  UPDATE bpkm.tbl_modificacion_ruta
  SET id_estado = v_estado_target,
      id_autorizador = p_id_autorizador,
      comentario_autorizador = p_comentario_autorizador,
      actualizado_por = p_id_autorizador,
      fecha_actualizacion = NOW()
  WHERE id_modificacion_ruta = p_id_modificacion_ruta
  RETURNING id_modificacion_ruta, id_ruta, id_forma_entrega_nuevo INTO int_id_modificacion_ruta, v_id_ruta, v_nuevo;

  IF p_decision_codigo = 'APR' THEN
    UPDATE bpkm.tbl_rutas
    SET id_forma_entrega = v_nuevo,
        actualizado_por = p_id_autorizador,
        fecha_actualizacion = NOW()
    WHERE id_ruta = v_id_ruta;
    PERFORM bpkm.post_bitacora_ruta(v_id_ruta, 'MOD_RUTA_APR', 'Cambio forma de entrega aplicado', p_id_autorizador);
  ELSE
    PERFORM bpkm.post_bitacora_ruta(v_id_ruta, 'MOD_RUTA_RECH', 'Cambio forma de entrega rechazado', p_id_autorizador);
  END IF;

  RETURN NEXT;
END;
$$;

alter function bpkm.put_modificacion_ruta_resolver(integer, varchar, integer, varchar) owner to antillonuser;

create or replace function bpkm.put_bpkm_actualizar(p_id_bpkm integer, p_cumplimiento character varying, p_observaciones character varying, p_km_punto_lejano integer, p_monto_logrado numeric, p_monto_piloto numeric, p_monto_auxiliar numeric, p_usuario integer)
    returns TABLE(int_id_bpkm integer)
    language plpgsql
as
$$
BEGIN
  UPDATE bpkm.tbl_bpkm
  SET cumplimiento = COALESCE(p_cumplimiento, cumplimiento),
      observaciones = COALESCE(p_observaciones, observaciones),
      km_punto_lejano = COALESCE(p_km_punto_lejano, km_punto_lejano),
      monto_logrado = COALESCE(p_monto_logrado, monto_logrado),
      monto_piloto  = COALESCE(p_monto_piloto,  monto_piloto),
      monto_auxiliar= COALESCE(p_monto_auxiliar,monto_auxiliar),
      actualizado_por = p_usuario,
      fecha_actualizacion = NOW()
  WHERE id_bpkm = p_id_bpkm
  RETURNING id_bpkm INTO int_id_bpkm;
  RETURN NEXT;
END;
$$;

alter function bpkm.put_bpkm_actualizar(integer, varchar, varchar, integer, numeric, numeric, numeric, integer) owner to antillonuser;

create or replace function bpkm.put_bpkm_aprobar_gerencia(p_id_bpkm integer, p_usuario integer)
    returns TABLE(int_id_bpkm integer)
    language plpgsql
as
$$
DECLARE v_apr INTEGER := bpkm._estado_id('BPKM','APR_GER'); v_id_ruta INTEGER;
BEGIN
  UPDATE bpkm.tbl_bpkm
  SET id_estado_bpkm = v_apr,
      actualizado_por = p_usuario,
      fecha_actualizacion = NOW()
  WHERE id_bpkm = p_id_bpkm
  RETURNING id_bpkm, id_ruta INTO int_id_bpkm, v_id_ruta;

  PERFORM bpkm.post_bitacora_ruta(v_id_ruta, 'BPKM_APR_GER', 'BPKM aprobado por Gerencia', p_usuario);
  RETURN NEXT;
END;
$$;

alter function bpkm.put_bpkm_aprobar_gerencia(integer, integer) owner to antillonuser;

create or replace function bpkm.put_bpkm_finalizar_rrhh(p_id_bpkm integer, p_usuario integer)
    returns TABLE(int_id_bpkm integer)
    language plpgsql
as
$$
DECLARE v_fin INTEGER := bpkm._estado_id('BPKM','FINAL_RRHH'); v_id_ruta INTEGER;
BEGIN
  UPDATE bpkm.tbl_bpkm
  SET id_estado_bpkm = v_fin,
      usuario_rrhh = p_usuario,
      fecha_rrhh = NOW(),
      actualizado_por = p_usuario,
      fecha_actualizacion = NOW()
  WHERE id_bpkm = p_id_bpkm
  RETURNING id_bpkm, id_ruta INTO int_id_bpkm, v_id_ruta;

  PERFORM bpkm.post_bitacora_ruta(v_id_ruta, 'BPKM_FINAL_RRHH', 'BPKM finalizado por RRHH', p_usuario);
  RETURN NEXT;
END;
$$;

alter function bpkm.put_bpkm_finalizar_rrhh(integer, integer) owner to antillonuser;

create or replace function bpkm.get_monitoreo_por_ruta(p_id_ruta integer)
    returns TABLE(int_id_monitoreo_bpkm integer, str_tipo character varying, ts_fecha_hora timestamp without time zone, str_comentario character varying)
    language plpgsql
as
$$
BEGIN
  RETURN QUERY
  SELECT id_monitoreo_bpkm, tipo, fecha_hora, comentario
  FROM bpkm.tbl_monitoreo_bpkm
  WHERE id_ruta = p_id_ruta
  ORDER BY tipo; -- S/E
END;
$$;

alter function bpkm.get_monitoreo_por_ruta(integer) owner to antillonuser;

create or replace function bpkm.get_roles_personal()
    returns TABLE(int_id_rol integer, str_nombre_rol character varying)
    language plpgsql
as
$$
BEGIN
  RETURN QUERY
  select id_rol, nombre from usuarios.tbl_roles where id_rol in(14,15);
END;
$$;

alter function bpkm.get_roles_personal() owner to antillonuser;

create or replace function bpkm.get_transportes_admin(p_id_transporte integer, p_nombre_like character varying, p_estado integer)
    returns TABLE(int_id_transporte_externo integer, str_nombre character varying, int_estado integer, str_estado_nombre character varying, int_creado_por integer, str_usuario_creador character varying, str_f_creacion character varying, int_actualizado_por integer, str_usuario_modificador character varying, str_f_modificacion character varying)
    language plpgsql
as
$$
BEGIN
RETURN QUERY
      select
        tte.id_transporte_externo,
        tte.nombre,
        tte.estado,
        case tte.estado when 1 then 'Activo' else 'Inactivo' end::character varying as estado_nombre,
        tte.creado_por,
        u_creador.nombre as usuario_creador,
        to_char(tte.fecha_creacion, 'DD-MM-YYYY HH24:MI:SS')::character varying as f_creacion,
        tte.actualizado_por,
        u_modificador.nombre as usuario_modificador,
        to_char(tte.fecha_actualizacion, 'DD-MM-YYYY HH24:MI:SS')::character varying as f_modificacion
    from bpkm.tbl_transporte_externo tte
    left join usuarios.tbl_usuarios u_creador on tte.creado_por = u_creador.id_usuario
    left join usuarios.tbl_usuarios u_modificador on tte.actualizado_por = u_modificador.id_usuario
  WHERE (p_id_transporte = 0 OR tte.id_transporte_externo = p_id_transporte)
    AND (p_estado = 2 OR tte.estado = p_estado)
    AND (p_nombre_like = '' OR tte.nombre ILIKE p_nombre_like)
  ORDER BY nombre
  LIMIT 1000;
END;
$$;

alter function bpkm.get_transportes_admin(integer, varchar, integer) owner to antillonuser;

create or replace function bpkm.get_permisos_bpkm(p_id_usuario integer)
    returns TABLE(key character varying, nivel_permiso character varying)
    stable
    language plpgsql
as
$$
BEGIN
  RETURN QUERY
  SELECT k.key, k.nivel
  FROM bpkm.tbl_permisos_usuario u
  JOIN bpkm.tbl_perm_key k ON k.id_perm_key = u.id_perm_key
  WHERE u.id_usuario = p_id_usuario
    AND u.estado = 1
    AND k.estado = 1
    AND k.key LIKE 'bpkm.%'
  ORDER BY k.key;
END;
$$;

alter function bpkm.get_permisos_bpkm(integer) owner to antillonuser;

create or replace function bpkm.post_ruta_add_desde_selecciones(p_id_ruta integer, p_ids_sel bigint[], p_usuario integer)
    returns TABLE(int_id_detalle_ruta integer)
    language plpgsql
as
$$
DECLARE
  v_lock    INTEGER := bpkm._estado_id('SEL','EN_RUTA');
  v_act     INTEGER := bpkm._estado_id('SEL','ACT');
  v_pend    INTEGER := bpkm._estado_id('DETALLE','PEND');
  v_row     RECORD;
  v_forma   INTEGER;
BEGIN
  IF p_ids_sel IS NULL OR CARDINALITY(p_ids_sel)=0 THEN
    RAISE EXCEPTION 'Debe enviar al menos 1 id_factura_sel';
  END IF;

  FOR v_row IN
    SELECT s.id_factura_sel, s.id_factura, s.folio_factura,
           s.id_forma_entrega, s.id_transporte_externo,
           s.id_municipio, s.direccion_entrega
    FROM bpkm.tbl_factura_seleccion s
    WHERE s.id_factura_sel = ANY(p_ids_sel)
      AND s.anulada = 0
      AND s.id_estado_sel = v_act
  LOOP
    -- lock selección + subir intento
    UPDATE bpkm.tbl_factura_seleccion
    SET id_estado_sel = v_lock,
        en_ruta = 1,
        intentos_envio = intentos_envio + 1,
        actualizado_por = p_usuario,
        fecha_actualizacion = NOW()
    WHERE id_factura_sel = v_row.id_factura_sel;

    -- snapshot en detalle
    INSERT INTO bpkm.tbl_detalles_ruta(
      id_ruta, id_municipio, id_factura, id_estado,
      direccion, folio_factura, total_factura,
      id_factura_sel, id_forma_entrega_snap, id_transp_ext_snap,
      creado_por
    )
    VALUES(
      p_id_ruta, v_row.id_municipio, v_row.id_factura, v_pend,
      v_row.direccion_entrega, v_row.folio_factura, NULL,
      v_row.id_factura_sel, v_row.id_forma_entrega, v_row.id_transporte_externo,
      p_usuario
    )
    RETURNING id_detalle_ruta INTO int_id_detalle_ruta;
  END LOOP;

  PERFORM bpkm.post_bitacora_ruta(p_id_ruta, 'ASIGNAR_SEL',
         format('Asignadas %s selecciones', CARDINALITY(p_ids_sel)), p_usuario);

  RETURN;
END$$;

alter function bpkm.post_ruta_add_desde_selecciones(integer, bigint[], integer) owner to antillonuser;

create or replace function bpkm.put_detalle_liquidar(p_id_detalle_ruta integer, p_resultado_codigo character varying, p_comentario character varying, p_usuario integer)
    returns TABLE(int_id_detalle_ruta integer)
    language plpgsql
as
$$
DECLARE
  v_ent   INTEGER := bpkm._estado_id('DETALLE','ENT');
  v_parc  INTEGER := bpkm._estado_id('DETALLE','PARC');
  v_fall  INTEGER := bpkm._estado_id('DETALLE','FALL');

  v_act   INTEGER := bpkm._estado_id('SEL','ACT');
  v_cer   INTEGER := bpkm._estado_id('SEL','CERRADA');

  v_id_sel BIGINT;
  v_estado_target INTEGER;
BEGIN
  CASE p_resultado_codigo
    WHEN 'ENT'  THEN v_estado_target := v_ent;
    WHEN 'PARC' THEN v_estado_target := v_parc;
    WHEN 'FALL' THEN v_estado_target := v_fall;
    ELSE RAISE EXCEPTION 'Resultado inválido (use ENT|PARC|FALL)';
  END CASE;

  UPDATE bpkm.tbl_detalles_ruta
  SET id_estado = v_estado_target,
      comentario = COALESCE(p_comentario, comentario),
      actualizado_por = p_usuario,
      fecha_actualizacion = NOW()
  WHERE id_detalle_ruta = p_id_detalle_ruta
  RETURNING id_detalle_ruta, id_factura_sel INTO int_id_detalle_ruta, v_id_sel;

  -- reciclar o cerrar selección
  IF v_id_sel IS NOT NULL THEN
    IF p_resultado_codigo = 'ENT' THEN
      UPDATE bpkm.tbl_factura_seleccion
      SET id_estado_sel = v_cer, en_ruta = 0,
          actualizado_por = p_usuario, fecha_actualizacion = NOW()
      WHERE id_factura_sel = v_id_sel;
    ELSE
      UPDATE bpkm.tbl_factura_seleccion
      SET id_estado_sel = v_act, en_ruta = 0,
          actualizado_por = p_usuario, fecha_actualizacion = NOW()
      WHERE id_factura_sel = v_id_sel;
    END IF;
  END IF;

  RETURN NEXT;
END$$;

alter function bpkm.put_detalle_liquidar(integer, varchar, varchar, integer) owner to antillonuser;

create or replace function bpkm.post_bitacora(p_tabla character varying, p_id_registro bigint, p_accion character varying, p_detalle character varying, p_creado_por integer)
    returns TABLE(int_id_bitacora bigint)
    language plpgsql
as
$$
BEGIN
  INSERT INTO bpkm.tbl_bitacora (tabla,id_registro,accion,detalle,creado_por)
  VALUES (UPPER(TRIM(p_tabla)), p_id_registro, UPPER(TRIM(p_accion)), TRIM(COALESCE(p_detalle,'')), p_creado_por)
  RETURNING id_bitacora INTO int_id_bitacora;
  RETURN NEXT;
END;
$$;

alter function bpkm.post_bitacora(varchar, bigint, varchar, varchar, integer) owner to antillonuser;

create or replace function bpkm.post_reciclar_factura_fallida(p_id_factura_sel bigint, p_usuario integer)
    returns TABLE(int_success boolean)
    language plpgsql
as
$$
DECLARE
  v_estado_act INTEGER := bpkm._estado_id('SEL','ACT');
BEGIN
  IF NOT EXISTS(
    SELECT 1 FROM bpkm.tbl_factura_seleccion
    WHERE id_factura_sel = p_id_factura_sel
      AND id_estado_sel = bpkm._estado_id('SEL','FALLIDA')
      AND anulada = 0
  ) THEN
    RAISE EXCEPTION 'Factura no está en estado FALLIDA';
  END IF;

  UPDATE bpkm.tbl_factura_seleccion
  SET id_estado_sel = v_estado_act,
      en_ruta = 0,
      actualizado_por = p_usuario,
      fecha_actualizacion = NOW()
  WHERE id_factura_sel = p_id_factura_sel;

  PERFORM bpkm.post_bitacora('SEL', p_id_factura_sel, 'RECICLAR_A_ACT',
    'Factura reciclada para reintento', p_usuario);

  int_success := TRUE;
  RETURN NEXT;
END;
$$;

alter function bpkm.post_reciclar_factura_fallida(bigint, integer) owner to antillonuser;

create or replace function bpkm.calcular_comision_bpkm(p_distancia_km numeric) returns numeric
    immutable
    language plpgsql
as
$$
BEGIN
  IF p_distancia_km IS NULL OR p_distancia_km <= 0 THEN
    RETURN 0;
  END IF;

  -- 1-50 km: 100%
  IF p_distancia_km <= 50 THEN
    RETURN p_distancia_km;
  END IF;

  -- 51-80 km: 80%
  IF p_distancia_km <= 80 THEN
    RETURN p_distancia_km * 0.80;
  END IF;

  -- 81+ km: 70%
  RETURN p_distancia_km * 0.70;
END;
$$;

alter function bpkm.calcular_comision_bpkm(numeric) owner to antillonuser;

create or replace function bpkm.get_sel_resumen_por_factura(p_id_factura integer, p_folio character varying)
    returns TABLE(tiene_activa integer, intentos_max integer, intentos_total bigint)
    stable
    language plpgsql
as
$$
BEGIN
  RETURN QUERY
  SELECT
    CASE WHEN EXISTS(
      SELECT 1 FROM bpkm.tbl_factura_seleccion
      WHERE (p_id_factura > 0 AND id_factura = p_id_factura OR UPPER(TRIM(folio_factura)) = UPPER(TRIM(p_folio)))
        AND anulada = 0
        AND id_estado_sel = bpkm._estado_id('SEL','ACT')
    ) THEN 1 ELSE 0 END AS tiene_activa,
    COALESCE(MAX(dr.intento_numero), 0)::INTEGER AS intentos_max,
    COUNT(dr.id_detalle_ruta) AS intentos_total
  FROM bpkm.tbl_factura_seleccion fs
  LEFT JOIN bpkm.tbl_detalles_ruta dr ON dr.id_factura_sel = fs.id_factura_sel
  WHERE (p_id_factura > 0 AND fs.id_factura = p_id_factura)
     OR (NULLIF(TRIM(p_folio),'') IS NOT NULL AND UPPER(TRIM(fs.folio_factura)) = UPPER(TRIM(p_folio)));
END;
$$;

alter function bpkm.get_sel_resumen_por_factura(integer, varchar) owner to antillonuser;

create or replace function bpkm.put_ruta_cancelar(p_id_ruta bigint, p_usuario integer)
    returns TABLE(int_success boolean)
    language plpgsql
as
$$
DECLARE
  v_estado_canc INTEGER := bpkm._estado_id('RUTA','CANCELADA');
  v_estado_fallida INTEGER := bpkm._estado_id('DETALLE','FALL');
  v_estado_liq_fallida INTEGER := bpkm._estado_id('LIQ_DET','FALLIDA');
  v_detalle RECORD;
BEGIN
  IF NOT EXISTS(
    SELECT 1 FROM bpkm.tbl_rutas
    WHERE id_ruta = p_id_ruta
      AND id_estado_ruta = bpkm._estado_id('RUTA','CREADA')
  ) THEN
    RAISE EXCEPTION 'Solo se pueden cancelar rutas en estado CREADA';
  END IF;

  -- ====================================================================
  -- NUEVO: Liquidar todos los detalles como FALLIDA antes de cancelar
  -- ====================================================================
  FOR v_detalle IN
    SELECT dr.id_detalle_ruta, dr.folio_factura
    FROM bpkm.tbl_detalles_ruta dr
    WHERE dr.id_ruta = p_id_ruta
      AND NOT EXISTS(
        SELECT 1 FROM bpkm.tbl_liquidacion_detalle ld
        WHERE ld.id_detalle_ruta = dr.id_detalle_ruta
      )
  LOOP
    -- Insertar liquidación FALLIDA para cada detalle pendiente
    INSERT INTO bpkm.tbl_liquidacion_detalle(
      id_detalle_ruta,
      id_estado_liq,
      motivo_fallo,
      observaciones,
      fecha_hora_intento,
      usuario_liquida
    ) VALUES (
      v_detalle.id_detalle_ruta,
      v_estado_liq_fallida,
      'Ruta cancelada',
      'Factura marcada como fallida debido a cancelación de ruta',
      NOW(),
      p_usuario
    );

    -- Actualizar estado del detalle a FALLIDA
    UPDATE bpkm.tbl_detalles_ruta
    SET id_estado = v_estado_fallida,
        actualizado_por = p_usuario,
        fecha_actualizacion = NOW()
    WHERE id_detalle_ruta = v_detalle.id_detalle_ruta;

    RAISE NOTICE 'Detalle % (folio: %) liquidado como FALLIDA por cancelación',
      v_detalle.id_detalle_ruta, v_detalle.folio_factura;
  END LOOP;

  -- Cancelar la ruta
  UPDATE bpkm.tbl_rutas
  SET id_estado_ruta = v_estado_canc,
      actualizado_por = p_usuario,
      fecha_actualizacion = NOW()
  WHERE id_ruta = p_id_ruta;

  -- Liberar facturas (cambiar a ACT)
  UPDATE bpkm.tbl_factura_seleccion fs
  SET en_ruta = 0,
      id_estado_sel = bpkm._estado_id('SEL','ACT'),
      actualizado_por = p_usuario,
      fecha_actualizacion = NOW()
  WHERE EXISTS(
    SELECT 1 FROM bpkm.tbl_detalles_ruta dr
    WHERE dr.id_ruta = p_id_ruta
      AND dr.id_factura_sel = fs.id_factura_sel
  );

  PERFORM bpkm.post_bitacora_ruta(
    p_id_ruta,
    'CANCELAR',
    'Ruta cancelada. Todos los detalles fueron liquidados como FALLIDA.',
    p_usuario
  );

  int_success := TRUE;
  RETURN NEXT;
END;
$$;

alter function bpkm.put_ruta_cancelar(bigint, integer) owner to antillonuser;

create or replace function bpkm.post_bitacora_ruta(p_id_ruta bigint, p_accion character varying, p_detalle character varying, p_creado_por integer)
    returns TABLE(int_id_bitacora bigint)
    language plpgsql
as
$$
BEGIN
  INSERT INTO bpkm.tbl_bitacora_ruta(id_ruta, accion, detalle, creado_por)
  VALUES (p_id_ruta, UPPER(TRIM(p_accion)), TRIM(p_detalle), p_creado_por)
  RETURNING id_bitacora_ruta INTO int_id_bitacora;
  RETURN NEXT;
END;
$$;

alter function bpkm.post_bitacora_ruta(bigint, varchar, varchar, integer) owner to antillonuser;

create or replace function bpkm.get_cambios_por_seleccion(p_id_factura_sel bigint)
    returns TABLE(id_sel_cambio bigint, forma_anterior_nombre character varying, forma_nueva_nombre character varying, solicitante_nombre character varying, comentario_solicitante character varying, autorizador_nombre character varying, comentario_autorizador character varying, estado_codigo character varying, estado_nombre character varying, fecha_creacion timestamp without time zone, fecha_actualizacion timestamp without time zone)
    stable
    language plpgsql
as
$$
BEGIN
  RETURN QUERY
  SELECT
    sc.id_sel_cambio,
    fe_ant.nombre AS forma_anterior_nombre,
    fe_new.nombre AS forma_nueva_nombre,
    u_sol.nombre AS solicitante_nombre,
    sc.comentario_solicitante,
    u_aut.nombre AS autorizador_nombre,
    sc.comentario_autorizador,
    e.codigo AS estado_codigo,
    e.nombre AS estado_nombre,
    sc.fecha_creacion,
    sc.fecha_actualizacion
  FROM bpkm.tbl_factura_sel_cambio sc
  LEFT JOIN bpkm.tbl_forma_entrega fe_ant ON fe_ant.id_forma_entrega = sc.id_forma_anterior
  LEFT JOIN bpkm.tbl_forma_entrega fe_new ON fe_new.id_forma_entrega = sc.id_forma_nueva
  LEFT JOIN usuarios.tbl_usuarios u_sol ON u_sol.id_usuario = sc.id_solicitante
  LEFT JOIN usuarios.tbl_usuarios u_aut ON u_aut.id_usuario = sc.id_autorizador
  JOIN bpkm.tbl_estado_bpkm e ON e.id_estado_bpkm = sc.id_estado
  WHERE sc.id_factura_sel = p_id_factura_sel
  ORDER BY sc.fecha_creacion DESC;
END;
$$;

alter function bpkm.get_cambios_por_seleccion(bigint) owner to antillonuser;

create or replace function bpkm.get_detalles_por_ruta(p_id_ruta bigint)
    returns TABLE(id_detalle_ruta integer, folio character varying, forma_entrega character varying, municipio character varying, direccion character varying, distancia_km numeric, intento_numero integer, estado_liquidacion character varying, fecha_liquidacion timestamp without time zone)
    stable
    language plpgsql
as
$$
BEGIN
  RETURN QUERY
  SELECT
    dr.id_detalle_ruta,
    dr.folio_factura,
    fe.nombre AS forma_entrega,
    m.nombre AS municipio,
    dr.direccion_snap AS direccion,
    dr.distancia_km,
    dr.intento_numero,
    el.nombre AS estado_liquidacion,
    ld.fecha_creacion AS fecha_liquidacion
  FROM bpkm.tbl_detalles_ruta dr
  LEFT JOIN bpkm.tbl_forma_entrega fe ON fe.id_forma_entrega = dr.id_forma_entrega_snap
  LEFT JOIN catalogos.tbl_municipios m ON m.id_municipio = dr.id_municipio_snap
  LEFT JOIN bpkm.tbl_liquidacion_detalle ld ON ld.id_detalle_ruta = dr.id_detalle_ruta
  LEFT JOIN bpkm.tbl_estado_bpkm el ON el.id_estado_bpkm = ld.id_estado_liq
  WHERE dr.id_ruta = p_id_ruta
  ORDER BY dr.distancia_km DESC, dr.id_detalle_ruta;
END;
$$;

alter function bpkm.get_detalles_por_ruta(bigint) owner to antillonuser;

create or replace function bpkm.post_factura_seleccion(p_id_factura integer, p_folio character varying, p_id_vendedor integer, p_id_forma_entrega integer, p_id_transporte_externo integer, p_id_departamento integer, p_id_municipio integer, p_direccion character varying, p_id_sucursal integer, p_creado_por integer)
    returns TABLE(int_id_factura_sel bigint)
    language plpgsql
as
$$
DECLARE
  v_act INTEGER := bpkm._estado_id('SEL','ACT');
BEGIN
  IF COALESCE(p_id_factura,0)=0 OR NULLIF(BTRIM(p_folio),'') IS NULL THEN
    RAISE EXCEPTION 'Debe enviar id_factura y folio';
  END IF;

  IF COALESCE(p_id_sucursal,0) = 0 THEN
    RAISE EXCEPTION 'Debe enviar id_sucursal';
  END IF;

  INSERT INTO bpkm.tbl_factura_seleccion(
    id_factura, folio_factura, id_vendedor, id_forma_entrega,
    id_transporte_externo, id_departamento, id_municipio, direccion_entrega,
    id_estado_sel, id_sucursal_creador, creado_por
  )
  VALUES(
    p_id_factura, p_folio, p_id_vendedor, p_id_forma_entrega,
    NULLIF(p_id_transporte_externo,0), NULLIF(p_id_departamento,0), NULLIF(p_id_municipio,0),
    NULLIF(p_direccion,''),
    v_act, p_id_sucursal, p_creado_por
  )
  RETURNING id_factura_sel INTO int_id_factura_sel;

  PERFORM bpkm.post_bitacora('SEL', int_id_factura_sel, 'CREAR',
    CONCAT('Selección creada - Folio: ', p_folio), p_creado_por);

  RETURN NEXT;
END
$$;

alter function bpkm.post_factura_seleccion(integer, varchar, integer, integer, integer, integer, integer, varchar, integer, integer) owner to antillonuser;

create or replace function bpkm.get_bitacora_bpkm(p_id_bpkm bigint)
    returns TABLE(id_bitacora bigint, accion character varying, detalle character varying, fecha_creacion timestamp without time zone, nombre_creador character varying)
    language plpgsql
as
$$
BEGIN
  RETURN QUERY
  SELECT
    b.id_bitacora,
    b.accion,
    b.detalle,
    b.fecha_creacion,
    u.nombre AS nombre_creador
  FROM bpkm.tbl_bitacora b
  LEFT JOIN usuarios.tbl_usuarios u ON u.id_usuario = b.creado_por
  WHERE b.tabla = 'BPKM'
    AND b.id_registro = p_id_bpkm
  ORDER BY b.fecha_creacion ASC;
END;
$$;

alter function bpkm.get_bitacora_bpkm(bigint) owner to antillonuser;

create or replace function bpkm.get_rutas_con_monitoreo(p_estado_codigo character varying, p_fecha_desde date, p_fecha_hasta date, p_id_suc_salida integer, p_id_camion integer, p_id_piloto integer, p_id_auxiliar integer, p_creado_por integer)
    returns TABLE(id_ruta integer, numero_ruta character varying, estado_nombre character varying, camion character varying, piloto character varying, auxiliar character varying, fecha_salida_plan timestamp without time zone, fecha_entrada_plan timestamp without time zone, monto_total_transportado numeric, total_facturas bigint, fecha_creacion timestamp without time zone, tiene_salida boolean, tiene_entrada boolean, salida_fecha_hora timestamp without time zone, salida_comentario character varying, entrada_fecha_hora timestamp without time zone, entrada_comentario character varying, bpkm_aprobado boolean)
    stable
    language plpgsql
as
$$

BEGIN
  RETURN QUERY
  SELECT
    r.id_ruta,
    r.numero_ruta,
    e.nombre AS estado_nombre,
    c.placa AS camion,
    p.nombre AS piloto,
    a.nombre AS auxiliar,
    r.fecha_salida_plan,
    r.fecha_entrada_plan,
    r.monto_total_transportado,
    COUNT(dr.id_detalle_ruta) AS total_facturas,
    r.fecha_creacion,
    -- Monitoreo de salida
    (ms.id_monitoreo_bpkm IS NOT NULL) AS tiene_salida,
    -- Monitoreo de entrada
    (me.id_monitoreo_bpkm IS NOT NULL) AS tiene_entrada,
    ms.fecha_hora AS salida_fecha_hora,
    ms.comentario AS salida_comentario,
    me.fecha_hora AS entrada_fecha_hora,
    me.comentario AS entrada_comentario,
    -- NUEVO CAMPO: Solo estado de aprobación (SIN información confidencial de gerencia)
    (bpkm_data.usuario_gerencia IS NOT NULL AND bpkm_data.fecha_aprobacion IS NOT NULL) AS bpkm_aprobado
  FROM bpkm.tbl_rutas r
  LEFT JOIN bpkm.tbl_estado_bpkm e ON e.id_estado_bpkm = r.id_estado_ruta
  LEFT JOIN bpkm.tbl_camiones c ON c.id_camion = r.id_camion
  LEFT JOIN bpkm.tbl_personal p ON p.id_personal = r.id_piloto
  LEFT JOIN bpkm.tbl_personal a ON a.id_personal = r.id_auxiliar
  LEFT JOIN bpkm.tbl_detalles_ruta dr ON dr.id_ruta = r.id_ruta
  -- LEFT JOIN para monitoreo de salida (tipo='S')
  LEFT JOIN bpkm.tbl_monitoreo_bpkm ms ON ms.id_ruta = r.id_ruta AND ms.tipo = 'S'
  -- LEFT JOIN para monitoreo de entrada (tipo='E')
  LEFT JOIN bpkm.tbl_monitoreo_bpkm me ON me.id_ruta = r.id_ruta AND me.tipo = 'E'
  -- NUEVO: LEFT JOIN para obtener información de BPKM aprobado (SOLO ESTADO)
  LEFT JOIN bpkm.tbl_bpkm bpkm_data ON bpkm_data.id_ruta = r.id_ruta
  WHERE (NULLIF(TRIM(p_estado_codigo),'') IS NULL OR e.codigo = UPPER(TRIM(p_estado_codigo)))
    AND (p_fecha_desde IS NULL OR r.fecha_creacion::DATE >= p_fecha_desde)
    AND (p_fecha_hasta IS NULL OR r.fecha_creacion::DATE <= p_fecha_hasta)
    AND (p_id_suc_salida = 0 OR r.id_sucursal_salida = p_id_suc_salida)
    AND (p_id_camion = 0 OR r.id_camion = p_id_camion)
    AND (p_id_piloto = 0 OR r.id_piloto = p_id_piloto)
    AND (p_id_auxiliar = 0 OR r.id_auxiliar = p_id_auxiliar)
    AND (p_creado_por = 0 OR r.creado_por = p_creado_por)
  GROUP BY
    r.id_ruta, r.numero_ruta, e.nombre, c.placa, p.nombre, a.nombre,
    r.fecha_salida_plan, r.fecha_entrada_plan, r.monto_total_transportado, r.fecha_creacion,
    ms.id_monitoreo_bpkm, ms.fecha_hora, ms.comentario,
    me.id_monitoreo_bpkm, me.fecha_hora, me.comentario,
    -- Agregar campo de aprobación al GROUP BY
    bpkm_data.usuario_gerencia, bpkm_data.fecha_aprobacion
  ORDER BY r.id_ruta DESC;
END;
$$;

alter function bpkm.get_rutas_con_monitoreo(varchar, date, date, integer, integer, integer, integer, integer) owner to antillonuser;

create or replace function bpkm.post_aprobar_bpkm_gerencia(p_id_bpkm bigint, p_monto_aprobado_piloto numeric, p_monto_aprobado_auxiliar numeric, p_observaciones character varying, p_usuario_gerencia integer)
    returns TABLE(int_success boolean)
    language plpgsql
as
$$

DECLARE
  v_estado_apr INTEGER := bpkm._estado_id('BPKM','APR');
  v_codigo_ruta VARCHAR;
BEGIN
  -- Actualizar BPKM
  UPDATE bpkm.tbl_bpkm
  SET monto_aprobado_piloto = p_monto_aprobado_piloto,
      monto_aprobado_auxiliar = p_monto_aprobado_auxiliar,
      observaciones_gerencia = NULLIF(BTRIM(p_observaciones),''),
      id_estado_bpkm = v_estado_apr,
      usuario_gerencia = p_usuario_gerencia,
      fecha_aprobacion = NOW(),
      actualizado_por = p_usuario_gerencia,
      fecha_actualizacion = NOW()
  WHERE id_bpkm = p_id_bpkm;

  -- Obtener código de ruta para el detalle
  SELECT r.numero_ruta INTO v_codigo_ruta
  FROM bpkm.tbl_bpkm b
  JOIN bpkm.tbl_rutas r ON r.id_ruta = b.id_ruta
  WHERE b.id_bpkm = p_id_bpkm;

  -- ============================================================
  -- NUEVO: Registrar en bitácora
  -- ============================================================
  PERFORM bpkm.post_bitacora(
    'BPKM',
    p_id_bpkm,
    'APROBAR',
    CONCAT('BPKM aprobado por Gerencia - Ruta: ', COALESCE(v_codigo_ruta, '?'),
           ' - Piloto: Q', p_monto_aprobado_piloto::TEXT,
           ' - Auxiliar: Q', p_monto_aprobado_auxiliar::TEXT,
           CASE WHEN NULLIF(BTRIM(p_observaciones),'') IS NOT NULL
                THEN ' - Obs: ' || BTRIM(p_observaciones)
                ELSE ''
           END),
    p_usuario_gerencia
  );

  int_success := TRUE;
  RETURN NEXT;
END;
$$;

alter function bpkm.post_aprobar_bpkm_gerencia(bigint, numeric, numeric, varchar, integer) owner to antillonuser;

create or replace function bpkm.post_finalizar_bpkm_rrhh(p_id_bpkm bigint, p_usuario_rrhh integer)
    returns TABLE(int_success boolean)
    language plpgsql
as
$$

DECLARE
  v_estado_fin INTEGER := bpkm._estado_id('BPKM','FIN_RRHH');
  v_codigo_ruta VARCHAR;
  v_monto_piloto NUMERIC;
  v_monto_auxiliar NUMERIC;
BEGIN
  -- Validar que esté aprobado
  IF NOT EXISTS(
    SELECT 1 FROM bpkm.tbl_bpkm
    WHERE id_bpkm = p_id_bpkm
      AND id_estado_bpkm = bpkm._estado_id('BPKM','APR')
  ) THEN
    RAISE EXCEPTION 'BPKM no está aprobado por Gerencia';
  END IF;

  -- Actualizar BPKM
  UPDATE bpkm.tbl_bpkm
  SET id_estado_bpkm = v_estado_fin,
      usuario_rrhh = p_usuario_rrhh,
      fecha_rrhh = NOW(),
      actualizado_por = p_usuario_rrhh,
      fecha_actualizacion = NOW()
  WHERE id_bpkm = p_id_bpkm;

  -- Obtener datos para el detalle de bitácora
  SELECT r.numero_ruta, b.monto_aprobado_piloto, b.monto_aprobado_auxiliar
  INTO v_codigo_ruta, v_monto_piloto, v_monto_auxiliar
  FROM bpkm.tbl_bpkm b
  JOIN bpkm.tbl_rutas r ON r.id_ruta = b.id_ruta
  WHERE b.id_bpkm = p_id_bpkm;

  -- ============================================================
  -- NUEVO: Registrar en bitácora
  -- ============================================================
  PERFORM bpkm.post_bitacora(
    'BPKM',
    p_id_bpkm,
    'FINALIZAR',
    CONCAT('BPKM finalizado por RRHH - Ruta: ', COALESCE(v_codigo_ruta, '?'),
           ' - Piloto: Q', COALESCE(v_monto_piloto::TEXT, '0.00'),
           ' - Auxiliar: Q', COALESCE(v_monto_auxiliar::TEXT, '0.00')),
    p_usuario_rrhh
  );

  int_success := TRUE;
  RETURN NEXT;
END;
$$;

alter function bpkm.post_finalizar_bpkm_rrhh(bigint, integer) owner to antillonuser;

create or replace function bpkm.get_camiones(p_id_camion integer, p_placa_like character varying, p_estado integer, p_id_sucursal integer DEFAULT 0)
    returns TABLE(int_id_camion integer, str_placa character varying, int_estado integer, int_id_sucursal integer, str_nombre_sucursal character varying)
    language plpgsql
as
$$
BEGIN
  RETURN QUERY
  SELECT tc.id_camion, tc.placa, tc.estado, tc.id_sucursal, s.nombre
  FROM bpkm.tbl_camiones tc
  LEFT JOIN usuarios.tbl_sucursales s ON s.id_sucursal = tc.id_sucursal
  WHERE (p_id_camion = 0 OR tc.id_camion = p_id_camion)
    AND (p_estado    = 2 OR tc.estado = p_estado)
    AND (p_placa_like = '' OR tc.placa ILIKE p_placa_like)
    AND (p_id_sucursal = 0 OR tc.id_sucursal = p_id_sucursal)
  ORDER BY tc.placa
  LIMIT 1000;
END;
$$;

alter function bpkm.get_camiones(integer, varchar, integer, integer) owner to antillonuser;

create or replace function bpkm.post_camion(p_placa character varying, p_estado integer, p_creado_por integer, p_id_sucursal integer DEFAULT NULL::integer)
    returns TABLE(int_id_camion integer)
    language plpgsql
as
$$
BEGIN
  INSERT INTO bpkm.tbl_camiones(placa, estado, creado_por, id_sucursal)
  VALUES (p_placa, COALESCE(p_estado,1), p_creado_por, p_id_sucursal)
  RETURNING id_camion INTO int_id_camion;
  RETURN NEXT;
END;
$$;

alter function bpkm.post_camion(varchar, integer, integer, integer) owner to antillonuser;

create or replace function bpkm.put_camion(p_id_camion integer, p_estado integer, p_actualizado_por integer, p_id_sucursal integer DEFAULT NULL::integer)
    returns TABLE(int_id_camion integer)
    language plpgsql
as
$$
BEGIN
  UPDATE bpkm.tbl_camiones
  SET estado = COALESCE(p_estado, estado),
      actualizado_por = p_actualizado_por,
      fecha_actualizacion = NOW(),
      id_sucursal = COALESCE(p_id_sucursal, id_sucursal)
  WHERE id_camion = p_id_camion
  RETURNING id_camion INTO int_id_camion;
  RETURN NEXT;
END;
$$;

alter function bpkm.put_camion(integer, integer, integer, integer) owner to antillonuser;

create or replace function bpkm.get_personal(p_id_personal integer, p_id_rol integer, p_nombre_like character varying, p_estado integer, p_id_sucursal integer DEFAULT 0)
    returns TABLE(int_id_personal integer, int_id_rol integer, str_nombre character varying, str_telefono character varying, int_estado integer, int_id_sucursal integer, str_nombre_sucursal character varying)
    language plpgsql
as
$$
BEGIN
  RETURN QUERY
  SELECT tp.id_personal, tp.id_rol, tp.nombre, tp.telefono, tp.estado, tp.id_sucursal, s.nombre
  FROM bpkm.tbl_personal tp
  LEFT JOIN usuarios.tbl_sucursales s ON s.id_sucursal = tp.id_sucursal
  WHERE (p_id_personal = 0 OR tp.id_personal = p_id_personal)
    AND (p_id_rol      = 0 OR tp.id_rol = p_id_rol)
    AND (p_estado      = 2 OR tp.estado = p_estado)
    AND (p_nombre_like = '' OR tp.nombre ILIKE p_nombre_like)
    AND (p_id_sucursal = 0 OR tp.id_sucursal = p_id_sucursal)
  ORDER BY LOWER(tp.nombre)
  LIMIT 1000;
END;
$$;

alter function bpkm.get_personal(integer, integer, varchar, integer, integer) owner to antillonuser;

create or replace function bpkm.post_personal(p_id_rol integer, p_nombre character varying, p_telefono character varying, p_estado integer, p_creado_por integer, p_id_sucursal integer DEFAULT NULL::integer)
    returns TABLE(int_id_personal integer)
    language plpgsql
as
$$
BEGIN
  INSERT INTO bpkm.tbl_personal(id_rol, nombre, telefono, estado, creado_por, id_sucursal)
  VALUES (p_id_rol, p_nombre, p_telefono, COALESCE(p_estado,1), p_creado_por, p_id_sucursal)
  RETURNING id_personal INTO int_id_personal;
  RETURN NEXT;
END;
$$;

alter function bpkm.post_personal(integer, varchar, varchar, integer, integer, integer) owner to antillonuser;

create or replace function bpkm.put_personal(p_id_personal integer, p_id_rol integer, p_nombre character varying, p_telefono character varying, p_estado integer, p_actualizado_por integer, p_id_sucursal integer DEFAULT NULL::integer)
    returns TABLE(int_id_personal integer)
    language plpgsql
as
$$
BEGIN
  UPDATE bpkm.tbl_personal
  SET id_rol = COALESCE(p_id_rol, id_rol),
      nombre = COALESCE(p_nombre, nombre),
      telefono = COALESCE(p_telefono, telefono),
      estado = COALESCE(p_estado, estado),
      actualizado_por = p_actualizado_por,
      fecha_actualizacion = NOW(),
      id_sucursal = COALESCE(p_id_sucursal, id_sucursal)
  WHERE id_personal = p_id_personal
  RETURNING id_personal INTO int_id_personal;
  RETURN NEXT;
END;
$$;

alter function bpkm.put_personal(integer, integer, varchar, varchar, integer, integer, integer) owner to antillonuser;

create or replace function bpkm.get_personal_admin(p_id_personal integer, p_id_rol integer, p_nombre_like character varying, p_estado integer, p_id_sucursal integer DEFAULT 0)
    returns TABLE(int_id_personal integer, int_id_rol integer, str_nombre_rol character varying, str_nombre character varying, str_telefono character varying, int_estado integer, str_nombre_estado character varying, int_creado_por integer, str_nombre_creador character varying, str_f_creacion character varying, int_actualizado_por integer, str_nombre_actualizador character varying, str_f_actualizacion character varying, int_id_sucursal integer, str_nombre_sucursal character varying)
    language plpgsql
as
$$
BEGIN
  RETURN QUERY
      select
        tp.id_personal,
        tp.id_rol,
        tr.nombre as nombre_rol,
        tp.nombre,
        tp.telefono::character varying,
        tp.estado,
        case tp.estado when 1 then 'Activo' else 'Inactivo' end::character varying as estado_descripcion,
        tp.creado_por,
        u_creador.nombre as nombre_creador,
        to_char( tp.fecha_creacion, 'DD-MM-YYYY HH24:MI:SS')::character varying as f_creacion,
        tp.actualizado_por,
        u_actualizador .nombre as nombre_actualizador,
        to_char( tp.fecha_actualizacion, 'DD-MM-YYYY HH24:MI:SS')::character varying as f_actualizacion,
        tp.id_sucursal,
        s.nombre
    from bpkm.tbl_personal tp
    left join usuarios.tbl_roles tr on tp.id_rol = tr.id_rol
    left join usuarios.tbl_usuarios u_creador on tp.creado_por = u_creador.id_usuario
    left join usuarios.tbl_usuarios u_actualizador on tp.actualizado_por = u_actualizador.id_usuario
    left join usuarios.tbl_sucursales s on s.id_sucursal = tp.id_sucursal
  WHERE (p_id_personal = 0 OR tp.id_personal = p_id_personal)
    AND (p_id_rol      = 0 OR tp.id_rol = p_id_rol)
    AND (p_estado      = 2 OR tp.estado = p_estado)
    AND (p_nombre_like = '' OR tp.nombre ILIKE p_nombre_like)
    AND (p_id_sucursal = 0 OR tp.id_sucursal = p_id_sucursal)
  ORDER BY tp.id_personal desc
  LIMIT 1000;
END;
$$;

alter function bpkm.get_personal_admin(integer, integer, varchar, integer, integer) owner to antillonuser;

create or replace function bpkm.put_detalle_resultado(p_id_detalle_ruta integer, p_estado_codigo character varying, p_comentario character varying, p_folio_nc character varying, p_fecha_anulacion timestamp without time zone, p_sumar_intento integer, p_usuario integer)
    returns TABLE(int_id_detalle_ruta integer)
    language plpgsql
as
$$
DECLARE
  v_estado_id INTEGER;
  v_id_ruta   INTEGER;
  v_estado_ruta INTEGER;
  v_en_curso  INTEGER := bpkm._estado_id('RUTA','EN_CURSO');
  v_regresada INTEGER := bpkm._estado_id('RUTA','REGRESADA');
BEGIN
  v_estado_id := bpkm._estado_id('DETALLE', p_estado_codigo);

  -- Permitir cambiar resultados solo cuando ruta EN_CURSO o REGRESADA
  SELECT r.id_estado_ruta INTO v_estado_ruta
  FROM bpkm.tbl_rutas r
  JOIN bpkm.tbl_detalles_ruta d ON d.id_ruta = r.id_ruta
  WHERE d.id_detalle_ruta = p_id_detalle_ruta;

  IF v_estado_ruta NOT IN (v_en_curso, v_regresada) THEN
    RAISE EXCEPTION 'No se puede registrar resultado: ruta no está EN_CURSO/REGRESADA';
  END IF;

  UPDATE bpkm.tbl_detalles_ruta
  SET id_estado = v_estado_id,
      comentario = COALESCE(p_comentario, comentario),
      folio_nc = CASE WHEN p_estado_codigo='ANUL' THEN COALESCE(p_folio_nc, folio_nc) ELSE folio_nc END,
      fecha_anulacion = CASE WHEN p_estado_codigo='ANUL' THEN COALESCE(p_fecha_anulacion, fecha_anulacion) ELSE fecha_anulacion END,
      intentos_entrega = CASE WHEN p_sumar_intento=1 THEN intentos_entrega+1 ELSE intentos_entrega END,
      actualizado_por = p_usuario,
      fecha_actualizacion = NOW()
  WHERE id_detalle_ruta = p_id_detalle_ruta
  RETURNING id_detalle_ruta, id_ruta INTO int_id_detalle_ruta, v_id_ruta;

  PERFORM bpkm.post_bitacora_ruta(v_id_ruta, 'DET_RESULTADO', format('Detalle % -> %s', p_estado_codigo), p_usuario);
  RETURN NEXT;
END;
$$;

alter function bpkm.put_detalle_resultado(integer, varchar, varchar, varchar, timestamp, integer, integer) owner to antillonuser;

create or replace function bpkm.post_modificacion_ruta(p_id_ruta integer, p_id_solicitante integer, p_id_forma_entrega_nuevo integer, p_comentario_solicitante character varying)
    returns TABLE(int_id_modificacion_ruta integer)
    language plpgsql
as
$$
DECLARE
  v_pend   INTEGER := bpkm._estado_id('MOD_RUTA','PEND');
  v_actual INTEGER;
  v_estado_ruta INTEGER;
  v_en_curso  INTEGER := bpkm._estado_id('RUTA','EN_CURSO');
  v_regresada INTEGER := bpkm._estado_id('RUTA','REGRESADA');
BEGIN
  SELECT id_estado_ruta, tipo_ruta INTO v_estado_ruta, v_actual
  FROM bpkm.tbl_rutas WHERE id_ruta = p_id_ruta;

  IF v_estado_ruta NOT IN (v_en_curso, v_regresada) THEN
    RAISE EXCEPTION 'Solicitud no permitida: ruta no está EN_CURSO/REGRESADA';
  END IF;

  INSERT INTO bpkm.tbl_modificacion_ruta(
    id_ruta, id_solicitante,
    id_forma_entrega_anterior, id_forma_entrega_nuevo,
    id_estado, comentario_solicitante, creado_por
  ) VALUES (
    p_id_ruta, p_id_solicitante,
    v_actual, p_id_forma_entrega_nuevo,
    v_pend, p_comentario_solicitante, p_id_solicitante
  )
  RETURNING id_modificacion_ruta INTO int_id_modificacion_ruta;

  PERFORM bpkm.post_bitacora_ruta(p_id_ruta, 'MOD_RUTA_SOL', 'Solicitud cambio forma de entrega (PEND)', p_id_solicitante);
  RETURN NEXT;
END;
$$;

alter function bpkm.post_modificacion_ruta(integer, integer, integer, varchar) owner to antillonuser;

create or replace function bpkm.put_ruta_actualizar_personal(p_id_ruta integer, p_id_piloto integer, p_id_auxiliar integer, p_usuario integer) returns void
    language plpgsql
as
$$
BEGIN
  UPDATE bpkm.tbl_rutas
  SET
    id_piloto = p_id_piloto,
    id_auxiliar = p_id_auxiliar,
    actualizado_por = p_usuario,
    fecha_actualizacion = NOW()
  WHERE id_ruta = p_id_ruta;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'No se encontró la ruta con id %', p_id_ruta;
  END IF;
END;
$$;

alter function bpkm.put_ruta_actualizar_personal(integer, integer, integer, integer) owner to antillonuser;

create or replace function bpkm.post_productos_entrega_parcial(p_id_liquidacion bigint, p_productos jsonb, p_usuario integer)
    returns TABLE(int_success boolean)
    language plpgsql
as
$$
BEGIN
  -- Validar que exista la liquidación
  IF NOT EXISTS (SELECT 1 FROM bpkm.tbl_liquidacion_detalle WHERE id_liquidacion = p_id_liquidacion) THEN
    RAISE EXCEPTION 'No se encontró la liquidación con id %', p_id_liquidacion;
  END IF;

  -- Insertar productos
  INSERT INTO bpkm.tbl_entrega_parcial_productos (
    id_liquidacion,
    codigo_producto,
    nombre_producto,
    cantidad_pedida,
    cantidad_entregada,
    precio_unitario,
    monto_parcial,
    creado_por
  )
  SELECT
    p_id_liquidacion,
    (prod->>'codigo_producto')::VARCHAR,
    (prod->>'nombre_producto')::VARCHAR,
    (prod->>'cantidad_pedida')::NUMERIC,
    (prod->>'cantidad_entregada')::NUMERIC,
    (prod->>'precio_unitario')::NUMERIC,
    (prod->>'monto_parcial')::NUMERIC,
    p_usuario
  FROM jsonb_array_elements(p_productos) AS prod
  WHERE (prod->>'cantidad_entregada')::NUMERIC > 0;

  int_success := TRUE;
  RETURN NEXT;
END;
$$;

alter function bpkm.post_productos_entrega_parcial(bigint, jsonb, integer) owner to antillonuser;

create or replace function bpkm.get_productos_entrega_parcial(p_id_liquidacion bigint)
    returns TABLE(id_entrega_parcial_prod bigint, id_liquidacion bigint, codigo_producto character varying, nombre_producto character varying, cantidad_pedida numeric, cantidad_entregada numeric, precio_unitario numeric, monto_parcial numeric, fecha_creacion timestamp without time zone)
    language plpgsql
as
$$
BEGIN
  RETURN QUERY
  SELECT
    epp.id_entrega_parcial_prod,
    epp.id_liquidacion,
    epp.codigo_producto,
    epp.nombre_producto,
    epp.cantidad_pedida,
    epp.cantidad_entregada,
    epp.precio_unitario,
    epp.monto_parcial,
    epp.fecha_creacion
  FROM bpkm.tbl_entrega_parcial_productos epp
  WHERE epp.id_liquidacion = p_id_liquidacion
  ORDER BY epp.id_entrega_parcial_prod;
END;
$$;

alter function bpkm.get_productos_entrega_parcial(bigint) owner to antillonuser;

create or replace function bpkm.get_cambios_sucursal(p_estado_codigo character varying DEFAULT NULL::character varying, p_id_sucursal integer DEFAULT 0, p_limit integer DEFAULT 50, p_offset integer DEFAULT 0)
    returns TABLE(items jsonb, total_count integer)
    language plpgsql
as
$$
DECLARE
  v_total INTEGER;
  v_items JSONB;
BEGIN
  -- Contar total
  SELECT COUNT(*) INTO v_total
  FROM bpkm.tbl_cambio_sucursal_factura cs
  LEFT JOIN bpkm.tbl_estado_bpkm e ON e.id_estado_bpkm = cs.id_estado
  WHERE (NULLIF(TRIM(p_estado_codigo),'') IS NULL OR e.codigo = UPPER(TRIM(p_estado_codigo)))
    AND (p_id_sucursal = 0 OR cs.id_sucursal_destino = p_id_sucursal);

  -- Obtener items
  SELECT jsonb_agg(row_to_json(d)::jsonb) INTO v_items
  FROM (
    SELECT
      cs.id_cambio_sucursal,
      cs.id_factura_sel,
      fs.folio_factura,
      cs.id_sucursal_origen,
      so.nombre AS sucursal_origen,
      cs.id_sucursal_destino,
      sd.nombre AS sucursal_destino,
      cs.motivo_solicitud,
      cs.observaciones_aprob,
      e.codigo AS estado_codigo,
      e.nombre AS estado_nombre,
      cs.fecha_solicitud,
      cs.fecha_aprobacion,
      CONCAT(us.nombre, ' ', us.apellido) AS usuario_solicita,
      CONCAT(ua.nombre, ' ', ua.apellido) AS usuario_aprueba
    FROM bpkm.tbl_cambio_sucursal_factura cs
    LEFT JOIN bpkm.tbl_estado_bpkm e ON e.id_estado_bpkm = cs.id_estado
    LEFT JOIN bpkm.tbl_factura_seleccion fs ON fs.id_factura_sel = cs.id_factura_sel
    LEFT JOIN usuarios.tbl_sucursales so ON so.id_sucursal = cs.id_sucursal_origen
    LEFT JOIN usuarios.tbl_sucursales sd ON sd.id_sucursal = cs.id_sucursal_destino
    LEFT JOIN usuarios.tbl_usuarios us ON us.id_usuario = cs.usuario_solicita
    LEFT JOIN usuarios.tbl_usuarios ua ON ua.id_usuario = cs.usuario_aprueba
    WHERE (NULLIF(TRIM(p_estado_codigo),'') IS NULL OR e.codigo = UPPER(TRIM(p_estado_codigo)))
      AND (p_id_sucursal = 0 OR cs.id_sucursal_destino = p_id_sucursal)
    ORDER BY cs.fecha_solicitud DESC
    LIMIT p_limit OFFSET p_offset
  ) d;

  items := COALESCE(v_items, '[]'::jsonb);
  total_count := v_total;
  RETURN NEXT;
END;
$$;

alter function bpkm.get_cambios_sucursal(varchar, integer, integer, integer) owner to antillonuser;

create or replace function bpkm.get_comentarios_ruta(p_id_ruta bigint)
    returns TABLE(id_comentario bigint, id_ruta bigint, comentario text, id_usuario integer, nombre_usuario character varying, fecha_creacion timestamp without time zone, estado integer)
    stable
    language plpgsql
as
$$
begin
  return query
  select
    c.id_comentario,
    c.id_ruta,
    c.comentario,
    c.id_usuario,
    u.nombre as nombre_usuario,
    c.fecha_creacion,
    c.estado
  from bpkm.tbl_comentarios_ruta c
  inner join usuarios.tbl_usuarios u on u.id_usuario = c.id_usuario
  where c.id_ruta = p_id_ruta
    and c.estado = 1
  order by c.fecha_creacion desc;
end;
$$;

alter function bpkm.get_comentarios_ruta(bigint) owner to antillonuser;

create or replace function bpkm.post_comentario_ruta(p_id_ruta bigint, p_comentario text, p_id_usuario integer)
    returns TABLE(id_comentario bigint, mensaje character varying)
    language plpgsql
as
$$
declare
  v_id_comentario bigint;
  v_ruta_existe boolean;
begin
  -- Validar que la ruta exista
  select exists(
    select 1 from bpkm.tbl_rutas where id_ruta = p_id_ruta
  ) into v_ruta_existe;

  if not v_ruta_existe then
    raise exception 'La ruta con ID % no existe', p_id_ruta;
  end if;

  -- Validar comentario no vacío
  if trim(p_comentario) = '' then
    raise exception 'El comentario no puede estar vacío';
  end if;

  -- Insertar comentario
  insert into bpkm.tbl_comentarios_ruta (
    id_ruta,
    comentario,
    id_usuario,
    estado
  ) values (
    p_id_ruta,
    trim(p_comentario),
    p_id_usuario,
    1
  )
  returning tbl_comentarios_ruta.id_comentario into v_id_comentario;

  -- Retornar resultado
  return query
  select
    v_id_comentario,
    'Comentario agregado exitosamente'::varchar;
end;
$$;

alter function bpkm.post_comentario_ruta(bigint, text, integer) owner to antillonuser;

create or replace function bpkm.post_rechazar_cambio_sucursal(p_id_cambio bigint, p_observaciones character varying, p_usuario integer)
    returns TABLE(int_success boolean)
    language plpgsql
as
$$
DECLARE
  v_id_factura_sel BIGINT;
  v_estado_rech INTEGER;
  v_folio_factura VARCHAR;
BEGIN
  -- Obtener id_factura_sel
  SELECT id_factura_sel
  INTO v_id_factura_sel
  FROM bpkm.tbl_cambio_sucursal_factura
  WHERE id_cambio_sucursal = p_id_cambio;

  IF v_id_factura_sel IS NULL THEN
    RAISE EXCEPTION 'No se encontró la solicitud de cambio con id %', p_id_cambio;
  END IF;

  -- Obtener folio
  SELECT folio_factura INTO v_folio_factura
  FROM bpkm.tbl_factura_seleccion
  WHERE id_factura_sel = v_id_factura_sel;

  -- Obtener estado RECH
  v_estado_rech := bpkm._estado_id('CAMBIO_SUC', 'RECH');

  -- Actualizar solicitud
  UPDATE bpkm.tbl_cambio_sucursal_factura
  SET id_estado = v_estado_rech,
      observaciones_aprob = p_observaciones,
      usuario_aprueba = p_usuario,
      fecha_aprobacion = NOW(),
      actualizado_por = p_usuario,
      fecha_actualizacion = NOW()
  WHERE id_cambio_sucursal = p_id_cambio;

  -- Registrar en bitácora
  PERFORM bpkm.post_bitacora(
    'FACTURA',
    v_id_factura_sel,
    'CAMBIO_RECH',
    CONCAT('Cambio de sucursal rechazado - Folio: ', COALESCE(v_folio_factura, '?'),
           CASE WHEN NULLIF(BTRIM(p_observaciones),'') IS NOT NULL
                THEN ' - Motivo: ' || BTRIM(p_observaciones)
                ELSE ''
           END),
    p_usuario
  );

  int_success := TRUE;
  RETURN NEXT;
END;
$$;

alter function bpkm.post_rechazar_cambio_sucursal(bigint, varchar, integer) owner to antillonuser;

create or replace function bpkm.post_sel_cambio(p_id_factura_sel bigint, p_id_solicitante integer, p_id_forma_nueva integer, p_id_transporte_externo_new integer, p_id_departamento_new integer, p_id_municipio_new integer, p_direccion_new character varying, p_comentario_solicitante character varying DEFAULT NULL::character varying)
    returns TABLE(int_id_sel_cambio bigint)
    language plpgsql
as
$$
DECLARE
  v_pend   INTEGER := bpkm._estado_id('SEL_CAMBIO','PEND');
  v_forma_anterior INTEGER;
  v_folio_factura VARCHAR;
BEGIN
  -- Obtener forma actual y folio
  SELECT id_forma_entrega, folio_factura
  INTO v_forma_anterior, v_folio_factura
  FROM bpkm.tbl_factura_seleccion
  WHERE id_factura_sel = p_id_factura_sel;

  IF v_forma_anterior IS NULL THEN
    RAISE EXCEPTION 'Selección no encontrada';
  END IF;

  -- Validar que la factura NO esté en ruta
  IF EXISTS (
    SELECT 1
    FROM bpkm.tbl_factura_seleccion
    WHERE id_factura_sel = p_id_factura_sel
      AND en_ruta = 1
  ) THEN
    RAISE EXCEPTION 'No se puede cambiar la forma de entrega de la factura % porque está asignada a una ruta. Debe liquidarse la ruta primero.', v_folio_factura;
  END IF;

  -- Insertar solicitud de cambio
  INSERT INTO bpkm.tbl_factura_sel_cambio(
    id_factura_sel,
    id_solicitante,
    id_forma_anterior,
    id_forma_nueva,
    id_transporte_externo_new,
    id_departamento_new,
    id_municipio_new,
    direccion_new,
    comentario_solicitante,
    id_estado,
    creado_por
  )
  VALUES(
    p_id_factura_sel,
    p_id_solicitante,
    v_forma_anterior,
    p_id_forma_nueva,
    NULLIF(p_id_transporte_externo_new, 0),
    NULLIF(p_id_departamento_new, 0),
    NULLIF(p_id_municipio_new, 0),
    NULLIF(BTRIM(p_direccion_new), ''),
    NULLIF(BTRIM(p_comentario_solicitante), ''),
    v_pend,
    p_id_solicitante
  )
  RETURNING id_sel_cambio INTO int_id_sel_cambio;

  -- Registrar en bitácora
  PERFORM bpkm.post_bitacora('SEL', p_id_factura_sel, 'CAMBIO_PEND',
    CONCAT('Solicitud de cambio de forma - ID: ', int_id_sel_cambio), p_id_solicitante);

  RETURN NEXT;
END
$$;

alter function bpkm.post_sel_cambio(bigint, integer, integer, integer, integer, integer, varchar, varchar) owner to antillonuser;

create or replace function bpkm.post_solicitar_cambio_sucursal(p_id_factura_sel bigint, p_id_sucursal_destino integer, p_motivo character varying, p_usuario integer)
    returns TABLE(int_id_cambio bigint)
    language plpgsql
as
$$
DECLARE
  v_id_cambio BIGINT;
  v_id_sucursal_origen INTEGER;
  v_estado_pend INTEGER;
  v_folio_factura VARCHAR;
BEGIN
  -- Validar que la factura exista y obtener su sucursal actual
  SELECT id_sucursal_creador, folio_factura
  INTO v_id_sucursal_origen, v_folio_factura
  FROM bpkm.tbl_factura_seleccion
  WHERE id_factura_sel = p_id_factura_sel;

  IF v_id_sucursal_origen IS NULL THEN
    RAISE EXCEPTION 'No se encontró la factura con id %', p_id_factura_sel;
  END IF;

  -- Validar que la factura NO esté en ruta
  IF EXISTS (
    SELECT 1
    FROM bpkm.tbl_factura_seleccion
    WHERE id_factura_sel = p_id_factura_sel
      AND en_ruta = 1
  ) THEN
    RAISE EXCEPTION 'No se puede cambiar la sucursal de la factura % porque está asignada a una ruta. Debe liquidarse la ruta primero.', v_folio_factura;
  END IF;

  -- Validar que la sucursal destino sea diferente del origen
  IF v_id_sucursal_origen = p_id_sucursal_destino THEN
    RAISE EXCEPTION 'La sucursal de destino debe ser diferente a la actual';
  END IF;

  -- Obtener estado PEND de cambio de sucursal
  v_estado_pend := bpkm._estado_id('CAMBIO_SUC', 'PEND');

  -- Crear solicitud de cambio
  INSERT INTO bpkm.tbl_cambio_sucursal_factura (
    id_factura_sel,
    id_sucursal_origen,
    id_sucursal_destino,
    motivo_solicitud,
    id_estado,
    usuario_solicita,
    creado_por
  ) VALUES (
    p_id_factura_sel,
    v_id_sucursal_origen,
    p_id_sucursal_destino,
    p_motivo,
    v_estado_pend,
    p_usuario,
    p_usuario
  ) RETURNING id_cambio_sucursal INTO v_id_cambio;

  -- Registrar en bitácora de factura
  PERFORM bpkm.post_bitacora(
    'FACTURA',
    p_id_factura_sel,
    'CAMBIO_PEND',
    CONCAT('Solicitud de cambio de sucursal - Folio: ', COALESCE(v_folio_factura, '?'),
           ' - Destino: ', (SELECT nombre FROM usuarios.tbl_sucursales WHERE id_sucursal = p_id_sucursal_destino),
           ' - Motivo: ', p_motivo),
    p_usuario
  );

  int_id_cambio := v_id_cambio;
  RETURN NEXT;
END;
$$;

alter function bpkm.post_solicitar_cambio_sucursal(bigint, integer, varchar, integer) owner to antillonuser;

create or replace function bpkm.get_ruta_completa_pdf(p_id_ruta bigint)
    returns TABLE(id_ruta integer, codigo_ruta character varying, tipo_ruta character varying, placa_camion character varying, piloto character varying, auxiliar character varying, sucursal_salida character varying, sucursal_regreso character varying, fecha_salida_plan timestamp without time zone, fecha_entrada_plan timestamp without time zone, monto_total numeric, total_facturas bigint, nombre_transporte_externo character varying, facturas jsonb)
    stable
    language plpgsql
as
$$
BEGIN
  RETURN QUERY
  SELECT
    r.id_ruta,
    r.numero_ruta,
    r.tipo_ruta,
    c.placa AS placa_camion,
    p.nombre AS piloto,
    a.nombre AS auxiliar,
    ss.nombre AS sucursal_salida,
    sr.nombre AS sucursal_regreso,
    r.fecha_salida_plan,
    r.fecha_entrada_plan,
    r.monto_total AS monto_total,
    COUNT(dr.id_detalle_ruta) AS total_facturas,
    te.nombre AS nombre_transporte_externo,
    COALESCE(
      jsonb_agg(
        jsonb_build_object(
          'folio', dr.folio_factura,
          'cliente', initcap(fac.card_name),
          'departamento', cd.nombre,
          'municipio', m.nombre,
          'nombre_transporte_sel', te_sel.nombre,
          'direccion', CASE
            WHEN r.tipo_ruta = 'TE' AND (dr.direccion_snap IS NULL OR TRIM(dr.direccion_snap) = '')
            THEN 'Transporte Externo'
            ELSE dr.direccion_snap
          END,
          'distancia_km', dr.distancia_km
        ) ORDER BY LOWER(TRIM(fac.card_name)), dr.folio_factura
      ),
      '[]'::jsonb
    ) AS facturas
  FROM bpkm.tbl_rutas r
  LEFT JOIN bpkm.tbl_camiones c ON c.id_camion = r.id_camion
  LEFT JOIN bpkm.tbl_personal p ON p.id_personal = r.id_piloto
  LEFT JOIN bpkm.tbl_personal a ON a.id_personal = r.id_auxiliar
  LEFT JOIN usuarios.tbl_sucursales ss ON ss.id_sucursal = r.id_sucursal_salida
  LEFT JOIN usuarios.tbl_sucursales sr ON sr.id_sucursal = r.id_sucursal_regreso
  LEFT JOIN bpkm.tbl_transporte_externo te ON te.id_transporte_externo = r.id_transporte_externo
  LEFT JOIN bpkm.tbl_detalles_ruta dr ON dr.id_ruta = r.id_ruta AND dr.id_estado != bpkm._estado_id('DETALLE','ANULADO')
  LEFT JOIN bpkm.tbl_factura_seleccion fs ON fs.id_factura_sel = dr.id_factura_sel
  LEFT JOIN catalogos.tbl_ciudades cd ON cd.id_ciudad = fs.id_departamento
  LEFT JOIN catalogos.tbl_municipios m ON m.id_municipio = fs.id_municipio
  LEFT JOIN bpkm.tbl_transporte_externo te_sel ON te_sel.id_transporte_externo = fs.id_transporte_externo
  LEFT JOIN ndc.tbl_cat_facturas fac ON fac.id = fs.id_factura
  WHERE r.id_ruta = p_id_ruta
  GROUP BY
    r.id_ruta, r.numero_ruta, r.tipo_ruta, c.placa, p.nombre, a.nombre,
    ss.nombre, sr.nombre, r.fecha_salida_plan, r.fecha_entrada_plan,
    r.monto_total, te.nombre;
END;
$$;

alter function bpkm.get_ruta_completa_pdf(bigint) owner to antillonuser;

create or replace function bpkm.put_ruta_recalcular_monto(p_id_ruta bigint, p_usuario integer)
    returns TABLE(int_monto_total numeric)
    language plpgsql
as
$$
DECLARE
  v_monto NUMERIC;
BEGIN
  SELECT COALESCE(SUM(f.doc_total), 0)
  INTO v_monto
  FROM bpkm.tbl_detalles_ruta dr
  JOIN bpkm.tbl_factura_seleccion fs ON fs.id_factura_sel = dr.id_factura_sel
  JOIN ndc.tbl_cat_facturas f ON f.id = fs.id_factura
  WHERE dr.id_ruta = p_id_ruta
    AND dr.id_estado != bpkm._estado_id('DETALLE','ANULADO');

  UPDATE bpkm.tbl_rutas
  SET monto_total = v_monto,
      actualizado_por = p_usuario,
      fecha_actualizacion = NOW()
  WHERE id_ruta = p_id_ruta;

  int_monto_total := v_monto;
  RETURN NEXT;
END;
$$;

alter function bpkm.put_ruta_recalcular_monto(bigint, integer) owner to antillonuser;

create or replace function bpkm.post_aprobar_cambio_sucursal(p_id_cambio bigint, p_observaciones character varying, p_usuario integer)
    returns TABLE(int_success boolean)
    language plpgsql
as
$$
DECLARE
  v_id_factura_sel BIGINT;
  v_id_sucursal_destino INTEGER;
  v_estado_apr INTEGER;
  v_folio_factura VARCHAR;
BEGIN
  -- Obtener datos del cambio
  SELECT
    cs.id_factura_sel,
    cs.id_sucursal_destino
  INTO v_id_factura_sel, v_id_sucursal_destino
  FROM bpkm.tbl_cambio_sucursal_factura cs
  WHERE cs.id_cambio_sucursal = p_id_cambio;

  IF v_id_factura_sel IS NULL THEN
    RAISE EXCEPTION 'No se encontró la solicitud de cambio con id %', p_id_cambio;
  END IF;

  -- Obtener folio de la factura
  SELECT folio_factura INTO v_folio_factura
  FROM bpkm.tbl_factura_seleccion
  WHERE id_factura_sel = v_id_factura_sel;

  -- Validar que la factura NO esté en ruta al momento de aprobar
  IF EXISTS(
    SELECT 1 FROM bpkm.tbl_factura_seleccion
    WHERE id_factura_sel = v_id_factura_sel
    AND en_ruta = 1
  ) THEN
    RAISE EXCEPTION 'No se puede aprobar el cambio porque la factura % está asignada a una ruta. Debe quitarse de la ruta primero.', v_folio_factura;
  END IF;

  -- Obtener estado APR
  v_estado_apr := bpkm._estado_id('CAMBIO_SUC', 'APR');

  -- Actualizar solicitud
  UPDATE bpkm.tbl_cambio_sucursal_factura
  SET id_estado = v_estado_apr,
      observaciones_aprob = p_observaciones,
      usuario_aprueba = p_usuario,
      fecha_aprobacion = NOW(),
      actualizado_por = p_usuario,
      fecha_actualizacion = NOW()
  WHERE id_cambio_sucursal = p_id_cambio;

  -- Ejecutar el cambio de sucursal en la factura
  UPDATE bpkm.tbl_factura_seleccion
  SET id_sucursal_creador = v_id_sucursal_destino,
      actualizado_por = p_usuario,
      fecha_actualizacion = NOW()
  WHERE id_factura_sel = v_id_factura_sel;

  -- Registrar en bitácora
  PERFORM bpkm.post_bitacora(
    'FACTURA',
    v_id_factura_sel,
    'CAMBIO_APR',
    CONCAT('Cambio de sucursal aprobado - Folio: ', COALESCE(v_folio_factura, '?'),
           ' - Nueva sucursal: ', (SELECT nombre FROM usuarios.tbl_sucursales WHERE id_sucursal = v_id_sucursal_destino),
           CASE WHEN NULLIF(BTRIM(p_observaciones),'') IS NOT NULL
                THEN ' - Obs: ' || BTRIM(p_observaciones)
                ELSE ''
           END),
    p_usuario
  );

  int_success := TRUE;
  RETURN NEXT;
END;
$$;

alter function bpkm.post_aprobar_cambio_sucursal(bigint, varchar, integer) owner to antillonuser;

create or replace function bpkm.get_camiones_admin(p_id_camion integer, p_placa_like character varying, p_estado integer, p_id_sucursal integer DEFAULT 0)
    returns TABLE(int_id_camion integer, str_placa character varying, int_estado integer, str_nombre_estado character varying, int_creado_por integer, str_nombre_creador character varying, str_fecha_creacion character varying, int_actualizado_por integer, str_nombre_actualizador character varying, str_fecha_actualizacion character varying, int_id_sucursal integer, str_nombre_sucursal character varying)
    language plpgsql
as
$$

BEGIN
  RETURN QUERY
      select
        tc.id_camion,
        tc.placa,
        tc.estado,
        case when tc.estado = 1 then 'ACTIVO' else 'INACTIVO' end::character varying as nombre_estado,
        tc.creado_por,
        u_creador.nombre as nombre_creador,
        to_char( tc.fecha_creacion, 'DD-MM-YYYY HH24:MI:SS')::character varying as fecha_creacion,
        tc.actualizado_por,
        u_actualizador.nombre as nombre_actualizador,
        to_char( tc.fecha_actualizacion, 'DD-MM-YYYY HH24:MI:SS')::character varying as fecha_actualizacion,
        tc.id_sucursal,
        s.nombre
    from bpkm.tbl_camiones tc
    left join usuarios.tbl_usuarios u_creador on tc.creado_por = u_creador.id_usuario
    left join usuarios.tbl_usuarios u_actualizador on tc.actualizado_por = u_actualizador.id_usuario
    left join usuarios.tbl_sucursales s on s.id_sucursal = tc.id_sucursal
  WHERE (p_id_camion = 0 OR tc.id_camion = p_id_camion)
    AND (p_estado    = 2 OR tc.estado = p_estado)
    AND (p_placa_like = '' OR tc.placa ILIKE p_placa_like)
    AND (p_id_sucursal = 0 OR tc.id_sucursal = p_id_sucursal)
  ORDER BY tc.id_camion DESC
  LIMIT 1000;
END;
$$;

alter function bpkm.get_camiones_admin(integer, varchar, integer, integer) owner to antillonuser;

create or replace function bpkm.post_liquidar_sel_despacho_sucursal(p_id_factura_sel integer, p_usuario integer, p_comentario character varying DEFAULT NULL::character varying)
    returns TABLE(int_id_factura_sel bigint, str_mensaje character varying)
    rows 1
    language plpgsql
as
$$

DECLARE
  v_forma_codigo VARCHAR;
  v_estado_codigo VARCHAR;
  v_tiene_cambio_suc_pendiente INTEGER;
  v_tiene_cambio_forma_pendiente INTEGER;
  v_id_estado_cerrada INTEGER;
  v_detalle_bitacora VARCHAR;
BEGIN
  -- ============================================
  -- VALIDACION 1: Verificar forma SUC y estado ACT
  -- ============================================
  SELECT
    tfe.codigo,
    teb.codigo
  INTO
    v_forma_codigo,
    v_estado_codigo
  FROM bpkm.tbl_factura_seleccion tfs
  LEFT JOIN bpkm.tbl_forma_entrega tfe
    ON tfs.id_forma_entrega = tfe.id_forma_entrega
  LEFT JOIN bpkm.tbl_estado_bpkm teb
    ON tfs.id_estado_sel = teb.id_estado_bpkm
    AND teb.tabla = 'SEL'
  WHERE tfs.id_factura_sel = p_id_factura_sel;

  IF v_forma_codigo IS NULL THEN
    RAISE EXCEPTION 'Selección no encontrada';
  END IF;

  IF v_forma_codigo <> 'SUC' THEN
    RAISE EXCEPTION 'Solo se pueden liquidar facturas con despacho en sucursal';
  END IF;

  IF v_estado_codigo <> 'ACT' THEN
    RAISE EXCEPTION 'Solo se pueden liquidar facturas en estado Pendiente de envío';
  END IF;

  SELECT COUNT(1)
  INTO v_tiene_cambio_suc_pendiente
  FROM bpkm.tbl_cambio_sucursal_factura csf
  LEFT JOIN bpkm.tbl_estado_bpkm ecs
    ON ecs.id_estado_bpkm = csf.id_estado
  WHERE csf.id_factura_sel = p_id_factura_sel
    AND ecs.codigo = 'PEND';

  IF v_tiene_cambio_suc_pendiente > 0 THEN
    RAISE EXCEPTION 'No se puede liquidar: tiene un cambio de sucursal pendiente';
  END IF;

  SELECT COUNT(1)
  INTO v_tiene_cambio_forma_pendiente
  FROM bpkm.tbl_factura_sel_cambio fsc
  LEFT JOIN bpkm.tbl_estado_bpkm esc
    ON esc.id_estado_bpkm = fsc.id_estado
  WHERE fsc.id_factura_sel = p_id_factura_sel
    AND esc.codigo = 'PEND';

  IF v_tiene_cambio_forma_pendiente > 0 THEN
    RAISE EXCEPTION 'No se puede liquidar: tiene un cambio de forma de entrega pendiente';
  END IF;

  v_id_estado_cerrada := bpkm._estado_id('SEL', 'CERRADA');

  UPDATE bpkm.tbl_factura_seleccion
  SET id_estado_sel = v_id_estado_cerrada,
      actualizado_por = p_usuario,
      fecha_actualizacion = NOW()
  WHERE id_factura_sel = p_id_factura_sel;

  -- ============================================
  -- BITACORA: Registrar cierre
  -- ============================================
  v_detalle_bitacora := 'Entregado en sucursal.';

  IF NULLIF(BTRIM(p_comentario), '') IS NOT NULL THEN
    v_detalle_bitacora := v_detalle_bitacora || ' ' || BTRIM(p_comentario);
  END IF;

  PERFORM bpkm.post_bitacora(
    'SEL',
    p_id_factura_sel,
    'CERRAR',
    v_detalle_bitacora,
    p_usuario
  );

  int_id_factura_sel := p_id_factura_sel;
  str_mensaje := 'Factura despachada en sucursal exitosamente';

  RETURN NEXT;
END;
$$;

alter function bpkm.post_liquidar_sel_despacho_sucursal(integer, integer, varchar) owner to antillonuser;

create or replace function bpkm.get_estado_entrega_by_folio(p_folio_factura character varying)
    returns TABLE(id_factura_sel bigint, estado character varying, forma_entrega character varying)
    stable
    language plpgsql
as
$$
BEGIN
    IF NULLIF(BTRIM(p_folio_factura), '') IS NULL THEN
        RAISE EXCEPTION 'El folio de factura es requerido';
    END IF;

    RETURN QUERY
    WITH liq AS (
        SELECT
            tdr.id_factura_sel,
            teb.nombre AS estado
        FROM bpkm.tbl_detalles_ruta tdr
        LEFT JOIN bpkm.tbl_liquidacion_detalle tld
            ON tdr.id_detalle_ruta = tld.id_detalle_ruta
        LEFT JOIN bpkm.tbl_estado_bpkm teb
            ON tld.id_estado_liq = teb.id_estado_bpkm
        WHERE tdr.folio_factura = BTRIM(p_folio_factura)
        ORDER BY tld.id_liquidacion DESC
        LIMIT 1
        -- Motivo: obtener último estado de liquidación
    )
    SELECT
        tfs.id_factura_sel,
        concat_ws(
            ' - ',
            CASE teb.codigo
                WHEN 'ACT' THEN 'Pendiente de Envío'
                WHEN 'CERRADA' THEN 'Entregada'
                ELSE teb.nombre
            END,
            liq.estado
        )::character varying AS estado,
        tfe.nombre AS forma_entrega
    FROM bpkm.tbl_factura_seleccion tfs
    LEFT JOIN bpkm.tbl_estado_bpkm teb
        ON tfs.id_estado_sel = teb.id_estado_bpkm
    LEFT JOIN bpkm.tbl_forma_entrega tfe
        ON tfs.id_forma_entrega = tfe.id_forma_entrega
    LEFT JOIN liq
        ON liq.id_factura_sel = tfs.id_factura_sel
    WHERE tfs.folio_factura = BTRIM(p_folio_factura)
    ORDER BY tfs.fecha_creacion DESC
    LIMIT 1;
END;
$$;

alter function bpkm.get_estado_entrega_by_folio(varchar) owner to antillonuser;

create or replace function bpkm.post_agregar_factura_a_ruta(p_id_ruta bigint, p_id_factura_sel bigint, p_usuario integer)
    returns TABLE(int_id_detalle_ruta bigint)
    language plpgsql
as
$$

DECLARE
  v_estado_en_ruta   INTEGER := bpkm._estado_id('SEL','EN_RUTA');
  v_estado_detalle   INTEGER := bpkm._estado_id('DETALLE','PEND');
  v_estado_en_curso  INTEGER := bpkm._estado_id('RUTA','EN_CURSO');
  v_id_detalle BIGINT;
  v_folio VARCHAR;
  v_forma INTEGER;
  v_transp INTEGER;
  v_depto INTEGER;
  v_muni INTEGER;
  v_dir VARCHAR;
  v_dist NUMERIC;
  v_intento INTEGER;
  v_estado_actual_ruta INTEGER;
  v_total_detalles INTEGER;
  v_numero_ruta VARCHAR;
  v_id_sucursal_salida INTEGER;
  v_es_ruta_xela BOOLEAN;
BEGIN
  -- Obtener código de ruta al inicio
  SELECT numero_ruta INTO v_numero_ruta
  FROM bpkm.tbl_rutas
  WHERE id_ruta = p_id_ruta;

  -- Bloquear selección
  PERFORM 1 FROM bpkm.tbl_factura_seleccion WHERE id_factura_sel = p_id_factura_sel FOR UPDATE;

  IF NOT EXISTS(
    SELECT 1 FROM bpkm.tbl_factura_seleccion
    WHERE id_factura_sel = p_id_factura_sel
      AND anulada = 0 AND en_ruta = 0
      AND id_estado_sel = bpkm._estado_id('SEL','ACT')
  ) THEN
    RAISE EXCEPTION 'Factura no disponible para agregar a ruta';
  END IF;

  -- No permitir la misma factura dos veces en la MISMA ruta
  IF EXISTS(
    SELECT 1 FROM bpkm.tbl_detalles_ruta
    WHERE id_ruta = p_id_ruta AND id_factura_sel = p_id_factura_sel
  ) THEN
    RAISE EXCEPTION 'La factura ya está asignada a esta ruta';
  END IF;

  -- Obtener sucursal de salida para determinar qué distancia usar
  SELECT r.id_sucursal_salida
  INTO v_id_sucursal_salida
  FROM bpkm.tbl_rutas r
  WHERE r.id_ruta = p_id_ruta;

  v_es_ruta_xela := (v_id_sucursal_salida IN (14, 15, 16));

  -- Seleccionar distancia correcta según sucursal
  -- Sucursales 14 (Xela) y 15 (Perixela) usan distancia_desde_xela
  -- Otras sucursales usan distancia_km (desde Guatemala)
  SELECT
    fs.folio_factura,
    fs.id_forma_entrega,
    fs.id_transporte_externo,
    fs.id_departamento,
    fs.id_municipio,
    fs.direccion_entrega,
    CASE
      WHEN v_es_ruta_xela THEN COALESCE(m.distancia_desde_xela, 0)
      ELSE COALESCE(m.distancia_km, 0)
    END,
    COALESCE((SELECT COUNT(*) FROM bpkm.tbl_detalles_ruta WHERE id_factura_sel = p_id_factura_sel), 0) + 1
  INTO v_folio, v_forma, v_transp, v_depto, v_muni, v_dir, v_dist, v_intento
  FROM bpkm.tbl_factura_seleccion fs
  LEFT JOIN catalogos.tbl_municipios m ON m.id_municipio = fs.id_municipio
  WHERE fs.id_factura_sel = p_id_factura_sel;

  INSERT INTO bpkm.tbl_detalles_ruta(
    id_ruta, id_factura_sel, folio_factura,
    id_forma_entrega_snap, id_transp_ext_snap,
    id_departamento_snap, id_municipio_snap,
    direccion_snap, distancia_km, intento_numero,
    creado_por, fecha_creacion, id_estado
  ) VALUES (
    p_id_ruta, p_id_factura_sel, v_folio,
    v_forma, v_transp,
    v_depto, v_muni,
    v_dir, v_dist, v_intento,
    p_usuario, NOW(), v_estado_detalle
  ) RETURNING id_detalle_ruta INTO v_id_detalle;

  UPDATE bpkm.tbl_factura_seleccion
  SET en_ruta = 1,
      id_estado_sel = v_estado_en_ruta,
      actualizado_por = p_usuario,
      fecha_actualizacion = NOW()
  WHERE id_factura_sel = p_id_factura_sel;

  -- ✅ CORREGIDO: Usa código de ruta en lugar de ID
  PERFORM bpkm.post_bitacora('SEL', p_id_factura_sel, 'EN_RUTA',
    'Agregada a ruta ' || COALESCE(v_numero_ruta, p_id_ruta::VARCHAR) || ' - Intento #' || v_intento, p_usuario);

  -- ====================================================================
  -- NUEVO: Si es la primera factura agregada, cambiar estado a EN_CURSO
  -- USA: id_estado_ruta (CORREGIDO)
  -- ====================================================================
  SELECT id_estado_ruta INTO v_estado_actual_ruta
  FROM bpkm.tbl_rutas
  WHERE id_ruta = p_id_ruta;

  -- Contar cuántos detalles tiene la ruta ahora (incluyendo el recién agregado)
  SELECT COUNT(*) INTO v_total_detalles
  FROM bpkm.tbl_detalles_ruta
  WHERE id_ruta = p_id_ruta;

  -- Si la ruta está en CREADA y ahora tiene al menos 1 detalle → cambiar a EN_CURSO
  IF v_estado_actual_ruta = bpkm._estado_id('RUTA','CREADA') AND v_total_detalles >= 1 THEN
    UPDATE bpkm.tbl_rutas
    SET id_estado_ruta = v_estado_en_curso,
        actualizado_por = p_usuario,
        fecha_actualizacion = NOW()
    WHERE id_ruta = p_id_ruta;

    PERFORM bpkm.post_bitacora_ruta(
      p_id_ruta,
      'EN_CURSO',
      'Ruta pasó a EN_CURSO automáticamente al agregar primera factura',
      p_usuario
    );

    RAISE NOTICE 'Ruta % cambió automáticamente de CREADA a EN_CURSO', COALESCE(v_numero_ruta, p_id_ruta::VARCHAR);
  END IF;

  int_id_detalle_ruta := v_id_detalle;
  RETURN NEXT;
END;
$$;

alter function bpkm.post_agregar_factura_a_ruta(bigint, bigint, integer) owner to antillonuser;

create or replace function bpkm.patch_bpkm_distancia_lejana(p_id_bpkm integer, p_distancia numeric, p_usuario integer)
    returns TABLE(ok boolean, mensaje character varying)
    language plpgsql
as
$$
DECLARE
  v_estado_codigo      VARCHAR;
  v_distancia_actual   NUMERIC;
  v_distancia_anterior NUMERIC;
  v_nuevo_piloto       NUMERIC;
  v_nuevo_auxiliar     NUMERIC;
BEGIN
  -- 1. Verificar existencia y estado actual del BPKM
  SELECT e.codigo, b.distancia_mas_lejana, b.distancia_anterior
  INTO v_estado_codigo, v_distancia_actual, v_distancia_anterior
  FROM bpkm.tbl_bpkm b
  LEFT JOIN bpkm.tbl_estado_bpkm e ON e.id_estado_bpkm = b.id_estado_bpkm
  WHERE b.id_bpkm = p_id_bpkm;

  IF NOT FOUND THEN
    RETURN QUERY SELECT false, 'BPKM no encontrado'::varchar;
    RETURN;
  END IF;

  IF v_estado_codigo != 'PEND' THEN
    RETURN QUERY SELECT false, 'Solo se puede modificar en estado Pendiente'::varchar;
    RETURN;
  END IF;

  -- 2. Validar rango de distancia
  IF p_distancia <= 0 THEN
    RETURN QUERY SELECT false, 'La distancia debe ser mayor a 0'::varchar;
    RETURN;
  END IF;

  IF p_distancia > 1000 THEN
    RETURN QUERY SELECT false, 'La distancia no puede superar 1000 km'::varchar;
    RETURN;
  END IF;

  -- 3. Recalcular comisiones sugeridas con bpkm.calcular_comision_bpkm
  v_nuevo_piloto   := bpkm.calcular_comision_bpkm(p_distancia);
  v_nuevo_auxiliar := v_nuevo_piloto * 0.50;

  -- 4. Actualizar tbl_bpkm
  -- La 1a vez respalda distancia_mas_lejana en distancia_anterior (cambiando estado a INGRESADO).
  -- En subsiguientes modificaciones, conserva la distancia_anterior original y actualiza distancia_mas_lejana.
  UPDATE bpkm.tbl_bpkm
  SET distancia_anterior     = COALESCE(distancia_anterior, distancia_mas_lejana),
      distancia_mas_lejana    = p_distancia,
      km_punto_lejano         = p_distancia::integer,
      monto_sugerido_piloto   = v_nuevo_piloto,
      monto_sugerido_auxiliar = v_nuevo_auxiliar,
      actualizado_por         = p_usuario,
      fecha_actualizacion     = NOW()
  WHERE id_bpkm = p_id_bpkm;

  -- 5. Registrar en bitácora de auditoría
  PERFORM bpkm.post_bitacora(
    'bpkm',
    p_id_bpkm,
    'DISTANCIA_MODIFICADA',
    CONCAT('Distancia modificada: ', COALESCE(v_distancia_actual::TEXT, 'N/A'), ' km → ', p_distancia, ' km. ',
           'Nuevas comisiones sugeridas -> Piloto: Q', ROUND(v_nuevo_piloto, 2),
           ', Auxiliar: Q', ROUND(v_nuevo_auxiliar, 2)),
    p_usuario
  );

  RETURN QUERY SELECT true, 'Distancia y comisiones actualizadas correctamente'::varchar;
END;
$$;

alter function bpkm.patch_bpkm_distancia_lejana(integer, numeric, integer) owner to antillonuser;

create or replace function bpkm.get_bpkm_sucursales()
    returns TABLE(id_sucursal integer, sucursal character varying)
    stable
    language sql
as
$$
  SELECT DISTINCT
    tr.id_sucursal_salida AS id_sucursal,
    ts.nombre             AS sucursal
  FROM bpkm.tbl_rutas tr
  INNER JOIN bpkm.tbl_bpkm tb ON tb.id_ruta = tr.id_ruta
  INNER JOIN usuarios.tbl_sucursales ts ON ts.id_sucursal = tr.id_sucursal_salida
  ORDER BY ts.nombre;
$$;

alter function bpkm.get_bpkm_sucursales() owner to antillonuser;

create or replace function bpkm.get_bpkm_camiones()
    returns TABLE(id_camion integer, placa character varying, id_sucursal integer, sucursal character varying)
    stable
    language sql
as
$$
  SELECT DISTINCT
    tr.id_camion     AS id_camion,
    tc.placa         AS placa,
    ts.id_sucursal   AS id_sucursal,
    ts.nombre        AS sucursal
  FROM bpkm.tbl_rutas tr
  INNER JOIN bpkm.tbl_bpkm tb ON tb.id_ruta = tr.id_ruta
  INNER JOIN bpkm.tbl_camiones tc ON tc.id_camion = tr.id_camion
  INNER JOIN usuarios.tbl_sucursales ts ON ts.id_sucursal = tc.id_sucursal
  ORDER BY tc.placa;
$$;

alter function bpkm.get_bpkm_camiones() owner to antillonuser;

create or replace function bpkm.put_sel_cambio_resolver(p_id_sel_cambio bigint, p_decision_codigo character varying, p_id_autorizador integer, p_comentario_autorizador character varying)
    returns TABLE(int_success boolean)
    language plpgsql
as
$$
DECLARE
  v_id_estado      INTEGER;
  v_id_factura_sel BIGINT;
  v_id_forma_nueva INTEGER;
  v_id_transp_new  INTEGER;
  v_id_depto_new   INTEGER;
  v_id_muni_new    INTEGER;
  v_dir_new        VARCHAR;
BEGIN
  IF UPPER(TRIM(p_decision_codigo)) NOT IN ('APR', 'RECH') THEN
    RAISE EXCEPTION 'decision_codigo debe ser APR o RECH';
  END IF;

  v_id_estado := bpkm._estado_id('SEL_CAMBIO', p_decision_codigo);

  -- Obtener datos del cambio
  SELECT
    id_factura_sel,
    id_forma_nueva,
    id_transporte_externo_new,
    id_departamento_new,
    id_municipio_new,
    direccion_new
  INTO
    v_id_factura_sel,
    v_id_forma_nueva,
    v_id_transp_new,
    v_id_depto_new,
    v_id_muni_new,
    v_dir_new
  FROM bpkm.tbl_factura_sel_cambio
  WHERE id_sel_cambio = p_id_sel_cambio;

  IF v_id_factura_sel IS NULL THEN
    RAISE EXCEPTION 'Cambio no encontrado';
  END IF;

  -- Actualizar estado del cambio
  UPDATE bpkm.tbl_factura_sel_cambio
  SET id_estado              = v_id_estado,
      id_autorizador         = p_id_autorizador,
      comentario_autorizador = NULLIF(BTRIM(p_comentario_autorizador), ''),
      actualizado_por        = p_id_autorizador,
      fecha_actualizacion    = NOW()
  WHERE id_sel_cambio = p_id_sel_cambio;

  -- Si aprobado, actualizar selección
  IF UPPER(TRIM(p_decision_codigo)) = 'APR' THEN
    UPDATE bpkm.tbl_factura_seleccion
    SET id_forma_entrega      = v_id_forma_nueva,
        id_transporte_externo = v_id_transp_new,
        id_departamento       = v_id_depto_new,
        id_municipio          = v_id_muni_new,
        direccion_entrega     = COALESCE(v_dir_new, direccion_entrega),
        actualizado_por       = p_id_autorizador,
        fecha_actualizacion   = NOW()
    WHERE id_factura_sel = v_id_factura_sel;

    PERFORM bpkm.post_bitacora('SEL', v_id_factura_sel, 'CAMBIO_APR',
      CONCAT('Cambio de forma aprobado - ID cambio: ', p_id_sel_cambio), p_id_autorizador);
  ELSE
    PERFORM bpkm.post_bitacora('SEL', v_id_factura_sel, 'CAMBIO_RECH',
      CONCAT('Cambio de forma rechazado - ID cambio: ', p_id_sel_cambio), p_id_autorizador);
  END IF;

  int_success := TRUE;
  RETURN NEXT;
END;
$$;

alter function bpkm.put_sel_cambio_resolver(bigint, varchar, integer, varchar) owner to antillonuser;

create or replace function bpkm._get_sucursales_permitidas_cambio(p_id_usuario integer) returns integer[]
    stable
    language plpgsql
as
$$
DECLARE
  v_sucursal integer;
BEGIN
  -- Excepción: mayoreo1vema (id=202) gestiona Xela (14,15,16) + VEMA (17)
  IF p_id_usuario = 202 THEN
    RETURN ARRAY[14, 15, 16, 17];
  END IF;

  -- Regla general: sucursal asignada activa del usuario
  SELECT id_sucursal INTO v_sucursal
  FROM   usuarios.tbl_asignaciones_usuario_rol_sucursal
  WHERE  id_usuario = p_id_usuario
    AND  estado     = 1
  LIMIT  1;

  IF v_sucursal IS NULL THEN
    RETURN ARRAY[]::integer[];
  END IF;

  RETURN ARRAY[v_sucursal];
END;
$$;

alter function bpkm._get_sucursales_permitidas_cambio(integer) owner to antillonuser;

create or replace function bpkm.get_solicitudes_cambio(p_estado_codigo character varying, p_fecha_desde date, p_fecha_hasta date, p_folio_like character varying, p_limit integer, p_offset integer, p_id_usuario integer DEFAULT 0)
    returns TABLE(id_sel_cambio bigint, id_factura_sel bigint, folio_factura character varying, forma_anterior_nombre character varying, forma_nueva_nombre character varying, destino_anterior text, destino_nuevo text, solicitante_nombre character varying, comentario_solicitante character varying, autorizador_nombre character varying, comentario_autorizador character varying, estado_codigo character varying, estado_nombre character varying, fecha_creacion timestamp without time zone, fecha_actualizacion timestamp without time zone, total_count bigint)
    stable
    language plpgsql
as
$$
BEGIN
  RETURN QUERY
  WITH datos AS (
    SELECT
      sc.id_sel_cambio,
      sc.id_factura_sel,
      fs.folio_factura,
      fe_ant.nombre AS forma_anterior_nombre,
      fe_new.nombre AS forma_nueva_nombre,
      -- Destino anterior
      CASE
        WHEN fe_ant.codigo IN ('CAM', 'LOCAL') THEN
          CONCAT_WS(', ', c_ant.nombre, m_ant.nombre, NULLIF(BTRIM(fs.direccion_entrega), ''))
        WHEN fe_ant.codigo = 'SUC' THEN 'Despacho en sucursal'
        WHEN fe_ant.codigo = 'EXT' THEN te_ant.nombre::TEXT
        ELSE NULL
      END AS destino_anterior,
      -- Destino nuevo
      CASE
        WHEN fe_new.codigo IN ('CAM', 'LOCAL') THEN
          CONCAT_WS(', ', c_new.nombre, m_new.nombre, NULLIF(BTRIM(sc.direccion_new), ''))
        WHEN fe_new.codigo = 'SUC' THEN 'Despacho en sucursal'
        WHEN fe_new.codigo = 'EXT' THEN te_new.nombre::TEXT
        ELSE NULL
      END AS destino_nuevo,
      u_sol.nombre  AS solicitante_nombre,
      sc.comentario_solicitante,
      u_aut.nombre  AS autorizador_nombre,
      sc.comentario_autorizador,
      e.codigo      AS estado_codigo,
      e.nombre      AS estado_nombre,
      sc.fecha_creacion,
      sc.fecha_actualizacion
    FROM bpkm.tbl_factura_sel_cambio sc
    JOIN  bpkm.tbl_factura_seleccion      fs     ON fs.id_factura_sel             = sc.id_factura_sel
    LEFT  JOIN bpkm.tbl_forma_entrega     fe_ant ON fe_ant.id_forma_entrega       = sc.id_forma_anterior
    LEFT  JOIN bpkm.tbl_forma_entrega     fe_new ON fe_new.id_forma_entrega       = sc.id_forma_nueva
    LEFT  JOIN bpkm.tbl_transporte_externo te_ant ON te_ant.id_transporte_externo = fs.id_transporte_externo
    LEFT  JOIN bpkm.tbl_transporte_externo te_new ON te_new.id_transporte_externo = sc.id_transporte_externo_new
    LEFT  JOIN catalogos.tbl_ciudades     c_ant  ON c_ant.id_ciudad               = fs.id_departamento
    LEFT  JOIN catalogos.tbl_municipios   m_ant  ON m_ant.id_municipio            = fs.id_municipio
    LEFT  JOIN catalogos.tbl_ciudades     c_new  ON c_new.id_ciudad               = sc.id_departamento_new
    LEFT  JOIN catalogos.tbl_municipios   m_new  ON m_new.id_municipio            = sc.id_municipio_new
    LEFT  JOIN usuarios.tbl_usuarios      u_sol  ON u_sol.id_usuario              = sc.id_solicitante
    LEFT  JOIN usuarios.tbl_usuarios      u_aut  ON u_aut.id_usuario              = sc.id_autorizador
    JOIN  bpkm.tbl_estado_bpkm           e      ON e.id_estado_bpkm              = sc.id_estado
    WHERE e.tabla = 'SEL_CAMBIO'
      -- Filtro por sucursal: si p_id_usuario = 0 no filtra (modo admin/superusuario)
      AND (p_id_usuario = 0
           OR fs.id_sucursal_creador = ANY(bpkm._get_sucursales_permitidas_cambio(p_id_usuario)))
      AND (NULLIF(TRIM(p_estado_codigo), '') IS NULL OR e.codigo        = UPPER(TRIM(p_estado_codigo)))
      AND (p_fecha_desde IS NULL             OR sc.fecha_creacion::DATE >= p_fecha_desde)
      AND (p_fecha_hasta IS NULL             OR sc.fecha_creacion::DATE <= p_fecha_hasta)
      AND (NULLIF(TRIM(p_folio_like),   '') IS NULL OR fs.folio_factura ILIKE '%' || TRIM(p_folio_like) || '%')
    ORDER BY sc.fecha_creacion DESC
  )
  SELECT
    d.*,
    COUNT(*) OVER() AS total_count
  FROM datos d
  LIMIT  COALESCE(p_limit, 50)
  OFFSET COALESCE(p_offset, 0);
END;
$$;

alter function bpkm.get_solicitudes_cambio(varchar, date, date, varchar, integer, integer, integer) owner to antillonuser;

create or replace function bpkm.post_factura_seleccion_anular(p_id_factura_sel bigint, p_folio_nc character varying, p_usuario integer, p_fecha_anulacion timestamp without time zone DEFAULT NULL::timestamp without time zone, p_comentario character varying DEFAULT NULL::character varying)
    returns TABLE(int_id_factura_sel bigint)
    language plpgsql
as
$$

DECLARE
  v_anul INTEGER := bpkm._estado_id('SEL','ANUL');
BEGIN
  IF NULLIF(BTRIM(p_folio_nc),'') IS NULL THEN
    RAISE EXCEPTION 'Debe enviar folio de Nota de Crédito';
  END IF;

  IF EXISTS (
    SELECT 1 FROM bpkm.tbl_factura_seleccion
    WHERE id_factura_sel = p_id_factura_sel
      AND en_ruta = 1
) THEN
    RAISE EXCEPTION 'No se puede anular: la factura está actualmente en una ruta activa';
END IF;

  UPDATE bpkm.tbl_factura_seleccion
  SET anulada = 1,
      id_estado_sel = v_anul,
      folio_nc = p_folio_nc,
      fecha_anulacion = COALESCE(p_fecha_anulacion, NOW()),
      comentario_anulacion = NULLIF(BTRIM(p_comentario),''),
      actualizado_por = p_usuario,
      fecha_actualizacion = NOW()
  WHERE id_factura_sel = p_id_factura_sel
  RETURNING id_factura_sel INTO int_id_factura_sel;

  PERFORM bpkm.post_bitacora('SEL', p_id_factura_sel, 'ANULAR',
          CONCAT('NC=', p_folio_nc, COALESCE(CONCAT(' · ', NULLIF(BTRIM(p_comentario),'')) ,'')),
          p_usuario);

  RETURN NEXT;
END;
$$;

alter function bpkm.post_factura_seleccion_anular(bigint, varchar, integer, timestamp, varchar) owner to antillonuser;

create or replace function bpkm.post_liquidar_detalle_ruta(p_id_detalle_ruta bigint, p_estado_codigo character varying, p_motivo_fallo character varying, p_observaciones character varying, p_puede_reenviar boolean, p_fecha_hora_intento timestamp without time zone, p_usuario integer)
    returns TABLE(int_id_liquidacion bigint)
    language plpgsql
as
$$

DECLARE
  v_id_estado INTEGER := bpkm._estado_id('LIQ_DET', p_estado_codigo);
  v_id_factura_sel BIGINT;
  v_id_liq BIGINT;
  v_estado_sel_target INTEGER;
  v_estado_detalle INTEGER;
  v_id_ruta BIGINT;
BEGIN
  -- Obtener id_factura_sel e id_ruta
  SELECT id_factura_sel, id_ruta
  INTO v_id_factura_sel, v_id_ruta
  FROM bpkm.tbl_detalles_ruta
  WHERE id_detalle_ruta = p_id_detalle_ruta;

  IF v_id_factura_sel IS NULL THEN
    RAISE EXCEPTION 'Detalle de ruta no encontrado';
  END IF;

  IF EXISTS (
    SELECT 1 FROM bpkm.tbl_factura_seleccion
    WHERE id_factura_sel = v_id_factura_sel
      AND anulada = 1
) THEN
    RAISE EXCEPTION 'La selección está anulada y no puede ser liquidada';
END IF;

  -- Mapear estado de liquidación a estado de detalle
  IF p_estado_codigo = 'ENTREGADA' THEN
    v_estado_detalle := bpkm._estado_id('DETALLE', 'ENT');
  ELSIF p_estado_codigo = 'FALLIDA' THEN
    v_estado_detalle := bpkm._estado_id('DETALLE', 'FALL');
  ELSIF p_estado_codigo = 'PARCIAL' THEN
    v_estado_detalle := bpkm._estado_id('DETALLE', 'PARC');
  ELSE
    RAISE EXCEPTION 'Estado inválido: %', p_estado_codigo;
  END IF;

  -- Insertar liquidación
  INSERT INTO bpkm.tbl_liquidacion_detalle(
    id_detalle_ruta,
    id_estado_liq,
    motivo_fallo,
    observaciones,
    puede_reenviar,
    fecha_hora_intento,
    usuario_liquida
  ) VALUES (
    p_id_detalle_ruta,
    v_id_estado,
    NULLIF(BTRIM(p_motivo_fallo),''),
    NULLIF(BTRIM(p_observaciones),''),
    COALESCE(p_puede_reenviar, true),
    COALESCE(p_fecha_hora_intento, NOW()),
    p_usuario
  ) RETURNING id_liquidacion INTO v_id_liq;

  -- Actualizar estado del detalle de ruta
  UPDATE bpkm.tbl_detalles_ruta
  SET id_estado = v_estado_detalle,
      actualizado_por = p_usuario,
      fecha_actualizacion = NOW()
  WHERE id_detalle_ruta = p_id_detalle_ruta;

  -- Determinar nuevo estado de selección
  IF p_estado_codigo = 'ENTREGADA' THEN
    v_estado_sel_target := bpkm._estado_id('SEL','CERRADA');

    UPDATE bpkm.tbl_factura_seleccion
    SET en_ruta = 0,
        id_estado_sel = v_estado_sel_target,
        actualizado_por = p_usuario,
        fecha_actualizacion = NOW()
    WHERE id_factura_sel = v_id_factura_sel;

    PERFORM bpkm.post_bitacora('SEL', v_id_factura_sel, 'CERRAR',
      'Entregada exitosamente', p_usuario);

  ELSIF p_estado_codigo IN ('FALLIDA','PARCIAL') THEN
      IF COALESCE(p_puede_reenviar, true) = false THEN
        v_estado_sel_target := bpkm._estado_id('SEL','FALLIDA');

        UPDATE bpkm.tbl_factura_seleccion
        SET en_ruta = 0,
            id_estado_sel = v_estado_sel_target,
            actualizado_por = p_usuario,
            fecha_actualizacion = NOW()
        WHERE id_factura_sel = v_id_factura_sel;

        PERFORM bpkm.post_bitacora('SEL', v_id_factura_sel, 'FALL_NOENV',
          COALESCE(p_motivo_fallo, 'Entrega fallida - no será reenviada'), p_usuario);
      ELSE
        v_estado_sel_target := bpkm._estado_id('SEL','ACT');

        UPDATE bpkm.tbl_factura_seleccion
        SET en_ruta = 0,
            id_estado_sel = v_estado_sel_target,
            actualizado_por = p_usuario,
            fecha_actualizacion = NOW()
        WHERE id_factura_sel = v_id_factura_sel;

        PERFORM bpkm.post_bitacora('SEL', v_id_factura_sel, 'REACTIVAR',
          COALESCE(p_motivo_fallo, 'Entrega fallida/parcial - factura reactivada'), p_usuario);
      END IF;
    END IF;

  -- ====================================================================
  -- ELIMINADO: Ya NO se finaliza automáticamente la ruta
  -- La finalización debe hacerse manualmente desde el frontend
  -- ====================================================================

  int_id_liquidacion := v_id_liq;
  RETURN NEXT;
END;
$$;

alter function bpkm.post_liquidar_detalle_ruta(bigint, varchar, varchar, varchar, boolean, timestamp, integer) owner to antillonuser;

create or replace function bpkm.delete_factura_de_ruta(p_id_detalle_ruta bigint, p_usuario integer)
    returns TABLE(ok boolean, mensaje character varying)
    language plpgsql
as
$$

DECLARE
    v_id_ruta bigint;
    v_estado_ruta_codigo varchar;
    v_id_factura_sel bigint;
    v_folio_factura varchar;
    v_numero_ruta varchar;
    v_total_facturas_restantes integer;
    v_estado_creada integer;
BEGIN
    v_estado_creada := bpkm._estado_id('RUTA','CREADA');

    SELECT
        dr.id_ruta,
        e.codigo,
        dr.id_factura_sel,
        dr.folio_factura,
        r.numero_ruta
    INTO
        v_id_ruta,
        v_estado_ruta_codigo,
        v_id_factura_sel,
        v_folio_factura,
        v_numero_ruta
    FROM bpkm.tbl_detalles_ruta dr
    JOIN bpkm.tbl_rutas r ON r.id_ruta = dr.id_ruta
    LEFT JOIN bpkm.tbl_estado_bpkm e ON e.id_estado_bpkm = r.id_estado_ruta
    WHERE dr.id_detalle_ruta = p_id_detalle_ruta
    AND dr.id_estado = bpkm._estado_id('DETALLE','PEND');

    IF v_id_ruta IS NULL THEN
        ok := FALSE;
        mensaje := 'Detalle de ruta no encontrado o ya fue eliminado/entregado';
        RETURN NEXT;
        RETURN;
    END IF;

    IF v_estado_ruta_codigo NOT IN ('CREADA', 'EN_CURSO') THEN
        ok := FALSE;
        mensaje := 'Solo se pueden eliminar facturas en rutas CREADA o EN CURSO';
        RETURN NEXT;
        RETURN;
    END IF;

    SELECT COUNT(*)
    INTO v_total_facturas_restantes
    FROM bpkm.tbl_detalles_ruta
    WHERE id_ruta = v_id_ruta
    AND id_estado = bpkm._estado_id('DETALLE','PEND')
    AND id_detalle_ruta != p_id_detalle_ruta;

    IF v_total_facturas_restantes = 0 AND v_estado_ruta_codigo = 'EN_CURSO' THEN
        ok := FALSE;
        mensaje := 'No se puede eliminar la única factura pendiente de una ruta EN CURSO';
        RETURN NEXT;
        RETURN;
    END IF;

    UPDATE bpkm.tbl_factura_seleccion
    SET en_ruta = 0,
        id_estado_sel = bpkm._estado_id('SEL','ACT'),
        intentos_envio = GREATEST(0, intentos_envio - 1),
        actualizado_por = p_usuario,
        fecha_actualizacion = NOW()
    WHERE id_factura_sel = v_id_factura_sel;

    UPDATE bpkm.tbl_detalles_ruta
    SET id_estado = bpkm._estado_id('DETALLE','ANULADO'),
        actualizado_por = p_usuario,
        fecha_actualizacion = NOW()
    WHERE id_detalle_ruta = p_id_detalle_ruta;

    PERFORM bpkm.post_bitacora('SEL', v_id_factura_sel, 'REACTIVAR',
        'Quitada de ruta ' || COALESCE(v_numero_ruta, v_id_ruta::VARCHAR), p_usuario);

    PERFORM bpkm.post_bitacora_ruta(v_id_ruta, v_estado_ruta_codigo,
        'Factura ' || v_folio_factura || ' eliminada de la ruta', p_usuario);

    IF v_total_facturas_restantes = 0 THEN
        UPDATE bpkm.tbl_rutas
        SET id_estado_ruta = v_estado_creada,
            actualizado_por = p_usuario,
            fecha_actualizacion = NOW()
        WHERE id_ruta = v_id_ruta;

        PERFORM bpkm.post_bitacora_ruta(v_id_ruta, 'CREADA',
            'Ruta volvió a CREADA al eliminar todas las facturas', p_usuario);
    END IF;

    PERFORM bpkm.put_ruta_recalcular_monto(v_id_ruta, p_usuario);

    ok := TRUE;
    mensaje := 'Factura ' || v_folio_factura || ' eliminada correctamente de la ruta';
    RETURN NEXT;
END;
$$;

comment on function bpkm.delete_factura_de_ruta(bigint, integer) is 'Elimina una factura de una ruta existente. Solo permite en estados CREADA o EN_CURSO.';

alter function bpkm.delete_factura_de_ruta(bigint, integer) owner to antillonuser;

create or replace function bpkm.get_rutas(p_estado_codigo character varying, p_fecha_desde date, p_fecha_hasta date, p_id_suc_salida integer, p_id_camion integer, p_id_piloto integer, p_id_auxiliar integer, p_creado_por integer, p_id_sucursal_usuario integer DEFAULT 0, p_usuario integer DEFAULT 0)
    returns TABLE(id_ruta integer, codigo_ruta character varying, tipo_ruta character varying, estado_nombre character varying, camion character varying, piloto character varying, auxiliar character varying, fecha_salida_plan timestamp without time zone, fecha_entrada_plan timestamp without time zone, monto_total_transportado numeric, total_facturas bigint, fecha_creacion timestamp without time zone)
    stable
    language plpgsql
as
$$

DECLARE
  v_es_super_usuario BOOLEAN;
BEGIN
  -- Super usuarios (5, 2) ven todas las rutas sin filtro de sucursal
  v_es_super_usuario := (p_usuario IN (5, 2));

  RETURN QUERY
  SELECT
    r.id_ruta,
    r.numero_ruta,
    r.tipo_ruta,
    e.nombre AS estado_nombre,
    c.placa AS camion,
    p.nombre AS piloto,
    a.nombre AS auxiliar,
    r.fecha_salida_plan,
    r.fecha_entrada_plan,
    r.monto_total,
    COUNT(CASE WHEN ed_det.codigo NOT IN ('ANULADO', 'ANUL') THEN dr.id_detalle_ruta END)
    AS total_facturas,
    r.fecha_creacion
  FROM bpkm.tbl_rutas r
  LEFT JOIN bpkm.tbl_estado_bpkm e ON e.id_estado_bpkm = r.id_estado_ruta
  LEFT JOIN bpkm.tbl_camiones c ON c.id_camion = r.id_camion
  LEFT JOIN bpkm.tbl_personal p ON p.id_personal = r.id_piloto
  LEFT JOIN bpkm.tbl_personal a ON a.id_personal = r.id_auxiliar
  LEFT JOIN bpkm.tbl_detalles_ruta dr ON dr.id_ruta = r.id_ruta
  LEFT JOIN bpkm.tbl_estado_bpkm ed_det ON ed_det.id_estado_bpkm = dr.id_estado
  WHERE (NULLIF(TRIM(p_estado_codigo),'') IS NULL OR e.codigo = UPPER(TRIM(p_estado_codigo)))
    AND (p_fecha_desde IS NULL OR r.fecha_creacion::DATE >= p_fecha_desde)
    AND (p_fecha_hasta IS NULL OR r.fecha_creacion::DATE <= p_fecha_hasta)
    AND (p_id_suc_salida = 0 OR r.id_sucursal_salida = p_id_suc_salida)
    AND (v_es_super_usuario OR p_id_sucursal_usuario = 0 OR r.id_sucursal_salida = p_id_sucursal_usuario OR r.id_sucursal_creador = p_id_sucursal_usuario)
    AND (p_id_camion = 0 OR r.id_camion = p_id_camion)
    AND (p_id_piloto = 0 OR r.id_piloto = p_id_piloto)
    AND (p_id_auxiliar = 0 OR r.id_auxiliar = p_id_auxiliar)
    AND (p_creado_por = 0 OR r.creado_por = p_creado_por)
  GROUP BY r.id_ruta, r.numero_ruta, r.tipo_ruta, e.nombre, c.placa, p.nombre, a.nombre,
           r.fecha_salida_plan, r.fecha_entrada_plan, r.monto_total, r.fecha_creacion
  ORDER BY r.id_ruta DESC;
END;
$$;

alter function bpkm.get_rutas(varchar, date, date, integer, integer, integer, integer, integer, integer, integer) owner to antillonuser;

create or replace function bpkm.get_ruta_para_liquidar(p_id_ruta bigint)
    returns TABLE(id_ruta integer, codigo_ruta character varying, tipo_ruta character varying, estado_ruta_codigo character varying, estado_ruta_nombre character varying, placa_camion character varying, id_piloto integer, nombre_piloto character varying, id_auxiliar integer, nombre_auxiliar character varying, id_sucursal_salida integer, fecha_creacion timestamp without time zone, id_detalle_ruta integer, folio_factura character varying, estado_codigo character varying, estado_nombre character varying, total_factura numeric, direccion character varying, cliente character varying, ciudad character varying, municipio character varying, forma_entrega character varying, transporte_externo character varying, distancia_km numeric, intento_numero integer)
    stable
    language plpgsql
as
$$


BEGIN
  RETURN QUERY
  SELECT
    r.id_ruta,
    r.numero_ruta,
    r.tipo_ruta,
    er.codigo,
    er.nombre,
    c.placa,
    r.id_piloto,
    p.nombre,
    r.id_auxiliar,
    a.nombre,
    r.id_sucursal_salida,
    r.fecha_creacion,
    dr.id_detalle_ruta,
    dr.folio_factura,
    e.codigo,
    e.nombre,
    fac.doc_total,
    dr.direccion_snap,
    fac.card_name,
    ciudad.nombre,
    m.nombre,
    fe.nombre,
    te.nombre,
    dr.distancia_km,
    dr.intento_numero
  FROM bpkm.tbl_rutas r
  LEFT JOIN bpkm.tbl_camiones c ON c.id_camion = r.id_camion
  LEFT JOIN bpkm.tbl_personal p ON p.id_personal = r.id_piloto
  LEFT JOIN bpkm.tbl_personal a ON a.id_personal = r.id_auxiliar
  LEFT JOIN bpkm.tbl_estado_bpkm er
    ON er.id_estado_bpkm = r.id_estado_ruta
  LEFT JOIN bpkm.tbl_detalles_ruta dr ON dr.id_ruta = r.id_ruta
  LEFT JOIN bpkm.tbl_estado_bpkm e
    ON e.id_estado_bpkm = dr.id_estado
  LEFT JOIN catalogos.tbl_municipios m ON m.id_municipio = dr.id_municipio_snap
  LEFT JOIN catalogos.tbl_ciudades ciudad ON ciudad.id_ciudad = m.id_ciudad
      LEFT JOIN bpkm.tbl_factura_seleccion fs ON fs.id_factura_sel = dr.id_factura_sel
  LEFT JOIN ndc.tbl_cat_facturas fac ON fac.id = fs.id_factura
  LEFT JOIN bpkm.tbl_forma_entrega fe ON fe.id_forma_entrega = dr.id_forma_entrega_snap
  LEFT JOIN bpkm.tbl_transporte_externo te ON te.id_transporte_externo = dr.id_transp_ext_snap
  WHERE r.id_ruta = p_id_ruta
  ORDER BY dr.id_detalle_ruta;
END;
$$;

alter function bpkm.get_ruta_para_liquidar(bigint) owner to antillonuser;

create or replace function bpkm.get_detalles_por_ruta_gerencia(p_id_ruta bigint)
    returns TABLE(id_detalle_ruta integer, id_factura integer, id_factura_sel bigint, folio_factura character varying, forma_entrega character varying, municipio character varying, ciudad character varying, direccion_snap character varying, direccion_entrega character varying, direccion_completa text, distancia_km numeric, intento_numero integer, intentos_envio integer, estado_liquidacion character varying, estado_codigo character varying, fecha_liquidacion timestamp without time zone, total_factura numeric, comentario_rutero character varying, nombre_transporte_externo character varying)
    stable
    language plpgsql
as
$$

BEGIN
  RETURN QUERY
  SELECT
    dr.id_detalle_ruta,
    dr.id_factura,
    dr.id_factura_sel,
    dr.folio_factura,
    fe.nombre AS forma_entrega,
    m.nombre AS municipio,
    c.nombre AS ciudad,
    dr.direccion_snap,
    nf.comentario_sap AS direccion_entrega,
    -- Dirección completa: Ciudad, Municipio + Complemento
    CONCAT(
      COALESCE(c.nombre || ', ', ''),
      COALESCE(m.nombre, ''),
      CASE
        WHEN TRIM(COALESCE(dr.direccion_snap, '')) != '' THEN ' - ' || dr.direccion_snap
        WHEN TRIM(COALESCE(nf.comentario_sap, '')) != '' THEN ' - ' || nf.comentario_sap
        ELSE ''
      END
    ) AS direccion_completa,
    dr.distancia_km,
    dr.intento_numero,
    -- Contar cuántos intentos tiene esta factura
    (
      SELECT COUNT(*)
      FROM bpkm.tbl_detalles_ruta dr2
      WHERE dr2.id_factura_sel = dr.id_factura_sel
    )::INTEGER AS intentos_envio,
    COALESCE(el.nombre,  edr.nombre) AS estado_liquidacion,
    COALESCE(el.codigo,  edr.codigo) AS estado_codigo,
    ld.fecha_creacion AS fecha_liquidacion,
    -- Total de la factura desde ndc.tbl_cat_facturas
    nf.doc_total AS total_factura,
    -- Comentario del rutero desde liquidación
    COALESCE(ld.observaciones, ld.motivo_fallo) AS comentario_rutero,
	te.nombre AS nombre_transporte_externo
  FROM bpkm.tbl_detalles_ruta dr
  LEFT JOIN bpkm.tbl_forma_entrega fe ON fe.id_forma_entrega = dr.id_forma_entrega_snap
  LEFT JOIN catalogos.tbl_municipios m ON m.id_municipio = dr.id_municipio_snap
  LEFT JOIN catalogos.tbl_ciudades c ON c.id_ciudad = m.id_ciudad
  LEFT JOIN bpkm.tbl_liquidacion_detalle ld ON ld.id_detalle_ruta = dr.id_detalle_ruta
  LEFT JOIN bpkm.tbl_estado_bpkm el ON el.id_estado_bpkm = ld.id_estado_liq
  LEFT JOIN bpkm.tbl_factura_seleccion fs ON fs.id_factura_sel = dr.id_factura_sel
  LEFT JOIN ndc.tbl_cat_facturas nf ON nf.id = fs.id_factura
  LEFT JOIN bpkm.tbl_estado_bpkm edr ON edr.id_estado_bpkm = dr.id_estado
  LEFT JOIN bpkm.tbl_transporte_externo te ON te.id_transporte_externo = dr.id_transp_ext_snap
  WHERE dr.id_ruta = p_id_ruta
  ORDER BY dr.distancia_km DESC NULLS LAST, dr.id_detalle_ruta;
END;
$$;

alter function bpkm.get_detalles_por_ruta_gerencia(bigint) owner to antillonuser;

create or replace function bpkm.get_bitacora_sel(p_id_factura_sel bigint, p_scope character varying, p_usuario integer)
    returns TABLE(id_bitacora bigint, accion character varying, detalle character varying, creado_por integer, nombre_creador character varying, fecha_creacion timestamp without time zone)
    stable
    language plpgsql
as
$$

DECLARE
    v_es_duenio boolean;
BEGIN
    IF p_id_factura_sel IS NULL OR p_id_factura_sel <= 0 THEN
        RAISE EXCEPTION 'id_factura_sel requerido';
    END IF;

    SELECT EXISTS (
        SELECT 1
        FROM bpkm.tbl_factura_seleccion s
        WHERE s.id_factura_sel = p_id_factura_sel
          AND (s.id_vendedor = p_usuario OR s.creado_por = p_usuario)
    )
    INTO v_es_duenio;

    IF UPPER(COALESCE(p_scope, '')) = 'USR' AND NOT v_es_duenio THEN
        RETURN;
    END IF;

    RETURN QUERY
    WITH bitacora_base AS (
        SELECT
            b.id_bitacora,
            CASE b.accion
                WHEN 'CREAR' THEN 'Creación'
                WHEN 'ANULAR' THEN 'Anulación'
                WHEN 'RECICLAR_A_ACT' THEN 'Reactivación'
                WHEN 'CAMBIO_APR' THEN 'Cambio Aprobado'
                WHEN 'CAMBIO_RECH' THEN 'Cambio Rechazado'
                WHEN 'CAMBIO_PEND' THEN 'Solicitud de Cambio'
                WHEN 'EN_RUTA' THEN 'En Ruta'
                WHEN 'CERRAR' THEN 'Cerrada'
                WHEN 'REACTIVAR' THEN 'Reactivación'
                WHEN 'FALL_NOENV' THEN 'Fallida (no reenviar)'
                ELSE b.accion
            END AS accion,
            CASE WHEN b.accion IN ('RECICLAR_A_ACT', 'REACTIVAR') THEN ''
       ELSE b.detalle
  END AS detalle,
            b.creado_por,
            u.nombre AS nombre_creador,
            b.fecha_creacion
        FROM bpkm.tbl_bitacora b
        LEFT JOIN usuarios.tbl_usuarios u
            ON u.id_usuario = b.creado_por
        WHERE b.tabla IN ('SEL', 'FACTURA')
          AND b.id_registro = p_id_factura_sel
    ),
    bitacora_liquidacion AS (
        SELECT
            tld.id_liquidacion AS id_bitacora,
            teb.nombre AS accion,
            concat_ws('. ', tld.motivo_fallo, tld.observaciones) AS detalle,
            tld.usuario_liquida AS creado_por,
            u.nombre AS nombre_creador,
            tld.fecha_creacion
        FROM bpkm.tbl_detalles_ruta tdr
        JOIN bpkm.tbl_liquidacion_detalle tld
            ON tdr.id_detalle_ruta = tld.id_detalle_ruta
        LEFT JOIN bpkm.tbl_estado_bpkm teb
            ON tld.id_estado_liq = teb.id_estado_bpkm
        LEFT JOIN usuarios.tbl_usuarios u
            ON u.id_usuario = tld.usuario_liquida
        WHERE tdr.id_factura_sel = p_id_factura_sel
    )
    SELECT *
    FROM (
        SELECT * FROM bitacora_base
        UNION ALL
        SELECT * FROM bitacora_liquidacion
    ) x
    ORDER BY fecha_creacion DESC;

END;
$$;

alter function bpkm.get_bitacora_sel(bigint, varchar, integer) owner to antillonuser;

create or replace function bpkm.get_ruta_sin_bpkm_detalle(p_id_ruta integer)
    returns TABLE(id_ruta integer, numero_ruta character varying, tipo_ruta character varying, estado_ruta_codigo character varying, nombre_piloto character varying, nombre_auxiliar character varying, placa_camion character varying, sucursal_salida character varying, fecha_salida_plan timestamp without time zone, fecha_entrada_plan timestamp without time zone, monto_total_transportado numeric, total_facturas bigint, distancia_calculada numeric, municipio_lejano character varying, cumplimiento character varying, porcentaje_entrega numeric, nombre_transporte_externo character varying)
    stable
    language plpgsql
as
$$
BEGIN
  RETURN QUERY
  SELECT
      r.id_ruta,
      r.numero_ruta,
      r.tipo_ruta,
      e.codigo                                              AS estado_ruta_codigo,
      p.nombre                                              AS nombre_piloto,
      a.nombre                                              AS nombre_auxiliar,
      c.placa                                               AS placa_camion,
      s.nombre                                              AS sucursal_salida,
      r.fecha_salida_plan,
      r.fecha_entrada_plan,
      montos.total_transportado                             AS monto_total_transportado,
      COUNT(dr.id_detalle_ruta)                             AS total_facturas,
      lejano.distancia                                      AS distancia_calculada,
      lejano.municipio_nombre                               AS municipio_lejano,
      CASE
        WHEN COUNT(dr.id_detalle_ruta)
             FILTER (WHERE ed.codigo NOT IN ('ANULADO', 'ANUL')) = 0
             THEN NULL
        WHEN COUNT(dr.id_detalle_ruta) FILTER (WHERE ed.codigo = 'ENT')
             = COUNT(dr.id_detalle_ruta)
               FILTER (WHERE ed.codigo NOT IN ('ANULADO', 'ANUL'))
             THEN 'T'
        WHEN COUNT(dr.id_detalle_ruta) FILTER (WHERE ed.codigo = 'FALL')
             = COUNT(dr.id_detalle_ruta)
               FILTER (WHERE ed.codigo NOT IN ('ANULADO', 'ANUL'))
             THEN 'F'
        ELSE 'P'
      END::character varying                                AS cumplimiento,
      CASE
        WHEN montos.total_transportado = 0 THEN 0::numeric
        ELSE ROUND(montos.total_entregado / montos.total_transportado * 100, 2)
      END                                                   AS porcentaje_entrega,
      te.nombre                                             AS nombre_transporte_externo

  FROM  bpkm.tbl_rutas                   r
  JOIN  bpkm.tbl_estado_bpkm             e   ON e.id_estado_bpkm        = r.id_estado_ruta
  LEFT  JOIN bpkm.tbl_personal           p   ON p.id_personal            = r.id_piloto
  LEFT  JOIN bpkm.tbl_personal           a   ON a.id_personal            = r.id_auxiliar
  LEFT  JOIN bpkm.tbl_camiones           c   ON c.id_camion              = r.id_camion
  LEFT  JOIN bpkm.tbl_transporte_externo te  ON te.id_transporte_externo = r.id_transporte_externo
  LEFT  JOIN usuarios.tbl_sucursales     s   ON s.id_sucursal            = r.id_sucursal_salida
  LEFT  JOIN bpkm.tbl_detalles_ruta      dr  ON dr.id_ruta               = r.id_ruta
  LEFT  JOIN bpkm.tbl_estado_bpkm        ed  ON ed.id_estado_bpkm        = dr.id_estado
  LEFT  JOIN LATERAL (
      SELECT
          m2.nombre AS municipio_nombre,
          CASE WHEN r.id_sucursal_salida IN (14, 15, 16)
               THEN m2.distancia_desde_xela
               ELSE dr2.distancia_km
          END       AS distancia
      FROM  bpkm.tbl_detalles_ruta  dr2
      JOIN  bpkm.tbl_estado_bpkm    ed2 ON ed2.id_estado_bpkm = dr2.id_estado
      JOIN  catalogos.tbl_municipios m2  ON m2.id_municipio    = dr2.id_municipio_snap
      WHERE dr2.id_ruta  = r.id_ruta
        AND ed2.codigo   = 'ENT'
      ORDER BY
          CASE WHEN r.id_sucursal_salida IN (14, 15, 16)
               THEN m2.distancia_desde_xela
               ELSE dr2.distancia_km
          END DESC NULLS LAST
      LIMIT 1
  ) lejano ON true
  LEFT  JOIN LATERAL (
      SELECT
          COALESCE(SUM(f.doc_total) FILTER (WHERE edm.codigo NOT IN ('ANULADO', 'ANUL')), 0) AS total_transportado,
          COALESCE(SUM(f.doc_total) FILTER (WHERE edm.codigo IN ('ENT', 'PARC')), 0)         AS total_entregado
      FROM  bpkm.tbl_detalles_ruta      drm
      JOIN  bpkm.tbl_estado_bpkm        edm ON edm.id_estado_bpkm = drm.id_estado
      JOIN  bpkm.tbl_factura_seleccion  fsm ON fsm.id_factura_sel  = drm.id_factura_sel
      JOIN  ndc.tbl_cat_facturas        f   ON f.id                = fsm.id_factura
      WHERE drm.id_ruta = r.id_ruta
  ) montos ON true

  WHERE r.id_ruta = p_id_ruta

  GROUP BY
      r.id_ruta, r.numero_ruta, r.tipo_ruta,
      e.codigo,
      p.nombre, a.nombre, c.placa, s.nombre,
      r.fecha_salida_plan, r.fecha_entrada_plan,
      r.id_sucursal_salida,
      montos.total_transportado, montos.total_entregado,
      lejano.distancia, lejano.municipio_nombre,
      te.nombre;
END;
$$;

alter function bpkm.get_ruta_sin_bpkm_detalle(integer) owner to antillonuser;

create or replace function bpkm._ruta_numero_next(p_fecha date, p_tipo_ruta character varying) returns character varying
    language plpgsql
as
$$
DECLARE
  v_anio_mes VARCHAR(4);
  v_sec      INTEGER;
  v_prefijo  VARCHAR(6);
  v_numero   VARCHAR;
BEGIN
  v_anio_mes := TO_CHAR(p_fecha, 'YYMM');

  CASE p_tipo_ruta
    WHEN 'RL' THEN v_prefijo := v_anio_mes || 'RL';
    WHEN 'TE' THEN v_prefijo := v_anio_mes || 'TE';
    WHEN 'RC' THEN v_prefijo := v_anio_mes || 'RC';
    ELSE RAISE EXCEPTION 'Tipo de ruta inválido: %. Debe ser RL, TE o RC', p_tipo_ruta;
  END CASE;

  UPDATE bpkm.tbl_consecutivo_ruta
  SET    sec = sec + 1
  WHERE  anio_mes = v_anio_mes AND tipo_ruta = p_tipo_ruta
  RETURNING sec INTO v_sec;

  IF NOT FOUND THEN
    BEGIN
      INSERT INTO bpkm.tbl_consecutivo_ruta (anio_mes, tipo_ruta, sec)
      VALUES (v_anio_mes, p_tipo_ruta, 1)
      RETURNING sec INTO v_sec;
    EXCEPTION
      WHEN unique_violation THEN
        UPDATE bpkm.tbl_consecutivo_ruta
        SET    sec = sec + 1
        WHERE  anio_mes = v_anio_mes AND tipo_ruta = p_tipo_ruta
        RETURNING sec INTO v_sec;
    END;
  END IF;

  v_numero := v_prefijo || LPAD(v_sec::VARCHAR, 3, '0');
  RETURN v_numero;
END;
$$;

alter function bpkm._ruta_numero_next(date, varchar) owner to antillonuser;

create or replace function bpkm.post_ruta(p_id_sucursal_salida integer, p_id_sucursal_regreso integer, p_id_camion integer, p_id_piloto integer, p_id_auxiliar integer, p_fecha_salida_plan timestamp without time zone, p_fecha_entrada_plan timestamp without time zone, p_creado_por integer, p_tipo_ruta character varying DEFAULT 'RL'::character varying, p_id_transporte_externo integer DEFAULT NULL::integer)
    returns TABLE(int_id_ruta bigint, str_codigo_ruta character varying)
    language plpgsql
as
$$
DECLARE
  v_id_ruta              BIGINT;
  v_numero_ruta          VARCHAR;
  v_id_estado            INTEGER := bpkm._estado_id('RUTA', 'CREADA');
  v_reintentos           INTEGER := 0;
  v_max_reintentos       INTEGER := 5;
  v_id_sucursal_creador  INTEGER;
  v_genera_bpkm          BOOLEAN;
BEGIN
  SELECT taurs.id_sucursal
  INTO   v_id_sucursal_creador
  FROM   usuarios.tbl_usuarios u
  LEFT   JOIN usuarios.tbl_asignaciones_usuario_rol_sucursal taurs ON u.id_usuario = taurs.id_usuario
  WHERE  u.id_usuario = p_creado_por
  LIMIT  1;

  -- Solo CENTRAL (1), VEMA (17), CEDI (19), XELA (14), PERIXELA (15,16) generan BPKM
  v_genera_bpkm := (p_id_sucursal_salida IN (1, 17, 19, 14, 15, 16));

  -- Validar tipo de ruta
  IF p_tipo_ruta NOT IN ('RL', 'TE', 'RC') THEN
    RAISE EXCEPTION 'Tipo de ruta inválido: %. Debe ser RL, TE o RC', p_tipo_ruta;
  END IF;

  -- Validaciones específicas por tipo
  IF p_tipo_ruta IN ('RL', 'RC') THEN
    IF p_id_camion IS NULL THEN
      RAISE EXCEPTION 'Las rutas de tipo % requieren un camión', p_tipo_ruta;
    END IF;
    IF p_id_piloto IS NULL THEN
      RAISE EXCEPTION 'Las rutas de tipo % requieren un piloto', p_tipo_ruta;
    END IF;
  ELSIF p_tipo_ruta = 'TE' THEN
    IF p_id_transporte_externo IS NULL THEN
      RAISE EXCEPTION 'Las rutas de tipo TE (Transporte externo) requieren un proveedor de transporte';
    END IF;
    IF p_id_camion IS NULL THEN
      RAISE EXCEPTION 'Las rutas de tipo TE requieren un camión';
    END IF;
    IF p_id_piloto IS NULL THEN
      RAISE EXCEPTION 'Las rutas de tipo TE requieren un piloto';
    END IF;
  END IF;

  IF (p_fecha_salida_plan IS NULL) <> (p_fecha_entrada_plan IS NULL) THEN
    RAISE EXCEPTION 'Debe enviar ambas fechas de plan (salida y entrada) o ninguna.';
  END IF;
  IF p_fecha_salida_plan IS NOT NULL AND p_fecha_entrada_plan < p_fecha_salida_plan THEN
    RAISE EXCEPTION 'fecha_entrada_plan (%) debe ser >= fecha_salida_plan (%).',
        p_fecha_entrada_plan, p_fecha_salida_plan;
  END IF;

  -- Validar que el camión no esté ocupado
  IF p_id_camion IS NOT NULL AND p_fecha_salida_plan IS NOT NULL THEN
    DECLARE
      v_camion_placa     VARCHAR;
      v_conflicto_existe BOOLEAN;
    BEGIN
      SELECT placa INTO v_camion_placa FROM bpkm.tbl_camiones WHERE id_camion = p_id_camion;
      SELECT EXISTS(
          SELECT 1 FROM bpkm.tbl_rutas
          WHERE id_camion = p_id_camion
            AND tstzrange(
                COALESCE(fecha_salida, fecha_salida_plan),
                COALESCE(fecha_entrada, fecha_entrada_plan), '[]')
                && tstzrange(p_fecha_salida_plan, p_fecha_entrada_plan, '[]')
      ) INTO v_conflicto_existe;
      IF v_conflicto_existe THEN
        RAISE EXCEPTION 'El camión % ya está asignado a otra ruta en ese horario',
            COALESCE(v_camion_placa, p_id_camion::VARCHAR);
      END IF;
    END;
  END IF;

  -- Validar que el piloto no esté ocupado
  IF p_id_piloto IS NOT NULL AND p_fecha_salida_plan IS NOT NULL THEN
    DECLARE
      v_piloto_nombre    VARCHAR;
      v_conflicto_existe BOOLEAN;
    BEGIN
      SELECT nombre INTO v_piloto_nombre FROM bpkm.tbl_personal WHERE id_personal = p_id_piloto;
      SELECT EXISTS(
          SELECT 1 FROM bpkm.tbl_rutas
          WHERE id_piloto = p_id_piloto
            AND tstzrange(
                COALESCE(fecha_salida, fecha_salida_plan),
                COALESCE(fecha_entrada, fecha_entrada_plan), '[]')
                && tstzrange(p_fecha_salida_plan, p_fecha_entrada_plan, '[]')
      ) INTO v_conflicto_existe;
      IF v_conflicto_existe THEN
        RAISE EXCEPTION 'El piloto % ya está asignado a otra ruta en ese horario',
            COALESCE(v_piloto_nombre, p_id_piloto::VARCHAR);
      END IF;
    END;
  END IF;

  -- Validar que el auxiliar no esté ocupado
  IF p_id_auxiliar IS NOT NULL AND p_fecha_salida_plan IS NOT NULL THEN
    DECLARE
      v_auxiliar_nombre  VARCHAR;
      v_conflicto_existe BOOLEAN;
    BEGIN
      SELECT nombre INTO v_auxiliar_nombre FROM bpkm.tbl_personal WHERE id_personal = p_id_auxiliar;
      SELECT EXISTS(
          SELECT 1 FROM bpkm.tbl_rutas
          WHERE id_auxiliar = p_id_auxiliar
            AND tstzrange(
                COALESCE(fecha_salida, fecha_salida_plan),
                COALESCE(fecha_entrada, fecha_entrada_plan), '[]')
                && tstzrange(p_fecha_salida_plan, p_fecha_entrada_plan, '[]')
      ) INTO v_conflicto_existe;
      IF v_conflicto_existe THEN
        RAISE EXCEPTION 'El auxiliar % ya está asignado a otra ruta en ese horario',
            COALESCE(v_auxiliar_nombre, p_id_auxiliar::VARCHAR);
      END IF;
    END;
  END IF;

  -- Insertar ruta con manejo de concurrencia en número consecutivo
  LOOP
    BEGIN
      v_numero_ruta := bpkm._ruta_numero_next(CURRENT_DATE, p_tipo_ruta);

      INSERT INTO bpkm.tbl_rutas(
          numero_ruta, tipo_ruta,
          id_sucursal_salida, id_sucursal_regreso,
          id_camion, id_piloto, id_auxiliar, id_transporte_externo,
          fecha_salida_plan, fecha_entrada_plan,
          id_estado_ruta, creado_por, id_sucursal_creador, genera_bpkm
      ) VALUES (
          v_numero_ruta, p_tipo_ruta,
          p_id_sucursal_salida, p_id_sucursal_regreso,
          p_id_camion, p_id_piloto, p_id_auxiliar, p_id_transporte_externo,
          p_fecha_salida_plan, p_fecha_entrada_plan,
          v_id_estado, p_creado_por, v_id_sucursal_creador, v_genera_bpkm
      )
      RETURNING id_ruta INTO v_id_ruta;

      EXIT;

    EXCEPTION
      WHEN unique_violation THEN
        IF SQLERRM LIKE '%ux_rutas_numero%' THEN
          v_reintentos := v_reintentos + 1;
          IF v_reintentos >= v_max_reintentos THEN
            RAISE EXCEPTION 'No se pudo generar un número de ruta único después de % intentos. Por favor intente nuevamente.', v_max_reintentos;
          END IF;
          PERFORM pg_sleep(0.01);
          CONTINUE;
        ELSE
          RAISE;
        END IF;
    END;
  END LOOP;

  PERFORM bpkm.post_bitacora_ruta(
      v_id_ruta,
      'CREAR',
      'Ruta creada: ' || v_numero_ruta || ' (Tipo: ' || p_tipo_ruta || ')',
      p_creado_por
  );

  int_id_ruta     := v_id_ruta;
  str_codigo_ruta := v_numero_ruta;
  RETURN NEXT;
END;
$$;

alter function bpkm.post_ruta(integer, integer, integer, integer, integer, timestamp, timestamp, integer, varchar, integer) owner to antillonuser;

create or replace function bpkm.post_bpkm_from_ruta(p_id_ruta integer, p_creado_por integer)
    returns TABLE(int_id_bpkm integer)
    language plpgsql
as
$$


DECLARE
    v_pend_ger INTEGER := bpkm._estado_id('BPKM', 'PEND_GER');
    v_regresada INTEGER := bpkm._estado_id('RUTA', 'REGRESADA');
    v_tipo_ruta VARCHAR(2);
    v_numero_ruta VARCHAR; -- ✅ NUEVO: Para mostrar código de ruta
BEGIN
    -- Verificar que la ruta existe y obtener su tipo y código
    SELECT tipo_ruta, numero_ruta INTO v_tipo_ruta, v_numero_ruta
    FROM bpkm.tbl_rutas
    WHERE id_ruta = p_id_ruta;

    IF v_tipo_ruta IS NULL THEN
        -- ✅ CORREGIDO: Usa código de ruta en lugar de ID
        RAISE EXCEPTION 'Ruta % no existe', COALESCE(v_numero_ruta, p_id_ruta::VARCHAR);
    END IF;

    -- VALIDACIÓN: Solo rutas RL pueden generar BPKM
    IF v_tipo_ruta IN ('TE','RC') THEN
        RAISE EXCEPTION 'No se puede crear BPKM para rutas de tipo % (solo aplica para rutas RL)', v_tipo_ruta;
    END IF;

    -- Solo si ruta está REGRESADA
    IF NOT EXISTS (SELECT 1 FROM bpkm.tbl_rutas WHERE id_ruta = p_id_ruta AND id_estado_ruta = v_regresada) THEN
        -- ✅ CORREGIDO: Usa código de ruta en lugar de ID
        RAISE EXCEPTION 'Ruta % no está en REGRESADA; no se puede crear BPKM', COALESCE(v_numero_ruta, p_id_ruta::VARCHAR);
    END IF;

    INSERT INTO bpkm.tbl_bpkm(id_ruta, id_estado_bpkm, creado_por)
    VALUES (p_id_ruta, v_pend_ger, p_creado_por)
    ON CONFLICT DO NOTHING
    RETURNING id_bpkm INTO int_id_bpkm;

    IF int_id_bpkm IS NOT NULL THEN
        PERFORM bpkm.post_bitacora_ruta(p_id_ruta, 'BPKM_CREAR', 'BPKM creado (PEND_GER)', p_creado_por);
        RETURN NEXT;
    ELSE
        SELECT id_bpkm INTO int_id_bpkm FROM bpkm.tbl_bpkm WHERE id_ruta = p_id_ruta LIMIT 1;
        RETURN NEXT;
    END IF;
END;
$$;

alter function bpkm.post_bpkm_from_ruta(integer, integer) owner to antillonuser;

create or replace function bpkm.post_crear_registro_bpkm(p_id_ruta bigint, p_usuario integer)
    returns TABLE(int_id_bpkm bigint)
    language plpgsql
as
$$
DECLARE
  v_tipo_ruta          VARCHAR;
  v_id_bpkm            BIGINT;
  v_distancia_max      NUMERIC;
  v_id_muni_lejano     INTEGER;
  v_monto_total        NUMERIC;
  v_monto_sug_piloto   NUMERIC;
  v_monto_sug_auxiliar NUMERIC;
  v_estado_pend        INTEGER := bpkm._estado_id('BPKM', 'PEND');
  v_id_sucursal_salida INTEGER;
  v_es_ruta_xela       BOOLEAN;
  v_total_entregas     INTEGER;
  v_entregas_exitosas  INTEGER;
  v_entregas_parciales INTEGER;
  v_entregas_fallidas  INTEGER;
  v_cumplimiento       VARCHAR(1);
BEGIN
  -- Guard: solo rutas RL pueden tener BPKM
  SELECT tipo_ruta INTO v_tipo_ruta
  FROM   bpkm.tbl_rutas
  WHERE  id_ruta = p_id_ruta;

  IF v_tipo_ruta IS NULL THEN
    RAISE EXCEPTION 'Ruta % no existe', p_id_ruta;
  END IF;

  IF v_tipo_ruta IN ('TE', 'RC') THEN
    RAISE EXCEPTION 'No se puede crear BPKM para rutas de tipo % (solo aplica para RL)', v_tipo_ruta;
  END IF;

  -- Sucursal de salida (para determinar qué distancia usar)
  SELECT r.id_sucursal_salida
  INTO   v_id_sucursal_salida
  FROM   bpkm.tbl_rutas r
  WHERE  r.id_ruta = p_id_ruta;

  v_es_ruta_xela := (v_id_sucursal_salida IN (14, 15, 16));

  -- Distancia más lejana de entregas ENT
  IF v_es_ruta_xela THEN
    SELECT m.distancia_desde_xela, dr.id_municipio_snap
    INTO   v_distancia_max, v_id_muni_lejano
    FROM   bpkm.tbl_detalles_ruta  dr
    JOIN   catalogos.tbl_municipios m ON m.id_municipio = dr.id_municipio_snap
    JOIN   bpkm.tbl_estado_bpkm    e ON e.id_estado_bpkm = dr.id_estado
    WHERE  dr.id_ruta = p_id_ruta AND e.codigo = 'ENT'
    ORDER  BY m.distancia_desde_xela DESC
    LIMIT  1;
  ELSE
    SELECT dr.distancia_km, dr.id_municipio_snap
    INTO   v_distancia_max, v_id_muni_lejano
    FROM   bpkm.tbl_detalles_ruta dr
    JOIN   bpkm.tbl_estado_bpkm   e ON e.id_estado_bpkm = dr.id_estado
    WHERE  dr.id_ruta = p_id_ruta AND e.codigo = 'ENT'
    ORDER  BY dr.distancia_km DESC
    LIMIT  1;
  END IF;

  -- Monto total transportado (facturas no anuladas)
  SELECT COALESCE(SUM(f.doc_total), 0)
  INTO   v_monto_total
  FROM   bpkm.tbl_detalles_ruta    dr
  JOIN   bpkm.tbl_factura_seleccion fs ON fs.id_factura_sel = dr.id_factura_sel
  JOIN   ndc.tbl_cat_facturas       f  ON f.id              = fs.id_factura
  WHERE  dr.id_ruta  = p_id_ruta
    AND  dr.id_estado != bpkm._estado_id('DETALLE', 'ANULADO');

  -- Sugerencias de comisión
  v_monto_sug_piloto   := bpkm.calcular_comision_bpkm(v_distancia_max);
  v_monto_sug_auxiliar := v_monto_sug_piloto * 0.50;

  -- Conteo de entregas para cumplimiento
  SELECT
      COUNT(*),
      SUM(CASE WHEN e.codigo = 'ENT'  THEN 1 ELSE 0 END),
      SUM(CASE WHEN e.codigo = 'PARC' THEN 1 ELSE 0 END),
      SUM(CASE WHEN e.codigo = 'FALL' THEN 1 ELSE 0 END)
  INTO v_total_entregas, v_entregas_exitosas, v_entregas_parciales, v_entregas_fallidas
  FROM   bpkm.tbl_detalles_ruta dr
  JOIN   bpkm.tbl_estado_bpkm   e ON e.id_estado_bpkm = dr.id_estado
  WHERE  dr.id_ruta  = p_id_ruta
    AND  dr.id_estado != bpkm._estado_id('DETALLE', 'ANULADO');

  IF    v_entregas_exitosas = v_total_entregas THEN v_cumplimiento := 'T';
  ELSIF v_entregas_fallidas = v_total_entregas THEN v_cumplimiento := 'F';
  ELSE                                              v_cumplimiento := 'P';
  END IF;

  -- Insertar BPKM
  INSERT INTO bpkm.tbl_bpkm(
      id_ruta, id_municipio_lejano, distancia_mas_lejana,
      monto_total_transportado, monto_sugerido_piloto, monto_sugerido_auxiliar,
      km_punto_lejano, monto_logrado, monto_piloto, monto_auxiliar,
      id_estado_bpkm, cumplimiento, creado_por
  ) VALUES (
      p_id_ruta, v_id_muni_lejano, v_distancia_max,
      v_monto_total, v_monto_sug_piloto, v_monto_sug_auxiliar,
      v_distancia_max, v_monto_total, v_monto_sug_piloto, v_monto_sug_auxiliar,
      v_estado_pend, v_cumplimiento, p_usuario
  ) RETURNING id_bpkm INTO v_id_bpkm;

  PERFORM bpkm.post_bitacora(
      'BPKM', v_id_bpkm, 'CREAR',
      CONCAT('BPKM creado para ruta ', p_id_ruta,
             ' - Entregas: ', v_entregas_exitosas, '/', v_total_entregas,
             ' - Cumplimiento: ', CASE v_cumplimiento WHEN 'T' THEN 'Total' WHEN 'P' THEN 'Parcial' WHEN 'F' THEN 'Fallido' END,
             ' - Distancia más lejana entregada: ', COALESCE(v_distancia_max::TEXT, 'N/A'), ' km',
             ' - Monto: Q', COALESCE(v_monto_total::TEXT, '0.00')),
      p_usuario
  );

  int_id_bpkm := v_id_bpkm;
  RETURN NEXT;
END;
$$;

alter function bpkm.post_crear_registro_bpkm(bigint, integer) owner to antillonuser;

create or replace function bpkm.put_ruta_finalizar(p_id_ruta bigint, p_usuario integer)
    returns TABLE(int_success boolean)
    language plpgsql
as
$$
DECLARE
  v_estado_fin           INTEGER := bpkm._estado_id('RUTA', 'FINALIZADA');
  v_tipo_ruta            VARCHAR;
  v_existe_bpkm          BOOLEAN;
  v_estado_actual_codigo VARCHAR;
  v_numero_ruta          VARCHAR;
  v_genera_bpkm BOOLEAN; 
BEGIN
  -- Obtener tipo, estado actual y código de ruta
  SELECT r.tipo_ruta, e.codigo, r.numero_ruta, COALESCE(r.genera_bpkm, TRUE)  
  INTO   v_tipo_ruta, v_estado_actual_codigo, v_numero_ruta, v_genera_bpkm
  FROM   bpkm.tbl_rutas r
  INNER  JOIN bpkm.tbl_estado_bpkm e ON r.id_estado_ruta = e.id_estado_bpkm
  WHERE  r.id_ruta = p_id_ruta;

  IF v_tipo_ruta IS NULL THEN
    RAISE EXCEPTION 'Ruta no encontrada';
  END IF;

  IF v_estado_actual_codigo NOT IN ('CREADA', 'EN_CURSO', 'REGRESADA') THEN
    RAISE EXCEPTION 'No se puede finalizar una ruta en estado %', v_estado_actual_codigo;
  END IF;

  -- Verificar que todos los detalles activos estén liquidados
  IF EXISTS (
    SELECT 1
    FROM   bpkm.tbl_detalles_ruta dr
    WHERE  dr.id_ruta   = p_id_ruta
      AND  dr.id_estado != bpkm._estado_id('DETALLE', 'ANULADO')
      AND  NOT EXISTS (
             SELECT 1
             FROM   bpkm.tbl_liquidacion_detalle ld
             WHERE  ld.id_detalle_ruta = dr.id_detalle_ruta
           )
  ) THEN
    RAISE EXCEPTION 'No se puede finalizar: hay facturas sin liquidar';
  END IF;

  -- Marcar ruta como FINALIZADA
  UPDATE bpkm.tbl_rutas
  SET    id_estado_ruta      = v_estado_fin,
         actualizado_por     = p_usuario,
         fecha_actualizacion = NOW()
  WHERE  id_ruta = p_id_ruta;

  PERFORM bpkm.post_bitacora_ruta(p_id_ruta, 'FINALIZAR', 'Ruta finalizada', p_usuario);

  -- TE, RC y RL con genera_bpkm=false no generan BPKM
  IF v_tipo_ruta IN ('RT','RL') AND v_genera_bpkm THEN  
    SELECT EXISTS(SELECT 1 FROM bpkm.tbl_bpkm WHERE id_ruta = p_id_ruta)
    INTO   v_existe_bpkm;

    IF NOT v_existe_bpkm THEN
      PERFORM bpkm.post_crear_registro_bpkm(p_id_ruta, p_usuario);
      RAISE NOTICE 'BPKM creado automáticamente para ruta %',
        COALESCE(v_numero_ruta, p_id_ruta::VARCHAR);
      PERFORM bpkm.post_bitacora_ruta(p_id_ruta, 'BPKM_CREADO',
        'Registro BPKM creado automáticamente al finalizar ruta RL', p_usuario);
    END IF;
  END IF;
  -- TE y RC: no generan BPKM, no requieren acción adicional

  int_success := TRUE;
  RETURN NEXT;
END;
$$;

alter function bpkm.put_ruta_finalizar(bigint, integer) owner to antillonuser;

create or replace function bpkm.get_facturas_disponibles(p_buscar character varying DEFAULT ''::character varying, p_limite integer DEFAULT 50, p_offset integer DEFAULT 0, p_id_sucursal integer DEFAULT 0, p_tipo_ruta character varying DEFAULT ''::character varying)
    returns TABLE(id_factura_sel bigint, folio_factura character varying, id_factura integer, estado_nombre character varying, forma_entrega character varying, forma_entrega_codigo character varying, municipio character varying, distancia_km numeric, direccion_entrega character varying, fecha_creacion timestamp without time zone, nombre_cliente character varying, ciudad character varying, nombre_transporte_externo character varying)
    stable
    language plpgsql
as
$$
BEGIN
    RETURN QUERY
    SELECT
        fs.id_factura_sel,
        fs.folio_factura,
        fs.id_factura,
        e.nombre                AS estado_nombre,
        fe.nombre               AS forma_entrega,
        fe.codigo               AS forma_entrega_codigo,
        m.nombre                AS municipio,
        COALESCE(m.distancia_km, 0) AS distancia_km,
        fs.direccion_entrega,
        fs.fecha_creacion,
        fac.card_name           AS nombre_cliente,
        c.nombre                AS ciudad,
        te.nombre               AS nombre_transporte_externo
    FROM bpkm.tbl_factura_seleccion fs
    LEFT JOIN bpkm.tbl_estado_bpkm        e   ON e.id_estado_bpkm       = fs.id_estado_sel
    LEFT JOIN bpkm.tbl_forma_entrega      fe  ON fe.id_forma_entrega     = fs.id_forma_entrega
    LEFT JOIN catalogos.tbl_municipios    m   ON m.id_municipio          = fs.id_municipio
    LEFT JOIN catalogos.tbl_ciudades      c   ON m.id_ciudad             = c.id_ciudad
    LEFT JOIN ndc.tbl_cat_facturas        fac ON fs.id_factura           = fac.id
    LEFT JOIN bpkm.tbl_transporte_externo te  ON te.id_transporte_externo = fs.id_transporte_externo
    WHERE fs.anulada        = 0
      AND fs.en_ruta        = 0
      AND fe.codigo        <> 'SUC'
      AND fs.id_estado_sel  = bpkm._estado_id('SEL', 'ACT')
      AND (p_id_sucursal = 0 OR fs.id_sucursal_creador = p_id_sucursal)
      AND (
          NULLIF(TRIM(p_tipo_ruta), '') IS NULL OR
          (UPPER(TRIM(p_tipo_ruta)) IN ('RT', 'RL') AND fe.codigo = 'CAM') OR
          (UPPER(TRIM(p_tipo_ruta)) = 'TE' AND fe.codigo = 'EXT')   OR
          (UPPER(TRIM(p_tipo_ruta)) = 'RC' AND fe.codigo = 'LOCAL')
      )
      AND (
          NULLIF(TRIM(p_buscar), '') IS NULL
          OR fs.folio_factura     ILIKE '%' || TRIM(p_buscar) || '%'
          OR fac.card_name        ILIKE '%' || TRIM(p_buscar) || '%'
          OR fs.direccion_entrega ILIKE '%' || TRIM(p_buscar) || '%'
      )
      AND NOT EXISTS (
          SELECT 1
          FROM  bpkm.tbl_detalles_ruta      dr
          JOIN  bpkm.tbl_liquidacion_detalle ld ON ld.id_detalle_ruta = dr.id_detalle_ruta
          JOIN  bpkm.tbl_estado_bpkm        ed ON ed.id_estado_bpkm  = dr.id_estado
          WHERE dr.id_factura_sel = fs.id_factura_sel
            AND ld.puede_reenviar = false
            AND ed.codigo NOT IN ('ANULADO', 'ANUL')
      )
      AND NOT EXISTS (
          SELECT 1
          FROM  bpkm.tbl_cambio_sucursal_factura csf
          JOIN  bpkm.tbl_estado_bpkm             ecs ON ecs.id_estado_bpkm = csf.id_estado
          WHERE csf.id_factura_sel = fs.id_factura_sel
            AND ecs.codigo = 'PEND'
      )
      AND NOT EXISTS (
          SELECT 1
          FROM  bpkm.tbl_factura_sel_cambio fsc
          JOIN  bpkm.tbl_estado_bpkm        esc ON esc.id_estado_bpkm = fsc.id_estado
          WHERE fsc.id_factura_sel = fs.id_factura_sel
            AND esc.codigo = 'PEND'
      )
	  AND NOT EXISTS (
            SELECT 1
            FROM  bpkm.tbl_detalles_ruta dr2
            JOIN  bpkm.tbl_rutas          r2  ON r2.id_ruta         = dr2.id_ruta
            JOIN  bpkm.tbl_estado_bpkm    er2 ON er2.id_estado_bpkm = r2.id_estado_ruta
            JOIN  bpkm.tbl_estado_bpkm    ed2 ON ed2.id_estado_bpkm = dr2.id_estado
            WHERE dr2.id_factura_sel = fs.id_factura_sel
              AND er2.codigo NOT IN ('FINALIZADA', 'CANCELADA', 'CERRADA')
              AND ed2.codigo NOT IN ('ANUL', 'ANULADO')
        )
    ORDER BY fs.fecha_creacion DESC
    LIMIT  p_limite
    OFFSET p_offset;
END;
$$;

alter function bpkm.get_facturas_disponibles(varchar, integer, integer, integer, varchar) owner to antillonuser;

create or replace function bpkm.get_rutas_sin_bpkm(p_fecha_desde date, p_fecha_hasta date, p_id_sucursal integer DEFAULT 0, p_id_camion integer DEFAULT 0, p_id_piloto integer DEFAULT 0, p_limit integer DEFAULT 20, p_offset integer DEFAULT 0, p_folio_factura character varying DEFAULT NULL::character varying, p_tipo_ruta character varying DEFAULT ''::character varying, p_estado_ruta character varying DEFAULT ''::character varying)
    returns TABLE(id_ruta integer, numero_ruta character varying, tipo_ruta character varying, estado_ruta_codigo character varying, nombre_piloto character varying, nombre_auxiliar character varying, placa_camion character varying, sucursal_salida character varying, fecha_salida_plan timestamp without time zone, fecha_entrada_plan timestamp without time zone, monto_total_transportado numeric, total_facturas bigint, distancia_calculada numeric, municipio_lejano character varying, cumplimiento character varying, porcentaje_entrega numeric, nombre_transporte_externo character varying, total_count bigint)
    stable
    language plpgsql
as
$$
BEGIN
  RETURN QUERY
  WITH base AS (
    SELECT
        r.id_ruta,
        r.numero_ruta,
        r.tipo_ruta,
        e.codigo                                              AS estado_ruta_codigo,
        p.nombre                                              AS nombre_piloto,
        a.nombre                                              AS nombre_auxiliar,
        c.placa                                               AS placa_camion,
        s.nombre                                              AS sucursal_salida,
        r.fecha_salida_plan,
        r.fecha_entrada_plan,
        montos.total_transportado                             AS monto_total_transportado,
        COUNT(dr.id_detalle_ruta)                             AS total_facturas,
        lejano.distancia                                      AS distancia_calculada,
        lejano.municipio_nombre                               AS municipio_lejano,
        CASE
          WHEN COUNT(dr.id_detalle_ruta) FILTER (WHERE ed.codigo NOT IN ('ANULADO', 'ANUL')) = 0
               THEN NULL
          WHEN COUNT(dr.id_detalle_ruta) FILTER (WHERE ed.codigo = 'ENT')
             = COUNT(dr.id_detalle_ruta) FILTER (WHERE ed.codigo NOT IN ('ANULADO', 'ANUL'))
               THEN 'T'
          WHEN COUNT(dr.id_detalle_ruta) FILTER (WHERE ed.codigo = 'FALL')
             = COUNT(dr.id_detalle_ruta) FILTER (WHERE ed.codigo NOT IN ('ANULADO', 'ANUL'))
               THEN 'F'
          ELSE 'P'
        END::character varying                                AS cumplimiento,
        CASE
          WHEN montos.total_transportado = 0 THEN 0::numeric
          ELSE ROUND(montos.total_entregado / montos.total_transportado * 100, 2)
        END                                                   AS porcentaje_entrega,
        te.nombre                                             AS nombre_transporte_externo

    FROM  bpkm.tbl_rutas                   r
    JOIN  bpkm.tbl_estado_bpkm             e   ON e.id_estado_bpkm        = r.id_estado_ruta
    LEFT  JOIN bpkm.tbl_personal           p   ON p.id_personal            = r.id_piloto
    LEFT  JOIN bpkm.tbl_personal           a   ON a.id_personal            = r.id_auxiliar
    LEFT  JOIN bpkm.tbl_camiones           c   ON c.id_camion              = r.id_camion
    LEFT  JOIN bpkm.tbl_transporte_externo te  ON te.id_transporte_externo = r.id_transporte_externo
    LEFT  JOIN usuarios.tbl_sucursales     s   ON s.id_sucursal            = r.id_sucursal_salida
    LEFT  JOIN bpkm.tbl_detalles_ruta      dr  ON dr.id_ruta               = r.id_ruta
    LEFT  JOIN bpkm.tbl_estado_bpkm        ed  ON ed.id_estado_bpkm        = dr.id_estado
    LEFT  JOIN LATERAL (
        SELECT
            m2.nombre AS municipio_nombre,
            CASE WHEN r.id_sucursal_salida IN (14, 15, 16)
                 THEN m2.distancia_desde_xela
                 ELSE dr2.distancia_km
            END       AS distancia
        FROM  bpkm.tbl_detalles_ruta  dr2
        JOIN  bpkm.tbl_estado_bpkm    ed2 ON ed2.id_estado_bpkm = dr2.id_estado
        JOIN  catalogos.tbl_municipios m2  ON m2.id_municipio    = dr2.id_municipio_snap
        WHERE dr2.id_ruta = r.id_ruta AND ed2.codigo = 'ENT'
        ORDER BY
            CASE WHEN r.id_sucursal_salida IN (14, 15, 16)
                 THEN m2.distancia_desde_xela
                 ELSE dr2.distancia_km
            END DESC NULLS LAST
        LIMIT 1
    ) lejano ON true
    LEFT  JOIN LATERAL (
        SELECT
            COALESCE(SUM(f.doc_total) FILTER (WHERE edm.codigo NOT IN ('ANULADO', 'ANUL')), 0) AS total_transportado,
            COALESCE(SUM(f.doc_total) FILTER (WHERE edm.codigo IN ('ENT', 'PARC')), 0)         AS total_entregado
        FROM  bpkm.tbl_detalles_ruta      drm
        JOIN  bpkm.tbl_estado_bpkm        edm ON edm.id_estado_bpkm = drm.id_estado
        JOIN  bpkm.tbl_factura_seleccion  fsm ON fsm.id_factura_sel  = drm.id_factura_sel
        JOIN  ndc.tbl_cat_facturas        f   ON f.id                = fsm.id_factura
        WHERE drm.id_ruta = r.id_ruta
    ) montos ON true

    WHERE (
        r.tipo_ruta IN ('RC', 'TE')
        OR (r.tipo_ruta IN ('RT', 'RL') AND r.genera_bpkm = false)
    )
    AND (NULLIF(TRIM(p_estado_ruta), '') IS NULL OR e.codigo = UPPER(TRIM(p_estado_ruta)))
    AND (
      NULLIF(TRIM(p_tipo_ruta), '') IS NULL
      OR r.tipo_ruta = UPPER(TRIM(p_tipo_ruta))
      OR (UPPER(TRIM(p_tipo_ruta)) IN ('RL', 'RT') AND r.tipo_ruta IN ('RL', 'RT'))
  )
    AND (p_fecha_desde IS NULL  OR r.fecha_salida_plan::DATE >= p_fecha_desde)
    AND (p_fecha_hasta IS NULL  OR r.fecha_salida_plan::DATE <= p_fecha_hasta)
    AND (p_id_sucursal = 0      OR r.id_sucursal_salida = p_id_sucursal)
    AND (p_id_camion   = 0      OR r.id_camion          = p_id_camion)
    AND (p_id_piloto   = 0      OR r.id_piloto          = p_id_piloto)
    AND (NULLIF(TRIM(p_folio_factura), '') IS NULL OR EXISTS (
            SELECT 1
            FROM   bpkm.tbl_detalles_ruta dr_f
            WHERE  dr_f.id_ruta       = r.id_ruta
              AND  dr_f.folio_factura ILIKE '%' || TRIM(p_folio_factura) || '%'
        ))

    GROUP BY
        r.id_ruta, r.numero_ruta, r.tipo_ruta,
        e.codigo,
        p.nombre, a.nombre, c.placa, s.nombre,
        r.fecha_salida_plan, r.fecha_entrada_plan,
        r.id_sucursal_salida,
        montos.total_transportado, montos.total_entregado,
        lejano.distancia, lejano.municipio_nombre,
        te.nombre
  )
  SELECT
      b2.id_ruta, b2.numero_ruta, b2.tipo_ruta,
      b2.estado_ruta_codigo,
      b2.nombre_piloto, b2.nombre_auxiliar, b2.placa_camion,
      b2.sucursal_salida, b2.fecha_salida_plan, b2.fecha_entrada_plan,
      b2.monto_total_transportado, b2.total_facturas,
      b2.distancia_calculada, b2.municipio_lejano,
      b2.cumplimiento, b2.porcentaje_entrega,
      b2.nombre_transporte_externo,
      COUNT(*) OVER () AS total_count
  FROM  base b2
  ORDER BY b2.fecha_salida_plan DESC NULLS LAST
  LIMIT  p_limit
  OFFSET p_offset;
END;
$$;

alter function bpkm.get_rutas_sin_bpkm(date, date, integer, integer, integer, integer, integer, varchar, varchar, varchar) owner to antillonuser;

create or replace function bpkm.get_facturas_para_ruta(p_creado_por integer, p_estado_codigo character varying, p_folio_like character varying, p_fecha_desde date, p_fecha_hasta date, p_limit integer, p_offset integer, p_id_sucursal integer DEFAULT 0, p_forma_entrega_codigo character varying DEFAULT NULL::character varying, p_id_transporte_externo integer DEFAULT 0, p_id_sucursal_salida integer DEFAULT 0)
    returns TABLE(items jsonb, total_count integer)
    language plpgsql
as
$$
DECLARE
  v_total          INTEGER;
  v_items          JSONB;
  v_es_ruta_xela   BOOLEAN;
BEGIN
  v_es_ruta_xela := (p_id_sucursal_salida IN (14, 15, 16));

  -- COUNT (para paginación)
  SELECT COUNT(*) INTO v_total
  FROM (
    SELECT 1
    FROM  bpkm.tbl_factura_seleccion fs
    LEFT  JOIN bpkm.tbl_estado_bpkm     e  ON e.id_estado_bpkm  = fs.id_estado_sel
    LEFT  JOIN bpkm.tbl_forma_entrega   fe ON fe.id_forma_entrega = fs.id_forma_entrega
    LEFT  JOIN catalogos.tbl_municipios m  ON m.id_municipio     = fs.id_municipio
    WHERE fs.anulada        = 0
      AND fs.en_ruta        = 0
      AND fe.codigo        <> 'SUC'
      AND fs.id_estado_sel  = bpkm._estado_id('SEL', 'ACT')
      AND (NULLIF(TRIM(p_estado_codigo), '')  IS NULL OR e.codigo  = UPPER(TRIM(p_estado_codigo)))
      AND (p_creado_por = 0                              OR fs.creado_por = p_creado_por)
      AND (NULLIF(TRIM(p_folio_like), '')    IS NULL OR fs.folio_factura ILIKE '%' || TRIM(p_folio_like) || '%')
      AND (p_fecha_desde IS NULL             OR fs.fecha_creacion::DATE >= p_fecha_desde)
      AND (p_fecha_hasta IS NULL             OR fs.fecha_creacion::DATE <= p_fecha_hasta)
      AND (p_id_sucursal = 0                 OR fs.id_sucursal_creador   = p_id_sucursal)
      AND (
          NULLIF(TRIM(p_forma_entrega_codigo), '') IS NULL
          OR fe.codigo = UPPER(TRIM(p_forma_entrega_codigo))
      )
      AND (p_id_transporte_externo = 0 OR fs.id_transporte_externo = p_id_transporte_externo)
      -- Excluir facturas no reenviables en detalles NO anulados
      AND NOT EXISTS (
          SELECT 1
          FROM  bpkm.tbl_detalles_ruta      dr
          JOIN  bpkm.tbl_liquidacion_detalle ld ON ld.id_detalle_ruta = dr.id_detalle_ruta
          JOIN  bpkm.tbl_estado_bpkm         ed ON ed.id_estado_bpkm  = dr.id_estado
          WHERE dr.id_factura_sel = fs.id_factura_sel
            AND ld.puede_reenviar = false
            AND ed.codigo NOT IN ('ANULADO', 'ANUL')
      )
      -- Excluir facturas con cambio de sucursal pendiente
      AND NOT EXISTS (
          SELECT 1
          FROM  bpkm.tbl_cambio_sucursal_factura csf
          JOIN  bpkm.tbl_estado_bpkm             ecs ON ecs.id_estado_bpkm = csf.id_estado
          WHERE csf.id_factura_sel = fs.id_factura_sel
            AND ecs.codigo = 'PEND'
      )
      -- Excluir facturas con cambio de forma de entrega pendiente
      AND NOT EXISTS (
          SELECT 1
          FROM  bpkm.tbl_factura_sel_cambio fsc
          JOIN  bpkm.tbl_estado_bpkm        esc ON esc.id_estado_bpkm = fsc.id_estado
          WHERE fsc.id_factura_sel = fs.id_factura_sel
            AND esc.codigo = 'PEND'
      )
  ) t;

  -- SELECT items
  SELECT jsonb_agg(row_to_json(d)::jsonb) INTO v_items
  FROM (
    SELECT
        fs.id_factura_sel,
        fs.folio_factura,
        fs.id_factura,
        e.nombre   AS estado_nombre,
        fe.nombre  AS forma_entrega,
        fe.codigo  AS forma_entrega_codigo,
        m.nombre   AS municipio,
        CASE
            WHEN v_es_ruta_xela THEN COALESCE(m.distancia_desde_xela, 0)
            ELSE COALESCE(m.distancia_km, 0)
        END        AS distancia_km,
        fs.direccion_entrega,
        fs.fecha_creacion,
        fac.card_name             AS nombre_cliente,
        c.nombre                  AS ciudad,
        te.nombre                 AS nombre_transporte_externo,
		fac.fecha as fecha_factura
    FROM  bpkm.tbl_factura_seleccion fs
    LEFT  JOIN bpkm.tbl_estado_bpkm     e   ON e.id_estado_bpkm   = fs.id_estado_sel
    LEFT  JOIN bpkm.tbl_forma_entrega   fe  ON fe.id_forma_entrega = fs.id_forma_entrega
    LEFT  JOIN catalogos.tbl_municipios m   ON m.id_municipio      = fs.id_municipio
    LEFT  JOIN catalogos.tbl_ciudades   c   ON m.id_ciudad         = c.id_ciudad
    LEFT  JOIN ndc.tbl_cat_facturas     fac ON fs.id_factura       = fac.id
    LEFT  JOIN bpkm.tbl_transporte_externo te ON te.id_transporte_externo = fs.id_transporte_externo
    WHERE fs.anulada        = 0
      AND fs.en_ruta        = 0
      AND fe.codigo        <> 'SUC'
      AND fs.id_estado_sel  = bpkm._estado_id('SEL', 'ACT')
      AND (NULLIF(TRIM(p_estado_codigo), '')  IS NULL OR e.codigo  = UPPER(TRIM(p_estado_codigo)))
      AND (p_creado_por = 0                              OR fs.creado_por = p_creado_por)
      AND (NULLIF(TRIM(p_folio_like), '')    IS NULL OR fs.folio_factura ILIKE '%' || TRIM(p_folio_like) || '%')
      AND (p_fecha_desde IS NULL             OR fs.fecha_creacion::DATE >= p_fecha_desde)
      AND (p_fecha_hasta IS NULL             OR fs.fecha_creacion::DATE <= p_fecha_hasta)
      AND (p_id_sucursal = 0                 OR fs.id_sucursal_creador   = p_id_sucursal)
      AND (
          NULLIF(TRIM(p_forma_entrega_codigo), '') IS NULL
          OR fe.codigo = UPPER(TRIM(p_forma_entrega_codigo))
      )
      AND (p_id_transporte_externo = 0 OR fs.id_transporte_externo = p_id_transporte_externo)
      AND NOT EXISTS (
          SELECT 1
          FROM  bpkm.tbl_detalles_ruta      dr
          JOIN  bpkm.tbl_liquidacion_detalle ld ON ld.id_detalle_ruta = dr.id_detalle_ruta
          JOIN  bpkm.tbl_estado_bpkm         ed ON ed.id_estado_bpkm  = dr.id_estado
          WHERE dr.id_factura_sel = fs.id_factura_sel
            AND ld.puede_reenviar = false
            AND ed.codigo NOT IN ('ANULADO', 'ANUL')
      )
      AND NOT EXISTS (
          SELECT 1
          FROM  bpkm.tbl_cambio_sucursal_factura csf
          JOIN  bpkm.tbl_estado_bpkm             ecs ON ecs.id_estado_bpkm = csf.id_estado
          WHERE csf.id_factura_sel = fs.id_factura_sel
            AND ecs.codigo = 'PEND'
      )
      AND NOT EXISTS (
          SELECT 1
          FROM  bpkm.tbl_factura_sel_cambio fsc
          JOIN  bpkm.tbl_estado_bpkm        esc ON esc.id_estado_bpkm = fsc.id_estado
          WHERE fsc.id_factura_sel = fs.id_factura_sel
            AND esc.codigo = 'PEND'
      )
    ORDER BY fac.fecha
    LIMIT  p_limit
    OFFSET p_offset
  ) d;

  items       := COALESCE(v_items, '[]'::jsonb);
  total_count := v_total;
  RETURN NEXT;
END;
$$;

alter function bpkm.get_facturas_para_ruta(integer, varchar, varchar, date, date, integer, integer, integer, varchar, integer, integer) owner to antillonuser;

create or replace function bpkm.get_mis_facturas_seleccion(p_id_vendedor integer DEFAULT NULL::integer, p_forma_codigo character varying DEFAULT NULL::character varying, p_folio_like character varying DEFAULT NULL::character varying, p_estado_codigo character varying DEFAULT NULL::character varying, p_fecha_desde timestamp without time zone DEFAULT NULL::timestamp without time zone, p_fecha_hasta timestamp without time zone DEFAULT NULL::timestamp without time zone, p_creado_por integer DEFAULT NULL::integer, p_limit integer DEFAULT 50, p_offset integer DEFAULT 0)
    returns TABLE(id_factura_sel bigint, id_factura integer, folio_factura character varying, id_vendedor integer, id_forma_entrega integer, forma_codigo character varying, forma_nombre character varying, id_transporte_externo integer, transporte_nombre character varying, id_departamento integer, id_municipio integer, destino character varying, en_ruta integer, anulada integer, id_estado_sel integer, estado_codigo character varying, estado_nombre character varying, id_sucursal_creador integer, sucursal_creador character varying, fecha_creacion timestamp without time zone, fecha_actualizacion timestamp without time zone, es_creador boolean, puede_reenviar boolean, nombre_cliente character varying, fecha_factura date, total_count bigint)
    stable
    language sql
as
$$
  WITH filtrado AS (
    SELECT
      s.id_factura_sel, s.id_factura, s.folio_factura,
      s.id_vendedor, s.id_forma_entrega,
      fe.codigo AS forma_codigo, fe.nombre AS forma_nombre,
      s.id_transporte_externo, te.nombre AS transporte_nombre,
      s.id_departamento, s.id_municipio,
      CASE
        WHEN fe.codigo = 'CAM'   THEN
          CONCAT_WS(', ', tc.nombre, tm.nombre, NULLIF(BTRIM(s.direccion_entrega), ''))
        WHEN fe.codigo = 'LOCAL' THEN
          CONCAT_WS(', ', tc.nombre, tm.nombre, NULLIF(BTRIM(s.direccion_entrega), ''))
        WHEN fe.codigo = 'SUC'   THEN ''
        WHEN fe.codigo = 'EXT'   THEN
          CONCAT_WS(' - ', te.nombre, NULLIF(BTRIM(s.direccion_entrega), ''))
        ELSE NULL
      END AS destino,
      s.en_ruta, s.anulada,
      s.id_estado_sel, e.codigo AS estado_codigo, e.nombre AS estado_nombre,
      s.id_sucursal_creador, suc.nombre AS sucursal_creador,
      s.fecha_creacion, s.fecha_actualizacion,
      COALESCE(s.creado_por = p_creado_por, false) AS es_creador,
	  COALESCE(
    (SELECT ld.puede_reenviar
     FROM bpkm.tbl_detalles_ruta dr
     JOIN bpkm.tbl_liquidacion_detalle ld ON ld.id_detalle_ruta = dr.id_detalle_ruta
     WHERE dr.id_factura_sel = s.id_factura_sel
     ORDER BY ld.fecha_creacion DESC
     LIMIT 1),
    true
) AS puede_reenviar,
	tcf.card_name as nombre_cliente,
	tcf.fecha::date as fecha_factura
    FROM bpkm.tbl_factura_seleccion s
    JOIN bpkm.tbl_forma_entrega     fe  ON fe.id_forma_entrega        = s.id_forma_entrega
    JOIN bpkm.tbl_estado_bpkm       e   ON e.id_estado_bpkm           = s.id_estado_sel
    JOIN ndc.tbl_cat_facturas        tcf ON tcf.id                     = s.id_factura
    LEFT JOIN bpkm.tbl_transporte_externo te  ON te.id_transporte_externo = s.id_transporte_externo
    LEFT JOIN catalogos.tbl_ciudades      tc  ON s.id_departamento        = tc.id_ciudad
    LEFT JOIN catalogos.tbl_municipios    tm  ON s.id_municipio           = tm.id_municipio
    LEFT JOIN usuarios.tbl_sucursales     suc ON suc.id_sucursal          = s.id_sucursal_creador
    WHERE e.tabla = 'SEL'
      AND (p_id_vendedor   IS NULL OR s.id_vendedor   = p_id_vendedor)
      AND (p_forma_codigo  IS NULL OR fe.codigo        = p_forma_codigo)
      AND (p_estado_codigo IS NULL OR e.codigo         = p_estado_codigo)
      AND (p_folio_like    IS NULL OR s.folio_factura  ILIKE '%'||p_folio_like||'%')
      AND (p_fecha_desde IS NULL OR s.fecha_creacion::DATE >= p_fecha_desde::DATE)
  AND (p_fecha_hasta IS NULL OR s.fecha_creacion::DATE <= p_fecha_hasta::DATE)
      AND (
          p_creado_por IS NULL
          OR s.creado_por = p_creado_por
          OR EXISTS (
              SELECT 1
              FROM bpkm.tbl_asignacion_usuario_vendedor a
              WHERE a.id_usuario  = p_creado_por
                AND a.id_vendedor = tcf.vendedor_id
                AND a.activo      = true
          )
      )
  )
  SELECT
    f.*,
    COUNT(*) OVER() AS total_count
  FROM filtrado f
  ORDER BY
    CASE WHEN p_estado_codigo = 'ACT' THEN NULL ELSE f.fecha_factura END DESC,
    CASE WHEN p_estado_codigo = 'ACT' THEN f.fecha_factura END
  LIMIT  COALESCE(p_limit,  50)
  OFFSET COALESCE(p_offset,  0);
$$;

alter function bpkm.get_mis_facturas_seleccion(integer, varchar, varchar, varchar, timestamp, timestamp, integer, integer, integer) owner to antillonuser;

create or replace function bpkm.get_bpkm(p_estado_codigo character varying, p_fecha_desde date, p_fecha_hasta date, p_id_sucursal integer DEFAULT 0, p_id_camion integer DEFAULT 0, p_folio_factura character varying DEFAULT NULL::character varying)
    returns TABLE(id_bpkm integer, codigo_ruta character varying, estado_nombre character varying, estado_codigo character varying, distancia_mas_lejana numeric, distancia_anterior numeric, municipio_lejano character varying, monto_total_transportado numeric, monto_sugerido_piloto numeric, monto_aprobado_piloto numeric, nombre_piloto character varying, nombre_auxiliar character varying, placa_camion character varying, total_facturas bigint, tipo_ruta character varying, fecha_creacion timestamp without time zone, fecha_aprobacion timestamp without time zone, fecha_rrhh timestamp without time zone, ruta_cumplida boolean, cumplimiento character varying, sucursal_salida character varying, monto_aprobado_auxiliar numeric, departamento character varying, cumplimiento_regreso boolean, porcentaje_entrega numeric)
    stable
    language plpgsql
as
$$
BEGIN
  RETURN QUERY
  SELECT
    b.id_bpkm,
    r.numero_ruta,
    e.nombre AS estado_nombre,
    e.codigo AS estado_codigo,
    b.distancia_mas_lejana,
    b.distancia_anterior, -- << SE SELECCIONA EL NUEVO CAMPO
    m.nombre AS municipio_lejano,
    b.monto_total_transportado,
    b.monto_sugerido_piloto,
    b.monto_aprobado_piloto,
    p.nombre AS nombre_piloto,
    a.nombre AS nombre_auxiliar,
    c.placa AS placa_camion,
    COUNT(dr.id_detalle_ruta) AS total_facturas,
    r.tipo_ruta,
    r.fecha_salida_plan AS fecha_creacion,
    b.fecha_aprobacion,
    b.fecha_rrhh,

    CASE
      WHEN r.fecha_salida_plan IS NULL OR r.fecha_entrada_plan IS NULL THEN NULL
      WHEN mon_salida.fecha_hora IS NULL OR mon_entrada.fecha_hora IS NULL THEN NULL
      WHEN (EXTRACT(EPOCH FROM (mon_salida.fecha_hora - r.fecha_salida_plan)) / 60)::INTEGER
           BETWEEN -15 AND 15
      THEN TRUE
      ELSE FALSE
    END AS ruta_cumplida,

    b.cumplimiento,
    s.nombre AS sucursal_salida,
    b.monto_aprobado_auxiliar,
    tc.nombre AS departamento,

    CASE
      WHEN r.fecha_entrada_plan IS NULL THEN NULL
      WHEN mon_entrada.fecha_hora IS NULL THEN NULL
      WHEN (EXTRACT(EPOCH FROM (mon_entrada.fecha_hora - r.fecha_entrada_plan)) / 60)::INTEGER
           BETWEEN -15 AND 15
      THEN TRUE
      ELSE FALSE
    END AS cumplimiento_regreso,

    CASE
      WHEN b.monto_total_transportado IS NULL OR b.monto_total_transportado = 0 THEN 0.00
      ELSE (
        (SELECT COALESCE(SUM(tcf.doc_total), 0)
         FROM bpkm.tbl_detalles_ruta tdr
         LEFT JOIN bpkm.tbl_estado_bpkm teb ON tdr.id_estado = teb.id_estado_bpkm
         LEFT JOIN bpkm.tbl_factura_seleccion tfs ON tdr.id_factura_sel = tfs.id_factura_sel
         LEFT JOIN ndc.tbl_cat_facturas tcf ON tfs.id_factura = tcf.id
         WHERE tdr.id_ruta = r.id_ruta
           AND teb.codigo IN ('ENT', 'PARC')
        ) / b.monto_total_transportado * 100
      )
    END AS porcentaje_entrega

  FROM bpkm.tbl_bpkm b
  JOIN bpkm.tbl_rutas r ON r.id_ruta = b.id_ruta
  LEFT JOIN bpkm.tbl_estado_bpkm e ON e.id_estado_bpkm = b.id_estado_bpkm
  LEFT JOIN catalogos.tbl_municipios m ON m.id_municipio = b.id_municipio_lejano
  LEFT JOIN bpkm.tbl_personal p ON p.id_personal = r.id_piloto
  LEFT JOIN bpkm.tbl_personal a ON a.id_personal = r.id_auxiliar
  LEFT JOIN bpkm.tbl_camiones c ON c.id_camion = r.id_camion
  LEFT JOIN bpkm.tbl_detalles_ruta dr ON dr.id_ruta = r.id_ruta
  LEFT JOIN usuarios.tbl_sucursales s ON s.id_sucursal = r.id_sucursal_salida
  LEFT JOIN catalogos.tbl_ciudades tc ON tc.id_ciudad = m.id_ciudad

  LEFT JOIN LATERAL (
    SELECT fecha_hora
    FROM bpkm.tbl_monitoreo_bpkm
    WHERE id_ruta = r.id_ruta AND tipo = 'S'
    ORDER BY fecha_hora DESC
    LIMIT 1
  ) mon_salida ON true

  LEFT JOIN LATERAL (
    SELECT fecha_hora
    FROM bpkm.tbl_monitoreo_bpkm
    WHERE id_ruta = r.id_ruta AND tipo = 'E'
    ORDER BY fecha_hora DESC
    LIMIT 1
  ) mon_entrada ON true

  WHERE (NULLIF(TRIM(p_estado_codigo),'') IS NULL OR e.codigo = UPPER(TRIM(p_estado_codigo)))
    AND (p_fecha_desde IS NULL OR r.fecha_salida_plan::DATE >= p_fecha_desde)
    AND (p_fecha_hasta IS NULL OR r.fecha_salida_plan::DATE <= p_fecha_hasta)
    AND (p_id_sucursal = 0 OR r.id_sucursal_salida = p_id_sucursal)
    AND (p_id_camion = 0 OR r.id_camion = p_id_camion)
    AND (NULLIF(TRIM(p_folio_factura),'') IS NULL OR EXISTS (
      SELECT 1 FROM bpkm.tbl_detalles_ruta dr2
      WHERE dr2.id_ruta = r.id_ruta
        AND dr2.folio_factura ILIKE '%'||TRIM(p_folio_factura)||'%'
    ))

  GROUP BY b.id_bpkm, r.numero_ruta, e.nombre, e.codigo, b.distancia_mas_lejana,
           b.distancia_anterior, -- << NUEVO CAMPO AGRUPADO
           m.nombre, b.monto_total_transportado, b.monto_sugerido_piloto,
           b.monto_aprobado_piloto, p.nombre, a.nombre, c.placa, r.tipo_ruta,
           b.fecha_aprobacion, b.fecha_rrhh, r.fecha_salida_plan,
           r.fecha_entrada_plan, mon_salida.fecha_hora, mon_entrada.fecha_hora,
           b.cumplimiento, s.nombre, b.monto_aprobado_auxiliar, tc.nombre, r.id_ruta

  ORDER BY
    CASE
      WHEN UPPER(TRIM(p_estado_codigo)) = 'PEND'
      THEN r.fecha_salida_plan
    END ASC NULLS LAST,
    CASE
      WHEN UPPER(TRIM(p_estado_codigo)) != 'PEND'
           OR NULLIF(TRIM(p_estado_codigo),'') IS NULL
      THEN r.fecha_salida_plan
    END DESC NULLS LAST;
END;
$$;

alter function bpkm.get_bpkm(varchar, date, date, integer, integer, varchar) owner to antillonuser;

create or replace function bpkm.get_bpkm_detalle(p_id_bpkm bigint)
    returns TABLE(id_bpkm integer, id_ruta integer, codigo_ruta character varying, estado_bpkm character varying, estado_codigo character varying, tipo_ruta character varying, distancia_mas_lejana numeric, distancia_anterior numeric, municipio_lejano character varying, monto_total_transportado numeric, monto_sugerido_piloto numeric, monto_sugerido_auxiliar numeric, monto_aprobado_piloto numeric, monto_aprobado_auxiliar numeric, observaciones_gerencia character varying, nombre_piloto character varying, nombre_auxiliar character varying, placa_camion character varying, fecha_salida_plan timestamp without time zone, fecha_entrada_plan timestamp without time zone, total_facturas bigint, fecha_creacion timestamp without time zone, fecha_aprobacion timestamp without time zone, usuario_gerencia_nombre character varying, fecha_rrhh timestamp without time zone, usuario_rrhh_nombre character varying, cumplimiento character varying, departamento character varying, cumplimiento_regreso boolean, porcentaje_entrega numeric)
    stable
    language plpgsql
as
$$
BEGIN
  RETURN QUERY
  SELECT
    b.id_bpkm,
    b.id_ruta,
    r.numero_ruta,
    e.nombre AS estado_bpkm,
    e.codigo AS estado_codigo,
    r.tipo_ruta,
    b.distancia_mas_lejana,
    b.distancia_anterior, -- << SE SELECCIONA EL NUEVO CAMPO
    m.nombre AS municipio_lejano,
    b.monto_total_transportado,
    b.monto_sugerido_piloto,
    b.monto_sugerido_auxiliar,
    b.monto_aprobado_piloto,
    b.monto_aprobado_auxiliar,
    b.observaciones_gerencia,
    p.nombre AS nombre_piloto,
    a.nombre AS nombre_auxiliar,
    c.placa AS placa_camion,
    r.fecha_salida_plan,
    r.fecha_entrada_plan,
    COUNT(dr.id_detalle_ruta) AS total_facturas,
    b.fecha_creacion,
    b.fecha_aprobacion,
    ug.nombre AS usuario_gerencia_nombre,
    b.fecha_rrhh,
    ur.nombre AS usuario_rrhh_nombre,
    b.cumplimiento,
    tc.nombre AS departamento,

    CASE
      WHEN r.fecha_entrada_plan IS NULL THEN NULL
      WHEN mon_entrada.fecha_hora IS NULL THEN NULL
      WHEN (EXTRACT(EPOCH FROM (mon_entrada.fecha_hora - r.fecha_entrada_plan)) / 60)::INTEGER
           BETWEEN -15 AND 15
      THEN TRUE
      ELSE FALSE
    END AS cumplimiento_regreso,

    CASE
      WHEN b.monto_total_transportado IS NULL OR b.monto_total_transportado = 0 THEN 0.00
      ELSE (
        (SELECT COALESCE(SUM(tcf.doc_total), 0)
         FROM bpkm.tbl_detalles_ruta tdr
         LEFT JOIN bpkm.tbl_estado_bpkm teb ON tdr.id_estado = teb.id_estado_bpkm
         LEFT JOIN bpkm.tbl_factura_seleccion tfs ON tdr.id_factura_sel = tfs.id_factura_sel
         LEFT JOIN ndc.tbl_cat_facturas tcf ON tfs.id_factura = tcf.id
         WHERE tdr.id_ruta = b.id_ruta
           AND teb.codigo IN ('ENT', 'PARC')
        ) / b.monto_total_transportado * 100
      )
    END AS porcentaje_entrega

  FROM bpkm.tbl_bpkm b
  JOIN bpkm.tbl_rutas r ON r.id_ruta = b.id_ruta
  LEFT JOIN bpkm.tbl_estado_bpkm e ON e.id_estado_bpkm = b.id_estado_bpkm
  LEFT JOIN catalogos.tbl_municipios m ON m.id_municipio = b.id_municipio_lejano
  LEFT JOIN bpkm.tbl_personal p ON p.id_personal = r.id_piloto
  LEFT JOIN bpkm.tbl_personal a ON a.id_personal = r.id_auxiliar
  LEFT JOIN bpkm.tbl_camiones c ON c.id_camion = r.id_camion
  LEFT JOIN bpkm.tbl_detalles_ruta dr ON dr.id_ruta = r.id_ruta
  LEFT JOIN usuarios.tbl_usuarios ug ON ug.id_usuario = b.usuario_gerencia
  LEFT JOIN usuarios.tbl_usuarios ur ON ur.id_usuario = b.usuario_rrhh
  LEFT JOIN catalogos.tbl_ciudades tc ON tc.id_ciudad = m.id_ciudad
  LEFT JOIN LATERAL (
    SELECT fecha_hora
    FROM bpkm.tbl_monitoreo_bpkm mbm
    WHERE mbm.id_ruta = r.id_ruta AND mbm.tipo = 'E'
    ORDER BY fecha_hora DESC
    LIMIT 1
  ) mon_entrada ON true

  WHERE b.id_bpkm = p_id_bpkm

  GROUP BY b.id_bpkm, b.id_ruta, r.numero_ruta, e.nombre, e.codigo, r.tipo_ruta, m.nombre,
           b.distancia_mas_lejana, b.distancia_anterior, b.monto_total_transportado,
           b.monto_sugerido_piloto, b.monto_sugerido_auxiliar,
           b.monto_aprobado_piloto, b.monto_aprobado_auxiliar,
           b.observaciones_gerencia, p.nombre, a.nombre, c.placa,
           r.fecha_salida_plan, r.fecha_entrada_plan,
           b.fecha_creacion, b.fecha_aprobacion, ug.nombre,
           b.fecha_rrhh, ur.nombre, b.cumplimiento, tc.nombre, mon_entrada.fecha_hora;
END;
$$;

alter function bpkm.get_bpkm_detalle(bigint) owner to antillonuser;

create or replace function bpkm.get_destinos_por_ruta(p_id_ruta bigint)
    returns TABLE(sucursal character varying, numero_ruta character varying, departamento character varying, municipio character varying, monto numeric, total_facturas bigint)
    stable
    language plpgsql
as
$$
BEGIN
  RETURN QUERY
  SELECT
    COALESCE(ts.nombre, 'Sin Sucursal')::VARCHAR AS sucursal,
    tr.numero_ruta::VARCHAR,
    COALESCE(tc.nombre, 'Sin Departamento')::VARCHAR AS departamento,
    COALESCE(tm.nombre, 'Sin Municipio')::VARCHAR AS municipio,
    COALESCE(SUM(COALESCE(tcf.doc_total, tdr.total_factura, 0)), 0)::NUMERIC AS monto,
    COUNT(tdr.id_detalle_ruta)::BIGINT AS total_facturas
  FROM bpkm.tbl_rutas tr
  JOIN bpkm.tbl_detalles_ruta tdr ON tr.id_ruta = tdr.id_ruta
  JOIN bpkm.tbl_factura_seleccion tfs ON tdr.id_factura_sel = tfs.id_factura_sel
  LEFT JOIN ndc.tbl_cat_facturas tcf ON tfs.id_factura = tcf.id
  LEFT JOIN catalogos.tbl_ciudades tc ON tdr.id_departamento_snap = tc.id_ciudad
  LEFT JOIN catalogos.tbl_municipios tm ON tdr.id_municipio_snap = tm.id_municipio
  LEFT JOIN usuarios.tbl_sucursales ts ON tr.id_sucursal_salida = ts.id_sucursal
  WHERE tr.id_ruta = p_id_ruta
    AND tr.tipo_ruta IN ('RL', 'RC')
    AND (tdr.id_estado IS NULL OR tdr.id_estado != bpkm._estado_id('DETALLE', 'ANULADO'))
    AND (tfs.anulada IS NULL OR tfs.anulada = 0)
  GROUP BY ts.nombre, tr.numero_ruta, tc.nombre, tm.nombre
  ORDER BY tc.nombre, tm.nombre;
END;
$$;

alter function bpkm.get_destinos_por_ruta(bigint) owner to antillonuser;


