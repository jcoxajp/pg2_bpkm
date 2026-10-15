import { useEffect, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Layout from '@ui/Layout';
import { Toast } from 'primereact/toast';
import { Card } from 'primereact/card';
import { Button } from 'primereact/button';
import { Tag } from 'primereact/tag';
import { Dialog } from 'primereact/dialog';
import { getBPKMDetalleRRHH, postFinalizarBPKMRrhh, nombreEstadoRrhh } from '@services/bpkm/bpkmRrhh';
import { formatDateTimeGT } from '@utils/dateSafe';
import { getApiErrorMessage } from '@utils/apiError';

export default function RrhhDetalle() {
  const { id_bpkm } = useParams();
  const navigate = useNavigate();
  const toastRef = useRef(null);
  const show = (severity, summary, detail) =>
    toastRef.current?.show({ severity, summary, detail, life: 3000 });

  const [bpkm, setBpkm] = useState(null);
  const [loading, setLoading] = useState(false);
  const [dialogFinalizar, setDialogFinalizar] = useState(false);
  const [finalizando, setFinalizando] = useState(false);

  async function cargarDetalle() {
    setLoading(true);
    try {
      const data = await getBPKMDetalleRRHH({ id_bpkm: Number(id_bpkm) });
      setBpkm(data);
    } catch (e) {
      console.error(e);
      show('error', 'Error', getApiErrorMessage(e, 'No se pudo cargar el detalle del BPKM'));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    cargarDetalle();
  }, [id_bpkm]);

  const handleFinalizar = async () => {
    setFinalizando(true);
    try {
      const userId = Number(localStorage.getItem('userId') || 0);
      await postFinalizarBPKMRrhh({ id_bpkm: Number(id_bpkm), usuario_rrhh: userId });
      show('success', 'Finalizado', 'BPKM finalizado correctamente');
      setDialogFinalizar(false);
      await cargarDetalle();
    } catch (e) {
      console.error(e);
      show('error', 'Error', getApiErrorMessage(e, 'No se pudo finalizar el BPKM'));
    } finally {
      setFinalizando(false);
    }
  };

  const fmt = (num) => {
    const n = Number(num || 0);
    return 'Q' + n.toLocaleString('es-GT', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  const getEstadoSeverity = (codigo) => {
    if (codigo === 'APR') return 'warning';
    if (codigo === 'FIN_RRHH') return 'success';
    return 'info';
  };

  if (loading || !bpkm) {
    return (
      <Layout>
        <div className="d-flex justify-content-center align-items-center" style={{ minHeight: '400px' }}>
          <i className="pi pi-spin pi-spinner" style={{ fontSize: '2rem' }}></i>
        </div>
      </Layout>
    );
  }

  const yaFinalizado = bpkm.estado_codigo === 'FIN_RRHH';

  return (
    <Layout>
      <Toast ref={toastRef} />
      <div className="container-fluid py-0">
        <div className="d-flex justify-content-between align-items-center mb-3">
          <div className="d-flex align-items-center gap-2">
            <Button
              icon="pi pi-arrow-left"
              text
              onClick={() => navigate('/RRHH-BPKM')}
              tooltip="Volver"
              tooltipOptions={{ position: 'top' }}
            />
            <h5 className="m-0">Detalle BPKM - {bpkm.codigo_ruta}</h5>
            <Tag
              value={nombreEstadoRrhh(bpkm.estado_codigo, bpkm.estado_bpkm)}
              severity={getEstadoSeverity(bpkm.estado_codigo)}
            />
          </div>
          {!yaFinalizado && (
            <Button
              icon="pi pi-check"
              label="Finalizar BPKM"
              severity="success"
              onClick={() => setDialogFinalizar(true)}
            />
          )}
        </div>

        <Card className="mb-3">
          <h6 className="text-primary mb-3">Información de la Ruta</h6>
          <div className="row g-3">
            <div className="col-md-3">
              <label className="small text-muted d-block">Código Ruta</label>
              <strong>{bpkm.codigo_ruta || '-'}</strong>
            </div>
            <div className="col-md-3">
              <label className="small text-muted d-block">Piloto</label>
              <strong>{bpkm.nombre_piloto || '-'}</strong>
            </div>
            <div className="col-md-3">
              <label className="small text-muted d-block">Auxiliar</label>
              <strong>{bpkm.nombre_auxiliar || '-'}</strong>
            </div>
            <div className="col-md-3">
              <label className="small text-muted d-block">Camión</label>
              <strong>{bpkm.placa_camion || '-'}</strong>
            </div>
            <div className="col-md-4">
              <label className="small text-muted d-block">Departamento</label>
              <strong>{bpkm.departamento || '-'}</strong>
            </div>
            <div className="col-md-4">
              <label className="small text-muted d-block">Municipio</label>
              <strong>{bpkm.municipio_lejano || '-'}</strong>
            </div>
            <div className="col-md-4">
              <label className="small text-muted d-block">Distancia Más Lejana (km)</label>
              <strong>{bpkm.distancia_mas_lejana ? Number(bpkm.distancia_mas_lejana).toFixed(2) + ' km' : '-'}</strong>
            </div>
          </div>
        </Card>

        <Card>
          <h6 className="text-success mb-3">Montos Aprobados</h6>
          <div className="row g-3">
            <div className="col-md-6">
              <label className="small text-muted d-block mb-1">Monto Piloto</label>
              <div className="fs-4 text-success fw-bold">{fmt(bpkm.monto_aprobado_piloto)}</div>
            </div>
            <div className="col-md-6">
              <label className="small text-muted d-block mb-1">Monto Auxiliar</label>
              <div className="fs-4 text-success fw-bold">{fmt(bpkm.monto_aprobado_auxiliar)}</div>
            </div>
            {bpkm.observaciones_gerencia && (
              <div className="col-12">
                <label className="small text-muted d-block mb-1">Observaciones Gerencia</label>
                <div className="p-2 bg-light rounded">{bpkm.observaciones_gerencia}</div>
              </div>
            )}
            <div className="col-md-6">
              <label className="small text-muted d-block">Aprobado por</label>
              <strong>{bpkm.usuario_gerencia_nombre || '-'}</strong>
              <small className="text-muted d-block">
                {formatDateTimeGT(bpkm.fecha_aprobacion) || '-'}
              </small>
            </div>
            {yaFinalizado && (
              <div className="col-md-6">
                <label className="small text-muted d-block">Finalizado por</label>
                <strong>{bpkm.usuario_rrhh_nombre || '-'}</strong>
                <small className="text-muted d-block">
                  {formatDateTimeGT(bpkm.fecha_rrhh) || '-'}
                </small>
              </div>
            )}
          </div>
        </Card>
      </div>

      <Dialog
        visible={dialogFinalizar}
        onHide={() => setDialogFinalizar(false)}
        header="Confirmar Finalización"
        style={{ width: '450px' }}
        modal
      >
        <div className="mb-3">
          <p>¿Está seguro de finalizar este BPKM?</p>
          <p className="text-muted small mb-0">
            Esto confirmará el pago de:
          </p>
          <ul className="mt-2">
            <li>Piloto ({bpkm.nombre_piloto}): <strong>{fmt(bpkm.monto_aprobado_piloto)}</strong></li>
            <li>Auxiliar ({bpkm.nombre_auxiliar}): <strong>{fmt(bpkm.monto_aprobado_auxiliar)}</strong></li>
          </ul>
        </div>
        <div className="d-flex justify-content-end gap-2">
          <Button
            label="Cancelar"
            severity="secondary"
            outlined
            onClick={() => setDialogFinalizar(false)}
            disabled={finalizando}
          />
          <Button
            label="Finalizar"
            severity="success"
            icon="pi pi-check"
            onClick={handleFinalizar}
            loading={finalizando}
          />
        </div>
      </Dialog>
    </Layout>
  );
}
