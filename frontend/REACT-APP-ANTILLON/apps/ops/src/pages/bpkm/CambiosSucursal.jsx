// src/pages/bpkm/CambiosSucursal.jsx
import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Layout from '@ui/Layout';
import { Toast } from 'primereact/toast';
import { Card } from 'primereact/card';
import { RadioButton } from 'primereact/radiobutton';
import { InputTextarea } from 'primereact/inputtextarea';
import { Button } from 'primereact/button';
import { DataTable } from 'primereact/datatable';
import { Column } from 'primereact/column';
import { Tag } from 'primereact/tag';
import { Dialog } from 'primereact/dialog';
import { formatDateTimeGT } from '@utils/dateSafe';
import { getApiErrorMessage } from '@utils/apiError';

import {
  getCambiosSucursal,
  postAprobarCambioSucursal,
  postRechazarCambioSucursal
} from '@services/bpkm/cambiosSucursal';

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

export default function CambiosSucursal() {
  const toastRef = useRef(null);
  const navigate = useNavigate();
  const show = (sev, s, d) => toastRef.current?.show({ severity: sev, summary: s, detail: d, life: 3000 });
  const err = (s, d) => show('error', s, d);
  const ok = (s, d) => show('success', s, d);
  const warn = (s, d) => show('warn', s, d);

  const usuarioId = useMemo(() => Number(localStorage.getItem('userId') || 0), []);
  const sucursalId = useMemo(() => Number(localStorage.getItem('storeId') || 0), []);

  // filtros
  const [fEstado, setFEstado] = useState(ESTADOS[0]); // Por defecto: Todos

  // paginación
  const [rows, setRows] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [pageState, setPageState] = useState({ first: 0, rows: 20 });

  // diálogo aprobar/rechazar
  const [dlgResolver, setDlgResolver] = useState(false);
  const [rowSel, setRowSel] = useState(null);
  const [decision, setDecision] = useState(null); // 'APR' | 'RECH'
  const [observaciones, setObservaciones] = useState('');
  const [guardando, setGuardando] = useState(false);

  async function load(page = pageState) {
    try {
      setLoading(true);
      const res = await getCambiosSucursal({
        estado_codigo: fEstado?.code || null,
        // Filtrar por sucursal DESTINO: solo veo solicitudes dirigidas a mi sucursal
        id_sucursal: sucursalId,
        limit: page.rows,
        offset: page.first
      });
      setRows(res.items || []);
      setTotal(res.total || 0);
    } catch (e) {
      console.error(e);
      err('Error', getApiErrorMessage(e, 'No se pudieron cargar las solicitudes'));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, [fEstado]);

  function onPage(e) {
    const newPage = { first: e.first, rows: e.rows };
    setPageState(newPage);
    load(newPage);
  }

  function limpiarFiltros() {
    setFEstado(ESTADOS[0]);
  }

  function abrirDialogoResolver(row, dec) {
    if (row.estado_codigo !== 'PEND') {
      warn('No permitido', 'Solo se pueden aprobar/rechazar solicitudes pendientes');
      return;
    }
    setRowSel(row);
    setDecision(dec);
    setObservaciones('');
    setDlgResolver(true);
  }

  async function guardarDecision() {
    if (!rowSel || !decision) return;

    setGuardando(true);
    try {
      if (decision === 'APR') {
        await postAprobarCambioSucursal({
          id_cambio: rowSel.id_cambio_sucursal,
          observaciones: observaciones.trim() || null,
          usuario: usuarioId
        });
        ok('Aprobado', `Cambio de sucursal aprobado para factura ${rowSel.folio_factura}`);
      } else if (decision === 'RECH') {
        if (!observaciones.trim()) {
          warn('Validación', 'El motivo de rechazo es obligatorio');
          return;
        }
        await postRechazarCambioSucursal({
          id_cambio: rowSel.id_cambio_sucursal,
          observaciones: observaciones.trim(),
          usuario: usuarioId
        });
        ok('Rechazado', `Cambio de sucursal rechazado para factura ${rowSel.folio_factura}`);
      }
      setDlgResolver(false);
      await load();
    } catch (e) {
      console.error(e);
      err('Error', getApiErrorMessage(e, 'No se pudo procesar la decisión'));
    } finally {
      setGuardando(false);
    }
  }

  return (
    <Layout>
      <Toast ref={toastRef} />

      <div className="container-fluid py-0">
        <Card className="border-0 shadow-sm">
          <div className="d-flex justify-content-between align-items-center px-3 pt-3 pb-2">
            <div>
              <h5 className="m-0">Cambios de Sucursal</h5>
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
                onClick={() => load()}
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

          <div className="px-3 pb-3">
            <div className="d-flex align-items-center flex-wrap gap-3">
              <span className="text-muted small fw-semibold">Estado:</span>
              {ESTADOS.map((est) => (
                <div key={est.code} className="d-flex align-items-center">
                  <RadioButton
                    inputId={`estado-${est.code}`}
                    name="estado"
                    value={est}
                    onChange={(e) => setFEstado(e.value)}
                    checked={fEstado.code === est.code}
                  />
                  <label htmlFor={`estado-${est.code}`} className="ms-2 mb-0 small cursor-pointer">
                    {est.name}
                  </label>
                </div>
              ))}
            </div>
          </div>

          <div className="px-3 pb-3">
            <DataTable
              value={rows}
              loading={loading}
              paginator
              rows={pageState.rows}
              first={pageState.first}
              totalRecords={total}
              onPage={onPage}
              lazy
              rowsPerPageOptions={[10, 20, 50]}
              emptyMessage="No se encontraron solicitudes"
              size="small"
              stripedRows
            >
              <Column header="Folio" field="folio_factura" style={{ width: '120px' }} />
              <Column
                header="Solicitado"
                body={(row) => (
                  <div className="small" style={{ lineHeight: '1.3' }}>
                    <div className="fw-semibold">{row.usuario_solicita || '-'}</div>
                    <div className="text-muted">
                      {row.fecha_solicitud ? formatDateTimeGT(row.fecha_solicitud) : '-'}
                    </div>
                  </div>
                )}
                style={{ width: '180px' }}
              />
              <Column
                header="Origen"
                field="sucursal_origen"
                body={(row) => row.sucursal_origen || '-'}
                style={{ width: '160px' }}
              />
              <Column
                header="Destino"
                field="sucursal_destino"
                body={(row) => row.sucursal_destino || '-'}
                style={{ width: '160px' }}
              />
              <Column header="Motivo Solicitud" field="motivo_solicitud" style={{ minWidth: '250px' }} />
              <Column
                header="Estado"
                body={(row) => (
                  <Tag value={row.estado_nombre || row.estado_codigo} severity={sevEstado(row.estado_codigo)} />
                )}
                style={{ width: '130px' }}
              />
              <Column
                header="Observaciones"
                field="observaciones_aprob"
                body={(row) => row.observaciones_aprob || '-'}
                style={{ minWidth: '200px' }}
              />
              <Column
                header="Acciones"
                body={(row) => {
                  if (row.estado_codigo !== 'PEND') {
                    return <span className="text-muted small">-</span>;
                  }
                  return (
                    <div className="d-flex gap-1 justify-content-end">
                      <Button
                        icon="pi pi-check"
                        rounded
                        text
                        size="small"
                        severity="success"
                        onClick={() => abrirDialogoResolver(row, 'APR')}
                        tooltip="Aprobar"
                        tooltipOptions={{ position: 'top' }}
                      />
                      <Button
                        icon="pi pi-times"
                        rounded
                        text
                        size="small"
                        severity="danger"
                        onClick={() => abrirDialogoResolver(row, 'RECH')}
                        tooltip="Rechazar"
                        tooltipOptions={{ position: 'top' }}
                      />
                    </div>
                  );
                }}
                style={{ width: '100px' }}
              />
            </DataTable>
          </div>
        </Card>
      </div>

      <Dialog
        header={decision === 'APR' ? 'Aprobar Cambio de Sucursal' : 'Rechazar Cambio de Sucursal'}
        visible={dlgResolver}
        style={{ width: '500px' }}
        modal
        onHide={() => setDlgResolver(false)}
      >
        <div className="d-flex flex-column gap-3">
          {rowSel && (
            <>
              <div className="alert alert-info mb-0 small">
                <div><strong>Factura:</strong> {rowSel.folio_factura}</div>
                <div><strong>Origen:</strong> {rowSel.sucursal_origen}</div>
                <div><strong>Destino:</strong> {rowSel.sucursal_destino}</div>
                <div><strong>Motivo:</strong> {rowSel.motivo_solicitud}</div>
              </div>

              <div>
                <label className="form-label small">
                  {decision === 'APR' ? 'Observaciones (Opcional)' : 'Motivo de Rechazo *'}
                </label>
                <InputTextarea
                  value={observaciones}
                  onChange={(e) => setObservaciones(e.target.value)}
                  rows={4}
                  className="w-100"
                  placeholder={decision === 'APR' ? 'Comentarios adicionales...' : 'Explique el motivo del rechazo...'}
                />
              </div>
            </>
          )}

          <div className="d-flex justify-content-end gap-2 mt-2">
            <Button
              label={decision === 'APR' ? 'Aprobar' : 'Rechazar'}
              icon="pi pi-check"
              severity={decision === 'APR' ? 'success' : 'danger'}
              onClick={guardarDecision}
              loading={guardando}
            />
            <Button
              label="Cancelar"
              icon="pi pi-times"
              severity="secondary"
              outlined
              onClick={() => setDlgResolver(false)}
              disabled={guardando}
            />
          </div>
        </div>
      </Dialog>
    </Layout>
  );
}
