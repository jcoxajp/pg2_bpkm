import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import Layout from '@ui/Layout';
import SidebarHistorialEntrega from '@ui/Evidencias-Facturas/SidebarHistorialEntrega';
import FacturaDetalleDialog from './components/FacturaDetalleDialog';
import { GoogleMapsMapPinIcon, MapaRutaDialog } from '@ui/GoogleMaps';
import { Toast } from 'primereact/toast';
import { Card } from 'primereact/card';
import { Button } from 'primereact/button';
import { InputNumber } from 'primereact/inputnumber';
import { InputTextarea } from 'primereact/inputtextarea';
import { DataTable } from 'primereact/datatable';
import { Column } from 'primereact/column';
import { ColumnGroup } from 'primereact/columngroup';
import { Row } from 'primereact/row';
import { Tag } from 'primereact/tag';
import { Dialog } from 'primereact/dialog';
import { TabView, TabPanel } from 'primereact/tabview';
import { getBPKMDetalle, postAprobarBPKMGerencia, getMonitoreoPorRuta, getBitacoraBPKM, getDetallesPorRutaGerencia, patchDistanciaLejanaBPKM } from '@services/bpkm/bpkmGerencia';
import { getComentariosRuta, postComentarioRuta, getRutaDestinos } from '@services/bpkm/bpkmRutas';
import { formatDateTimeGT } from '@utils/dateSafe';
import { getApiErrorMessage } from '@utils/apiError';

// Mapeo de códigos de acción a nombres amigables
const ACCIONES_MAP = {
  'CREAR': 'Creación',
  'APROBAR': 'Aprobación',
  'RECHAZAR': 'Rechazo',
  'FINALIZAR': 'Finalización',
  'ANULAR': 'Anulación',
  'MODIFICAR': 'Modificación',
  'DISTANCIA_INSERTADA': 'Distancia Actualizada'
};

export default function GerenciaDetalle() {
  const { id_bpkm } = useParams();
  const navigate = useNavigate();
  const toastRef = useRef(null);
  const show = (severity, summary, detail) =>
    toastRef.current?.show({ severity, summary, detail, life: 3500 });

  const usuarioId = useMemo(() => Number(localStorage.getItem('userId') || 0), []);

  const [bpkm, setBpkm] = useState(null);
  const [facturas, setFacturas] = useState([]);
  const [monitoreo, setMonitoreo] = useState([]);
  const [bitacora, setBitacora] = useState([]);
  const [comentarios, setComentarios] = useState([]);
  const [destinos, setDestinos] = useState([]);
  const [loading, setLoading] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [guardandoDistancia, setGuardandoDistancia] = useState(false);
  const [loadingComentarios, setLoadingComentarios] = useState(false);
  const [nuevoComentario, setNuevoComentario] = useState('');

  // Edición de montos
  const [montoAprobadoPiloto, setMontoAprobadoPiloto] = useState(0);
  const [montoAprobadoAuxiliar, setMontoAprobadoAuxiliar] = useState(0);
  const [observaciones, setObservaciones] = useState('');
  const [distanciaInput, setDistanciaInput] = useState(0);
  const [distanciaDraft, setDistanciaDraft] = useState(0);
  const [distanciaEditando, setDistanciaEditando] = useState(false);
  const [distanciaDialogDraft, setDistanciaDialogDraft] = useState(0);
  const [distanciaDialogEditando, setDistanciaDialogEditando] = useState(false);
  const [guardandoDistanciaDialog, setGuardandoDistanciaDialog] = useState(false);

  // Diálogos
  const [bitacoraVisible, setBitacoraVisible] = useState(false);
  const [facturaDetalleVisible, setFacturaDetalleVisible] = useState(false);
  const [facturaSeleccionada, setFacturaSeleccionada] = useState(null);
  const [montosDialogVisible, setMontosDialogVisible] = useState(false);
  const [mapaDialogVisible, setMapaDialogVisible] = useState(false);

  async function cargarDatos() {
    setLoading(true);
    try {
      // Primero cargar el BPKM
      const bpkmData = await getBPKMDetalle({ id_bpkm: Number(id_bpkm) });
      setBpkm(bpkmData);

      // Inicializar montos aprobados
      if (bpkmData.monto_aprobado_piloto != null) {
        setMontoAprobadoPiloto(Number(bpkmData.monto_aprobado_piloto));
      } else {
        setMontoAprobadoPiloto(Number(bpkmData.monto_sugerido_piloto || 0));
      }

      if (bpkmData.monto_aprobado_auxiliar != null) {
        setMontoAprobadoAuxiliar(Number(bpkmData.monto_aprobado_auxiliar));
      } else {
        setMontoAprobadoAuxiliar(Number(bpkmData.monto_sugerido_auxiliar || 0));
      }

      setObservaciones(bpkmData.observaciones_gerencia || '');
      setDistanciaInput(Number(bpkmData.distancia_mas_lejana || 0));
      setDistanciaDraft(Number(bpkmData.distancia_mas_lejana || 0));
      setDistanciaEditando(false);
      setDistanciaDialogDraft(Number(bpkmData.distancia_mas_lejana || 0));
      setDistanciaDialogEditando(false);

      // Cargar facturas, monitoreo, bitácora, comentarios y destinos en paralelo
      const promises = [];

      if (bpkmData.id_ruta) {
        promises.push(
          getDetallesPorRutaGerencia({ id_ruta: bpkmData.id_ruta }),
          getMonitoreoPorRuta({ id_ruta: bpkmData.id_ruta }),
          getComentariosRuta({ id_ruta: bpkmData.id_ruta }),
          getRutaDestinos(bpkmData.id_ruta)
        );
      }

      promises.push(getBitacoraBPKM({ id_bpkm: Number(id_bpkm) }));

      const results = await Promise.all(promises);

      if (bpkmData.id_ruta) {
        setFacturas(Array.isArray(results[0]) ? results[0] : []);
        setMonitoreo(Array.isArray(results[1]) ? results[1] : []);
        setComentarios(Array.isArray(results[2]) ? results[2] : []);
        setDestinos(Array.isArray(results[3]) ? results[3] : []);
        setBitacora(Array.isArray(results[4]) ? results[4] : []);
      } else {
        setDestinos([]);
        setBitacora(Array.isArray(results[0]) ? results[0] : []);
      }
    } catch (e) {
      console.error(e);
      show('error', 'Error', getApiErrorMessage(e, 'No se pudo cargar el detalle del BPKM'));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (id_bpkm) {
      cargarDatos();
    }
  }, [id_bpkm]);

  const handleAgregarComentario = async () => {
    if (!nuevoComentario.trim()) {
      show('warn', 'Advertencia', 'El comentario no puede estar vacío');
      return;
    }

    if (!bpkm?.id_ruta) {
      show('error', 'Error', 'No se encontró el ID de la ruta');
      return;
    }

    setLoadingComentarios(true);
    try {
      await postComentarioRuta({
        id_ruta: bpkm.id_ruta,
        comentario: nuevoComentario.trim(),
        usuario: usuarioId
      });
      show('success', 'Éxito', 'Comentario agregado exitosamente');
      setNuevoComentario('');
      // Recargar comentarios
      const comentariosActualizados = await getComentariosRuta({ id_ruta: bpkm.id_ruta });
      setComentarios(Array.isArray(comentariosActualizados) ? comentariosActualizados : []);
    } catch (e) {
      console.error(e);
      const msg = getApiErrorMessage(e, 'No se pudo agregar el comentario');
      show('error', 'Error', msg);
    } finally {
      setLoadingComentarios(false);
    }
  };

  // Réplica de bpkm.calcular_comision_bpkm(p_distancia_km)
  const calcularComisionBpkm = (km) => {
    const d = parseFloat(km);
    if (!d || d <= 0) return 0;
    if (d <= 50) return d;
    if (d <= 80) return Math.round(d * 0.80 * 100) / 100;
    return Math.round(d * 0.70 * 100) / 100;
  };

  const handleAbrirRevisar = () => {
    if (!bpkm || bpkm.estado_codigo !== 'PEND') {
      show('warn', 'Advertencia', 'Solo se pueden revisar BPKMs con estado Pendiente');
      return;
    }
    setDistanciaEditando(false);
    setDistanciaDialogDraft(Number(distanciaInput || bpkm.distancia_mas_lejana || 0));
    setDistanciaDialogEditando(false);
    setObservaciones('');
    setMontosDialogVisible(true);
  };

  const handleDistanciaChange = (km) => {
    setDistanciaInput(km);
    const piloto = calcularComisionBpkm(km);
    setMontoAprobadoPiloto(piloto);
    setMontoAprobadoAuxiliar(Math.round(piloto * 0.50 * 100) / 100);
  };

  const patchDistanciaYRecalcular = async (km) => {
    await patchDistanciaLejanaBPKM({
      id_bpkm: Number(id_bpkm),
      distancia: km,
      usuario_gerencia: usuarioId
    });
    handleDistanciaChange(km);
    setBpkm(prev => prev ? { ...prev, distancia_mas_lejana: km } : prev);
    setDistanciaDraft(km);
    setDistanciaDialogDraft(km);
  };

  const handleIniciarEdicionDistancia = () => {
    setDistanciaDraft(Number(distanciaInput || 0));
    setDistanciaEditando(true);
  };

  const handleGuardarDistancia = async () => {
    const km = Number(distanciaDraft || 0);
    setGuardandoDistancia(true);
    try {
      await patchDistanciaYRecalcular(km);
      setDistanciaEditando(false);
      show('success', 'Actualizado', 'Distancia más lejana actualizada');
    } catch (e) {
      console.error(e);
      const msg = getApiErrorMessage(e, 'No se pudo actualizar la distancia');
      show('error', 'Error', msg);
    } finally {
      setGuardandoDistancia(false);
    }
  };

  const handleCancelarEdicionDistancia = () => {
    setDistanciaDraft(Number(distanciaInput || 0));
    setDistanciaEditando(false);
  };

  const handleIniciarEdicionDistanciaDialog = () => {
    setDistanciaDialogDraft(Number(distanciaInput || 0));
    setDistanciaDialogEditando(true);
  };

  const handleGuardarDistanciaDialog = async () => {
    const km = Number(distanciaDialogDraft || 0);
    setGuardandoDistanciaDialog(true);
    try {
      await patchDistanciaYRecalcular(km);
      setDistanciaDialogEditando(false);
      show('success', 'Actualizado', 'Distancia más lejana actualizada');
    } catch (e) {
      console.error(e);
      const msg = getApiErrorMessage(e, 'No se pudo actualizar la distancia');
      show('error', 'Error', msg);
    } finally {
      setGuardandoDistanciaDialog(false);
    }
  };

  const handleCancelarEdicionDistanciaDialog = () => {
    setDistanciaDialogDraft(Number(distanciaInput || 0));
    setDistanciaDialogEditando(false);
  };

  const handleAprobar = async () => {
    setGuardando(true);
    try {
      await postAprobarBPKMGerencia({
        id_bpkm: Number(id_bpkm),
        monto_aprobado_piloto: montoAprobadoPiloto,
        monto_aprobado_auxiliar: montoAprobadoAuxiliar,
        observaciones: observaciones,
        usuario_gerencia: usuarioId
      });
      show('success', 'Aprobado', 'BPKM aprobado exitosamente');
      setMontosDialogVisible(false);
      setTimeout(() => navigate('/Gerencia-BPKM'), 1500);
    } catch (e) {
      console.error(e);
      const msg = getApiErrorMessage(e, 'No se pudo aprobar el BPKM');
      show('error', 'Error', msg);
    } finally {
      setGuardando(false);
    }
  };

  const fmt = (num) => {
    const n = Number(num || 0);
    return 'Q' + n.toLocaleString('es-GT', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  const getNombreAccion = (codigo) => {
    return ACCIONES_MAP[codigo] || codigo;
  };

  const estadoBody = (row) => {
    const estado = row.estado_codigo || '';
    let severity = 'info';
    if (estado === 'ENTREGADA') severity = 'success';
    if (estado === 'FALLIDA') severity = 'danger';
    if (estado === 'PARCIAL') severity = 'warning';
    return <Tag value={row.estado_liquidacion} severity={severity} />;
  };

  // Calcular monto entregado (ENTREGADA + PARCIAL)
  // Porcentaje viene del backend (bpkm.porcentaje_entrega)
  const montosCalculados = useMemo(() => {
    const montoTotal = Number(bpkm?.monto_total_transportado || 0);
    const montoEntregado = facturas.reduce((sum, f) => {
      if (f.estado_codigo === 'ENTREGADA' || f.estado_codigo === 'PARCIAL') {
        return sum + Number(f.total_factura || 0);
      }
      return sum;
    }, 0);
    // Usar porcentaje del backend (calculado con estados ENT+PARC)
    const porcentaje = Number(bpkm?.porcentaje_entrega || 0);
    return { montoTotal, montoEntregado, porcentaje };
  }, [bpkm, facturas]);

  // Ordenar destinos por departamento para garantizar agrupación continua
  const destinosOrdenados = useMemo(() => {
    if (!Array.isArray(destinos)) return [];
    return [...destinos].sort((a, b) =>
      String(a.departamento || '').localeCompare(String(b.departamento || ''))
    );
  }, [destinos]);

  // Totales generales de la pestaña Destinos
  const totalFacturasDestinos = useMemo(() => {
    return destinos.reduce((acc, d) => acc + Number(d.total_facturas || 0), 0);
  }, [destinos]);

  const totalMontoDestinos = useMemo(() => {
    return destinos.reduce((acc, d) => acc + Number(d.monto || 0), 0);
  }, [destinos]);

  const rowGroupHeaderTemplate = (data) => {
    const depto = data.departamento;
    const deptoRows = destinos.filter((d) => d.departamento === depto);
    const subtotalFacturas = deptoRows.reduce((acc, r) => acc + Number(r.total_facturas || 0), 0);
    const subtotalMonto = deptoRows.reduce((acc, r) => acc + Number(r.monto || 0), 0);

    return (
      <div className="d-flex align-items-center w-100 py-1">
        <div style={{ width: '60%' }} className="d-flex align-items-center gap-3">
          <div className="d-flex align-items-center gap-2">
            <i className="pi pi-map-marker text-primary" style={{ fontSize: '0.9rem' }}></i>
            <strong style={{ fontSize: '0.9rem' }}>{depto || 'Sin Departamento'}</strong>
          </div>
          <span className="fw-bold text-primary" style={{ fontSize: '0.9rem' }}>
            {fmt(subtotalMonto)}
          </span>
        </div>
        <div style={{ width: '18%' }} className="text-center">
          <span className="badge bg-secondary">{subtotalFacturas}</span>
        </div>
        <div style={{ width: '22%' }}></div>
      </div>
    );
  };

  const footerGroupDestinos = (
    <ColumnGroup>
      <Row>
        <Column
          footer="Total General"
          colSpan={2}
          footerStyle={{ textAlign: 'right', fontWeight: 'bold', fontSize: '0.9rem' }}
        />
        <Column
          footer={
            <div className="text-center">
              <span className="badge bg-dark">{totalFacturasDestinos}</span>
            </div>
          }
          footerStyle={{ textAlign: 'center' }}
        />
        <Column
          footer={
            <div className="text-end fw-bold text-success" style={{ fontSize: '0.95rem' }}>
              {fmt(totalMontoDestinos)}
            </div>
          }
          footerStyle={{ textAlign: 'right' }}
        />
      </Row>
    </ColumnGroup>
  );

  const accionesBody = (row) => (
    <div className="d-flex gap-1">
      <Button
        icon="pi pi-history"
        size="small"
        rounded
        text
        tooltip="Ver Historial"
        tooltipOptions={{ position: 'top' }}
        onClick={() => {
          setFacturaSeleccionada(row);
          setBitacoraVisible(true);
        }}
      />
      <Button
        icon="pi pi-file"
        size="small"
        rounded
        text
        tooltip="Ver Detalle Factura"
        tooltipOptions={{ position: 'top' }}
        onClick={() => {
          setFacturaSeleccionada(row);
          setFacturaDetalleVisible(true);
        }}
      />
    </div>
  );

  const cumplimiento = useMemo(() => {
    if (!monitoreo || monitoreo.length < 2 || !bpkm) return null;

    const salidaReal = monitoreo.find(m => m.str_tipo === 'S')?.ts_fecha_hora;
    const entradaReal = monitoreo.find(m => m.str_tipo === 'E')?.ts_fecha_hora;

    if (!salidaReal || !entradaReal || !bpkm.fecha_salida_plan || !bpkm.fecha_entrada_plan) {
      return null;
    }

    const diffSalida = Math.abs((new Date(salidaReal) - new Date(bpkm.fecha_salida_plan)) / 60000);
    const diffEntrada = Math.abs((new Date(entradaReal) - new Date(bpkm.fecha_entrada_plan)) / 60000);

    const cumplida = diffSalida <= 15;

    return {
      cumplida,
      diffSalida: Math.round(diffSalida),
      diffEntrada: Math.round(diffEntrada)
    };
  }, [monitoreo, bpkm]);

  const tieneFacturasConUbicacion = useMemo(() => {
    const lista = bpkm?.mapa?.puntos?.length ? bpkm.mapa.puntos : facturas;
    return Array.isArray(lista) && lista.some((p) => p.latitud != null && p.longitud != null);
  }, [bpkm?.mapa?.puntos, facturas]);

  const botonMapaDeshabilitado =
    bpkm?.mapa?.mapa_habilitado === false || !tieneFacturasConUbicacion;

  if (loading || !bpkm) {
    return (
      <Layout>
        <div className="container-fluid py-2">
          <Card className="border-0 shadow-sm">
            <div className="text-center py-5">
              <i className="pi pi-spin pi-spinner" style={{ fontSize: '2rem' }}></i>
              <p className="mt-2">Cargando detalle...</p>
            </div>
          </Card>
        </div>
      </Layout>
    );
  }

  const puedeAprobar = bpkm.estado_codigo === 'PEND';
  const distanciaMostrada = puedeAprobar
    ? Number(distanciaInput || 0)
    : Number(bpkm?.distancia_mas_lejana || 0);
  const montoPilotoMostrado = bpkm.estado_codigo === 'PEND'
    ? Number(montoAprobadoPiloto || 0)
    : Number(bpkm?.monto_aprobado_piloto || 0);
  const montoAuxiliarMostrado = bpkm.estado_codigo === 'PEND'
    ? Number(montoAprobadoAuxiliar || 0)
    : Number(bpkm?.monto_aprobado_auxiliar || 0);

  return (
    <Layout>
      <Toast ref={toastRef} />
      <div className="container-fluid py-0">

        {/* Header con Datos de Ruta */}
        <Card className="border-0 shadow-sm mb-1" style={{ padding: '0.5rem' }}>
          <div className="d-flex justify-content-between align-items-start mb-1">
            <div className="d-flex align-items-center gap-3">
              <h6 className="mb-0">BPKM - {bpkm.codigo_ruta}</h6>
              <Tag
                value={bpkm.estado_bpkm}
                severity={
                  bpkm.estado_codigo === 'PEND'
                    ? 'warning'
                    : bpkm.estado_codigo === 'APR'
                      ? 'success'
                      : 'info'
                }
              />
            </div>
            <div className="d-flex gap-2">
              <Button
                type="button"
                text
                className="p-1"
                onClick={() => setMapaDialogVisible(true)}
                disabled={botonMapaDeshabilitado}
                tooltip={
                  bpkm?.mapa?.mapa_habilitado === false
                    ? 'Mapa no disponible'
                    : !tieneFacturasConUbicacion
                      ? 'Sin datos suficientes'
                      : 'Ver en Google Maps'
                }
                tooltipOptions={{ position: 'bottom', showOnDisabled: true }}
              >
                <GoogleMapsMapPinIcon size={35} />
              </Button>
              {puedeAprobar && (
                <Button
                  label="Aprobar"
                  icon="pi pi-check-circle"
                  severity="success"
                  size="small"
                  onClick={handleAbrirRevisar}
                />
              )}
              <Button
                label="Volver"
                icon="pi pi-arrow-left"
                size="small"
                outlined
                onClick={() => navigate('/Gerencia-BPKM')}
              />
            </div>
          </div>
          <div className="row g-1">
            <div className="col-md-3">
              <label className="small text-muted" style={{ fontSize: '0.75rem' }}>Piloto</label>
              <div className="fw-semibold" style={{ fontSize: '0.9rem' }}>{bpkm.nombre_piloto || '-'}</div>
            </div>
            <div className="col-md-3">
              <label className="small text-muted" style={{ fontSize: '0.75rem' }}>Auxiliar</label>
              <div className="fw-semibold" style={{ fontSize: '0.9rem' }}>{bpkm.nombre_auxiliar || '-'}</div>
            </div>
            <div className="col-md-3">
              <label className="small text-muted" style={{ fontSize: '0.75rem' }}>Camión</label>
              <div className="fw-semibold" style={{ fontSize: '0.9rem' }}>{bpkm.placa_camion || '-'}</div>
            </div>
            <div className="col-md-3">
              <label className="small text-muted" style={{ fontSize: '0.75rem' }}>Tipo Ruta</label>
              <div className="fw-semibold" style={{ fontSize: '0.9rem' }}>
                {(bpkm.tipo_ruta === 'RT' || bpkm.tipo_ruta === 'RL') ? 'Ruta Larga' : bpkm.tipo_ruta === 'RC' ? 'Ruta Corta' : 'Transporte Externo'}
              </div>
            </div>
            <div className="col-md-3">
              <label className="small text-muted" style={{ fontSize: '0.75rem' }}>Fecha de la Ruta</label>
              <div className="fw-semibold" style={{ fontSize: '0.9rem' }}>
                {formatDateTimeGT(bpkm.fecha_salida_plan) || '-'}
              </div>
            </div>
            <div className="col-md-3">
              <label className="small text-muted" style={{ fontSize: '0.75rem' }}>Distancia Más Lejana</label>
              {puedeAprobar ? (
                distanciaEditando ? (
                  <div className="d-flex align-items-center gap-1 flex-wrap">
                    <InputNumber
                      value={distanciaDraft}
                      onValueChange={(e) => setDistanciaDraft(e.value ?? 0)}
                      min={0}
                      maxFractionDigits={2}
                      locale="en-US"
                      suffix=" km"
                      style={{ width: '8.5rem' }}
                    />
                    <Button
                      icon="pi pi-check"
                      rounded
                      text
                      severity="success"
                      size="small"
                      tooltip="Guardar distancia"
                      tooltipOptions={{ position: 'top' }}
                      onClick={handleGuardarDistancia}
                      loading={guardandoDistancia}
                      disabled={guardandoDistancia}
                    />
                    <Button
                      icon="pi pi-times"
                      rounded
                      text
                      severity="secondary"
                      size="small"
                      tooltip="Cancelar"
                      tooltipOptions={{ position: 'top' }}
                      onClick={handleCancelarEdicionDistancia}
                      disabled={guardandoDistancia}
                    />
                  </div>
                ) : (
                  <div className="d-flex align-items-center gap-1">
                    <div className="fw-semibold" style={{ fontSize: '0.9rem' }}>
                      {`${Number(distanciaInput || 0).toFixed(1)} km`}
                    </div>
                    <Button
                      icon="pi pi-pencil"
                      rounded
                      text
                      size="small"
                      tooltip="Editar distancia"
                      tooltipOptions={{ position: 'top' }}
                      onClick={handleIniciarEdicionDistancia}
                      disabled={guardandoDistancia}
                    />
                  </div>
                )
              ) : (
                <div className="fw-semibold" style={{ fontSize: '0.9rem' }}>
                  {bpkm.distancia_mas_lejana ? `${Number(bpkm.distancia_mas_lejana).toFixed(1)} km` : '-'}
                </div>
              )}
            </div>
            <div className="col-md-3">
              <label className="small text-muted" style={{ fontSize: '0.75rem' }}>Distancia Anterior</label>
              <div className="fw-semibold" style={{ fontSize: '0.9rem' }}>
                {(() => {
                  const val = bpkm.distancia_anterior ?? bpkm.distancia_insertada;
                  return val !== null && val !== undefined && val !== ''
                    ? `${Number(val).toFixed(1)} km`
                    : '';
                })()}
              </div>
            </div>
            <div className="col-md-3">
              <label className="small text-muted" style={{ fontSize: '0.75rem' }}>Municipio Lejano</label>
              <div className="fw-semibold" style={{ fontSize: '0.9rem' }}>{bpkm.municipio_lejano || '-'}</div>
            </div>
            <div className="col-md-3">
              <label className="small text-muted" style={{ fontSize: '0.75rem' }}>Costo del Viaje</label>
              <div className="fw-bold text-success" style={{ fontSize: '1rem' }}>
                {fmt(distanciaMostrada * 10)}
              </div>
            </div>
            <div className="col-md-2">
              <label className="small text-muted" style={{ fontSize: '0.75rem' }}>Total Facturas</label>
              <div className="fw-semibold" style={{ fontSize: '0.9rem' }}>{bpkm.total_facturas || 0}</div>
            </div>
            <div className="col-md-2">
              <label className="small text-muted" style={{ fontSize: '0.75rem' }}>Monto Transportado</label>
              <div className="fw-bold text-primary" style={{ fontSize: '0.95rem' }}>
                {fmt(montosCalculados.montoTotal)}
              </div>
            </div>
            <div className="col-md-2">
              <label className="small text-muted" style={{ fontSize: '0.75rem' }}>Monto Entregado</label>
              <div className="fw-bold text-success" style={{ fontSize: '0.95rem' }}>
                {fmt(montosCalculados.montoEntregado)}
              </div>
            </div>
            <div className="col-md-2">
              <label className="small text-muted" style={{ fontSize: '0.75rem' }}>% Entrega</label>
              <div className="fw-bold" style={{ fontSize: '0.95rem', color: montosCalculados.porcentaje >= 95 ? '#28a745' : montosCalculados.porcentaje >= 85 ? '#f59e0b' : '#dc3545' }}>
                {montosCalculados.porcentaje.toFixed(1)}%
              </div>
            </div>
            <div className="col-md-3">
              <label className="small text-muted" style={{ fontSize: '0.75rem' }}>
                {bpkm.estado_codigo === 'PEND' ? 'Monto Sugerido (Piloto)' : 'Monto Aprobado (Piloto)'}
              </label>
              <div className="fw-bold" style={{ fontSize: '0.95rem', color: bpkm.estado_codigo === 'PEND' ? '#f59e0b' : '#28a745' }}>
                {bpkm.estado_codigo === 'PEND'
                  ? fmt(montoPilotoMostrado)
                  : fmt(bpkm.monto_aprobado_piloto || 0)
                }
              </div>
            </div>
            <div className="col-md-3">
              <label className="small text-muted" style={{ fontSize: '0.75rem' }}>
                {bpkm.estado_codigo === 'PEND' ? 'Monto Sugerido (Auxiliar)' : 'Monto Aprobado (Auxiliar)'}
              </label>
              <div className="fw-bold" style={{ fontSize: '0.95rem', color: bpkm.estado_codigo === 'PEND' ? '#f59e0b' : '#28a745' }}>
                {bpkm.estado_codigo === 'PEND'
                  ? fmt(montoAuxiliarMostrado)
                  : fmt(bpkm.monto_aprobado_auxiliar || 0)
                }
              </div>
            </div>
            {!puedeAprobar && bpkm.usuario_gerencia_nombre && (
              <div className="col-12">
                <div className="alert alert-info mb-0 py-1 mt-1" style={{ fontSize: '0.85rem' }}>
                  <strong>Aprobado por:</strong> {bpkm.usuario_gerencia_nombre} el{' '}
                  {formatDateTimeGT(bpkm.fecha_aprobacion) || '-'}
                  {bpkm.observaciones_gerencia && (
                    <span> | <strong>Observaciones:</strong> {bpkm.observaciones_gerencia}</span>
                  )}
                </div>
              </div>
            )}
          </div>
        </Card>

        {/* Facturas de la Ruta */}
        <Card className="border-0 shadow-sm mb-1" style={{ padding: '0.5rem' }}>
          <h6 className="mb-1" style={{ fontSize: '0.95rem', fontWeight: '600' }}>Facturas de la Ruta</h6>
          <DataTable
            value={facturas}
            size="small"
            stripedRows
            emptyMessage="No hay facturas en esta ruta"
            style={{ fontSize: '0.85rem' }}
            rowClassName={() => 'py-0'}
          >
            <Column field="folio_factura" header="Folio" sortable style={{ width: '140px' }} />
            <Column
              header="Total Factura"
              body={(row) => fmt(row.total_factura)}
              style={{ width: '130px', textAlign: 'right' }}
            />
            <Column header="Estado" body={estadoBody} style={{ width: '130px' }} />
            <Column
              header="Intentos Envío"
              field="intentos_envio"
              body={(row) => {
                const n = row.intentos_envio || 1;
                const severity = n >= 3 ? 'danger' : n === 2 ? 'warning' : 'success';
                return (
                  <div className="text-center">
                    <Tag value={`#${n}`} severity={severity} />
                  </div>
                );
              }}
              style={{ width: '120px', textAlign: 'center' }}
            />
            <Column
              header="Intento Actual"
              field="intento_numero"
              body={(row) => (
                <div className="text-center">
                  <span className="badge bg-secondary">Intento {row.intento_numero || 1}</span>
                </div>
              )}
              style={{ width: '120px', textAlign: 'center' }}
            />
            <Column
              field="direccion_completa"
              header="Dirección Completa"
              style={{ minWidth: '300px' }}
              body={(row) => (
                <div className="small">
                  {row.direccion_completa || row.direccion_snap || row.dir_complemento || 'Sin dirección'}
                </div>
              )}
            />
            <Column
              header="Comentario Rutero"
              field="comentario_rutero"
              style={{ minWidth: '200px' }}
              body={(row) => {
                if (!row.comentario_rutero) return <span className="text-muted small">-</span>;
                return (
                  <div className="small" style={{
                    maxWidth: '200px',
                    whiteSpace: 'normal',
                    lineHeight: '1.3'
                  }}>
                    {row.comentario_rutero}
                  </div>
                );
              }}
            />
            <Column header="Acciones" body={accionesBody} style={{ width: '100px' }} />
          </DataTable>
        </Card>

        {/* Tabs: Monitoreo e Historial */}
        <Card className="border-0 shadow-sm mb-1" style={{ padding: '0.5rem' }}>
          <TabView>
            <TabPanel header="Monitoreo">
              <div className="row g-1">
                <div className="col-md-5">
                  <label className="small text-muted" style={{ fontSize: '0.75rem' }}>Ruta Cumplida</label>
                  <div className="fw-semibold" style={{ fontSize: '0.9rem' }}>
                    {cumplimiento === null ? (
                      <span className="text-muted">Sin registros de monitoreo</span>
                    ) : cumplimiento.cumplida ? (
                      <div className="d-flex align-items-center gap-2">
                        <Tag value="CUMPLIDA" severity="success" icon="pi pi-check" />
                        <small className="text-muted" style={{ fontSize: '0.75rem' }}>
                          (Diferencia Salida: {cumplimiento.diffSalida}m, Diferencia Entrada: {cumplimiento.diffEntrada}m)
                        </small>
                      </div>
                    ) : (
                      <div className="d-flex align-items-center gap-2">
                        <Tag value="No Cumplida" severity="danger" icon="pi pi-times" />
                        <small className="text-muted" style={{ fontSize: '0.75rem' }}>
                          (Diferencia Salida: {cumplimiento.diffSalida}m, Diferencia Entrada: {cumplimiento.diffEntrada}m)
                        </small>
                      </div>
                    )}
                  </div>
                </div>
              </div>
              <br></br>
              <div className="row g-1">
                {/* SALIDA */}
                <div className="col-md-6">
                  <div className="p-2 rounded bg-light bpkm-panel-monitoreo border-start border-primary border-4">
                    <div className="d-flex justify-content-between align-items-center mb-1">
                      <Tag value="SALIDA" severity="info" />
                    </div>
                    <div className="small mb-1">
                      <strong style={{ fontSize: '0.75rem' }}>Planificada:</strong>{' '}
                      <span style={{ fontSize: '0.85rem' }}>
                        {formatDateTimeGT(bpkm.fecha_salida_plan) || '-'}
                      </span>
                    </div>
                    {monitoreo.find(m => m.str_tipo === 'S') ? (
                      <>
                        <div className="small mb-1">
                          <strong style={{ fontSize: '0.75rem' }}>Monitoreo:</strong>{' '}
                          <span style={{ fontSize: '0.85rem' }}>
                            {formatDateTimeGT(monitoreo.find(m => m.str_tipo === 'S')?.ts_fecha_hora) || '-'}
                          </span>
                        </div>
                        {monitoreo.find(m => m.str_tipo === 'S').str_comentario && (
                          <div className="small mt-1">
                            <strong style={{ fontSize: '0.75rem' }}>Comentario:</strong>{' '}
                            <span style={{ fontSize: '0.85rem' }}>{monitoreo.find(m => m.str_tipo === 'S').str_comentario}</span>
                          </div>
                        )}
                      </>
                    ) : (
                      <div className="small text-muted" style={{ fontSize: '0.85rem' }}>Sin registro de monitoreo</div>
                    )}
                  </div>
                </div>

                {/* ENTRADA */}
                <div className="col-md-6">
                  <div className="p-2 rounded bg-light bpkm-panel-monitoreo border-start border-success border-4">
                    <div className="d-flex justify-content-between align-items-center mb-1">
                      <Tag value="ENTRADA" severity="success" />
                    </div>
                    <div className="small mb-1">
                      <strong style={{ fontSize: '0.75rem' }}>Planificada:</strong>{' '}
                      <span style={{ fontSize: '0.85rem' }}>
                        {formatDateTimeGT(bpkm.fecha_entrada_plan) || '-'}
                      </span>
                    </div>
                    {monitoreo.find(m => m.str_tipo === 'E') ? (
                      <>
                        <div className="small mb-1">
                          <strong style={{ fontSize: '0.75rem' }}>Monitoreo:</strong>{' '}
                          <span style={{ fontSize: '0.85rem' }}>
                            {formatDateTimeGT(monitoreo.find(m => m.str_tipo === 'E')?.ts_fecha_hora) || '-'}
                          </span>
                        </div>
                        {monitoreo.find(m => m.str_tipo === 'E').str_comentario && (
                          <div className="small mt-1">
                            <strong style={{ fontSize: '0.75rem' }}>Comentario:</strong>{' '}
                            <span style={{ fontSize: '0.85rem' }}>{monitoreo.find(m => m.str_tipo === 'E').str_comentario}</span>
                          </div>
                        )}
                      </>
                    ) : (
                      <div className="small text-muted" style={{ fontSize: '0.85rem' }}>Sin registro de monitoreo</div>
                    )}
                  </div>
                </div>
              </div>
            </TabPanel>

            <TabPanel header={`Destinos (${destinos.length})`}>
              <div style={{ maxWidth: '1050px' }}>
                <DataTable
                  value={destinosOrdenados}
                  rowGroupMode="subheader"
                  groupRowsBy="departamento"
                  sortField="departamento"
                  sortOrder={1}
                  stripedRows
                  size="small"
                  emptyMessage="No hay destinos registrados para esta ruta"
                  style={{ fontSize: '0.85rem' }}
                  rowClassName={() => 'py-0'}
                  rowGroupHeaderTemplate={rowGroupHeaderTemplate}
                  footerColumnGroup={destinos.length > 0 ? footerGroupDestinos : null}
                >
                  <Column field="departamento" header="Departamento" style={{ width: '28%' }} />
                  <Column field="municipio" header="Municipio" style={{ width: '32%' }} />
                  <Column
                    field="total_facturas"
                    header="Total Facturas"
                    style={{ width: '18%', textAlign: 'center' }}
                    body={(row) => (
                      <div className="text-center">
                        <span className="badge bg-secondary">{row.total_facturas}</span>
                      </div>
                    )}
                  />
                  <Column
                    field="monto"
                    header="Monto"
                    style={{ width: '22%', textAlign: 'right' }}
                    body={(row) => (
                      <div className="text-end fw-semibold text-primary">
                        {fmt(row.monto)}
                      </div>
                    )}
                  />
                </DataTable>
              </div>
            </TabPanel>

            <TabPanel header="Historial">
              {bitacora.length > 0 ? (
                <DataTable value={bitacora} stripedRows size="small" style={{ fontSize: '0.85rem' }}>
                  <Column
                    field="fecha_creacion"
                    header="Fecha"
                    body={(row) => formatDateTimeGT(row.fecha_creacion) || '-'}
                    style={{ minWidth: '200px' }}
                  />
                  <Column
                    field="accion"
                    header="Acción"
                    body={(row) => getNombreAccion(row.accion)}
                    style={{ minWidth: '120px' }}
                  />
                  <Column field="detalle" header="Detalle" style={{ minWidth: '200px' }} />
                  <Column field="nombre_creador" header="Usuario" style={{ minWidth: '150px' }} />
                </DataTable>
              ) : (
                <div className="text-muted small">No hay eventos en el historial</div>
              )}
            </TabPanel>

            <TabPanel header={`Comentarios (${comentarios.length})`}>
              {comentarios.length > 0 ? (
                <div className="d-flex flex-column gap-2">
                  {comentarios.map((com) => (
                    <div
                      key={com.id_comentario}
                      className="p-2 border rounded bpkm-panel-comentario"
                      style={{ backgroundColor: '#f8f9fa' }}
                    >
                      <div className="d-flex justify-content-between align-items-start mb-1">
                        <span className="fw-semibold" style={{ fontSize: '0.85rem' }}>
                          {com.nombre_usuario}
                        </span>
                        <span className="text-muted" style={{ fontSize: '0.75rem' }}>
                          {formatDateTimeGT(com.fecha_creacion)}
                        </span>
                      </div>
                      <div style={{ fontSize: '0.85rem', color: '#495057' }}>
                        {com.comentario}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-muted small text-center py-4">
                  <i className="pi pi-comments" style={{ fontSize: '2rem', opacity: 0.3 }}></i>
                  <div className="mt-2">No hay comentarios aún</div>
                </div>
              )}
            </TabPanel>
          </TabView>
        </Card>

        {/* Sidebar Historial de Factura */}
        <SidebarHistorialEntrega
          visible={bitacoraVisible}
          onHide={() => {
            setBitacoraVisible(false);
            setFacturaSeleccionada(null);
          }}
          factura={facturaSeleccionada}
          idFacturaSel={facturaSeleccionada?.id_factura_sel}
          folio={facturaSeleccionada?.folio_factura}
          formaEntrega={facturaSeleccionada?.forma_nombre || facturaSeleccionada?.forma_entrega}
          destino={facturaSeleccionada?.direccion_completa || facturaSeleccionada?.destino}
          estado={facturaSeleccionada?.estado_liquidacion || facturaSeleccionada?.estado_codigo}
          title="Historial de factura"
        />

        {/* Diálogo Detalle Factura */}
        <FacturaDetalleDialog
          visible={facturaDetalleVisible}
          onHide={() => setFacturaDetalleVisible(false)}
          id_factura={facturaSeleccionada?.id_factura}
          folio={facturaSeleccionada?.folio_factura}
        />

        {/* Diálogo Revisar y Aprobar Montos */}
        <Dialog
          header="Revisar y Aprobar BPKM"
          visible={montosDialogVisible}
          onHide={() => setMontosDialogVisible(false)}
          style={{ width: '700px' }}
          footer={
            <div className="d-flex justify-content-end gap-2">
              <Button
                label="Cancelar"
                icon="pi pi-times"
                outlined
                size="small"
                onClick={() => setMontosDialogVisible(false)}
              />
              <Button
                label="Aprobar"
                icon="pi pi-check"
                severity="success"
                size="small"
                onClick={handleAprobar}
                loading={guardando}
                disabled={guardandoDistanciaDialog || distanciaDialogEditando}
              />
            </div>
          }
        >
          <div className="row g-2">
            <div className="col-12">
              <div className="p-2 rounded mb-1">
                <label className="small text-muted d-block mb-1" style={{ fontSize: '0.85rem' }}>
                  <strong>Distancia (km) - confirme para guardar y recalcular montos</strong>
                </label>
                {distanciaDialogEditando ? (
                  <div className="d-flex align-items-center gap-1 flex-wrap">
                    <InputNumber
                      value={distanciaDialogDraft}
                      onValueChange={(e) => setDistanciaDialogDraft(e.value ?? 0)}
                      min={0}
                      maxFractionDigits={2}
                      locale="en-US"
                      suffix=" km"
                      style={{ width: '8.5rem' }}
                    />
                    <Button
                      icon="pi pi-check"
                      rounded
                      text
                      severity="success"
                      size="small"
                      tooltip="Guardar distancia"
                      tooltipOptions={{ position: 'top' }}
                      onClick={handleGuardarDistanciaDialog}
                      loading={guardandoDistanciaDialog}
                      disabled={guardandoDistanciaDialog}
                    />
                    <Button
                      icon="pi pi-times"
                      rounded
                      text
                      severity="secondary"
                      size="small"
                      tooltip="Cancelar"
                      tooltipOptions={{ position: 'top' }}
                      onClick={handleCancelarEdicionDistanciaDialog}
                      disabled={guardandoDistanciaDialog}
                    />
                    <small className="text-muted text-nowrap" style={{ fontSize: '0.78rem' }}>
                      Original: {Number(bpkm?.distancia_mas_lejana || 0).toFixed(1)} km
                    </small>
                  </div>
                ) : (
                  <div className="d-flex align-items-center gap-1 flex-wrap">
                    <div className="fw-semibold" style={{ fontSize: '0.95rem' }}>
                      {`${Number(distanciaInput || 0).toFixed(1)} km`}
                    </div>
                    <Button
                      icon="pi pi-pencil"
                      rounded
                      text
                      size="small"
                      tooltip="Editar distancia"
                      tooltipOptions={{ position: 'top' }}
                      onClick={handleIniciarEdicionDistanciaDialog}
                      disabled={guardandoDistanciaDialog}
                    />
                    <small className="text-muted text-nowrap" style={{ fontSize: '0.78rem' }}>
                      Original: {Number(bpkm?.distancia_mas_lejana || 0).toFixed(1)} km
                    </small>
                  </div>
                )}
              </div>
            </div>
            <div className="col-md-6">
              <label className="small text-muted d-block mb-1" style={{ fontSize: '0.85rem' }}>
                Monto Piloto <span className="text-danger">*</span>
              </label>
              <InputNumber
                value={montoAprobadoPiloto}
                onValueChange={(e) => setMontoAprobadoPiloto(e.value)}
                mode="currency"
                currency="GTQ"
                locale="es-GT"
                className="w-100"
              />
            </div>
            <div className="col-md-6">
              <label className="small text-muted d-block mb-1" style={{ fontSize: '0.85rem' }}>
                Monto Auxiliar <span className="text-danger">*</span>
              </label>
              <InputNumber
                value={montoAprobadoAuxiliar}
                onValueChange={(e) => setMontoAprobadoAuxiliar(e.value)}
                mode="currency"
                currency="GTQ"
                locale="es-GT"
                className="w-100"
              />
            </div>
            <div className="col-12">
              <label className="small text-muted d-block mb-1" style={{ fontSize: '0.85rem' }}>
                Observaciones de Gerencia
              </label>
              <InputTextarea
                value={observaciones}
                onChange={(e) => setObservaciones(e.target.value)}
                rows={3}
                className="w-100"
                placeholder="Escriba las observaciones...."
              />
            </div>
          </div>
        </Dialog>
        <MapaRutaDialog
          visible={mapaDialogVisible}
          onHide={() => setMapaDialogVisible(false)}
          mapa={bpkm?.mapa}
          codigoRuta={bpkm?.codigo_ruta}
          tipoRuta={bpkm?.tipo_ruta}
          piloto={bpkm?.nombre_piloto}
          placa={bpkm?.placa_camion}
        />
      </div>
    </Layout>
  );
}
