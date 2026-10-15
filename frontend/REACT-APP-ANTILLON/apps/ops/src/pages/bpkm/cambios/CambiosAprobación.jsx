// src/pages/bpkm/cambios/CambiosAprobacion.jsx
import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Layout from '@ui/Layout';
import { Toast } from 'primereact/toast';
import { Card } from 'primereact/card';
import { RadioButton } from 'primereact/radiobutton';
import { Calendar } from 'primereact/calendar';
import { InputText } from 'primereact/inputtext';
import { InputTextarea } from 'primereact/inputtextarea';
import { Button } from 'primereact/button';
import { DataTable } from 'primereact/datatable';
import { Column } from 'primereact/column';
import { Tag } from 'primereact/tag';
import { Dialog } from 'primereact/dialog';
import { Sidebar } from 'primereact/sidebar';
import { Timeline } from 'primereact/timeline';
import { formatDateTimeGT } from '@utils/dateSafe';
import { getApiErrorMessage } from '@utils/apiError';

import {
  getSolicitudesCambio,
  resolverCambioForma,
  getCambiosPorSeleccion
} from '@services/bpkm/cambiosForma';

const ESTADOS = [
  { code: '', name: 'Todos' },
  { code: 'PEND', name: 'Pendientes' },
  { code: 'APR', name: 'Aprobadas' },
  { code: 'RECH', name: 'Rechazadas' }
];

const sevEstado = (s) => {
  if (s === 'PEND') return 'warning';
  if (s === 'APR') return 'success';
  if (s === 'RECH') return 'danger';
  return null;
};

export default function CambiosAprobacion() {
  const toastRef = useRef(null);
  const navigate = useNavigate();
  const show = (sev, s, d) => toastRef.current?.show({ severity: sev, summary: s, detail: d, life: 3000 });
  const err = (s, d) => show('error', s, d);
  const ok = (s, d) => show('success', s, d);

  const usuarioId = useMemo(() => Number(localStorage.getItem('userId') || 0), []);
  const firstFolioSearchRef = useRef(false);

  // filtros
  const [fEstado, setFEstado] = useState(ESTADOS[1].code);
  const [fFolio, setFFolio] = useState('');
  const [fRange, setFRange] = useState(null);

  // paginación
  const [rows, setRows] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [pageState, setPageState] = useState({ first: 0, rows: 20 });

  // diálogo aprobar/rechazar
  const [dlgResolver, setDlgResolver] = useState(false);
  const [rowSel, setRowSel] = useState(null);
  const [decision, setDecision] = useState(null); // 'APR' | 'RECH'
  const [comentario, setComentario] = useState('');

  // sidebar historial
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [historial, setHistorial] = useState([]);
  const [loadingHistorial, setLoadingHistorial] = useState(false);

  async function load(page = pageState) {
    try {
      setLoading(true);
      const [dFrom, dTo] = Array.isArray(fRange) ? fRange : [null, null];
      const res = await getSolicitudesCambio({
        estado_codigo: fEstado || null,
        fecha_desde: dFrom || null,
        fecha_hasta: dTo || null,
        folio_like: fFolio || null,
        id_usuario: usuarioId,
        limit: page.rows,
        offset: page.first
      });
      setRows(res.items || []);
      setTotal(Number(res.total || 0));
    } catch (e) {
      console.error(e);
      err('Error', getApiErrorMessage(e, 'No se pudo cargar la bandeja'));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load({ first: 0, rows: pageState.rows });
  }, [fEstado, fRange]);

  useEffect(() => {
    if (!firstFolioSearchRef.current) {
      firstFolioSearchRef.current = true;
      return;
    }
    const timer = setTimeout(() => {
      load({ first: 0, rows: pageState.rows });
    }, 500);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fFolio]);

  function onPage(ev) {
    const ns = { first: ev.first, rows: ev.rows };
    setPageState(ns);
    load(ns);
  }

  function clearFilters() {
    setFEstado(ESTADOS[1].code);
    setFFolio('');
    setFRange(null);
    load({ first: 0, rows: pageState.rows });
  }

  function openResolver(row, dec) {
    setRowSel(row);
    setDecision(dec);
    setComentario('');
    setDlgResolver(true);
  }

  async function confirmarResolucion() {
    if (!rowSel || !decision) return;
    try {
      await resolverCambioForma({
        id_sel_cambio: rowSel.id_sel_cambio,
        decision_codigo: decision,
        id_autorizador: usuarioId,
        comentario_autorizador: comentario || null
      });
      ok(
        decision === 'APR' ? 'Aprobado' : 'Rechazado',
        `Cambio ${decision === 'APR' ? 'aprobado' : 'rechazado'} correctamente`
      );
      setDlgResolver(false);
      load(pageState);
    } catch (e) {
      console.error(e);
      err('Error', getApiErrorMessage(e, 'No se pudo resolver la solicitud'));
    }
  }

  async function openHistorial(row) {
    setRowSel(row);
    setSidebarOpen(true);
    setHistorial([]);
    setLoadingHistorial(true);
    try {
      const data = await getCambiosPorSeleccion({ id_factura_sel: row.id_factura_sel });
      setHistorial(data || []);
    } catch (e) {
      console.error(e);
      err('Error', 'No se pudo cargar el historial');
    } finally {
      setLoadingHistorial(false);
    }
  }

  return (
    <Layout>
      <Toast ref={toastRef} />
      <div className="container-fluid py-0">

        <Card className="border-0 shadow-sm">
          <div className="d-flex justify-content-between align-items-center px-3 pt-3 pb-2">
            <div>
              <h5 className="m-0">Cambios en Forma de Entrega</h5>
              <small className="text-muted">
                {total} solicitud{total !== 1 ? 'es' : ''} encontrada{total !== 1 ? 's' : ''}
              </small>
            </div>
            <div className="d-flex gap-2">
              <Button
                label="Volver"
                icon="pi pi-arrow-left"
                size="small"
                severity="secondary"
                outlined
                onClick={() => navigate('/home')}
              />
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

          <div className="px-3 pb-3">
            <div className="row g-3">
              <div className="col-6 col-sm-4 col-md-3">
                <label className="form-label small text-muted mb-1">Folio</label>
                <InputText
                  value={fFolio}
                  onChange={(e) => setFFolio(e.target.value)}
                  placeholder="Buscar por folio"
                  className="w-100"
                />
              </div>
              <div className="col-6 col-sm-4 col-md-3">
                <label className="form-label small text-muted mb-1">Rango de Fechas</label>
                <Calendar
                  value={fRange}
                  onChange={(e) => setFRange(e.value)}
                  selectionMode="range"
                  dateFormat="dd/mm/yy"
                  placeholder="Seleccionar rango"
                  showIcon
                  className="w-100"
                  appendTo="self"
                />
              </div>
            </div>

            <div className="d-flex align-items-center flex-wrap gap-3 mt-3 pt-2">
              <span className="text-muted small fw-semibold">Estado:</span>
              {ESTADOS.map((estado) => (
                <div key={estado.code} className="d-flex align-items-center">
                  <RadioButton
                    inputId={`estado-${estado.code || 'todos'}`}
                    name="fEstado"
                    value={estado.code}
                    onChange={(e) => setFEstado(e.value)}
                    checked={fEstado === estado.code}
                  />
                  <label htmlFor={`estado-${estado.code || 'todos'}`} className="ms-2 mb-0 small cursor-pointer">
                    {estado.name}
                  </label>
                </div>
              ))}
            </div>
          </div>

          <DataTable
            value={rows}
            loading={loading}
            dataKey="id_sel_cambio"
            size="small"
            stripedRows
            paginator
            lazy
            rows={pageState.rows}
            first={pageState.first}
            totalRecords={total}
            onPage={onPage}
            emptyMessage="No hay solicitudes de cambio"
          >
            <Column field="folio_factura" header="Folio" style={{ width: '8rem' }} />

            <Column
              header="Cambio Solicitado"
              body={(r) => (
                <div className="d-flex align-items-center gap-2">
                  <Tag value={r.forma_anterior_nombre} severity="secondary" />
                  <i className="pi pi-arrow-right text-muted" />
                  <Tag value={r.forma_nueva_nombre} severity="info" />
                </div>
              )}
              style={{ width: '18rem' }}
            />

            <Column
              header="Destino"
              body={(r) => (
                <div className="small">
                  <div className="text-muted mb-1">
                    <strong>Anterior:</strong> {r.destino_anterior || '-'}
                  </div>
                  <div>
                    <strong>Nuevo:</strong> {r.destino_nuevo || '-'}
                  </div>
                </div>
              )}
              style={{ width: '14rem' }}
            />

            <Column
              field="solicitante_nombre"
              header="Solicitante"
              style={{ width: '8rem' }}
            />

            <Column
              field="comentario_solicitante"
              header="Comentario"
              body={(r) => (
                <div className="small text-truncate" style={{ maxWidth: 200 }}>
                  {r.comentario_solicitante || '-'}
                </div>
              )}
              style={{ width: '12rem' }}
            />

            <Column
              field="estado_nombre"
              header="Estado"
              body={(r) => <Tag value={r.estado_nombre} severity={sevEstado(r.estado_codigo)} rounded />}
              style={{ width: '6rem' }}
            />

            <Column
              header="Acciones"
              style={{ width: '8rem' }}
              body={(r) => {
                const isPendiente = r.estado_codigo === 'PEND';
                return (
                  <div className="d-flex gap-1 justify-content-end">
                    <Button
                      icon="pi pi-history"
                      text size="small"
                      onClick={() => openHistorial(r)}
                      tooltip="Ver historial"
                      tooltipOptions={{ position: 'top' }}
                    />
                    {isPendiente && (
                      <>
                        <Button
                          icon="pi pi-check"
                          text size="small" severity="success"
                          onClick={() => openResolver(r, 'APR')}
                          tooltip="Aprobar"
                          tooltipOptions={{ position: 'top' }}
                        />
                        <Button
                          icon="pi pi-times"
                          text size="small" severity="danger"
                          onClick={() => openResolver(r, 'RECH')}
                          tooltip="Rechazar"
                          tooltipOptions={{ position: 'top' }}
                        />
                      </>
                    )}
                  </div>
                );
              }}
            />
          </DataTable>
        </Card>

        {/* DIALOG RESOLVER */}
        <Dialog
          header={decision === 'APR' ? 'Aprobar Cambio' : 'Rechazar Cambio'}
          visible={dlgResolver}
          style={{ width: 560 }}
          modal
          onHide={() => setDlgResolver(false)}
        >
          {rowSel && (
            <>
              <div className="mb-3">
                <div className="card border-0 bg-light">
                  <div className="card-body py-3">
                    <div className="row g-2 small">
                      <div className="col-12">
                        <div className="text-muted">Folio</div>
                        <div className="fw-semibold">{rowSel.folio_factura}</div>
                      </div>
                      <div className="col-12">
                        <div className="text-muted">Cambio solicitado</div>
                        <div className="d-flex align-items-center gap-2 mt-1">
                          <Tag value={rowSel.forma_anterior_nombre} severity="secondary" />
                          <i className="pi pi-arrow-right" />
                          <Tag value={rowSel.forma_nueva_nombre} severity="info" />
                        </div>
                      </div>
                      <div className="col-12">
                        <div className="text-muted">Destino anterior</div>
                        <div className="fw-semibold">{rowSel.destino_anterior || '-'}</div>
                      </div>
                      <div className="col-12">
                        <div className="text-muted">Destino nuevo</div>
                        <div className="fw-semibold">{rowSel.destino_nuevo || '-'}</div>
                      </div>
                      {rowSel.comentario_solicitante && (
                        <div className="col-12">
                          <div className="text-muted">Comentario del solicitante</div>
                          <div className="small">{rowSel.comentario_solicitante}</div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              <div className="mb-3">
                <label className="small text-muted d-block mb-1">
                  Comentario {decision === 'APR' ? '(opcional)' : '(requerido)'}
                </label>
                <InputTextarea
                  value={comentario}
                  onChange={(e) => setComentario(e.target.value)}
                  rows={3}
                  className="w-100 p-inputtext-sm"
                  placeholder={
                    decision === 'APR'
                      ? 'Observaciones adicionales'
                      : 'Motivo del rechazo'
                  }
                />
              </div>

              <div className="d-flex justify-content-end gap-2">
                <Button
                  label={decision === 'APR' ? 'Confirmar Aprobación' : 'Confirmar Rechazo'}
                  icon="pi pi-check"
                  severity={decision === 'APR' ? 'success' : 'danger'}
                  onClick={() => {
                    if (decision === 'RECH' && !comentario.trim()) {
                      err('Comentario requerido', 'Debes indicar el motivo del rechazo');
                      return;
                    }
                    confirmarResolucion();
                  }}
                />
                <Button
                  label="Cerrar"
                  icon="pi pi-times"
                  severity="secondary"
                  onClick={() => setDlgResolver(false)}
                />
              </div>
            </>
          )}
        </Dialog>

        {/* SIDEBAR HISTORIAL */}
        <Sidebar
          visible={sidebarOpen}
          onHide={() => setSidebarOpen(false)}
          position="right"
          showCloseIcon
          style={{ width: '720px', maxWidth: '95vw' }}
        >
          <div className="d-flex align-items-center justify-content-between mb-3">
            <h5 className="mb-0">Historial de Cambios</h5>
          </div>

          {!rowSel ? null : (
            <div className="small mb-3">
              <div className="card border-0 bg-light">
                <div className="card-body py-3">
                  <div className="row g-2">
                    <div className="col-6">
                      <div className="text-muted">Folio</div>
                      <div className="fw-semibold">{rowSel.folio_factura}</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          <h6 className="fw-bold mb-3">Timeline de cambios</h6>

          {loadingHistorial ? (
            <div className="d-flex align-items-center gap-2 text-muted">
              <i className="pi pi-spin pi-spinner" />
              Cargando historial…
            </div>
          ) : historial.length === 0 ? (
            <div className="text-muted">Sin cambios registrados</div>
          ) : (
            <Timeline
              value={historial}
              align="left"
              className="customized-timeline"
              marker={(item) => {
                const estado = String(item.estado_codigo || '').toUpperCase();
                let icon = 'pi pi-circle';
                let bg = 'text-bg-primary';

                if (estado === 'PEND') {
                  icon = 'pi pi-clock';
                  bg = 'text-bg-warning';
                } else if (estado === 'APR') {
                  icon = 'pi pi-check-circle';
                  bg = 'text-bg-success';
                } else if (estado === 'RECH') {
                  icon = 'pi pi-times-circle';
                  bg = 'text-bg-danger';
                }

                return (
                  <span
                    className={`d-flex align-items-center justify-content-center rounded-circle ${bg}`}
                    style={{ width: 32, height: 32 }}
                  >
                    <i className={icon} />
                  </span>
                );
              }}
              content={(item) => (
                <div className="mb-3">
                  <div className="fw-semibold">
                    {item.forma_anterior_nombre} → {item.forma_nueva_nombre}
                  </div>
                  <div className="small text-muted mb-1">{formatDateTimeGT(item.fecha_creacion)}</div>
                  <div className="small">
                    <Tag value={item.estado_nombre} severity={sevEstado(item.estado_codigo)} />
                  </div>
                  {item.solicitante_nombre && (
                    <div className="small text-muted mt-1">Solicitante: {item.solicitante_nombre}</div>
                  )}
                  {item.comentario_solicitante && (
                    <div className="small mt-1">
                      <em>"{item.comentario_solicitante}"</em>
                    </div>
                  )}
                  {item.autorizador_nombre && (
                    <div className="small text-muted mt-1">
                      Resuelto por: {item.autorizador_nombre}
                    </div>
                  )}
                  {item.comentario_autorizador && (
                    <div className="small mt-1 border-start border-3 ps-2">
                      {item.comentario_autorizador}
                    </div>
                  )}
                </div>
              )}
            />
          )}
        </Sidebar>
      </div>
    </Layout>
  );
}