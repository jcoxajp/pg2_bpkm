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
import { Tag } from 'primereact/tag';
import { getBPKMsParaRRHH, getBPKMsParaRRHHExport, exportBPKMsToXlsx, nombreEstadoRrhh } from '@services/bpkm/bpkmRrhh';
import { toISODateLocal, toLocalDate } from '@utils/dateSafe';
import { getApiErrorMessage } from '@utils/apiError';

const LSKEY = 'bpkm_rrhh_bandeja_filters_v1';

export default function RrhhBandeja() {
  const navigate = useNavigate();
  const toastRef = useRef(null);
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
  const [exportando, setExportando] = useState(false);

  const [estadoCodigo, setEstadoCodigo] = useState(persisted.estadoCodigo ?? '');
  const [fechaDesde, setFechaDesde] = useState(
    persisted.fechaDesde ? toLocalDate(persisted.fechaDesde) : null
  );
  const [fechaHasta, setFechaHasta] = useState(
    persisted.fechaHasta ? toLocalDate(persisted.fechaHasta) : null
  );

  // Orden solo de la página actual (no hay orden real en el servidor todavía)
  const [sortField, setSortField] = useState(null);
  const [sortOrder, setSortOrder] = useState(null);

  const estadosOpts = [
    { label: 'Todos', value: '' },
    { label: nombreEstadoRrhh('APR'), value: 'APR' },
    { label: nombreEstadoRrhh('FIN_RRHH'), value: 'FIN_RRHH' }
  ];

  // Reordena solo la página actual - no hay orden real en el servidor
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
      const data = await getBPKMsParaRRHH({
        estado_codigo: estadoCodigo,
        fecha_desde: fechaDesde,
        fecha_hasta: fechaHasta,
        page: Math.floor(paginaFirst / paginaRows) + 1,
        limit: paginaRows
      });

      setBpkms(data.items.map((i) => ({ ...i, estado_rrhh: nombreEstadoRrhh(i.estado_codigo, i.estado_nombre) })));
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

  useEffect(() => {
    setFirst(0);
    cargarBPKMs(0);
  }, [estadoCodigo, fechaDesde, fechaHasta]);

  useEffect(() => {
    sessionStorage.setItem(LSKEY, JSON.stringify({
      estadoCodigo,
      fechaDesde: fechaDesde ? toISODateLocal(fechaDesde) : null,
      fechaHasta: fechaHasta ? toISODateLocal(fechaHasta) : null,
      rows
    }));
  }, [estadoCodigo, fechaDesde, fechaHasta, rows]);

  const handleBuscar = () => {
    setFirst(0);
    cargarBPKMs(0);
  };

  const handleLimpiar = () => {
    setEstadoCodigo('');
    setFechaDesde(null);
    setFechaHasta(null);
    setFirst(0);
  };

  const handleExportarExcel = async () => {
    setExportando(true);
    try {
      const todos = await getBPKMsParaRRHHExport({
        estado_codigo: estadoCodigo,
        fecha_desde: fechaDesde,
        fecha_hasta: fechaHasta
      });
      exportBPKMsToXlsx(todos);
      show('success', 'Exportado', 'Archivo Excel generado correctamente');
    } catch (e) {
      console.error(e);
      show('error', 'Error', getApiErrorMessage(e, 'No se pudo exportar a Excel'));
    } finally {
      setExportando(false);
    }
  };

  const fmt = (num) => {
    const n = Number(num || 0);
    return 'Q' + n.toLocaleString('es-GT', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  const estadoBody = (row) => {
    const estado = row.estado_codigo || '';
    let severity = 'info';
    if (estado === 'APR') severity = 'warning';
    if (estado === 'FIN_RRHH') severity = 'success';
    return <Tag value={row.estado_rrhh} severity={severity} />;
  };

  const accionesBody = (row) => (
    <Button
      icon="pi pi-arrow-right"
      size="small"
      text
      onClick={() => navigate(`/RRHH-BPKM/${row.id_bpkm}`)}
      tooltip="Ver Detalle"
      tooltipOptions={{ position: 'top' }}
    />
  );

  const tienesFiltrosActivos = estadoCodigo !== '' || fechaDesde || fechaHasta;

  return (
    <Layout>
      <Toast ref={toastRef} />
      <div className="container-fluid py-0">
        <Card className="border-0 shadow-sm">
          {/* Título y contador */}
          <div className="d-flex justify-content-between align-items-center px-3 pt-3 pb-2">
            <div>
              <h5 className="m-0">Liquidación BPKM</h5>
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
              <div className="col-6 col-md-3">
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

              <div className="col-6 col-md-3">
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
                <Button
                  icon="pi pi-refresh"
                  size="small"
                  severity="secondary"
                  outlined
                  onClick={() => cargarBPKMs(first)}
                  loading={loading}
                  tooltip="Refrescar"
                  tooltipOptions={{ position: 'top' }}
                />
                <Button
                  icon="pi pi-file-excel"
                  label="Exportar"
                  size="small"
                  severity="success"
                  outlined
                  onClick={handleExportarExcel}
                  loading={exportando}
                  disabled={total === 0}
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
              emptyMessage="No se encontraron registros BPKM"
              paginatorTemplate="CurrentPageReport FirstPageLink PrevPageLink PageLinks NextPageLink LastPageLink RowsPerPageDropdown"
              currentPageReportTemplate="{first} - {last} de {totalRecords}"
              scrollable
              tableStyle={{ minWidth: '1100px', tableLayout: 'fixed' }}
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
                style={{ width: '9rem', minWidth: '9rem' }}
              />

              <Column
                field="nombre_piloto"
                header="Piloto"
                sortable
                style={{ minWidth: '10rem' }}
              />

              <Column
                field="nombre_auxiliar"
                header="Auxiliar"
                sortable
                style={{ minWidth: '10rem' }}
              />

              <Column
                field="placa_camion"
                header="Camión"
                sortable
                style={{ width: '7rem', minWidth: '7rem' }}
              />

              <Column
                field="departamento"
                header="Departamento L."
                sortable
                style={{ minWidth: '9rem' }}
              />

              <Column
                field="municipio_lejano"
                header="Municipio L."
                sortable
                style={{ minWidth: '10rem' }}
              />

              <Column
                header="Monto Piloto"
                body={(row) => (
                  <div className="text-end">
                    <strong>{fmt(row.monto_aprobado_piloto)}</strong>
                  </div>
                )}
                sortable
                sortField="monto_aprobado_piloto"
                style={{ width: '9rem', minWidth: '9rem', textAlign: 'right' }}
              />

              <Column
                header="Monto Auxiliar"
                body={(row) => (
                  <div className="text-end">
                    <strong>{fmt(row.monto_aprobado_auxiliar)}</strong>
                  </div>
                )}
                sortable
                sortField="monto_aprobado_auxiliar"
                style={{ width: '9rem', minWidth: '9rem', textAlign: 'right' }}
              />

              <Column
                header="Estado"
                body={estadoBody}
                sortable
                sortField="estado_rrhh"
                style={{ width: '12rem', minWidth: '9rem' }}
              />

              <Column
                header="Acciones"
                body={accionesBody}
                style={{ width: '5rem', minWidth: '5rem' }}
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
