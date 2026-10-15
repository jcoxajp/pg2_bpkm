// src/pages/bpkm/sel/SelBandeja.jsx
import { useEffect, useMemo, useRef, useState } from 'react';
import Layout from '@ui/Layout';
import SelNav from './SelNav';
import { Toast } from 'primereact/toast';
import { Card } from 'primereact/card';
import { Dropdown } from 'primereact/dropdown';
import { Calendar } from 'primereact/calendar';
import { InputText } from 'primereact/inputtext';
import { InputTextarea } from 'primereact/inputtextarea';
import { Button } from 'primereact/button';
import { DataTable } from 'primereact/datatable';
import { Column } from 'primereact/column';
import { Tag } from 'primereact/tag';
import { Tooltip } from 'primereact/tooltip';
import { Dialog } from 'primereact/dialog';
import { RadioButton } from 'primereact/radiobutton';
import { ConfirmDialog, confirmDialog } from 'primereact/confirmdialog';
import { formatDateTimeGT, formatDateOnly } from '@utils/dateSafe';

import {
  getFormasEntrega,
  getCiudades,
  getMunicipios,
  getTransportesExternos,
  getSucursalesList,
  getPermisosBPKM
} from '@services/bpkm/bpkmRutas';

import {
  getMisSelecciones,
  postAnularSeleccion,
  postSolicitarCambio,
  validateNcInSap,
  postLiquidarSelDespachoSucursal
} from '@services/bpkm/selecciones';
import SidebarHistorialEntrega from '@ui/Evidencias-Facturas/SidebarHistorialEntrega';

import { postSolicitarCambioSucursal } from '@services/bpkm/cambiosSucursal';

const ESTADOS = [
  { code: '', name: 'Todos' },
  { code: 'ACT', name: 'Pendiente de envío' },
  { code: 'EN_RUTA', name: 'En Ruta' },
  { code: 'FALLIDA', name: 'Entrega fallida' },
  { code: 'CERRADA', name: 'Entregada' },
  { code: 'ANUL', name: 'Anulada' }
];

const sevEstado = (s) => {
  if (s === 'ACT') return 'info';
  if (s === 'EN_RUTA') return 'warning';
  if (s === 'FALLIDA') return 'danger';
  if (s === 'CERRADA') return 'success';
  if (s === 'ANUL') return 'danger';
  return null;
};

const getNombreEstado = (codigo) => {
  const estado = ESTADOS.find(e => e.code === codigo);
  return estado ? estado.name : codigo;
};

// Calcula días transcurridos desde la fecha de creación
const getDiasIndicator = (fechaCreacion) => {
  if (!fechaCreacion) return null;
  const now = new Date();
  const created = new Date(fechaCreacion);
  if (isNaN(created.getTime())) return null;
  const diffMs = now - created;
  const dias = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  let color;
  if (dias <= 2) color = '#22c55e';       // Verde: 0-2 días
  else if (dias <= 3) color = '#f59e0b';  // Amarillo: 2-3 días
  else color = '#ef4444';                 // Rojo: 4+ días
  return { dias, color };
};

const STORAGE_KEY = 'bpkm_sel_bandeja_filtros';

function readStoredFilters() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return null;
    return parsed;
  } catch (e) {
    console.warn('[SelBandeja] Error al leer filtros de localStorage:', e);
    return null;
  }
}

export default function SelBandeja() {
  const toastRef = useRef(null);
  const evTooltipRef = useRef(null);
  const show = (sev, s, d) => toastRef.current?.show({ severity: sev, summary: s, detail: d, life: 3000 });
  const err = (s, d) => show('error', s, d);
  const ok = (s, d) => show('success', s, d);

  const usuarioId = useMemo(() => Number(localStorage.getItem('userId') || 0), []);
  const [perms, setPerms] = useState([]);
  const [formas, setFormas] = useState([]);
  const [ciudades, setCiudades] = useState([]);
  const [transportes, setTransportes] = useState([]);
  const [sucursales, setSucursales] = useState([]);

  // filtros con persistencia
  const [fEstado, setFEstado] = useState(() => {
    const stored = readStoredFilters();
    if (stored && typeof stored.estadoCode === 'string' && stored.estadoCode !== '') {
      const found = ESTADOS.find((e) => e.code === stored.estadoCode);
      if (found) return found;
    }
    return ESTADOS[1]; // Por defecto: Pendiente de envío
  });
  const [fFolio, setFFolio] = useState(() => {
    const stored = readStoredFilters();
    return (stored && typeof stored.folio === 'string') ? stored.folio : '';
  });
  const [debouncedFolio, setDebouncedFolio] = useState(() => {
    const stored = readStoredFilters();
    return (stored && typeof stored.folio === 'string') ? stored.folio : '';
  });
  const [fRange, setFRange] = useState(() => {
    const stored = readStoredFilters();
    if (stored && Array.isArray(stored.range) && stored.range.length === 2) {
      const d1 = stored.range[0] ? new Date(stored.range[0]) : null;
      const d2 = stored.range[1] ? new Date(stored.range[1]) : null;
      const v1 = !d1 || !isNaN(d1.getTime());
      const v2 = !d2 || !isNaN(d2.getTime());
      if (v1 && v2 && (d1 || d2)) return [d1, d2];
    }
    return null;
  });

  // conteos por estado desde el backend
  const [conteoEstados, setConteoEstados] = useState({ ACT: 0, EN_RUTA: 0, FALLIDA: 0 });


  // paginación (opciones 10, 25, 50, 100 - por defecto 25)
  const [rows, setRows] = useState([]);
  const [rowsBase, setRowsBase] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [pageState, setPageState] = useState(() => {
    const stored = readStoredFilters();
    const allowed = [10, 25, 50, 100];
    const rows = (stored && allowed.includes(Number(stored.rows))) ? Number(stored.rows) : 50;
    return { first: 0, rows };
  });

  const [sortState, setSortState] = useState({ field: null, order: 1 });

  // diálogos
  const [dlgCambio, setDlgCambio] = useState(false);
  const [dlgAnular, setDlgAnular] = useState(false);
  const [dlgCambioSucursal, setDlgCambioSucursal] = useState(false);
  const [dlgLiquidar, setDlgLiquidar] = useState(false);
  const [rowSel, setRowSel] = useState(null);

  // sidebar historial
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // campos cambio forma
  const [newFormaId, setNewFormaId] = useState(null);
  const [newTransporteId, setNewTransporteId] = useState(null);
  const [newCiudadId, setNewCiudadId] = useState(null);
  const [newMuniId, setNewMuniId] = useState(null);
  const [newDireccion, setNewDireccion] = useState('');
  const [comentarioCambio, setComentarioCambio] = useState('');
  const [muniOpts, setMuniOpts] = useState([]);

  // campos cambio sucursal
  const [newSucursalId, setNewSucursalId] = useState(null);
  const [motivoCambioSuc, setMotivoCambioSuc] = useState('');

  // campos anular
  const [folioNc, setFolioNc] = useState('');
  const [comentarioAnular, setComentarioAnular] = useState('');

  // campos liquidar
  const [comentarioLiquidar, setComentarioLiquidar] = useState('');

  // Helper para validar permisos
  const rank = { viewer: 1, editor: 2, admin: 3 };
  const need = (perms, key, min = 'viewer') => {
    const r = rank[min] || 1;
    const p = Array.isArray(perms) ? perms.find((x) => x.key === key) : null;
    return p ? (rank[p.nivel_permiso] || 0) >= r : false;
  };

  const canView = need(perms, 'bpkm.facturas.view', 'viewer');

  useEffect(() => {
    (async () => {
      try {
        const [fe, ciu, tr, suc] = await Promise.all([getFormasEntrega(), getCiudades(), getTransportesExternos(), getSucursalesList()]);
        setFormas(fe || []);
        setCiudades(ciu || []);
        setTransportes(tr || []);
        setSucursales(suc || []);
      } catch (e) {
        console.error(e);
        err('Error', 'No se pudieron cargar catálogos');
      }
    })();
  }, []);

  useEffect(() => {
    (async () => {
      const data = await getPermisosBPKM(usuarioId);
      setPerms(Array.isArray(data) ? data : []);
    })();
  }, [usuarioId]);

  useEffect(() => {
    const t = setTimeout(() => {
      setDebouncedFolio(fFolio);
    }, 500);
    return () => clearTimeout(t);
  }, [fFolio]);

  const applySort = (items, field, order) => {
    if (!field || !order || order === 0) return items;
    const dir = order === -1 ? -1 : 1;
    return [...items].sort((a, b) => {
      const av = a?.[field];
      const bv = b?.[field];
      if (av == null && bv == null) return 0;
      if (av == null) return -1 * dir;
      if (bv == null) return 1 * dir;
      if (typeof av === 'number' && typeof bv === 'number') return (av - bv) * dir;
      return String(av).localeCompare(String(bv), 'es', { numeric: true, sensitivity: 'base' }) * dir;
    });
  };

  // Persistencia en localStorage
  useEffect(() => {
    try {
      const payload = {
        estadoCode: fEstado?.code ?? '',
        folio: fFolio ?? '',
        range: Array.isArray(fRange)
          ? fRange.map((d) => (d instanceof Date && !isNaN(d.getTime()) ? d.toISOString() : null))
          : null,
        rows: pageState.rows
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
    } catch (e) {
      console.warn('[SelBandeja] Error al guardar filtros en localStorage:', e);
    }
  }, [fEstado, fFolio, fRange, pageState.rows]);

  useEffect(() => {
    const t = setTimeout(() => {
      evTooltipRef.current?.updateTargetEvents();
    }, 150);
    return () => clearTimeout(t);
  }, [rows]);

  async function load(page = pageState, folioValue = debouncedFolio, estadoObj = fEstado) {
    if (!canView) return;
    try {
      setLoading(true);
      const [dFrom, dTo] = Array.isArray(fRange) ? fRange : [null, null];
      const res = await getMisSelecciones({
        fecha_desde: dFrom || null,
        fecha_hasta: dTo || null,
        folio_like: folioValue || null,
        estado_codigo: (estadoObj?.code !== undefined) ? (estadoObj.code || null) : (fEstado?.code || null),
        limit: page.rows,
        offset: page.first
      });
      const items = res.items || [];
      setRowsBase(items);
      setRows(applySort(items, sortState.field, sortState.order));
      setTotal(Number(res.total || 0));
      if (res?.resumen?.por_estado) {
        setConteoEstados(res.resumen.por_estado);
      }
    } catch (e) {
      console.error(e);
      err('Error', 'No se pudo cargar la bandeja');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (canView) {
      setPageState((prev) => ({ ...prev, first: 0 }));
      load({ first: 0, rows: pageState.rows }, debouncedFolio);
    }
  }, [fEstado, debouncedFolio, fRange, canView]);

  function onPage(ev) {
    const ns = { first: ev.first, rows: ev.rows };
    setPageState(ns);
    load(ns);
  }

  function onSort(ev) {
    const next = { field: ev.sortField, order: ev.sortOrder };
    setSortState(next);
    setRows(applySort(rowsBase, next.field, next.order));
  }

  function clearFilters() {
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {}
    setFEstado(ESTADOS[1]); // Por defecto: Pendiente de envío
    setFFolio('');
    setDebouncedFolio('');
    setFRange(null);
    setPageState({ first: 0, rows: 50 });
    load({ first: 0, rows: 50 }, '', ESTADOS[1]);
  }

  function openCambio(row) {
    setRowSel(row);
    setDlgCambio(true);
    setNewFormaId(null);
    setNewTransporteId(null);
    setNewCiudadId(null);
    setNewMuniId(null);
    setNewDireccion('');
    setComentarioCambio('');
    setMuniOpts([]);
  }

  function openAnular(row) {
    setRowSel(row);
    setDlgAnular(true);
    setFolioNc('');
    setComentarioAnular('');
  }

  function openCambioSucursal(row) {
    setRowSel(row);
    setDlgCambioSucursal(true);
    setNewSucursalId(null);
    setMotivoCambioSuc('');
    console.log('Row seleccionada:', row);
    console.log('Sucursales disponibles:', sucursales);
    console.log('ID sucursal actual:', row.id_sucursal_creador);
  }

  function openLiquidar(row) {
    setRowSel(row);
    setDlgLiquidar(true);
    setComentarioLiquidar('');
  }

  function openHistorial(row) {
    setRowSel(row);
    setSidebarOpen(true);
  }

  async function onChangeNewCiudad(v) {
    setNewCiudadId(v || null);
    setNewMuniId(null);
    if (!v) return setMuniOpts([]);
    try {
      const list = await getMunicipios({ p_departamento: v });
      setMuniOpts(Array.isArray(list) ? list : []);
    } catch {
      err('Error', 'No se pudieron cargar municipios');
    }
  }

  const newCode = (formas.find(f => f.int_id_forma_entrega === newFormaId)?.str_codigo || '').toUpperCase();
  const canCambio =
    !!rowSel &&
    !!newFormaId &&
    ((newCode === 'SUC') ||
      (newCode === 'EXT' && !!newTransporteId) ||
      ((newCode === 'CAM' || newCode === 'LOCAL') && !!newCiudadId && !!newMuniId && String(newDireccion).trim().length > 3));

  async function confirmarCambio() {
    if (!canCambio || !rowSel) return;
    try {
      await postSolicitarCambio({
        id_factura_sel: rowSel?.id_factura_sel || rowSel?.int_id_factura_sel,
        id_solicitante: usuarioId,
        id_forma_nueva: newFormaId,
        id_transporte_externo_new: newCode === 'EXT' ? newTransporteId : null,
        id_departamento_new: (newCode === 'CAM' || newCode === 'LOCAL') ? newCiudadId : null,
        id_municipio_new: (newCode === 'CAM' || newCode === 'LOCAL') ? newMuniId : null,
        direccion_new: (newCode === 'CAM' || newCode === 'LOCAL') ? newDireccion : null,
        comentario_solicitante: comentarioCambio || null
      });
      ok('Solicitud enviada', 'Cambio de forma solicitado');
      setDlgCambio(false);
      load(pageState);
    } catch (e) {
      console.error(e);
      err('Error', 'No se pudo solicitar el cambio');
    }
  }

  async function confirmarAnular() {
    if (!rowSel) return;
    const folio = String(folioNc || '').trim();
    const comentario = String(comentarioAnular || '').trim();

    if (folio.length < 6) {
      err('Validacion', 'El folio de Nota de Crédito es obligatorio y debe tener al menos 6 caracteres');
      return;
    }

    if (comentario.length === 0) {
      err('Validacion', 'El comentario es obligatorio');
      return;
    }

    try {
      const v = await validateNcInSap({ folio_nc: folio });
      if (!v.ok) {
        err('NC', 'La Nota de Crédito no existe en SAP');
        return;
      }

      const fechaDoc = v.fecha_doc || null;
      await postAnularSeleccion({
        id_factura_sel: rowSel?.id_factura_sel || rowSel?.int_id_factura_sel,
        folio_nc: folio,
        usuario: usuarioId,
        fecha_anulacion: fechaDoc,
        comentario: comentario
      });

      ok('Anulada', 'Seleccion anulada correctamente');
      setDlgAnular(false);
      load(pageState);
    } catch (e) {
      console.error(e);
      const serverMsg = e?.response?.data?.error || e?.response?.data?.message || (Array.isArray(e?.response?.data?.errors) && e.response.data.errors[0]) || e?.message || 'No se pudo anular la seleccion';
      err('Error', serverMsg);
    }
  }

  async function confirmarCambioSucursal() {
    if (!rowSel || !newSucursalId) {
      err('Validacion', 'Debe seleccionar una sucursal de destino');
      return;
    }

    const motivo = String(motivoCambioSuc || '').trim();
    if (motivo.length === 0) {
      err('Validacion', 'El motivo de solicitud es obligatorio');
      return;
    }

    // Validar que la sucursal sea diferente (solo si existe id_sucursal_creador)
    if (rowSel.id_sucursal_creador && newSucursalId === rowSel.id_sucursal_creador) {
      err('Validacion', 'La sucursal de destino debe ser diferente a la sucursal actual');
      return;
    }

    try {
      await postSolicitarCambioSucursal({
        id_factura_sel: rowSel?.id_factura_sel || rowSel?.int_id_factura_sel,
        id_sucursal_destino: newSucursalId,
        motivo: motivo,
        usuario: usuarioId
      });
      ok('Solicitud enviada', 'Cambio de sucursal solicitado correctamente');
      setDlgCambioSucursal(false);
      load(pageState);
    } catch (e) {
      console.error(e);
      err('Error', e?.response?.data?.error || e.message || 'No se pudo solicitar el cambio de sucursal');
    }
  }

  async function confirmarLiquidar() {
    if (!rowSel) return;

    try {
      await postLiquidarSelDespachoSucursal({
        id_factura_sel: rowSel?.id_factura_sel || rowSel?.int_id_factura_sel,
        usuario: usuarioId,
        comentario: comentarioLiquidar || null
      });
      ok('Liquidada', 'Factura despachada en sucursal');
      setDlgLiquidar(false);
      load(pageState);
    } catch (e) {
      console.error(e);
      err('Error', e?.response?.data?.error || e.message || 'No se pudo liquidar la factura');
    }
  }

  return (
    <Layout>
      <Toast ref={toastRef} />
      <ConfirmDialog />
      <Tooltip key={`tt-${rows.length}-${pageState.first}`} target=".tiene-evidencia-badge" position="top" />
      <div className="container-fluid py-0">
        <SelNav />

        {!canView && perms.length > 0 && (
          <Card className="border-0 shadow-sm mt-3">
            <div className="p-4 text-center">
              <i className="pi pi-lock text-muted" style={{ fontSize: '3rem' }}></i>
              <h5 className="mt-3">Sin permiso para ver facturas</h5>
              <p className="text-muted">No tiene permisos para ver "Mis Facturas". Contacte al administrador.</p>
            </div>
          </Card>
        )}

        {canView && (
        <Card className="border-0 shadow-sm">
          {/* Header con título */}
          <div className="d-flex justify-content-between align-items-center px-3 pt-3 pb-2">
            <div>
              <h5 className="m-0">Envío de Facturas</h5>
              <small className="text-muted">
                {total} factura{total !== 1 ? 's' : ''} encontrada{total !== 1 ? 's' : ''}
              </small>
            </div>
            <div className="d-flex gap-2">
              <Button
                label="Buscar"
                icon="pi pi-search"
                size="small"
                loading={loading}
                onClick={() => load({ first: 0, rows: pageState.rows })}
              />
              <Button
                label="Limpiar"
                icon="pi pi-filter-slash"
                size="small"
                severity="secondary"
                outlined
                onClick={clearFilters}
              />
            </div>
          </div>

          {/* Filtros organizados */}
          <div className="px-3 pb-3">
            <div className="row g-3">
              <div className="col-md-3">
                <label className="form-label small text-muted mb-1">Buscar por folio</label>
                <InputText
                  value={fFolio}
                  onChange={(e) => setFFolio(e.target.value)}
                  placeholder="Folio de factura"
                  className="w-100 p-inputtext-sm"
                />
              </div>

              <div className="col-md-3">
                <label className="form-label small text-muted mb-1">Rango de fechas</label>
                <Calendar
                  value={fRange}
                  onChange={(e) => setFRange(e.value)}
                  selectionMode="range"
                  dateFormat="dd/mm/yy"
                  placeholder="Seleccionar rango"
                  showIcon
                  className="w-100 p-inputtext-sm"
                  appendTo="self"
                />
              </div>

              {/* Radiobuttons de Estado */}
              <div className="col-12 mt-2">
                <label className="form-label small text-muted mb-2 d-block">Estado</label>
                <div className="d-flex flex-wrap align-items-center gap-3">
                  {ESTADOS.map((estado) => {
                    const cantidad = conteoEstados?.[estado.code];
                    const tieneConteo = ['ACT', 'EN_RUTA', 'FALLIDA'].includes(estado.code);
                    return (
                      <div key={estado.code} className="d-flex align-items-center">
                        <RadioButton
                          inputId={`estado-${estado.code}`}
                          name="estado"
                          value={estado}
                          onChange={(e) => setFEstado(e.value)}
                          checked={fEstado?.code === estado.code}
                        />
                        <label
                          htmlFor={`estado-${estado.code}`}
                          className="ms-2 d-flex align-items-center"
                          style={{ cursor: 'pointer', fontSize: '0.9rem' }}
                        >
                          <span>{estado.name}</span>
                          {tieneConteo && (
                            <span className="ms-1 text-muted">
                              ({cantidad ?? 0})
                            </span>
                          )}
                        </label>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>

          {/* Tabla */}
          <div className="px-3 pb-3">
            <DataTable
              value={rows}
              loading={loading}
              dataKey="id_factura_sel"
              size="small"
              stripedRows
              scrollable
              paginator
              lazy
              sortField={sortState.field}
              sortOrder={sortState.order}
              onSort={onSort}
              rows={pageState.rows}
              first={pageState.first}
              totalRecords={total}
              rowsPerPageOptions={[10, 25, 50, 100]}
              onPage={onPage}
              emptyMessage="No se encontraron facturas"
            >
              <Column
                header="Días"
                style={{ width: '3.2rem', minWidth: '3.2rem', textAlign: 'center', padding: '0.25rem' }}
                body={(r) => {
                  const showIndicator = r.estado_codigo === 'ACT' || r.estado_codigo === 'EN_RUTA';
                  if (!showIndicator) return null;
                  const indicator = getDiasIndicator(r.fecha_factura);
                  if (!indicator) return null;
                  return (
                    <div
                      title={`${indicator.dias} día${indicator.dias !== 1 ? 's' : ''} desde la creación`}
                      style={{
                        width: 36,
                        height: 36,
                        borderRadius: '50%',
                        backgroundColor: indicator.color,
                        color: '#000000ff',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontWeight: 700,
                        fontSize: indicator.dias >= 100 ? '0.6rem' : '0.78rem',
                        lineHeight: 1,
                        flexShrink: 0,
                        margin: '0 auto'
                      }}
                    >
                      {indicator.dias}
                    </div>
                  );
                }}
              />

              <Column
                field="folio_factura"
                header="Folio / Sucursal"
                sortable
                sortField="folio_factura"
                style={{ width: "11rem", minWidth: "10rem" }}
                body={(r) => (
                  <div className="d-flex flex-column" style={{ lineHeight: 1.25 }}>
                    <span>{r.folio_factura || "-"}</span>
                    {r.sucursal_creador && (
                      <span className="text-muted" style={{ fontSize: "0.8rem", marginTop: "2px" }}>
                        {r.sucursal_creador}
                      </span>
                    )}
                  </div>
                )}
              />

              <Column
                field="forma_nombre"
                header="Forma de Entrega"
                sortable
                style={{ width: "12rem", minWidth: "12rem" }}
              />

              <Column
                field="nombre_cliente"
                header="Cliente"
                sortable
                style={{ minWidth: '200px' }}
              />

              <Column
                field="fecha_creacion"
                header="Fecha Creación"
                body={(r) => formatDateOnly(r.fecha_creacion)}
                sortable
                style={{ width: '10rem', minWidth: '10rem' }}
              />

              <Column
                field="destino"
                header="Destino/Detalle"
                style={{ minWidth: '200px' }}
              />

              <Column
                field="estado_nombre"
                header="Estado"
                body={(r) => (
                  <div className="d-flex align-items-center gap-2">
                    <Tag value={getNombreEstado(r.estado_codigo)} severity={sevEstado(r.estado_codigo)} />
                    {r.tiene_evidencias && (
                      <span
                        className="badge bg-primary text-white rounded-pill d-inline-flex align-items-center justify-content-center tiene-evidencia-badge"
                        style={{ width: '1.35rem', height: '1.35rem', cursor: 'pointer', padding: 0 }}
                        data-pr-tooltip="Tiene evidencias de entrega"
                        data-pr-position="top"
                        onClick={() => openHistorial(r)}
                      >
                        <i className="pi pi-paperclip" style={{ fontSize: '0.75rem' }}></i>
                      </span>
                    )}
                  </div>
                )}
                sortable
                sortField="estado_codigo"
                style={{ width: '10.5rem', minWidth: '10.5rem' }}
              />

              <Column
                header="Acciones"
                body={(r) => {
                  const estado = r.estado_codigo;
                  const canOps = ['ACT', 'FALLIDA'].includes(String(estado || ''));
                  const isEnRuta = String(estado || '') === 'EN_RUTA';
                  const canAnular = ['ACT', 'FALLIDA'].includes(String(estado || ''));
                  const isCreator = r.es_creador === true || r.es_creador === 'true' || Number(r.es_creador) === 1;
                  const puedeReenviar = r.puede_reenviar === true || r.puede_reenviar === 1 || String(r.puede_reenviar) === '1' || String(r.puede_reenviar) === 'true';
                  return (
                    <div className="d-flex justify-content-end align-items-center flex-nowrap" style={{ gap: '2px' }}>
                      <Button
                        icon="pi pi-history"
                        rounded
                        text
                        severity="info"
                        size="small"
                        style={{ width: '1.85rem', height: '1.85rem' }}
                        onClick={() => openHistorial(r)}
                        tooltip="Ver historial"
                        tooltipOptions={{ position: 'top' }}
                      />

                      {isCreator && puedeReenviar && (
                        <>
                          <Button
                            icon="pi pi-pen-to-square"
                            rounded
                            text
                            severity="warning"
                            size="small"
                            style={{ width: '1.85rem', height: '1.85rem' }}
                            onClick={() => openCambio(r)}
                            disabled={!canOps}
                            tooltip={!canOps ? 'Solo se puede cambiar si está Pendiente de envío o Entrega fallida' : 'Solicitar cambio de forma de entrega'}
                            tooltipOptions={{ position: 'top' }}
                          />
                          <Button
                            icon="pi pi-ban"
                            rounded
                            text
                            severity="danger"
                            size="small"
                            style={{ width: '1.85rem', height: '1.85rem' }}
                            onClick={() => openAnular(r)}
                            disabled={!canAnular}
                            tooltip={isEnRuta ? 'No se puede anular con NC cuando está En Ruta' : (!canAnular ? 'Solo se puede anular si está Pendiente de envío o con Entrega fallida' : 'Anular con NC')}
                            tooltipOptions={{ position: 'top' }}
                          />
                          {/* Botón Liquidar - Solo SUC + ACT */}
                          {r.forma_codigo === 'SUC' && r.estado_codigo === 'ACT' && (
                            <Button
                              icon="pi pi-check-circle"
                              rounded
                              text
                              severity="success"
                              size="small"
                              style={{ width: '1.85rem', height: '1.85rem' }}
                              onClick={() => openLiquidar(r)}
                              tooltip="Liquidar despacho en sucursal"
                              tooltipOptions={{ position: 'top' }}
                            />
                          )}
                          <Button
                            icon="pi pi-building"
                            rounded
                            text
                            severity="help"
                            size="small"
                            style={{ width: '1.85rem', height: '1.85rem' }}
                            onClick={() => openCambioSucursal(r)}
                            disabled={!canOps}
                            tooltip={!canOps ? 'Solo se puede solicitar cambio si está Pendiente de envío o Entrega fallida' : 'Solicitar cambio de sucursal'}
                            tooltipOptions={{ position: 'top' }}
                          />
                        </>
                      )}
                    </div>
                  );
                }}
                frozen
                alignFrozen="right"
                style={{ width: '7.5rem', minWidth: '7.5rem' }}
              />
            </DataTable>
          </div>
        </Card>
        )}

        {/* SIDEBAR HISTORIAL */}
        <SidebarHistorialEntrega
          visible={sidebarOpen}
          onHide={() => {
            setSidebarOpen(false);
            setRowSel(null);
          }}
          idFacturaSel={rowSel?.id_factura_sel || rowSel?.int_id_factura_sel}
          folio={rowSel?.folio_factura}
          formaEntrega={rowSel?.forma_nombre}
          destino={rowSel?.destino}
          estado={rowSel?.estado_codigo ? getNombreEstado(rowSel.estado_codigo) : null}
          estadoSeverity={rowSel?.estado_codigo ? sevEstado(rowSel.estado_codigo) : null}
          title="Historial de factura"
        />

        {/* DLG CAMBIO */}
        <Dialog 
          header="Solicitar cambio de forma de entrega" 
          visible={dlgCambio} 
          style={{ width: 760 }} 
          modal 
          onHide={() => setDlgCambio(false)}
        >
          <div className="d-flex flex-wrap gap-3">
            <div>
              <label className="small text-muted d-block mb-1">Nueva forma de entrega</label>
              <Dropdown
                value={newFormaId}
                onChange={(e) => setNewFormaId(e.value == null ? null : Number(e.value))}
                options={formas}
                optionLabel="str_nombre"
                optionValue="int_id_forma_entrega"
                placeholder="Seleccionar"
                className="p-inputtext-sm"
                style={{ width: 260 }}
                showClear
                filter
                resetFilterOnHide
              />
            </div>

            {newCode === 'EXT' && (
              <div>
                <label className="small text-muted d-block mb-1">Transporte externo</label>
                <Dropdown
                  value={newTransporteId}
                  onChange={(e) => setNewTransporteId(e.value == null ? null : Number(e.value))}
                  options={transportes}
                  optionLabel="str_nombre"
                  optionValue="int_id_transporte_externo"
                  placeholder="Seleccionar"
                  className="p-inputtext-sm"
                  style={{ width: 280 }}
                  showClear
                  filter
                  resetFilterOnHide
                />
              </div>
            )}

            {(newCode === 'CAM' || newCode === 'LOCAL') && (
              <>
                <div>
                  <label className="small text-muted d-block mb-1">Departamento</label>
                  <Dropdown
                    value={newCiudadId}
                    onChange={(e) => onChangeNewCiudad(e.value)}
                    options={ciudades}
                    optionLabel="str_nombre"
                    optionValue="int_id_ciudad"
                    placeholder="Departamento"
                    className="p-inputtext-sm"
                    style={{ width: 240 }}
                    showClear
                    filter
                    resetFilterOnHide
                  />
                </div>

                <div>
                  <label className="small text-muted d-block mb-1">Municipio</label>
                  <Dropdown
                    value={newMuniId}
                    onChange={(e) => setNewMuniId(e.value == null ? null : Number(e.value))}
                    options={muniOpts}
                    optionLabel="str_nombre"
                    optionValue="int_id_municipio"
                    placeholder="Municipio"
                    className="p-inputtext-sm"
                    style={{ width: 260 }}
                    disabled={!newCiudadId}
                    showClear
                    filter
                    resetFilterOnHide
                  />
                </div>

                <div style={{ minWidth: 280, flex: 1 }}>
                  <label className="small text-muted d-block mb-1">Direccion</label>
                  <InputText
                    value={newDireccion}
                    onChange={(e) => setNewDireccion(e.target.value)}
                    placeholder="Referencia de entrega"
                    className="p-inputtext-sm w-100"
                  />
                </div>
              </>
            )}
          </div>

          <div className="mt-3">
            <label className="small text-muted d-block mb-1">Comentario (opcional)</label>
            <InputTextarea
              value={comentarioCambio}
              onChange={(e) => setComentarioCambio(e.target.value)}
              rows={3}
              className="w-100 p-inputtext-sm"
              placeholder="Motivo del cambio"
            />
          </div>

          <div className="d-flex justify-content-end gap-2 mt-3">
            <Button 
              label="Enviar solicitud" 
              icon="pi pi-check" 
              severity="success" 
              onClick={confirmarCambio} 
              disabled={!canCambio} 
            />
            <Button 
              label="Cerrar" 
              icon="pi pi-times" 
              severity="secondary" 
              onClick={() => setDlgCambio(false)} 
            />
          </div>
        </Dialog>

        {/* DLG ANULAR */}
        <Dialog
          header="Anular Factura con Nota de Crédito"
          visible={dlgAnular}
          style={{ width: 560 }}
          modal
          onHide={() => setDlgAnular(false)}
        >
          <div className="d-flex flex-column gap-3">
            <div>
              <label className="small text-muted d-block mb-1">
                Folio de Nota de Crédito <span className="text-danger">*</span>
              </label>
              <InputText
                value={folioNc}
                onChange={(e) => setFolioNc(e.target.value)}
                placeholder="Ej. 001001DE0001"
                className="w-100 p-inputtext-sm"
              />
            </div>

            <div>
              <label className="small text-muted d-block mb-1">
                Comentario <span className="text-danger">*</span>
              </label>
              <InputTextarea
                value={comentarioAnular}
                onChange={(e) => setComentarioAnular(e.target.value)}
                rows={3}
                className="w-100 p-inputtext-sm"
                placeholder="Motivo de anulacion (obligatorio)"
              />
            </div>

            <div className="d-flex justify-content-end gap-2 mt-2">
              <Button
                label="Validar y Anular"
                icon="pi pi-file-check"
                severity="danger"
                onClick={() => {
                  confirmDialog({
                    header: 'Confirmacion',
                    message: '¿Deseas anular esta factura con la Nota de Crédito indicada?',
                    acceptLabel: 'Sí, anular',
                    rejectLabel: 'Cancelar',
                    acceptClassName: 'p-button-danger',
                    accept: confirmarAnular
                  });
                }}
              />
              <Button
                label="Cerrar"
                icon="pi pi-times"
                severity="secondary"
                onClick={() => setDlgAnular(false)}
              />
            </div>
          </div>
        </Dialog>

        {/* Diálogo: Cambio de Sucursal */}
        <Dialog
          header="Solicitar Cambio de Sucursal"
          visible={dlgCambioSucursal}
          style={{ width: '500px' }}
          modal
          onHide={() => setDlgCambioSucursal(false)}
        >
          <div className="d-flex flex-column gap-3">
            {rowSel && (
              <>
                <div className="alert alert-info mb-0 small">
                  <div><strong>Factura:</strong> {rowSel.folio_factura}</div>
                  <div><strong>Sucursal Actual:</strong> {rowSel.sucursal_creador || '-'}</div>
                </div>

                <div>
                  <label className="form-label small">Sucursal Destino *</label>
                  <Dropdown
                    value={newSucursalId}
                    options={sucursales}
                    onChange={(e) => setNewSucursalId(e.value)}
                    optionLabel="str_nombre"
                    optionValue="int_id_sucursal"
                    placeholder="Seleccione la sucursal destino"
                    className="w-100"
                    filter
                    filterBy="nombre"
                    showClear
                    emptyMessage="No hay sucursales disponibles"
                  />
                </div>

                <div>
                  <label className="form-label small">Motivo de Solicitud *</label>
                  <InputTextarea
                    value={motivoCambioSuc}
                    onChange={(e) => setMotivoCambioSuc(e.target.value)}
                    rows={4}
                    className="w-100"
                    placeholder="Explique el motivo del cambio de sucursal..."
                  />
                </div>
              </>
            )}

            <div className="d-flex justify-content-end gap-2 mt-2">
              <Button
                label="Solicitar Cambio"
                icon="pi pi-check"
                severity="success"
                onClick={confirmarCambioSucursal}
              />
              <Button
                label="Cancelar"
                icon="pi pi-times"
                severity="secondary"
                outlined
                onClick={() => setDlgCambioSucursal(false)}
              />
            </div>
          </div>
        </Dialog>

        {/* DLG LIQUIDAR DESPACHO SUCURSAL */}
        <Dialog
          header="Liquidar Despacho en Sucursal"
          visible={dlgLiquidar}
          style={{ width: '500px' }}
          modal
          onHide={() => setDlgLiquidar(false)}
        >
          <div className="d-flex flex-column gap-3">
            {rowSel && (
              <div className="alert alert-info mb-0 small">
                <div><strong>Factura:</strong> {rowSel.folio_factura}</div>
                <div><strong>Forma de Entrega:</strong> {rowSel.forma_nombre}</div>
                <div><strong>Sucursal:</strong> {rowSel.sucursal_creador || '-'}</div>
              </div>
            )}

            <div>
              <label className="form-label small">Comentario (opcional)</label>
              <InputTextarea
                value={comentarioLiquidar}
                onChange={(e) => setComentarioLiquidar(e.target.value)}
                rows={3}
                className="w-100"
                placeholder="Agregar observacion sobre la entrega..."
              />
            </div>

            <div className="alert alert-warning mb-0 small">
              <i className="pi pi-exclamation-triangle me-2"></i>
              Al confirmar, la factura se marcará como <strong>ENTREGADA</strong> y no se podrá revertir esta accion.
            </div>

            <div className="d-flex justify-content-end gap-2 mt-2">
              <Button
                label="Confirmar Liquidacion"
                icon="pi pi-check"
                severity="success"
                onClick={confirmarLiquidar}
              />
              <Button
                label="Cancelar"
                icon="pi pi-times"
                severity="secondary"
                outlined
                onClick={() => setDlgLiquidar(false)}
              />
            </div>
          </div>
        </Dialog>
      </div>
    </Layout>
  );
}