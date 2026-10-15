import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Layout from '@ui/Layout';
import { Toast } from 'primereact/toast';
import { Card } from 'primereact/card';
import { DataTable } from 'primereact/datatable';
import { Column } from 'primereact/column';
import { Button } from 'primereact/button';
import { RadioButton } from 'primereact/radiobutton';
import { Calendar } from 'primereact/calendar';
import { Dropdown } from 'primereact/dropdown';
import { InputText } from 'primereact/inputtext';
import { Tag } from 'primereact/tag';
import { getBPKMs, getCamionesGerencia, getSucursalesGerencia } from '@services/bpkm/bpkmGerencia';
import { formatDateOnly, toISODateLocal, toLocalDate } from '@utils/dateSafe';
import { getApiErrorMessage } from '@utils/apiError';

const LSKEY = 'bpkm_gerencia_bandeja_filters_v1';

export default function GerenciaBandeja() {
  const navigate = useNavigate();
  const toastRef = useRef(null);
  const firstFolioSearchRef = useRef(true);
  const show = (severity, summary, detail) =>
    toastRef.current?.show({ severity, summary, detail, life: 3000 });

  const persisted = useMemo(() => {
    try { return JSON.parse(sessionStorage.getItem(LSKEY) || '{}'); } catch { return {}; }
  }, []);

  const [bpkms, setBpkms] = useState([]);
  const [total, setTotal] = useState(0);
  const [resumen, setResumen] = useState({ PEND: 0, APR: 0 });
  const [first, setFirst] = useState(0);
  const [rows, setRows] = useState(Number(persisted.rows) || 50);
  const [loading, setLoading] = useState(false);

  // Filtros
  const [estadoCodigo, setEstadoCodigo] = useState(persisted.estadoCodigo ?? 'PEND');
  const [fechaDesde, setFechaDesde] = useState(
    persisted.fechaDesde ? toLocalDate(persisted.fechaDesde) : null
  );
  const [fechaHasta, setFechaHasta] = useState(
    persisted.fechaHasta ? toLocalDate(persisted.fechaHasta) : null
  );
  const [camionFiltro, setCamionFiltro] = useState(Number(persisted.camionFiltro ?? 0) || 0);
  const [sucursalFiltro, setSucursalFiltro] = useState(Number(persisted.sucursalFiltro ?? 0) || 0);
  const [folioFactura, setFolioFactura] = useState(persisted.folioFactura ?? '');
  const [dropdownKey, setDropdownKey] = useState(0);

  const [camiones, setCamiones] = useState([]);
  const [sucursales, setSucursales] = useState([]);

  // Orden solo de la página actual (no hay orden real en el servidor todavía)
  const [sortField, setSortField] = useState(null);
  const [sortOrder, setSortOrder] = useState(null);

  const estadosOpts = [
    { label: 'Todos', value: '' },
    { label: 'Pendiente', value: 'PEND' },
    { label: 'Aprobado', value: 'APR' },
    { label: 'Finalizado RRHH', value: 'FIN_RRHH' }
  ];

  const bpkmsOrdenados = useMemo(() => {
    if (!sortField || !sortOrder) return bpkms;
    return [...bpkms].sort((a, b) => {
      const valA = a[sortField];
      const valB = b[sortField];
      if (valA == null) return sortOrder === 1 ? -1 : 1;
      if (valB == null) return sortOrder === 1 ? 1 : -1;
      if (typeof valA === 'string') {
        return sortOrder * valA.localeCompare(valB, undefined, { numeric: true });
      }
      return sortOrder * (valA > valB ? 1 : valA < valB ? -1 : 0);
    });
  }, [bpkms, sortField, sortOrder]);

  async function cargarBPKMs(paginaFirst = first, paginaRows = rows) {
    setLoading(true);
    try {
      const data = await getBPKMs({
        estado_codigo: estadoCodigo,
        fecha_desde: fechaDesde,
        fecha_hasta: fechaHasta,
        id_sucursal: Number(sucursalFiltro || 0),
        id_camion: Number(camionFiltro || 0),
        folio_factura: String(folioFactura || '').trim(),
        page: Math.floor(paginaFirst / paginaRows) + 1,
        limit: paginaRows
      });
      setBpkms(data.items);
      setTotal(data.total);
      setResumen(data.resumen?.por_estado || { PEND: 0, APR: 0 });
    } catch (e) {
      console.error(e);
      show('error', 'Error', getApiErrorMessage(e, 'No se pudieron cargar los registros BPKM'));
    } finally {
      setLoading(false);
    }
  }

  const handlePage = (e) => {
    setFirst(e.first);
    setRows(e.rows);
    cargarBPKMs(e.first, e.rows);
  };

  async function cargarCatalogos() {
    try {
      const [camionesData, sucursalesData] = await Promise.all([
        getCamionesGerencia(),
        getSucursalesGerencia()
      ]);
      setCamiones(Array.isArray(camionesData) ? camionesData : []);
      setSucursales(Array.isArray(sucursalesData) ? sucursalesData : []);
    } catch (e) {
      console.error(e);
      show('warn', 'Aviso', getApiErrorMessage(e, 'No se pudieron cargar camiones y sucursales'));
    }
  }

  useEffect(() => {
    setFirst(0);
    cargarBPKMs(0);
  }, [estadoCodigo, fechaDesde, fechaHasta, sucursalFiltro, camionFiltro]);

  useEffect(() => {
    if (firstFolioSearchRef.current) {
      firstFolioSearchRef.current = false;
      return;
    }
    const timer = setTimeout(() => {
      setFirst(0);
      cargarBPKMs(0);
    }, 350);
    return () => clearTimeout(timer);
  }, [folioFactura]);

  useEffect(() => {
    cargarCatalogos();
  }, []);

  useEffect(() => {
    sessionStorage.setItem(LSKEY, JSON.stringify({
      estadoCodigo,
      fechaDesde: fechaDesde ? toISODateLocal(fechaDesde) : null,
      fechaHasta: fechaHasta ? toISODateLocal(fechaHasta) : null,
      camionFiltro: Number(camionFiltro || 0) || 0,
      sucursalFiltro: Number(sucursalFiltro || 0) || 0,
      folioFactura: String(folioFactura || '').trim(),
      rows
    }));
  }, [estadoCodigo, fechaDesde, fechaHasta, camionFiltro, sucursalFiltro, folioFactura, rows]);

  const handleBuscar = () => {
    setFirst(0);
    cargarBPKMs(0);
  };

  const handleLimpiar = () => {
    setEstadoCodigo('PEND');
    setFechaDesde(null);
    setFechaHasta(null);
    setCamionFiltro(0);
    setSucursalFiltro(0);
    setFolioFactura('');
    setDropdownKey((prev) => prev + 1);
    setFirst(0);
  };

  const estadoBody = (row) => {
    const estado = row.estado_codigo || '';
    let severity = 'info';
    if (estado === 'PEND') severity = 'warning';
    if (estado === 'APR') severity = 'success';
    if (estado === 'FIN_RRHH') severity = 'info';
    return <Tag value={row.estado_nombre} severity={severity} />;
  };

  const accionesBody = (row) => (
    <Button
      icon="pi pi-arrow-right"
      size="small"
      text
      onClick={() => navigate(`/Gerencia-BPKM/${row.id_bpkm}`)}
      tooltip="Ver Detalle"
      tooltipOptions={{ position: 'top' }}
    />
  );

  const toNum = (v) => Number(v ?? 0) || 0;

  const opcionesCamiones = useMemo(() => {
    const usados = new Set();
    const opts = (camiones || [])
      .filter((c) => !sucursalFiltro || toNum(c.int_id_sucursal ?? c.id_sucursal) === Number(sucursalFiltro))
      .map((c) => {
        const placa =
          c.str_placa || c.placa || c.placa_camion || c.camion || c.nombre || '';
        const id = toNum(c.int_id_camion ?? c.id_camion ?? c.id);
        return {
          label: String(placa || '').trim(),
          value: id
        };
      })
      .filter((opt) => {
        if (!opt.value || !opt.label) return false;
        if (usados.has(opt.value)) return false;
        usados.add(opt.value);
        return true;
      })
      .sort((a, b) => a.label.localeCompare(b.label));

    return [{ label: 'Todos', value: 0 }, ...opts];
  }, [camiones, sucursalFiltro]);

  useEffect(() => {
    const camionElegido = Number(camionFiltro || 0);
    if (camiones.length && camionElegido > 0 && !opcionesCamiones.some((o) => o.value === camionElegido)) {
      setCamionFiltro(0);
    }
  }, [opcionesCamiones]);

  const opcionesSucursales = useMemo(() => {
    const usados = new Set();
    const opts = (sucursales || [])
      .map((s) => {
        const nombre =
          s.str_nombre_sucursal || s.str_nombre || s.nombre_sucursal || s.sucursal || s.nombre || s.descripcion || '';
        const id = toNum(s.int_id_sucursal ?? s.id_sucursal ?? s.id);
        return {
          label: String(nombre || '').trim(),
          value: id
        };
      })
      .filter((opt) => {
        if (!opt.value || !opt.label) return false;
        if (usados.has(opt.value)) return false;
        usados.add(opt.value);
        return true;
      })
      .sort((a, b) => a.label.localeCompare(b.label));

    return [{ label: 'Todas', value: 0 }, ...opts];
  }, [sucursales]);

  const tienesFiltrosActivos =
    estadoCodigo !== '' ||
    fechaDesde ||
    fechaHasta ||
    Number(camionFiltro || 0) > 0 ||
    Number(sucursalFiltro || 0) > 0 ||
    String(folioFactura || '').trim() !== '';

  return (
    <Layout>
      <Toast ref={toastRef} />
      <div className="container-fluid py-0">
        <Card className="border-0 shadow-sm">
          {/* Título y contador */}
          <div className="d-flex justify-content-between align-items-center px-3 pt-3 pb-2">
            <div>
              <h5 className="m-0">Rutas Largas</h5>
              <small className="text-muted">
                {total} registro{total !== 1 ? 's' : ''} encontrado{total !== 1 ? 's' : ''}
                {tienesFiltrosActivos && (
                  <span className="badge bg-info ms-2" style={{ fontSize: '0.7rem' }}>
                    Filtros activos
                  </span>
                )}
              </small>
            </div>
          </div>

          {/* Filtros, con los botones de acción al final de la misma fila */}
          <div className="px-3 pb-2">
            <div className="row g-2 align-items-end">
              <div className="col-6 col-sm-4 col-md-2">
                <label className="form-label small text-muted mb-1">Fecha Desde</label>
                <Calendar
                  value={fechaDesde}
                  onChange={(e) => setFechaDesde(e.value)}
                  showIcon
                  showButtonBar
                  placeholder="Seleccionar fecha"
                  className="w-100"
                  appendTo="self"
                  dateFormat="dd/mm/yy"
                />
              </div>

              <div className="col-6 col-sm-4 col-md-2">
                <label className="form-label small text-muted mb-1">Fecha Hasta</label>
                <Calendar
                  value={fechaHasta}
                  onChange={(e) => setFechaHasta(e.value)}
                  showIcon
                  showButtonBar
                  placeholder="Seleccionar fecha"
                  className="w-100"
                  appendTo="self"
                  dateFormat="dd/mm/yy"
                />
              </div>

              <div className="col-6 col-sm-4 col-md-2">
                <label className="form-label small text-muted mb-1">Sucursal</label>
                <Dropdown
                  key={`sucursal-${dropdownKey}`}
                  value={sucursalFiltro}
                  options={opcionesSucursales}
                  onChange={(e) => setSucursalFiltro(e.value ?? 0)}
                  placeholder="Todas"
                  filter
                  className="w-100"
                  emptyMessage="Sin sucursales"
                />
              </div>

              <div className="col-6 col-sm-4 col-md-2">
                <label className="form-label small text-muted mb-1">Camión</label>
                <Dropdown
                  key={`camion-${dropdownKey}`}
                  value={camionFiltro}
                  options={opcionesCamiones}
                  onChange={(e) => setCamionFiltro(e.value ?? 0)}
                  placeholder="Todos"
                  filter
                  className="w-100"
                  emptyMessage="Sin camiones"
                />
              </div>

              <div className="col-6 col-sm-4 col-md-2">
                <label className="form-label small text-muted mb-1">Folio Factura</label>
                <InputText
                  value={folioFactura}
                  onChange={(e) => setFolioFactura(String(e.target.value || '').toUpperCase())}
                  placeholder="Ej. CR5052"
                  className="w-100"
                />
              </div>

              <div className="col-12 col-md-auto ms-md-auto d-flex gap-2 justify-content-end">
                <Button
                  label="Buscar"
                  icon="pi pi-search"
                  size="small"
                  onClick={handleBuscar}
                  loading={loading}
                />
                <Button
                  label="Limpiar"
                  icon="pi pi-filter-slash"
                  size="small"
                  severity="secondary"
                  outlined
                  onClick={handleLimpiar}
                />
              </div>
            </div>

            <div className="d-flex align-items-center flex-wrap gap-3 mt-3 pt-2">
              <span className="text-muted small fw-semibold">Estado:</span>
              {estadosOpts.map((opt) => (
                <div key={opt.value} className="d-flex align-items-center">
                  <RadioButton
                    inputId={`estado-${opt.value}`}
                    name="estado"
                    value={opt.value}
                    onChange={(e) => setEstadoCodigo(e.value)}
                    checked={estadoCodigo === opt.value}
                  />
                  <label htmlFor={`estado-${opt.value}`} className="ms-2 mb-0 cursor-pointer small">
                    {opt.label}
                    {opt.value === 'PEND' && ` (${resumen.PEND ?? 0})`}
                    {opt.value === 'APR' && ` (${resumen.APR ?? 0})`}
                  </label>
                </div>
              ))}
            </div>
          </div>

          {/* Tabla con estilo compacto y moderno */}
          <div className="px-3 pb-3">
            <DataTable
              value={bpkmsOrdenados}
              loading={loading}
              dataKey="id_bpkm"
              size="small"
              stripedRows
              emptyMessage="No se encontraron registros BPKM"
              lazy
              paginator
              first={first}
              rows={rows}
              totalRecords={total}
              onPage={handlePage}
              rowsPerPageOptions={[10, 25, 50, 100]}
              sortField={sortField}
              sortOrder={sortOrder}
              onSort={(e) => {
                setSortField(e.sortField);
                setSortOrder(e.sortOrder);
              }}
              removableSort
              paginatorTemplate="CurrentPageReport FirstPageLink PrevPageLink PageLinks NextPageLink LastPageLink RowsPerPageDropdown"
              currentPageReportTemplate="{first} - {last} de {totalRecords}"
              scrollable
              tableStyle={{ width: '100%', minWidth: '1528px', tableLayout: 'fixed' }}
              pt={{
                bodyRow: { style: { fontSize: '0.76rem' } },
                headerCell: {
                  style: {
                    fontSize: '0.74rem',
                    padding: '0.35rem 0.45rem',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis'
                  }
                },
                bodyCell: {
                  style: {
                    padding: '0.25rem 0.45rem',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis'
                  }
                }
              }}
            >
              <Column
                field="codigo_ruta"
                header="Código de Ruta"
                sortable
                style={{ width: '8.4%' }}
              />

              <Column
                field="nombre_piloto"
                header="Piloto"
                sortable
                style={{ width: '7.3%' }}
              />

              <Column
                field="nombre_auxiliar"
                header="Auxiliar"
                sortable
                style={{ width: '7.3%' }}
              />

              <Column
                field="placa_camion"
                header="Camión"
                sortable
                style={{ width: '6.3%' }}
              />

              <Column
                field="sucursal_salida"
                header="Sucursal"
                sortable
                style={{ width: '7.3%' }}
              />

              <Column
                header="KM Más Lejano"
                body={(row) => {
                  const km = row.distancia_mas_lejana ? Number(row.distancia_mas_lejana).toFixed(1) : '0.0';
                  return (
                    <div className="text-end">
                      <strong>{km}</strong> km
                    </div>
                  );
                }}
                sortable
                sortField="distancia_mas_lejana"
                style={{ width: '6.8%' }}
              />

              <Column
                header="Distancia Anterior"
                body={(row) => {
                  const val = row.distancia_anterior ?? row.distancia_insertada;
                  if (val === null || val === undefined || val === '') {
                    return '';
                  }
                  const dist = Number(val).toFixed(1);
                  return (
                    <div className="text-end fw-bold">
                      {dist} km
                    </div>
                  );
                }}
                sortable
                sortField="distancia_anterior"
                style={{ width: '7.3%' }}
              />

              <Column
                header="Facturas"
                body={(row) => (
                  <div className="text-center">
                    <span className="badge bg-primary">{row.total_facturas || 0}</span>
                  </div>
                )}
                style={{ width: '5.2%', textAlign: 'center' }}
              />

              <Column
                header="Cumpl. Salida"
                body={(row) => {
                  if (row.ruta_cumplida === null || row.ruta_cumplida === undefined) {
                    return <span className="text-muted small">-</span>;
                  }
                  return row.ruta_cumplida ? (
                    <Tag severity="success" icon="pi pi-check" />
                  ) : (
                    <Tag severity="danger" icon="pi pi-times" />
                  );
                }}
                sortable
                sortField="ruta_cumplida"
                style={{ width: '6.8%', textAlign: 'center' }}
              />

              <Column
                header="Cumpl. Regreso"
                body={(row) => {
                  if (row.cumplimiento_regreso === null || row.cumplimiento_regreso === undefined) {
                    return <span className="text-muted small">-</span>;
                  }
                  return row.cumplimiento_regreso ? (
                    <Tag severity="success" icon="pi pi-check" />
                  ) : (
                    <Tag severity="danger" icon="pi pi-times" />
                  );
                }}
                sortable
                sortField="cumplimiento_regreso"
                style={{ width: '6.8%', textAlign: 'center' }}
              />

              <Column
                header="% Entrega"
                body={(row) => {
                  const porcentaje = Number(row.porcentaje_entrega || 0);
                  const color = porcentaje >= 95 ? '#28a745' : porcentaje >= 85 ? '#f59e0b' : '#dc3545';
                  return (
                    <div className="text-end fw-bold" style={{ color }}>
                      {porcentaje.toFixed(1)}%
                    </div>
                  );
                }}
                sortable
                sortField="porcentaje_entrega"
                style={{ width: '6.3%' }}
              />

              <Column
                header="Fecha de Ruta"
                field="fecha_creacion"
                body={(row) => formatDateOnly(row.fecha_creacion) || '-'}
                sortable
                style={{ width: '9.4%' }}
              />

              <Column
                header="Estado"
                body={estadoBody}
                sortable
                sortField="estado_nombre"
                style={{ width: '10.5%' }}
              />

              <Column
                header="Acciones"
                body={accionesBody}
                style={{ width: '4.2%' }}
                frozen
                alignFrozen="right"
              />
            </DataTable>
          </div>
        </Card>
      </div>
    </Layout>
  );
}
