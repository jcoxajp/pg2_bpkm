import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import Layout from '@ui/Layout';
import { Card } from 'primereact/card';
import { DataTable } from 'primereact/datatable';
import { Column } from 'primereact/column';
import { Toast } from 'primereact/toast';
import { Tag } from 'primereact/tag';
import { Button } from 'primereact/button';
import { Dropdown } from 'primereact/dropdown';
import { Calendar } from 'primereact/calendar';
import { Dialog } from 'primereact/dialog';
import { InputNumber } from 'primereact/inputnumber';
import { InputText } from 'primereact/inputtext';
import { RadioButton } from 'primereact/radiobutton';
import { Tooltip } from 'primereact/tooltip';
import { toISODateLocal, formatDateOnly } from '@utils/dateSafe';
import { getApiErrorMessage } from '@utils/apiError';
import {
  getBpkmDistancias,
  getCamionesGerencia,
  getSucursalesGerencia,
  patchDistanciaBPKM
} from '@services';

function GoogleMapsIcon({ size = 16, className = '', style = {} }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="77.3 0 357.4 512"
      width={Math.round(size * 0.7)}
      height={size}
      className={className}
      style={{ verticalAlign: 'middle', display: 'inline-block', flexShrink: 0, ...style }}
      aria-hidden="true"
    >
      <path d="M310.1 8.5c-17-5.4-35.6-8.5-54.5-8.5C201.1 0 152 24.7 119.1 63.8l84.3 70.8z" fill="#1a73e8" />
      <path d="M119.1 63.8C93.2 94.7 77.3 135 77.3 178.3c0 33.6 6.6 60.7 17.8 85.1l108.3-128.8z" fill="#ea4335" />
      <path d="M256 110.2c37.9 0 68.4 30.5 68.4 68.4 0 16.6-6.2 32.1-16.2 44.1 0 0 53.8-64.2 106.3-126.5-21.7-41.8-59.2-73.5-104.4-87.8L203.4 134.6c12.8-14.7 31.3-24.4 52.6-24.4" fill="#4285f4" />
      <path d="M256 246.7c-37.9 0-68.4-30.5-68.4-68.4 0-16.6 5.8-32.1 15.9-43.7L95.1 263.3c18.6 41 49.5 74.2 81.2 115.6l131.9-156.6c-12.8 15.1-31.3 24.4-52.2 24.4" fill="#fbbc04" />
      <path d="M305.9 422.3c59.6-93.2 128.8-135.3 128.8-243.6 0-29.8-7.3-57.6-20.1-82.4L176.3 379c10.1 13.1 20.5 28.2 30.5 43.7 36.4 56.1 26.3 89.3 49.5 89.3s13.2-33.6 49.6-89.7" fill="#34a853" />
    </svg>
  );
}

const STORAGE_KEY = 'distancia_rutas_filtros';

export default function DistanciaRutas() {
  const toastRef = useRef(null);
  const navigate = useNavigate();
  const userId = useMemo(() => Number(localStorage.getItem('userId') || 0), []);
  const isInitialMount = useRef(true);

  // Recuperar filtros persistidos en localStorage / sessionStorage
  const initialFilters = useMemo(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY) || sessionStorage.getItem(STORAGE_KEY);
      if (saved) return JSON.parse(saved);
    } catch (e) {
      console.error('Error al recuperar filtros guardados de BPKM:', e);
    }
    return {};
  }, []);

  const [bpkms, setBpkms] = useState([]);
  // Orden solo de la página actual — en modo lazy PrimeReact no ordena solo, no hay orden real en el servidor todavía.
  const [sortField, setSortField] = useState(null);
  const [sortOrder, setSortOrder] = useState(null);
  const [loading, setLoading] = useState(false);
  const [camiones, setCamiones] = useState([]);
  const [sucursales, setSucursales] = useState([]);

  // Paginación restaurada o default
  const [page, setPage] = useState(initialFilters.page ?? 1);
  const [limit, setLimit] = useState(initialFilters.limit ?? 25);
  const [first, setFirst] = useState(initialFilters.first ?? 0);
  const [totalRecords, setTotalRecords] = useState(0);
  const [totalPendientes, setTotalPendientes] = useState(0);

  // Diálogo para editar distancia insertada
  const [dialogVisible, setDialogVisible] = useState(false);
  const [selectedBpkm, setSelectedBpkm] = useState(null);
  const [distanciaVal, setDistanciaVal] = useState(null);
  const [saving, setSaving] = useState(false);

  // Filtros restaurados o default
  const [codigoRuta, setCodigoRuta] = useState(initialFilters.codigoRuta ?? '');
  const [codigoRutaDebounced, setCodigoRutaDebounced] = useState(initialFilters.codigoRuta ?? '');
  const [estadoDistancia, setEstadoDistancia] = useState(initialFilters.estadoDistancia ?? '');
  const [fechaDesde, setFechaDesde] = useState(initialFilters.fechaDesde ? new Date(initialFilters.fechaDesde) : null);
  const [fechaHasta, setFHasta] = useState(initialFilters.fechaHasta ? new Date(initialFilters.fechaHasta) : null);
  const [camionFiltro, setCamionFiltro] = useState(initialFilters.camionFiltro ?? 0);
  const [sucursalFiltro, setSucursalFiltro] = useState(initialFilters.sucursalFiltro ?? 0);

  // Debounce para la búsqueda por código de ruta (450ms)
  useEffect(() => {
    const timer = setTimeout(() => {
      setCodigoRutaDebounced(codigoRuta);
    }, 450);
    return () => clearTimeout(timer);
  }, [codigoRuta]);

  const estadosOpts = useMemo(() => [
    { label: 'Todos', value: '' },
    { label: 'Pendiente', value: 'PENDIENTE' },
    { label: 'Ingresado', value: 'INGRESADO' }
  ], []);

  // Guardar estado de filtros en localStorage y sessionStorage
  useEffect(() => {
    const filterState = {
      codigoRuta,
      camionFiltro,
      sucursalFiltro,
      fechaDesde: fechaDesde ? fechaDesde.toISOString() : null,
      fechaHasta: fechaHasta ? fechaHasta.toISOString() : null,
      estadoDistancia,
      page,
      limit,
      first
    };
    try {
      const json = JSON.stringify(filterState);
      localStorage.setItem(STORAGE_KEY, json);
      sessionStorage.setItem(STORAGE_KEY, json);
    } catch (e) {
      console.error('Error al guardar filtros:', e);
    }
  }, [codigoRuta, camionFiltro, sucursalFiltro, fechaDesde, fechaHasta, estadoDistancia, page, limit, first]);

  const cargarCatalogos = async () => {
    try {
      const [camionesData, sucursalesData] = await Promise.all([
        getCamionesGerencia(),
        getSucursalesGerencia()
      ]);
      setCamiones(Array.isArray(camionesData) ? camionesData : []);
      setSucursales(Array.isArray(sucursalesData) ? sucursalesData : []);
    } catch (e) {
      console.error('Error al cargar catálogos de camiones y sucursales:', e);
    }
  };

  useEffect(() => {
    cargarCatalogos();
  }, []);

  const cargarDatos = useCallback(async (p = page, l = limit) => {
    setLoading(true);
    try {
      const res = await getBpkmDistancias({
        estado_distancia: estadoDistancia,
        codigo_ruta: codigoRutaDebounced.trim(),
        fecha_desde: fechaDesde ? toISODateLocal(fechaDesde) : '',
        fecha_hasta: fechaHasta ? toISODateLocal(fechaHasta) : '',
        id_sucursal: sucursalFiltro ? String(sucursalFiltro) : '',
        id_camion: camionFiltro ? String(camionFiltro) : '',
        page: p,
        limit: l
      });
      setBpkms(res?.items || []);
      setTotalRecords(res?.total || 0);
      setTotalPendientes(res?.total_pendientes || 0);
    } catch (error) {
      console.error('Error al cargar distancias de rutas:', error);
      toastRef.current?.show({
        severity: 'error',
        summary: 'Error',
        detail: 'No se pudieron cargar los datos de BPKM',
        life: 3000,
      });
    } finally {
      setLoading(false);
    }
  }, [codigoRutaDebounced, fechaDesde, fechaHasta, sucursalFiltro, camionFiltro, estadoDistancia, page, limit]);

  useEffect(() => {
    if (isInitialMount.current) {
      isInitialMount.current = false;
      cargarDatos(page, limit);
      return;
    }
    setPage(1);
    setFirst(0);
    cargarDatos(1, limit);
  }, [codigoRutaDebounced, fechaDesde, fechaHasta, sucursalFiltro, camionFiltro, estadoDistancia]);

  const onPageChange = (event) => {
    const newPage = (event.page ?? 0) + 1;
    const newLimit = event.rows ?? 25;
    setFirst(event.first ?? 0);
    setPage(newPage);
    setLimit(newLimit);
    cargarDatos(newPage, newLimit);
  };

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

  const toNum = (v) => Number(v ?? 0) || 0;

  const opcionesCamiones = useMemo(() => {
    const usados = new Set();
    const opts = (camiones || [])
      .filter((c) => !sucursalFiltro || toNum(c.int_id_sucursal ?? c.id_sucursal) === Number(sucursalFiltro))
      .map((c) => {
        const placa = c.str_placa || c.placa || c.placa_camion || c.camion || c.nombre || '';
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

    return [{ label: 'Todos los camiones', value: 0 }, ...opts];
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
        const nombre = s.str_nombre_sucursal || s.str_nombre || s.nombre_sucursal || s.sucursal || s.nombre || s.descripcion || '';
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

    return [{ label: 'Todas las sucursales', value: 0 }, ...opts];
  }, [sucursales]);

  const limpiarFiltros = () => {
    setCodigoRuta('');
    setCodigoRutaDebounced('');
    setFechaDesde(null);
    setFHasta(null);
    setCamionFiltro(0);
    setSucursalFiltro(0);
    setEstadoDistancia('');
    setPage(1);
    setLimit(25);
    setFirst(0);
    try {
      localStorage.removeItem(STORAGE_KEY);
      sessionStorage.removeItem(STORAGE_KEY);
    } catch {
      // Ignorar errores de storage
    }
  };

  const handleAbrirDialog = (row) => {
    setSelectedBpkm(row);
    const val = row.distancia_anterior ?? row.distancia_insertada;
    setDistanciaVal(val != null ? Math.round(Number(val)) : null);
    setDialogVisible(true);
  };

  const handleGuardarDistancia = async () => {
    if (!selectedBpkm) return;
    if (distanciaVal == null || isNaN(distanciaVal)) {
      toastRef.current?.show({
        severity: 'warn',
        summary: 'Aviso',
        detail: 'Por favor ingrese un número entero de distancia válido.',
        life: 3000,
      });
      return;
    }

    setSaving(true);
    try {
      await patchDistanciaBPKM({
        id_bpkm: Number(selectedBpkm.id_bpkm),
        distancia: Number(distanciaVal),
        usuario: userId
      });

      toastRef.current?.show({
        severity: 'success',
        summary: 'Éxito',
        detail: 'Distancia actualizada correctamente',
        life: 3000,
      });

      setDialogVisible(false);
      setSelectedBpkm(null);
      cargarDatos(page, limit);
    } catch (error) {
      console.error('Error al actualizar distancia:', error);
      toastRef.current?.show({
        severity: 'error',
        summary: 'Error',
        detail: getApiErrorMessage(error, 'No se pudo guardar la distancia'),
        life: 3500,
      });
    } finally {
      setSaving(false);
    }
  };

  const distanciaMasLejanaBody = (row) => row.distancia_mas_lejana ?? '-';
  const distanciaInsertadaBody = (row) => {
    const val = row.distancia_anterior ?? row.distancia_insertada;
    return val != null && val !== '' ? val : '';
  };
  const fechaCreacionBody = (row) => (row.fecha_creacion ? formatDateOnly(row.fecha_creacion) : '-');

  const estadoBody = (row) => {
    const rawEstado = row.estado_distancia || row.estado_nombre || '-';
    const upper = String(rawEstado).toUpperCase();
    let severity = 'secondary';
    if (upper === 'INGRESADO' || upper.includes('APR') || upper.includes('FINALIZAD')) {
      severity = 'success';
    } else if (upper === 'PENDIENTE' || upper.includes('PEND') || upper === 'EN_CURSO') {
      severity = 'warning';
    }

    // Minúscula con primera letra mayúscula (ej: 'Ingresado', 'Pendiente')
    const formattedText = rawEstado !== '-'
      ? rawEstado.trim().charAt(0).toUpperCase() + rawEstado.trim().slice(1).toLowerCase()
      : '-';

    const hasGmaps = row.distancia_mas_lejana_gmaps != null && row.distancia_mas_lejana_gmaps !== '';

    return (
      <div className="d-flex align-items-center gap-2">
        <Tag value={formattedText} severity={severity} rounded />
        {hasGmaps && (
          <span
            className="gmaps-table-icon d-inline-flex align-items-center"
            data-pr-tooltip="Tiene sugerencia de Google Maps"
            data-pr-position="bottom"
            style={{ cursor: 'pointer' }}
          >
            <GoogleMapsIcon size={18} />
          </span>
        )}
      </div>
    );
  };

  const accionesBody = (row) => {
    const rawEstado = row.estado_distancia || row.estado_nombre || '';
    const isIngresado = String(rawEstado).trim().toUpperCase() === 'INGRESADO';

    return (
      <Button
        icon="fa-solid fa-arrow-right"
        size="small"
        rounded
        text
        aria-label="Actualizar distancia"
        onClick={() => handleAbrirDialog(row)}
        disabled={isIngresado}
        tooltip={isIngresado ? 'Distancia ya ingresada' : 'Editar Distancia'}
        tooltipOptions={{ position: 'top' }}
      />
    );
  };

  return (
    <Layout title="Distancia de Rutas">
      <Toast ref={toastRef} />
      <Tooltip
        key={`tt-table-gmaps-${page}-${first}-${sortField || ''}-${sortOrder || ''}-${bpkmsOrdenados.length}`}
        target=".gmaps-table-icon"
        position="bottom"
      />
      <div className="container-fluid py-2">
        <Card className="border-0 shadow-sm">
          <div className="d-flex align-items-center justify-content-between mb-3">
            <h2 className="fw-bold mb-0">Distancia de rutas</h2>
            <Button
              label='Volver'
              icon='pi pi-arrow-left'
              outlined
              severity='primary'
              onClick={() => navigate('/home')}
            />
          </div>

          {/* Sección de Filtros */}
          <div className="mb-3">
            <div className="row g-3 align-items-end mb-3">
              <div className="col-6 col-sm-4 col-md-2">
                <label className="form-label small text-muted mb-1">Código de Ruta</label>
                <InputText
                  value={codigoRuta}
                  onChange={(e) => setCodigoRuta(e.target.value)}
                  placeholder="Ej. 2607RL005"
                  className="w-100"
                />
              </div>

              <div className="col-6 col-sm-4 col-md-2">
                <label className="form-label small text-muted mb-1">Sucursal</label>
                <Dropdown
                  value={sucursalFiltro}
                  options={opcionesSucursales}
                  onChange={(e) => setSucursalFiltro(e.value ?? 0)}
                  placeholder="Seleccionar sucursal"
                  filter
                  className="w-100"
                  emptyMessage="Sin sucursales"
                />
              </div>

              <div className="col-6 col-sm-4 col-md-2">
                <label className="form-label small text-muted mb-1">Camión</label>
                <Dropdown
                  value={camionFiltro}
                  options={opcionesCamiones}
                  onChange={(e) => setCamionFiltro(e.value ?? 0)}
                  placeholder="Seleccionar camión"
                  filter
                  className="w-100"
                  emptyMessage="Sin camiones"
                />
              </div>

              <div className="col-6 col-sm-4 col-md-2">
                <label className="form-label small text-muted mb-1">Fecha Desde</label>
                <Calendar
                  value={fechaDesde}
                  onChange={(e) => setFechaDesde(e.value)}
                  showIcon
                  showButtonBar
                  placeholder="dd/mm/aaaa"
                  className="w-100"
                  dateFormat="dd/mm/yy"
                />
              </div>

              <div className="col-6 col-sm-4 col-md-2">
                <label className="form-label small text-muted mb-1">Fecha Hasta</label>
                <Calendar
                  value={fechaHasta}
                  onChange={(e) => setFHasta(e.value)}
                  showIcon
                  showButtonBar
                  placeholder="dd/mm/aaaa"
                  className="w-100"
                  dateFormat="dd/mm/yy"
                />
              </div>

              <div className="col-12 col-md-2 d-flex gap-3 justify-content-end">
                <Button
                  icon="pi pi-filter-slash"
                  severity="danger"
                  outlined
                  size="small"
                  tooltip="Limpiar filtros"
                  tooltipOptions={{ position: 'bottom' }}
                  onClick={limpiarFiltros}
                />
                <Button
                  icon="pi pi-refresh"
                  severity="success"
                  outlined
                  size="small"
                  tooltip="Actualizar"
                  tooltipOptions={{ position: 'bottom' }}
                  onClick={() => cargarDatos(page, limit)}
                  loading={loading}
                />
              </div>
            </div>

            {/* Filtro RadioButtons por Estado Distancia */}
            <div className="d-flex align-items-center gap-3 pt-1">
              <label className="form-label small text-muted mb-0 fw-bold me-1">Estado:</label>
              <div className="d-flex flex-wrap gap-3">
                {estadosOpts.map((opt) => (
                  <div key={opt.value} className="d-flex align-items-center">
                    <RadioButton
                      inputId={`estado-distancia-${opt.value}`}
                      name="estado_distancia"
                      value={opt.value}
                      onChange={(e) => setEstadoDistancia(e.value)}
                      checked={estadoDistancia === opt.value}
                    />
                    <label htmlFor={`estado-distancia-${opt.value}`} className="ms-1 mb-0 small cursor-pointer fw-normal">
                      {opt.label}
                      {opt.value === 'PENDIENTE' && (
                        <span className="ms-1 text-muted fw-normal">
                          ({totalPendientes})
                        </span>
                      )}
                    </label>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <DataTable
            value={bpkmsOrdenados}
            loading={loading}
            lazy
            paginator
            first={first}
            rows={limit}
            totalRecords={totalRecords}
            onPage={onPageChange}
            rowsPerPageOptions={[10, 25, 50, 100]}
            sortField={sortField}
            sortOrder={sortOrder}
            onSort={(e) => {
              setSortField(e.sortField);
              setSortOrder(e.sortOrder);
            }}
            removableSort
            dataKey="id_bpkm"
            size="small"
            stripedRows
            emptyMessage="No se encontraron registros de BPKM"
            className="datatable-compact"
          >
            <Column field="codigo_ruta" header="Código de Ruta" sortable />
            <Column field="nombre_piloto" header="Piloto" sortable />
            <Column field="nombre_auxiliar" header="Auxiliar" sortable />
            <Column field="placa_camion" header="Camión" sortable />
            <Column field="sucursal_salida" header="Sucursal" sortable />
            <Column field="distancia_mas_lejana" header="KM Más Lejano" body={distanciaMasLejanaBody} sortable />
            <Column field="distancia_anterior" header="Distancia Anterior" body={distanciaInsertadaBody} sortable />
            <Column field="fecha_creacion" header="Fecha Creación" body={fechaCreacionBody} sortable />
            <Column field="estado_distancia" header="Estado" body={estadoBody} sortable />
            <Column header="Acciones" body={accionesBody} style={{ width: '5rem', textAlign: 'center' }} />
          </DataTable>
        </Card>
      </div>

      {/* Diálogo para ingresar/editar distancia insertada */}
      <Dialog
        header="Ingresar Distancia"
        visible={dialogVisible}
        style={{ width: '400px' }}
        modal
        onHide={() => {
          if (!saving) {
            setDialogVisible(false);
            setSelectedBpkm(null);
          }
        }}
        footer={
          <div className="d-flex justify-content-end gap-2">
            <Button
              label="Cancelar"
              icon="pi pi-times"
              severity="secondary"
              outlined
              size="small"
              onClick={() => setDialogVisible(false)}
              disabled={saving}
            />
            <Button
              label="Guardar"
              icon="pi pi-check"
              severity="primary"
              size="small"
              onClick={handleGuardarDistancia}
              loading={saving}
            />
          </div>
        }
      >
        <Tooltip target=".gmaps-tooltip-target" position="bottom" />
        {selectedBpkm && (
          <div className="d-flex flex-column gap-3 py-2">
            <div className="bg-light p-2 rounded small">
              <div><strong>Ruta:</strong> {selectedBpkm.codigo_ruta || '-'}</div>
              <div><strong>Piloto:</strong> {selectedBpkm.nombre_piloto || '-'}</div>
              <div><strong>KM Más Lejano:</strong> {selectedBpkm.distancia_mas_lejana ?? '-'}</div>
              {selectedBpkm.distancia_mas_lejana_gmaps != null && selectedBpkm.distancia_mas_lejana_gmaps !== '' && (
                <div className="d-flex align-items-center gap-2">
                  <span
                    className="gmaps-tooltip-target d-inline-flex align-items-center"
                    data-pr-tooltip="Distancia sugerida por Google Maps"
                    data-pr-position="bottom"
                    style={{ cursor: 'pointer' }}
                  >
                    <GoogleMapsIcon size={20} />
                  </span>
                  <span>{selectedBpkm.distancia_mas_lejana_gmaps} Km</span>
                </div>
              )}
            </div>

            <div className="d-flex flex-column gap-1">
              <label htmlFor="distanciaInsertada" className="form-label small fw-bold mb-0">
                Distancia (km)
              </label>
              <InputNumber
                id="distanciaInsertada"
                value={distanciaVal}
                onValueChange={(e) => setDistanciaVal(e.value != null ? Math.round(e.value) : null)}
                min={0}
                minFractionDigits={0}
                maxFractionDigits={0}
                locale="es-GT"
                placeholder="Ingrese distancia..."
                className="w-100"
                autoFocus
              />
            </div>
          </div>
        )}
      </Dialog>
    </Layout>
  );
}
