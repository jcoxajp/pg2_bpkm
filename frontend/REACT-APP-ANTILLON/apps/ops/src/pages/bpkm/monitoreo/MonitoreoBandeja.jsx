// src/pages/bpkm/monitoreo/MonitoreoBandeja.jsx
import { useEffect, useMemo, useRef, useState } from 'react';
import Layout from '@ui/Layout';
import MonitoreoRegistro from './MonitoreoRegistro';
import RutasDestacadas from './RutasDestacadas';
import { Toast } from 'primereact/toast';
import { Card } from 'primereact/card';
import { Calendar } from 'primereact/calendar';
import { Button } from 'primereact/button';
import { DataTable } from 'primereact/datatable';
import { Column } from 'primereact/column';
import { Tag } from 'primereact/tag';
import { Sidebar } from 'primereact/sidebar';
import { Dropdown } from 'primereact/dropdown';
import { getRutasConMonitoreo } from '@services/bpkm/bpkmMonitoreo';
import { getSucursalesList, getCamionesActivos, getPersonal } from '@services/bpkm/bpkmRutas';
import { getApiErrorMessage } from '@utils/apiError';
import { formatDateTimeGT, toISODateLocal, toLocalDate } from '@utils/dateSafe';

const LSKEY = 'bpkm_monitoreo_filters_v1';

export default function MonitoreoBandeja() {
  const toastRef = useRef(null);
  const show = (severity, summary, detail) =>
    toastRef.current?.show({ severity, summary, detail, life: 3000 });

  const persisted = useMemo(() => {
    try {
      return JSON.parse(sessionStorage.getItem(LSKEY) || '{}');
    } catch {
      return {};
    }
  }, []);
  const persistedSucursalId = Number(persisted.fSucursalId || 0) || 0;
  const persistedCamionId = Number(persisted.fCamionId || 0) || 0;
  const persistedPilotoId = Number(persisted.fPilotoId || 0) || 0;

  // Filtros
  const [fDesde, setFDesde] = useState(persisted.fDesde ? toLocalDate(persisted.fDesde) : null);
  const [fHasta, setFHasta] = useState(persisted.fHasta ? toLocalDate(persisted.fHasta) : null);
  const [fSucursal, setFSucursal] = useState(null);
  const [fCamion, setFCamion] = useState(null);
  const [fPiloto, setFPiloto] = useState(null);

  // Catálogos
  const [sucursales, setSucursales] = useState([]);
  const [camiones, setCamiones] = useState([]);
  const [pilotos, setPilotos] = useState([]);
  const [combosReady, setCombosReady] = useState(false);
  const [filtersReady, setFiltersReady] = useState(false);
  const restoredFiltersRef = useRef(false);
  const lastCamionesPilotosSucursalRef = useRef(-1); // -1: sentinel para forzar la primera carga

  // Data
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [pagination, setPagination] = useState({ total: 0, page: 1, limit: 25 });
  const [resumen, setResumen] = useState({ sin_salida: 0, sin_entrada: 0 });
  const [destacadas, setDestacadas] = useState({ proximas_salir: [], que_regresaron: [] });

  // Dialog de registro
  const [showRegistro, setShowRegistro] = useState(false);
  const [rutaSeleccionada, setRutaSeleccionada] = useState(null);

  async function cargarCombos() {
    try {
      const s = await getSucursalesList();
      setSucursales(s || []);
    } catch (e) {
      console.error(e);
      show('error', 'Error', getApiErrorMessage(e, 'No se pudieron cargar los catálogos'));
    } finally {
      setCombosReady(true);
    }
  }

  async function cargarCamionesPilotos(idSucursal) {
    const [c, p] = await Promise.all([
      getCamionesActivos({ id_sucursal: idSucursal }),
      getPersonal({ rol: 'PILOTO', estado: 1, id_sucursal: idSucursal })
    ]);
    return {
      camiones: Array.isArray(c) ? c : [],
      pilotos: Array.isArray(p) ? p : []
    };
  }

  // Restaura sucursal/camión/piloto persistidos una sola vez, apenas están cargadas las
  // sucursales - el catálogo de camión/piloto ya filtrado por esa sucursal se pide aquí mismo
  // (no se espera al efecto de abajo) para poder emparejar los ids persistidos contra la lista
  // correcta desde el principio.
  useEffect(() => {
    if (restoredFiltersRef.current) return;
    if (!combosReady) return;
    restoredFiltersRef.current = true;

    (async () => {
      let sucursalMatch = null;
      if (persistedSucursalId) {
        sucursalMatch = sucursales.find(
          (s) => Number(s?.int_id_sucursal || 0) === persistedSucursalId
        ) || null;
        if (sucursalMatch) setFSucursal(sucursalMatch);
      }
      const idSucursal = sucursalMatch?.int_id_sucursal || 0;
      lastCamionesPilotosSucursalRef.current = idSucursal;

      try {
        const { camiones: nextCamiones, pilotos: nextPilotos } = await cargarCamionesPilotos(idSucursal);
        setCamiones(nextCamiones);
        setPilotos(nextPilotos);
        if (persistedCamionId) {
          const m = nextCamiones.find((c) => Number(c?.int_id_camion || 0) === persistedCamionId);
          if (m) setFCamion(m);
        }
        if (persistedPilotoId) {
          const m = nextPilotos.find((p) => Number(p?.int_id_personal || 0) === persistedPilotoId);
          if (m) setFPiloto(m);
        }
      } catch (e) {
        console.error(e);
        show('error', 'Error', getApiErrorMessage(e, 'No se pudieron cargar los catálogos'));
      } finally {
        setFiltersReady(true);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [combosReady, sucursales]);

  // Camión y Piloto dependen de Sucursal - se recargan filtrados cuando cambia el filtro de
  // Sucursal después de la restauración inicial (de ahí el `filtersReady`, para no repetir la
  // carga que ya hizo el efecto de arriba).
  useEffect(() => {
    if (!filtersReady) return;
    const idSucursal = fSucursal?.int_id_sucursal || 0;
    if (lastCamionesPilotosSucursalRef.current === idSucursal) return;
    lastCamionesPilotosSucursalRef.current = idSucursal;
    (async () => {
      try {
        const { camiones: nextCamiones, pilotos: nextPilotos } = await cargarCamionesPilotos(idSucursal);
        setCamiones(nextCamiones);
        setPilotos(nextPilotos);
        setFCamion((prev) =>
          prev && !nextCamiones.some((x) => x.int_id_camion === prev.int_id_camion) ? null : prev
        );
        setFPiloto((prev) =>
          prev && !nextPilotos.some((x) => x.int_id_personal === prev.int_id_personal) ? null : prev
        );
      } catch (e) {
        console.error(e);
        show('error', 'Error', getApiErrorMessage(e, 'No se pudieron cargar los catálogos'));
      }
    })();
  }, [fSucursal, filtersReady]);

  function buildParams(pageOverride, limitOverride) {
    return {
      estado_codigo: '',
      fecha_desde: fDesde ? toISODateLocal(fDesde) : null,
      fecha_hasta: fHasta ? toISODateLocal(fHasta) : null,
      id_suc_salida: fSucursal?.int_id_sucursal || 0,
      id_camion: fCamion?.int_id_camion || 0,
      id_piloto: fPiloto?.int_id_personal || 0,
      id_auxiliar: 0,
      creado_por: 0,
      page: pageOverride ?? pagination.page,
      limit: limitOverride ?? pagination.limit
    };
  }

  async function buscar(pageOverride, limitOverride) {
    try {
      setLoading(true);
      const data = await getRutasConMonitoreo(buildParams(pageOverride, limitOverride));

      setRows(data.items);
      setPagination({ total: data.total, page: data.page, limit: data.limit });
      setResumen(data.resumen);
      setDestacadas(data.destacadas);
    } catch (e) {
      console.error(e);
      show('error', 'Error', getApiErrorMessage(e, 'No se pudo cargar el monitoreo de rutas'));
    } finally {
      setLoading(false);
    }
  }

  function limpiarFiltros() {
    setFDesde(null);
    setFHasta(null);
    setFSucursal(null);
    setFCamion(null);
    setFPiloto(null);
    setPagination((prev) => ({ ...prev, page: 1 }));
  }

  const onPage = (event) => {
    const nextPage = Math.floor(event.first / event.rows) + 1;
    const nextLimit = event.rows;
    setPagination((prev) => ({ ...prev, page: nextPage, limit: nextLimit }));
    buscar(nextPage, nextLimit);
  };

  useEffect(() => {
    cargarCombos();
  }, []);

  // Busca al terminar de restaurar los filtros y cada vez que cambia alguno. Sin debounce:
  // ninguno de estos 5 filtros es texto libre (fechas y dropdowns).
  useEffect(() => {
    if (!filtersReady) return;
    setPagination((prev) => ({ ...prev, page: 1 }));
    buscar(1, pagination.limit);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fDesde, fHasta, fSucursal, fCamion, fPiloto, filtersReady]);

  useEffect(() => {
    sessionStorage.setItem(
      LSKEY,
      JSON.stringify({
        fDesde: fDesde ? toISODateLocal(fDesde) : null,
        fHasta: fHasta ? toISODateLocal(fHasta) : null,
        fSucursalId: fSucursal?.int_id_sucursal || 0,
        fCamionId: fCamion?.int_id_camion || 0,
        fPilotoId: fPiloto?.int_id_personal || 0
      })
    );
  }, [fDesde, fHasta, fSucursal, fCamion, fPiloto]);

  function abrirRegistro(ruta = null) {
    setRutaSeleccionada(ruta);
    setShowRegistro(true);
  }

  function cerrarRegistro() {
    setShowRegistro(false);
    setRutaSeleccionada(null);
  }

  async function onRegistroExitoso() {
    cerrarRegistro();
    show('success', 'Registrado', 'Evento de monitoreo registrado exitosamente');
    // El PATCH ya confirmó la escritura, así que la siguiente lectura la ve.
    await buscar();
  }

  return (
    <Layout>
      <Toast ref={toastRef} />

      <div className="container-fluid" style={{ paddingTop: '0rem', paddingBottom: '1.5rem' }}>
        <Card className="border-0 shadow-sm">
          {/* Header con título y alertas */}
          <div className="d-flex justify-content-between align-items-center px-3 pt-3 pb-2">
            <div>
              <h5 className="m-0">Monitoreo de Rutas</h5>
              <small className="text-muted">
                {pagination.total} ruta{pagination.total !== 1 ? 's' : ''} encontrada{pagination.total !== 1 ? 's' : ''}
              </small>
              {resumen.sin_salida > 0 && (
                <div className="mt-2">
                  <Tag severity="warning" icon="pi pi-exclamation-triangle">
                    {resumen.sin_salida} ruta{resumen.sin_salida !== 1 ? 's' : ''} sin salida registrada
                  </Tag>
                </div>
              )}
              {resumen.sin_entrada > 0 && (
                <div className="mt-2">
                  <Tag severity="info" icon="pi pi-info-circle">
                    {resumen.sin_entrada} ruta{resumen.sin_entrada !== 1 ? 's' : ''} sin entrada registrada
                  </Tag>
                </div>
              )}
            </div>
            <div className="d-flex gap-2">
              <Button
                label="Buscar"
                icon="pi pi-search"
                size="small"
                loading={loading}
                onClick={() => buscar(1, pagination.limit)}
              />
              <Button
                label="Limpiar"
                icon="pi pi-filter-slash"
                size="small"
                severity="secondary"
                outlined
                onClick={limpiarFiltros}
              />
            </div>
          </div>

          {/* Filtros organizados */}
          <div className="px-3 pb-3">
            <div className="row g-3">
              {/* Filtros principales */}
              <div className="col-6 col-sm-4 col-md-2">
                <label className="form-label small text-muted mb-1">Fecha Desde</label>
                <Calendar
                  value={fDesde}
                  onChange={(e) => setFDesde(e.value)}
                  showIcon
                  placeholder="Seleccionar fecha"
                  className="w-100"
                  appendTo="self"
                />
              </div>

              <div className="col-6 col-sm-4 col-md-2">
                <label className="form-label small text-muted mb-1">Fecha Hasta</label>
                <Calendar
                  value={fHasta}
                  onChange={(e) => setFHasta(e.value)}
                  showIcon
                  placeholder="Seleccionar fecha"
                  className="w-100"
                  appendTo="self"
                />
              </div>

              <div className="col-6 col-sm-4 col-md-2">
                <label className="form-label small text-muted mb-1">Sucursal Salida</label>
                <Dropdown
                  value={fSucursal}
                  onChange={(e) => setFSucursal(e.value)}
                  options={sucursales}
                  optionLabel="str_nombre"
                  placeholder="Todas"
                  filter
                  showClear
                  className="w-100"
                  appendTo="self"
                />
              </div>

              {/* Fila 2: Filtros adicionales */}
              <div className="col-6 col-sm-4 col-md-2">
                <label className="form-label small text-muted mb-1">Camión</label>
                <Dropdown
                  value={fCamion}
                  onChange={(e) => setFCamion(e.value)}
                  options={camiones}
                  optionLabel="str_placa"
                  placeholder="Todos"
                  filter
                  showClear
                  className="w-100"
                  appendTo="self"
                />
              </div>

              <div className="col-6 col-sm-4 col-md-2">
                <label className="form-label small text-muted mb-1">Piloto</label>
                <Dropdown
                  value={fPiloto}
                  onChange={(e) => setFPiloto(e.value)}
                  options={pilotos}
                  optionLabel="str_nombre"
                  placeholder="Todos"
                  filter
                  showClear
                  className="w-100"
                  appendTo="self"
                />
              </div>
            </div>
          </div>
        </Card>

        <RutasDestacadas
          titulo="Rutas que Ya Regresaron (Sin Entrada Registrada)"
          rutas={destacadas.que_regresaron}
          tipo="regresadas"
          onRegistrar={abrirRegistro}
        />

        {/* Secciones destacadas */}
        <RutasDestacadas
          titulo="Rutas Próximas a Salir (Hoy/Mañana)"
          rutas={destacadas.proximas_salir}
          tipo="proximas"
          onRegistrar={abrirRegistro}
        />

        {/* Tabla de todas las rutas */}
        <Card className="border-0 shadow-sm">
          <div className="px-3 pt-3">
            <h6 className="m-0 mb-2">Todas las Rutas</h6>
          </div>

          {/* Tabla */}
          <div className="px-3 pb-3">
            <DataTable
              value={rows}
              loading={loading}
              dataKey="id_ruta"
              size="small"
              stripedRows
              paginator
              lazy
              scrollable
              tableStyle={{ width: '100%', minWidth: '1296px', tableLayout: 'fixed' }}
              rows={pagination.limit}
              first={(pagination.page - 1) * pagination.limit}
              totalRecords={pagination.total}
              onPage={onPage}
              rowsPerPageOptions={[10, 25, 50, 100]}
              emptyMessage="No se encontraron rutas"
              rowClassName={(r) => r.bpkm_aprobado ? 'bg-danger bg-opacity-10' : ''}
            >
              <Column
                field="codigo_ruta"
                header="Código de Ruta"
                sortable
                style={{ width: '12.3%' }}
              />

              <Column
                field="fecha_salida_plan"
                header="Fecha Salida Plan"
                sortable
                body={(r) => formatDateTimeGT(r.fecha_salida_plan) || '-'}
                style={{ width: '12.3%' }}
              />

              <Column
                field="camion"
                header="Camión"
                sortable
                style={{ width: '8.6%' }}
              />

              <Column
                field="piloto"
                header="Piloto"
                sortable
                style={{ width: '14.8%' }}
              />

              <Column
                field="auxiliar"
                header="Auxiliar"
                sortable
                style={{ width: '14.8%' }}
              />

              <Column
                header="Salida Registrada"
                body={(r) => (
                  <div className="text-center">
                    {r.tiene_salida ? (
                      <div>
                        <div className="text-success">
                          <i className="pi pi-check-circle me-1"></i>
                          Sí
                        </div>
                        {r.salida_fecha_hora && (
                          <div className="small text-muted mt-1">
                            {formatDateTimeGT(r.salida_fecha_hora)}
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="text-danger">
                        <i className="pi pi-times-circle me-1"></i>
                        No
                      </div>
                    )}
                  </div>
                )}
                style={{ width: '14.8%' }}
              />

              <Column
                header="Entrada Registrada"
                body={(r) => (
                  <div className="text-center">
                    {r.tiene_entrada ? (
                      <div>
                        <div className="text-success">
                          <i className="pi pi-check-circle me-1"></i>
                          Sí
                        </div>
                        {r.entrada_fecha_hora && (
                          <div className="small text-muted mt-1">
                            {formatDateTimeGT(r.entrada_fecha_hora)}
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="text-warning">
                        <i className="pi pi-times-circle me-1"></i>
                        No
                      </div>
                    )}
                  </div>
                )}
                style={{ width: '14.8%' }}
              />

              <Column
                header="Acciones"
                body={(r) => (
                  <div className="d-flex gap-1 justify-content-end">
                    <Button
                      icon="pi pi-pencil"
                      rounded
                      text
                      severity="info"
                      size="small"
                      onClick={() => abrirRegistro(r)}
                      tooltip="Registrar monitoreo"
                      tooltipOptions={{ position: 'top' }}
                    />
                  </div>
                )}
                style={{ width: '7.4%' }}
                frozen
                alignFrozen="right"
              />
            </DataTable>
          </div>
        </Card>
      </div>

      {/* Sidebar de registro */}
      <Sidebar
        visible={showRegistro}
        onHide={cerrarRegistro}
        position="right"
        style={{ width: '500px' }}
        header={
          <div className="d-flex align-items-center">
            <i className="pi pi-clock me-2 text-primary"></i>
            <span className="font-semibold">Registrar Monitoreo</span>
          </div>
        }
      >
        <MonitoreoRegistro
          rutaInicial={rutaSeleccionada}
          onExito={onRegistroExitoso}
          onCancelar={cerrarRegistro}
        />
      </Sidebar>
    </Layout>
  );
}
