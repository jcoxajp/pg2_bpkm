import { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import Layout from '@ui/Layout';
import SidebarHistorialEntrega from '@ui/Evidencias-Facturas/SidebarHistorialEntrega';
import FacturaDetalleDialog from './components/FacturaDetalleDialog';
import { GoogleMapsMapPinIcon, MapaRutaDialog } from '@ui/GoogleMaps';
import { Toast } from 'primereact/toast';
import { Card } from 'primereact/card';
import { Button } from 'primereact/button';
import { DataTable } from 'primereact/datatable';
import { Column } from 'primereact/column';
import { ColumnGroup } from 'primereact/columngroup';
import { Row } from 'primereact/row';
import { TabView, TabPanel } from 'primereact/tabview';
import { Tag } from 'primereact/tag';
import { formatDateTimeGT } from '@utils/dateSafe';
import { getApiErrorMessage } from '@utils/apiError';
import { getDetallesPorRutaGerencia, getMonitoreoPorRuta } from '@services/bpkm/bpkmGerencia';
import { getComentariosRuta, getRutaLocalDetalle, getRutaDestinos } from '@services/bpkm/bpkmRutas';
import '../../../styles/bpkm.css';

const estadoFacturaSeverity = (estado) => {
  const code = String(estado || '').toUpperCase();
  if (code === 'ENTREGADA') return 'success';
  if (code === 'PARCIAL') return 'warning';
  if (code === 'FALLIDA') return 'danger';
  if (code === 'ANULADO' || code === 'ANULADA' || code === 'ANUL') return 'danger';
  return 'info';
};

const estadoRutaSeverity = (estado) => {
  const code = String(estado || '').toUpperCase();
  if (code === 'EN_CURSO' || code === 'EN CURSO') return 'warning';
  if (code === 'FINALIZADA' || code === 'FINALIZADO') return 'success';
  if (code === 'CANCELADA' || code === 'CANCELADO') return 'danger';
  if (code === 'ANULADO' || code === 'ANULADA' || code === 'ANUL') return 'danger';
  return 'info';
};

export default function RutasLocalesDetalle() {
  const { id_ruta } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const toastRef = useRef(null);
  const show = (severity, summary, detail) =>
    toastRef.current?.show({ severity, summary, detail, life: 3000 });

  const [ruta, setRuta] = useState(location.state?.row || null);
  const [facturas, setFacturas] = useState([]);
  const [monitoreo, setMonitoreo] = useState([]);
  const [comentarios, setComentarios] = useState([]);
  const [destinos, setDestinos] = useState([]);
  const [loading, setLoading] = useState(false);

  const [bitacoraVisible, setBitacoraVisible] = useState(false);
  const [facturaDetalleVisible, setFacturaDetalleVisible] = useState(false);
  const [facturaSeleccionada, setFacturaSeleccionada] = useState(null);
  const [mapaDialogVisible, setMapaDialogVisible] = useState(false);

  const rutaId = useMemo(() => Number(id_ruta || 0), [id_ruta]);

  const isRutaCorta = useMemo(() => {
    if (!ruta) return false;
    const tipo = String(ruta.tipo_ruta || '').toUpperCase();
    if (tipo === 'RC' || tipo === 'RUTA CORTA') return true;
    if (tipo === 'TE' || tipo === 'TRANSPORTE EXTERNO') return false;
    if (String(ruta.numero_ruta || '').toUpperCase().includes('RC')) return true;
    return tipo !== 'TE';
  }, [ruta]);

  const normalizeRuta = (data) => {
    if (!data) return null;
    if (Array.isArray(data)) return data[0] || null;
    if (Array.isArray(data?.items)) return data.items[0] || null;
    return data;
  };

  async function cargarDatos() {
    if (!rutaId) return;
    setLoading(true);
    try {
      const [rutaData, facturasData, monitoreoData, comentariosData] = await Promise.all([
        getRutaLocalDetalle(rutaId),
        getDetallesPorRutaGerencia({ id_ruta: rutaId }),
        getMonitoreoPorRuta({ id_ruta: rutaId }),
        getComentariosRuta({ id_ruta: rutaId })
      ]);

      const rutaNormalizada = normalizeRuta(rutaData);
      let rutaObj = rutaNormalizada || ruta;
      if (rutaNormalizada) {
        setRuta(rutaNormalizada);
      }

      const facturasArr = Array.isArray(facturasData) ? facturasData : [];
      setFacturas(facturasArr);
      setMonitoreo(Array.isArray(monitoreoData) ? monitoreoData : []);
      setComentarios(Array.isArray(comentariosData) ? comentariosData : []);

      if (!rutaNormalizada && !ruta && facturasArr.length > 0) {
        const first = facturasArr[0];
        rutaObj = {
          numero_ruta: first.numero_ruta,
          tipo_ruta: first.tipo_ruta,
          estado_nombre: first.estado_ruta || first.estado_nombre || first.estado_codigo,
          nombre_piloto: first.nombre_piloto,
          nombre_auxiliar: first.nombre_auxiliar,
          placa_camion: first.placa_camion,
          sucursal_salida: first.sucursal_salida,
          fecha_salida_plan: first.fecha_salida_plan,
          fecha_entrada_plan: first.fecha_entrada_plan
        };
        setRuta(rutaObj);
      }

      // Solo consumir el endpoint de destinos si es ruta corta
      const tipo = String(rutaObj?.tipo_ruta || '').toUpperCase();
      const numRuta = String(rutaObj?.numero_ruta || '').toUpperCase();
      const esCorta = tipo === 'RC' || tipo === 'RUTA CORTA' || numRuta.includes('RC') || (tipo !== 'TE' && tipo !== 'TRANSPORTE EXTERNO' && tipo !== '');

      if (esCorta) {
        try {
          const destinosData = await getRutaDestinos(rutaId);
          setDestinos(Array.isArray(destinosData) ? destinosData : []);
        } catch (errDest) {
          console.error('Error al obtener destinos:', errDest);
          setDestinos([]);
        }
      } else {
        setDestinos([]);
      }
    } catch (e) {
      console.error(e);
      show('error', 'Error', getApiErrorMessage(e, 'No se pudo cargar el detalle de la ruta'));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    cargarDatos();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rutaId]);

  const fmt = (num) => {
    const n = Number(num || 0);
    return 'Q' + n.toLocaleString('es-GT', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

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
    if (!monitoreo || monitoreo.length < 2) return null;

    const salidaReal = monitoreo.find((m) => m.str_tipo === 'S')?.ts_fecha_hora;
    const entradaReal = monitoreo.find((m) => m.str_tipo === 'E')?.ts_fecha_hora;
    const planSalida = ruta?.fecha_salida_plan || ruta?.fecha_salida;
    const planEntrada = ruta?.fecha_entrada_plan || ruta?.fecha_entrada;

    if (!salidaReal || !entradaReal || !planSalida || !planEntrada) return null;

    const diffSalida = Math.abs((new Date(salidaReal) - new Date(planSalida)) / 60000);
    const diffEntrada = Math.abs((new Date(entradaReal) - new Date(planEntrada)) / 60000);

    return {
      cumplida: diffSalida <= 15,
      diffSalida: Math.round(diffSalida),
      diffEntrada: Math.round(diffEntrada)
    };
  }, [monitoreo, ruta]);

  const tieneFacturasConUbicacion = useMemo(() => {
    const lista = ruta?.mapa?.puntos?.length ? ruta.mapa.puntos : facturas;
    return Array.isArray(lista) && lista.some((p) => p.latitud != null && p.longitud != null);
  }, [ruta?.mapa?.puntos, facturas]);

  const botonMapaDeshabilitado =
    ruta?.mapa?.mapa_habilitado === false || !tieneFacturasConUbicacion;

  if (loading && !ruta) {
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

  return (
    <Layout>
      <Toast ref={toastRef} />

      <div className="container-fluid py-0">
        <Card className="border-0 shadow-sm mb-1" style={{ padding: '0.5rem' }}>
          <div className="d-flex justify-content-between align-items-start mb-1">
            <div className="d-flex align-items-center gap-3">
              <h6 className="mb-0">
                Ruta Corta {ruta?.numero_ruta ? `- ${ruta.numero_ruta}` : `#${rutaId || '-'}`}
              </h6>
              {ruta?.estado_nombre && (
                <Tag value={ruta.estado_nombre} severity={estadoRutaSeverity(ruta.estado_nombre || ruta?.estado_codigo)} />
              )}
            </div>
            <div className="d-flex gap-2">
              <Button
                type="button"
                text
                className="p-1"
                onClick={() => setMapaDialogVisible(true)}
                disabled={botonMapaDeshabilitado}
                tooltip={
                  ruta?.mapa?.mapa_habilitado === false
                    ? 'Mapa no disponible'
                    : !tieneFacturasConUbicacion
                      ? 'Sin datos suficientes'
                      : 'Ver en Google Maps'
                }
                tooltipOptions={{ position: 'bottom', showOnDisabled: true }}
              >
                <GoogleMapsMapPinIcon size={35} />
              </Button>
              <Button
                label="Volver"
                icon="pi pi-arrow-left"
                size="small"
                outlined
                onClick={() => navigate('/Rutas-Locales')}
              />
            </div>
          </div>

          <div className="row g-1">
            <div className="col-md-3">
              <label className="small text-muted" style={{ fontSize: '0.75rem' }}>Sucursal salida</label>
              <div className="fw-semibold" style={{ fontSize: '0.9rem' }}>{ruta?.sucursal_salida || '-'}</div>
            </div>
            <div className="col-md-3">
              <label className="small text-muted" style={{ fontSize: '0.75rem' }}>Placa camion</label>
              <div className="fw-semibold" style={{ fontSize: '0.9rem' }}>{ruta?.placa_camion || '-'}</div>
            </div>
            <div className="col-md-3">
              <label className="small text-muted" style={{ fontSize: '0.75rem' }}>Piloto</label>
              <div className="fw-semibold" style={{ fontSize: '0.9rem' }}>{ruta?.nombre_piloto || '-'}</div>
            </div>
            <div className="col-md-3">
              <label className="small text-muted" style={{ fontSize: '0.75rem' }}>Auxiliar</label>
              <div className="fw-semibold" style={{ fontSize: '0.9rem' }}>{ruta?.nombre_auxiliar || '-'}</div>
            </div>
            <div className="col-md-3">
              <label className="small text-muted" style={{ fontSize: '0.75rem' }}>Fecha salida</label>
              <div className="fw-semibold" style={{ fontSize: '0.9rem' }}>
                {formatDateTimeGT(ruta?.fecha_salida_plan || ruta?.fecha_salida) || '-'}
              </div>
            </div>
            <div className="col-md-3">
              <label className="small text-muted" style={{ fontSize: '0.75rem' }}>Fecha entrada</label>
              <div className="fw-semibold" style={{ fontSize: '0.9rem' }}>
                {formatDateTimeGT(ruta?.fecha_entrada_plan || ruta?.fecha_entrada) || '-'}
              </div>
            </div>
            <div className="col-md-3">
              <label className="small text-muted" style={{ fontSize: '0.75rem' }}>Distancia mas lejana</label>
              <div className="fw-semibold" style={{ fontSize: '0.9rem' }}>
                {ruta?.distancia_calculada != null
                  ? `${Number(ruta.distancia_calculada).toFixed(1)} km`
                  : '-'}
              </div>
            </div>
            <div className="col-md-3">
              <label className="small text-muted" style={{ fontSize: '0.75rem' }}>Municipio lejano</label>
              <div className="fw-semibold" style={{ fontSize: '0.9rem' }}>{ruta?.municipio_lejano || '-'}</div>
            </div>
            <div className="col-md-3">
              <label className="small text-muted" style={{ fontSize: '0.75rem' }}>Total facturas</label>
              <div className="fw-semibold" style={{ fontSize: '0.9rem' }}>{Number(ruta?.total_facturas || 0)}</div>
            </div>
            <div className="col-md-3">
              <label className="small text-muted" style={{ fontSize: '0.75rem' }}>Monto transportado</label>
              <div className="fw-bold text-primary" style={{ fontSize: '0.95rem' }}>
                {fmt(ruta?.monto_total_transportado || 0)}
              </div>
            </div>
            {ruta?.tipo_ruta === 'TE' && (
              <div className="col-md-3">
                <label className="small text-muted" style={{ fontSize: '0.75rem' }}>Transporte externo</label>
                <div className="fw-semibold" style={{ fontSize: '0.9rem' }}>
                  {ruta?.nombre_transporte_externo || '-'}
                </div>
              </div>
            )}
          </div>
        </Card>

        <Card className="border-0 shadow-sm mb-1" style={{ padding: '0.5rem' }}>
          <h6 className="mb-1" style={{ fontSize: '0.95rem', fontWeight: 600 }}>Facturas de la Ruta</h6>
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
            <Column
              header="Estado"
              body={(row) => (
                <Tag value={row.estado_liquidacion || row.estado_codigo || '-'} severity={estadoFacturaSeverity(row.estado_codigo)} />
              )}
              style={{ width: '130px' }}
            />
            <Column
              header="Intentos Envio"
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
              header="Direccion Completa"
              field="direccion_completa"
              body={(row) => {
                const isTE = String(row.forma_entrega || '').toLowerCase() === 'transporte externo';
                const transporte = isTE ? String(row.nombre_transporte_externo || '').trim() : '';
                const direccion = row.direccion_completa || row.direccion_snap || row.dir_complemento || 'Sin direccion';
                return (
                  <div className="small">
                    {transporte && (
                      <div>{transporte}</div>
                    )}
                    <div>{direccion}</div>
                  </div>
                );
              }}
              style={{ minWidth: '300px' }}
            />
            <Column
              header="Comentario Rutero"
              field="comentario_rutero"
              body={(row) => (
                row.comentario_rutero ? (
                  <div
                    className="small"
                    style={{ maxWidth: '200px', whiteSpace: 'normal', lineHeight: '1.3' }}
                  >
                    {row.comentario_rutero}
                  </div>
                ) : (
                  <span className="text-muted small">-</span>
                )
              )}
              style={{ minWidth: '220px' }}
            />
            <Column
              header="Acciones"
              body={accionesBody}
              style={{ width: '100px' }}
            />
          </DataTable>
        </Card>

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

        <FacturaDetalleDialog
          visible={facturaDetalleVisible}
          onHide={() => setFacturaDetalleVisible(false)}
          id_factura={facturaSeleccionada?.id_factura}
          folio={facturaSeleccionada?.folio_factura}
        />

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
                          (Dif. salida: {cumplimiento.diffSalida}m, dif. entrada: {cumplimiento.diffEntrada}m)
                        </small>
                      </div>
                    ) : (
                      <div className="d-flex align-items-center gap-2">
                        <Tag value="No Cumplida" severity="danger" icon="pi pi-times" />
                        <small className="text-muted" style={{ fontSize: '0.75rem' }}>
                          (Dif. salida: {cumplimiento.diffSalida}m, dif. entrada: {cumplimiento.diffEntrada}m)
                        </small>
                      </div>
                    )}
                  </div>
                </div>
              </div>
              <br />
              <div className="row g-1">
                <div className="col-md-6">
                  <div className="p-2 rounded bg-light bpkm-panel-monitoreo border-start border-primary border-4">
                    <div className="d-flex justify-content-between align-items-center mb-1">
                      <Tag value="SALIDA" severity="info" />
                    </div>
                    <div className="small mb-1">
                      <strong style={{ fontSize: '0.75rem' }}>Planificada:</strong>{' '}
                      <span style={{ fontSize: '0.85rem' }}>
                        {formatDateTimeGT(ruta?.fecha_salida_plan || ruta?.fecha_salida) || '-'}
                      </span>
                    </div>
                    {monitoreo.find((m) => m.str_tipo === 'S') ? (
                      <>
                        <div className="small mb-1">
                          <strong style={{ fontSize: '0.75rem' }}>Monitoreo:</strong>{' '}
                          <span style={{ fontSize: '0.85rem' }}>
                            {formatDateTimeGT(monitoreo.find((m) => m.str_tipo === 'S')?.ts_fecha_hora) || '-'}
                          </span>
                        </div>
                        {monitoreo.find((m) => m.str_tipo === 'S')?.str_comentario && (
                          <div className="small mt-1">
                            <strong style={{ fontSize: '0.75rem' }}>Comentario:</strong>{' '}
                            <span style={{ fontSize: '0.85rem' }}>
                              {monitoreo.find((m) => m.str_tipo === 'S')?.str_comentario}
                            </span>
                          </div>
                        )}
                      </>
                    ) : (
                      <div className="small text-muted" style={{ fontSize: '0.85rem' }}>Sin registro de monitoreo</div>
                    )}
                  </div>
                </div>

                <div className="col-md-6">
                  <div className="p-2 rounded bg-light bpkm-panel-monitoreo border-start border-success border-4">
                    <div className="d-flex justify-content-between align-items-center mb-1">
                      <Tag value="ENTRADA" severity="success" />
                    </div>
                    <div className="small mb-1">
                      <strong style={{ fontSize: '0.75rem' }}>Planificada:</strong>{' '}
                      <span style={{ fontSize: '0.85rem' }}>
                        {formatDateTimeGT(ruta?.fecha_entrada_plan || ruta?.fecha_entrada) || '-'}
                      </span>
                    </div>
                    {monitoreo.find((m) => m.str_tipo === 'E') ? (
                      <>
                        <div className="small mb-1">
                          <strong style={{ fontSize: '0.75rem' }}>Monitoreo:</strong>{' '}
                          <span style={{ fontSize: '0.85rem' }}>
                            {formatDateTimeGT(monitoreo.find((m) => m.str_tipo === 'E')?.ts_fecha_hora) || '-'}
                          </span>
                        </div>
                        {monitoreo.find((m) => m.str_tipo === 'E')?.str_comentario && (
                          <div className="small mt-1">
                            <strong style={{ fontSize: '0.75rem' }}>Comentario:</strong>{' '}
                            <span style={{ fontSize: '0.85rem' }}>
                              {monitoreo.find((m) => m.str_tipo === 'E')?.str_comentario}
                            </span>
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

            {isRutaCorta && (
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
            )}

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
                      <div style={{ fontSize: '0.85rem', color: '#8a949e' }}>
                        {com.comentario}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-muted small text-center py-4">
                  <i className="pi pi-comments" style={{ fontSize: '2rem', opacity: 0.3 }}></i>
                  <div className="mt-2">No hay comentarios aun</div>
                </div>
              )}
            </TabPanel>
          </TabView>
        </Card>
        <MapaRutaDialog
          visible={mapaDialogVisible}
          onHide={() => setMapaDialogVisible(false)}
          mapa={ruta?.mapa}
          codigoRuta={ruta?.numero_ruta}
          piloto={ruta?.nombre_piloto}
          placa={ruta?.placa_camion}
        />
      </div>
    </Layout>
  );
}
