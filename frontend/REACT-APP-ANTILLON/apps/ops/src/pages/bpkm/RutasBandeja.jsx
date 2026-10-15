// src/pages/bpkm/rutas/RutasBandeja.jsx
import { useEffect, useMemo, useRef, useState } from 'react';
import Layout from '@ui/Layout';
import RutasNav from './RutasNav';
import { Toast } from 'primereact/toast';
import { Card } from 'primereact/card';
import { Dropdown } from 'primereact/dropdown';
import { Calendar } from 'primereact/calendar';
import { RadioButton } from 'primereact/radiobutton';
import { InputText } from 'primereact/inputtext';
import { Button } from 'primereact/button';
import { DataTable } from 'primereact/datatable';
import { Column } from 'primereact/column';
import { Tag } from 'primereact/tag';
import { useNavigate } from 'react-router-dom';
import { formatDateTimeGT, toISODateLocal, toLocalDate } from '@utils/dateSafe';
import { getApiErrorMessage } from '@utils/apiError';
import {
  getRutas,
  getCamionesActivos,
  getPersonal,
  exportRutasToXlsx,
  getPermisosBPKM
} from '@services/bpkm/bpkmRutas';

const LSKEY = 'bpkm_rutas_filters_v1';

// Solo los estados que ocurren en producción; ver AGENTS.md de este módulo.
const estados = [
  { code: '', name: 'Todos' },
  { code: 'EN_CURSO', name: 'En curso' },
  { code: 'FINALIZADA', name: 'Finalizada' }
];

function tagSeverity(s) {
  const upper = String(s || '').toUpperCase();
  if (upper === 'CREADA' || s === 'Creada') return 'info';
  if (upper === 'EN_CURSO' || upper === 'EN CURSO' || s === 'En curso') return 'warning';
  if (upper === 'REGRESADA' || s === 'Regresada') return 'success';
  if (upper === 'FINALIZADA' || s === 'Finalizada') return 'success';
  if (upper === 'CANCELADA' || s === 'Cancelada') return 'danger';
  return 'secondary';
}

export default function RutasBandeja() {
  const toastRef = useRef(null);
  const nav = useNavigate();
  const show = (severity, summary, detail) =>
    toastRef.current?.show({ severity, summary, detail, life: 3000 });
  const usuarioId = useMemo(() => Number(localStorage.getItem('userId') || 0), []);
  const storeId = useMemo(() => Number(localStorage.getItem('storeId') || 0), []);

  // Permisos
  const [perms, setPerms] = useState([]);

  // Helper para validar permisos
  const rank = { viewer: 1, editor: 2, admin: 3 };
  const need = (perms, key, min = 'viewer') => {
    const r = rank[min] || 1;
    const p = Array.isArray(perms) ? perms.find((x) => x.key === key) : null;
    return p ? (rank[p.nivel_permiso] || 0) >= r : false;
  };

  const canView = need(perms, 'bpkm.rutas.view', 'viewer');

  const persisted = useMemo(() => {
    try {
      return JSON.parse(sessionStorage.getItem(LSKEY) || '{}');
    } catch {
      return {};
    }
  }, []);
  const persistedCamionId = Number(persisted.fCamionId || 0) || 0;
  const persistedPilotoId = Number(persisted.fPilotoId || 0) || 0;
  const persistedAuxId = Number(persisted.fAuxId || 0) || 0;

  // Filtros
  const [fEstado, setFEstado] = useState(persisted.fEstado ?? '');
  const [fDesde, setFDesde] = useState(persisted.fDesde ? toLocalDate(persisted.fDesde) : null);
  const [fHasta, setFHasta] = useState(persisted.fHasta ? toLocalDate(persisted.fHasta) : null);
  const [fCamion, setFCamion] = useState(null);
  const [fPiloto, setFPiloto] = useState(null);
  const [fAux, setFAux] = useState(null);
  const [fFolio, setFFolio] = useState(persisted.fFolio ?? '');
  const [filtersReady, setFiltersReady] = useState(false);

  // Catálogos (dependientes de la sucursal del usuario, igual que en RutaDetalle)
  const [camiones, setCamiones] = useState([]);
  const [pilotos, setPilotos] = useState([]);
  const [auxiliares, setAuxiliares] = useState([]);

  // Data y paginación real de servidor
  const [rows, setRows] = useState([]);
  const [total, setTotal] = useState(0);
  const [resumen, setResumen] = useState({ EN_CURSO: 0 });
  const [first, setFirst] = useState(0);
  const [pageRows, setPageRows] = useState(25);
  const [loading, setLoading] = useState(false);
  const [sortField, setSortField] = useState(null);
  const [sortOrder, setSortOrder] = useState(null);

  const sortedRows = useMemo(() => {
    if (!sortField || !sortOrder) return rows;
    return [...rows].sort((a, b) => {
      const valA = a[sortField];
      const valB = b[sortField];
      if (valA == null) return sortOrder === 1 ? -1 : 1;
      if (valB == null) return sortOrder === 1 ? 1 : -1;
      if (typeof valA === 'string' && typeof valB === 'string') {
        return sortOrder * valA.localeCompare(valB, undefined, { numeric: true });
      }
      return sortOrder * (valA > valB ? 1 : valA < valB ? -1 : 0);
    });
  }, [rows, sortField, sortOrder]);

  async function cargarCombos() {
    try {
      const [c, p, a] = await Promise.all([
        getCamionesActivos({ id_sucursal: storeId }),
        getPersonal({ rol: 'PILOTO', estado: 1, id_sucursal: storeId }),
        getPersonal({ rol: 'AUXILIAR', estado: 1, id_sucursal: storeId })
      ]);
      const nextCamiones = c || [];
      const nextPilotos = p || [];
      const nextAuxiliares = a || [];
      setCamiones(nextCamiones);
      setPilotos(nextPilotos);
      setAuxiliares(nextAuxiliares);
      if (persistedCamionId) {
        const m = nextCamiones.find((x) => Number(x?.int_id_camion || 0) === persistedCamionId);
        if (m) setFCamion(m);
      }
      if (persistedPilotoId) {
        const m = nextPilotos.find((x) => Number(x?.int_id_personal || 0) === persistedPilotoId);
        if (m) setFPiloto(m);
      }
      if (persistedAuxId) {
        const m = nextAuxiliares.find((x) => Number(x?.int_id_personal || 0) === persistedAuxId);
        if (m) setFAux(m);
      }
    } catch (e) {
      console.error(e);
      show('error', 'Error', getApiErrorMessage(e, 'No se pudieron cargar los catálogos'));
    } finally {
      setFiltersReady(true);
    }
  }

  async function buscar(paginaFirst = first, paginaRows = pageRows) {
    try {
      setLoading(true);
      const data = await getRutas({
        estado_codigo: fEstado || '',
        fecha_desde: fDesde || null,
        fecha_hasta: fHasta || null,
        id_camion: fCamion?.int_id_camion || 0,
        id_piloto: fPiloto?.int_id_personal || 0,
        id_auxiliar: fAux?.int_id_personal || 0,
        folio_factura: String(fFolio || '').trim(),
        page: Math.floor(paginaFirst / paginaRows) + 1,
        limit: paginaRows
      });
      setRows(Array.isArray(data.items) ? data.items : []);
      setTotal(data.total || 0);
      setResumen(data.resumen?.por_estado || { EN_CURSO: 0 });
    } catch (e) {
      console.error(e);
      show('error', 'Error', getApiErrorMessage(e, 'No se pudo cargar la bandeja de rutas'));
    } finally {
      setLoading(false);
    }
  }

  function limpiarFiltros() {
    setFEstado('');
    setFDesde(null);
    setFHasta(null);
    setFCamion(null);
    setFPiloto(null);
    setFAux(null);
    setFFolio('');
    setFirst(0);
  }

  const handlePage = (e) => {
    setFirst(e.first);
    setPageRows(e.rows);
    buscar(e.first, e.rows);
  };

  useEffect(() => {
    cargarCombos();
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const data = await getPermisosBPKM(usuarioId);
        setPerms(Array.isArray(data) ? data : []);
      } catch (e) {
        console.error(e);
        show('error', 'Error', getApiErrorMessage(e, 'No se pudieron cargar los permisos'));
      }
    })();
  }, [usuarioId]);

  useEffect(() => {
    if (canView && filtersReady) {
      setFirst(0);
      buscar(0, pageRows);
    }
  }, [canView, filtersReady, fEstado, fDesde, fHasta, fCamion, fPiloto, fAux]);

  useEffect(() => {
    if (!canView || !filtersReady) return;
    const timer = setTimeout(() => {
      setFirst(0);
      buscar(0, pageRows);
    }, 350);
    return () => clearTimeout(timer);
  }, [fFolio]);

  useEffect(() => {
    sessionStorage.setItem(
      LSKEY,
      JSON.stringify({
        fEstado,
        fDesde: fDesde ? toISODateLocal(fDesde) : null,
        fHasta: fHasta ? toISODateLocal(fHasta) : null,
        fCamionId: fCamion?.int_id_camion || 0,
        fPilotoId: fPiloto?.int_id_personal || 0,
        fAuxId: fAux?.int_id_personal || 0,
        fFolio: String(fFolio || '').trim()
      })
    );
  }, [fEstado, fDesde, fHasta, fCamion, fPiloto, fAux, fFolio]);

  async function handleExportar() {
    try {
      setLoading(true);
      const data = await getRutas({
        estado_codigo: fEstado || '',
        fecha_desde: fDesde || null,
        fecha_hasta: fHasta || null,
        id_camion: fCamion?.int_id_camion || 0,
        id_piloto: fPiloto?.int_id_personal || 0,
        id_auxiliar: fAux?.int_id_personal || 0,
        folio_factura: String(fFolio || '').trim(),
        exportar: true
      });
      await exportRutasToXlsx(Array.isArray(data.items) ? data.items : []);
    } catch (e) {
      console.error(e);
      show('error', 'Error', getApiErrorMessage(e, 'No se pudo exportar la bandeja de rutas'));
    } finally {
      setLoading(false);
    }
  }

  function verDetalle(r) {
    nav(`/Rutas-BPKM/${r.id_ruta}`, { state: { row: r } });
  }

  return (
    <Layout>
      <Toast ref={toastRef} />
      <div className="container-fluid py-0">
        <RutasNav />

        {!canView && perms.length > 0 && (
          <Card className="border-0 shadow-sm mt-3">
            <div className="p-4 text-center">
              <i className="pi pi-lock text-muted" style={{ fontSize: '3rem' }}></i>
              <h5 className="mt-3">Sin permiso para ver rutas</h5>
              <p className="text-muted">
                No tiene permisos para ver el listado de rutas. Contacte al administrador.
              </p>
            </div>
          </Card>
        )}

        {canView && <Card className="border-0 shadow-sm">
          {/* Header con título */}
          <div className="d-flex justify-content-between align-items-center px-3 pt-3 pb-2">
            <div>
              <h5 className="m-0">Rutas de Distribución</h5>
              <small className="text-muted">
                {total} ruta{total !== 1 ? 's' : ''} encontrada{total !== 1 ? 's' : ''}
              </small>
            </div>
            <div className="d-flex gap-2">
              <Button
                label="Buscar"
                icon="pi pi-search"
                size="small"
                loading={loading}
                onClick={() => { setFirst(0); buscar(0, pageRows); }}
              />
              <Button
                label="Limpiar"
                icon="pi pi-filter-slash"
                size="small"
                severity="secondary"
                outlined
                onClick={limpiarFiltros}
              />
              <Button
                label="Exportar"
                icon="pi pi-file-excel"
                size="small"
                severity="success"
                outlined
                onClick={handleExportar}
                disabled={total === 0}
              />
            </div>
          </div>

          {/* Filtros organizados */}
          <div className="px-3 pb-3">
            <div className="row g-3">
              <div className="col-6 col-sm-4 col-md-2">
                <label className="form-label small text-muted mb-1">Fecha Desde</label>
                <Calendar
                  value={fDesde}
                  onChange={(e) => setFDesde(e.value)}
                  showIcon
                  placeholder="Seleccionar fecha"
                  className="w-100"
                  appendTo="self"
                  dateFormat="dd/mm/yy"
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
                  dateFormat="dd/mm/yy"
                />
              </div>

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

              <div className="col-6 col-sm-4 col-md-2">
                <label className="form-label small text-muted mb-1">Auxiliar</label>
                <Dropdown
                  value={fAux}
                  onChange={(e) => setFAux(e.value)}
                  options={auxiliares}
                  optionLabel="str_nombre"
                  placeholder="Todos"
                  filter
                  showClear
                  className="w-100"
                  appendTo="self"
                />
              </div>

              <div className="col-6 col-sm-4 col-md-2">
                <label className="form-label small text-muted mb-1">Folio Factura</label>
                <InputText
                  value={fFolio}
                  onChange={(e) => setFFolio(String(e.target.value || '').toUpperCase())}
                  placeholder="Ej. CR5052"
                  className="w-100"
                />
              </div>
            </div>

            <div className="d-flex align-items-center flex-wrap gap-3 mt-3 pt-2">
              <span className="text-muted small fw-semibold">Estado:</span>
              {estados.map((opt) => (
                <div key={opt.code} className="d-flex align-items-center">
                  <RadioButton
                    inputId={`estado-${opt.code}`}
                    name="estado"
                    value={opt.code}
                    onChange={(e) => setFEstado(e.value)}
                    checked={fEstado === opt.code}
                  />
                  <label htmlFor={`estado-${opt.code}`} className="ms-2 mb-0 cursor-pointer small">
                    {opt.name}
                    {opt.code === 'EN_CURSO' && ` (${resumen.EN_CURSO ?? 0})`}
                  </label>
                </div>
              ))}
            </div>
          </div>

          {/* Tabla */}
          <div className="px-3 pb-3">
            <DataTable
              value={sortedRows}
              loading={loading}
              dataKey="id_ruta"
              size="small"
              stripedRows
              lazy
              paginator
              sortField={sortField}
              sortOrder={sortOrder}
              onSort={(e) => {
                setSortField(e.sortField);
                setSortOrder(e.sortOrder);
              }}
              removableSort
              first={first}
              rows={pageRows}
              totalRecords={total}
              onPage={handlePage}
              rowsPerPageOptions={[10, 25, 50, 100]}
              emptyMessage="No se encontraron rutas"
            >
              <Column
                field="codigo_ruta"
                header="Código de Ruta"
                sortable
                style={{ width: '8rem', minWidth: '8rem' }}
              />
              
              <Column
                field="fecha_salida_plan"
                header="Fecha Salida"
                sortable
                body={(r) => formatDateTimeGT(r.fecha_salida_plan) || '-'}
                style={{ width: '10rem', minWidth: '10rem' }}
              />
              
              <Column
                field="camion"
                header="Camión"
                sortable
                style={{ width: '7rem', minWidth: '7rem' }}
              />
              
              <Column
                field="piloto"
                header="Piloto"
                sortable
                style={{ width: '12rem', minWidth: '12rem' }}
              />
              
              <Column
                field="tipo_ruta"
                header="Tipo"
                body={(r) => {
                  const tipo = r.tipo_ruta;
                  const label = (tipo === 'RT' || tipo === 'RL') ? 'Ruta Larga'
                              : tipo === 'RC' ? 'Ruta Corta'
                              : tipo === 'TE' ? 'Transporte Externo'
                              : '-';
                  return (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span>{label}</span>
                    </div>
                  );
                }}
                sortable
                style={{ width: '12rem', minWidth: '12rem' }}
              />

              <Column
                header="Facturas"
                body={(r) => (
                  <div className="text-center">
                    <span className="badge bg-primary">{r.total_facturas || 0}</span>
                  </div>
                )}
                style={{ width: '6rem', minWidth: '6rem' }}
              />

              <Column
                header="Estado"
                body={(r) => (
                  <Tag value={r.estado_nombre} severity={tagSeverity(r.estado_nombre)} />
                )}
                sortable
                sortField="estado_nombre"
                style={{ width: '7rem', minWidth: '7rem' }}
              />
              
              <Column
                header="Acción"
                body={(r) => (
                  <div className="d-flex gap-1 justify-content-end">
                    <Button
                      icon="pi pi-arrow-right"
                      rounded
                      text
                      severity="info"
                      size="small"
                      onClick={() => verDetalle(r)}
                      tooltip="Ver detalle"
                      tooltipOptions={{ position: 'top' }}
                    />
                  </div>
                )}
                style={{ width: '2rem', minWidth: '2rem' }}
              />
            </DataTable>
          </div>
        </Card>}
      </div>
    </Layout>
  );
}