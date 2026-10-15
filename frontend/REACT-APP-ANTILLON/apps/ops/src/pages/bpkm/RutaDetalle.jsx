// src/pages/bpkm/rutas/RutaDetalle.jsx
import { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useParams, useNavigate } from 'react-router-dom';
import Layout from '@ui/Layout';
import { Toast } from 'primereact/toast';
import { Card } from 'primereact/card';
import { Button } from 'primereact/button';
import { DataTable } from 'primereact/datatable';
import { Column } from 'primereact/column';
import { Tag } from 'primereact/tag';
import { Dialog } from 'primereact/dialog';
import { InputTextarea } from 'primereact/inputtextarea';
import { InputNumber } from 'primereact/inputnumber';
import { Dropdown } from 'primereact/dropdown';
import { ConfirmDialog, confirmDialog } from 'primereact/confirmdialog';
import { formatDateTimeGT } from '@utils/dateSafe';
import { getApiErrorMessage } from '@utils/apiError';

import {
  getRutaParaLiquidar,
  postLiquidarDetalleRuta,
  putRutaFinalizar,
  putRutaActualizarPersonal,
  getPersonal,
  postProductosEntregaParcial,
  getPermisosBPKM,
  postComentarioRuta,
  getComentariosRuta
} from '@services/bpkm/bpkmRutas';
import {
  postAgregarFacturaARuta,
  deleteFacturaDeRuta,
  getFacturasDisponibles,
  getRutaPDF,
  putRutaRecalcularMonto
} from '@services/bpkm/rutas';
import { generateRutaPdf } from '@utils/rutaPdf';
import { loadAssetAsDataURL } from '@utils/loadAssetAsDataURL';
import SidebarHistorialEntrega from '@ui/Evidencias-Facturas/SidebarHistorialEntrega';
import logoUrl from '@assets/img/Logo.png';
import axios from 'axios';

function tagSeverity(estado) {
  const s = String(estado || '').toUpperCase();
  if (s === 'CREADA') return 'info';
  if (s === 'EN_CURSO') return 'warning';
  if (s === 'REGRESADA') return 'success';
  if (s === 'FINALIZADA') return 'success';
  if (s === 'CANCELADA') return 'danger';
  if (s === 'ANULADO' || s === 'ANULADA' || s === 'ANUL') return 'danger';
  return 'secondary';
}

export default function RutaDetalle() {
  const { id } = useParams();
  const nav = useNavigate();
  const { state } = useLocation();
  const row = state?.row || null;

  const toastRef = useRef(null);
  const show = (severity, summary, detail) => 
    toastRef.current?.show({ severity, summary, detail, life: 3000 });
  const ok = (s, d) => show('success', s, d);
  const warn = (s, d) => show('warn', s, d);
  const err = (s, d) => show('error', s, d);

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
  const canEdit = need(perms, 'bpkm.rutas.edit', 'editor');
  const canLiquidar = need(perms, 'bpkm.rutas.liquidar', 'editor');
  const canComment = need(perms, 'bpkm.rutas.comentar', 'editor');

  const [detalles, setDetalles] = useState([]);
  const [loading, setLoading] = useState(false);
  const [liquidando, setLiquidando] = useState(false);
  const [logoDataUrl, setLogoDataUrl] = useState('');

  // Diálogo para Parcial/Fallido
  const [dlgOpen, setDlgOpen] = useState(false);
  const [dlgTipo, setDlgTipo] = useState(''); // 'PARCIAL' | 'FALLIDA'
  const [dlgRow, setDlgRow] = useState(null);
  const [dlgMotivoFallo, setDlgMotivoFallo] = useState('');
  const [dlgObservaciones, setDlgObservaciones] = useState('');
  const [dlgPuedeReenviar, setDlgPuedeReenviar] = useState(true);

  // Estados para productos de entrega parcial
  const [productosFactura, setProductosFactura] = useState([]);
  const [loadingProductos, setLoadingProductos] = useState(false);

  // Diálogo para editar piloto/auxiliar
  const [dlgPersonalOpen, setDlgPersonalOpen] = useState(false);
  const [pilotos, setPilotos] = useState([]);
  const [auxiliares, setAuxiliares] = useState([]);
  const [nuevoPiloto, setNuevoPiloto] = useState(null);
  const [nuevoAuxiliar, setNuevoAuxiliar] = useState(null);
  const [guardandoPersonal, setGuardandoPersonal] = useState(false);

  // Comentarios de ruta
  const [comentarios, setComentarios] = useState([]);
  const [nuevoComentario, setNuevoComentario] = useState('');
  const [guardandoComentario, setGuardandoComentario] = useState(false);
  const [loadingComentarios, setLoadingComentarios] = useState(false);

  // Modo de edición de facturas
  const [modoEdicion, setModoEdicion] = useState(false);
  const [facturasDisponibles, setFacturasDisponibles] = useState([]);
  const [loadingFacturasDisp, setLoadingFacturasDisp] = useState(false);
  const [busquedaFactura, setBusquedaFactura] = useState('');
  const [guardandoCambios, setGuardandoCambios] = useState(false);

  // Historial de entrega (Sidebar)
  const [historialVisible, setHistorialVisible] = useState(false);
  const [facturaSeleccionada, setFacturaSeleccionada] = useState(null);

  const abrirHistorial = (factura) => {
    setFacturaSeleccionada(factura);
    setHistorialVisible(true);
  };

  // Paleta de colores para departamentos (pendientes)
  const coloresDepartamento = [
    '#f8f9fa', // gris muy claro
    '#e3f2fd', // azul muy claro
    '#f3e5f5', // morado muy claro
    '#e8f5e9', // verde muy claro
    '#fff3e0', // naranja muy claro
    '#fce4ec', // rosa muy claro
    '#e0f2f1', // cyan muy claro
    '#f1f8e9', // lima muy claro
    '#fff9c4', // amarillo muy claro
    '#ffe0b2', // naranja claro
  ];

  // Obtener color por departamento (solo para pendientes)
  const getDepartamentoColor = (ciudad) => {
    if (!ciudad) return 'transparent';
    const departamentosUnicos = [...new Set(
      detalles
        .filter(d => d.estado_codigo === 'PEND')
        .map(d => d.ciudad)
        .filter(Boolean)
    )].sort();
    const index = departamentosUnicos.indexOf(ciudad);
    return index !== -1 ? coloresDepartamento[index % coloresDepartamento.length] : 'transparent';
  };

  // Determinar color de fila según estado o departamento
  const getRowClass = (rowData) => {
    const estado = String(rowData.estado_codigo || '').toUpperCase();

    if (estado === 'ENTREGADA') return 'bg-success-subtle';
    if (estado === 'PARCIAL') return 'bg-warning-subtle';
    if (estado === 'FALLIDA') return 'bg-danger-subtle';

    return '';
  };

  // Resumen de pendientes
  const resumen = useMemo(() => {
    const pendientes = detalles.filter(d =>
      String(d.estado_codigo || '').toUpperCase() === 'PEND'
    ).length;
    return { pendientes };
  }, [detalles]);

  // Ordenar detalles por cliente para agrupación
  const detallesOrdenados = useMemo(() => {
    return [...detalles].sort((a, b) => {
      const clienteA = (a.cliente || '').toLowerCase();
      const clienteB = (b.cliente || '').toLowerCase();
      return clienteA.localeCompare(clienteB);
    });
  }, [detalles]);

  // Cargar detalles
  async function cargar() {
    try {
      setLoading(true);
      const rows = await getRutaParaLiquidar({ id_ruta: Number(id) });
      setDetalles(Array.isArray(rows) ? rows : []);
    } catch (e) {
      console.error(e);
      err('Error', getApiErrorMessage(e, 'No se pudieron cargar los detalles de la ruta'));
    } finally {
      setLoading(false);
    }
  }

  // Cargar comentarios
  async function cargarComentarios() {
    try {
      setLoadingComentarios(true);
      const rows = await getComentariosRuta({ id_ruta: Number(id) });
      setComentarios(Array.isArray(rows) ? rows : []);
    } catch (e) {
      console.error(e);
      err('Error', getApiErrorMessage(e, 'No se pudieron cargar los comentarios'));
    } finally {
      setLoadingComentarios(false);
    }
  }

  // Agregar nuevo comentario
  async function agregarComentario() {
    if (!nuevoComentario.trim()) {
      warn('Validación', 'El comentario no puede estar vacío');
      return;
    }

    try {
      setGuardandoComentario(true);
      await postComentarioRuta({
        id_ruta: Number(id),
        comentario: nuevoComentario.trim(),
        usuario: usuarioId
      });
      ok('Comentario agregado', 'El comentario se agregó exitosamente');
      setNuevoComentario('');
      await cargarComentarios();
    } catch (e) {
      console.error(e);
      err('Error', getApiErrorMessage(e, 'Error al agregar comentario'));
    } finally {
      setGuardandoComentario(false);
    }
  }

  // Funciones para edición de facturas
  async function abrirModoEdicion() {
    setModoEdicion(true);
    await cargarFacturasDisponibles();
  }

  function cerrarModoEdicion() {
    setModoEdicion(false);
    setBusquedaFactura('');
    setFacturasDisponibles([]);
  }

  async function cargarFacturasDisponibles() {
    try {
      setLoadingFacturasDisp(true);
      const tipoRuta = detalles[0]?.tipo_ruta || '';
      const rows = await getFacturasDisponibles({
        buscar: busquedaFactura,
        limite: 50,
        offset: 0,
        id_sucursal: storeId,
        tipo_ruta: tipoRuta
      });
      setFacturasDisponibles(Array.isArray(rows) ? rows : []);
    } catch (e) {
      console.error(e);
      err('Error', getApiErrorMessage(e, 'No se pudieron cargar las facturas disponibles'));
    } finally {
      setLoadingFacturasDisp(false);
    }
  }

  async function agregarFacturaARuta(factura) {
    try {
      setGuardandoCambios(true);
      await postAgregarFacturaARuta({
        id_ruta: Number(id),
        id_factura_sel: factura.id_factura_sel,
        usuario: usuarioId
      });
      ok('Factura agregada', `Factura ${factura.folio_factura} agregada a la ruta`);
      await cargar();
      await cargarFacturasDisponibles();
    } catch (e) {
      console.error(e);
      err('Error', getApiErrorMessage(e, 'Error al agregar factura'));
    } finally {
      setGuardandoCambios(false);
    }
  }

  async function quitarFacturaDeRuta(detalle) {
    confirmDialog({
      message: `¿Está seguro de quitar la factura ${detalle.folio_factura} de esta ruta?`,
      header: 'Confirmar Eliminación',
      icon: 'pi pi-exclamation-triangle',
      acceptLabel: 'Sí, quitar',
      rejectLabel: 'Cancelar',
      acceptClassName: 'p-button-danger',
      accept: async () => {
        try {
          setGuardandoCambios(true);
          const result = await deleteFacturaDeRuta({
            id_detalle_ruta: detalle.id_detalle_ruta,
            usuario: usuarioId
          });
          if (result.ok) {
            ok('Factura eliminada', result.mensaje || 'Factura eliminada correctamente');
            await cargar();
            await cargarFacturasDisponibles();
          } else {
            err('Error', result.mensaje || 'No se pudo eliminar la factura');
          }
        } catch (e) {
          console.error(e);
          err('Error', getApiErrorMessage(e, 'Error al eliminar factura'));
        } finally {
          setGuardandoCambios(false);
        }
      }
    });
  }

  async function guardarCambiosYGenerarPDF() {
    try {
      setGuardandoCambios(true);

      await putRutaRecalcularMonto({
        id_ruta: Number(id),
        usuario: usuarioId
      });

      const dataPDF = await getRutaPDF({ id_ruta: Number(id) });
      if (dataPDF) {
        generateRutaPdf(dataPDF, {
          company: {
            nombre: 'Comercializadora Eléctrica Ferretera, S.A.',
            direccion: '6a. Av. 14-12 Zona 9, Guatemala, Guatemala.',
            telefono: '(502) 2326 0202',
            nit: 'NIT 116426055'
          },
          logoBase64: logoDataUrl || ''
        });
        ok('Cambios guardados', 'Los cambios se guardaron y el PDF se generó correctamente');
      }

      cerrarModoEdicion();
      await cargar();
    } catch (e) {
      console.error(e);
      err('Error', getApiErrorMessage(e, 'Error al guardar cambios'));
    } finally {
      setGuardandoCambios(false);
    }
  }

  useEffect(() => {
    cargar();
    cargarComentarios();
  }, [id]);

  useEffect(() => {
    (async () => {
      const data = await getPermisosBPKM(usuarioId);
      setPerms(Array.isArray(data) ? data : []);
    })();
  }, [usuarioId]);

  // Cargar logo
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const dataUrl = await loadAssetAsDataURL(logoUrl);
        if (alive) setLogoDataUrl(dataUrl);
      } catch (e) {
        console.error('Logo no disponible', e);
      }
    })();
    return () => { alive = false; };
  }, []);

  // Liquidar rápido (ENTREGADA)
  async function liquidarRapido(rowData) {
    setLiquidando(true);
    try {
      await postLiquidarDetalleRuta({
        id_detalle_ruta: rowData.id_detalle_ruta,
        estado_codigo: 'ENTREGADA',
        motivo_fallo: null,
        observaciones: null,
        fecha_hora_intento: new Date(),
        usuario: usuarioId
      });

      const folio = rowData.folio_factura || `Detalle #${rowData.id_detalle_ruta}`;
      ok('Liquidado', `Factura ${folio} marcada como Entregada`);
      await cargar();
    } catch (e) {
      console.error(e);
      err('Error', getApiErrorMessage(e, 'Error al liquidar'));
    } finally {
      setLiquidando(false);
    }
  }

  // Abrir diálogo para Parcial o Fallido
  async function abrirDialogo(rowData, tipo) {
    setDlgRow(rowData);
    setDlgTipo(tipo);
    setDlgMotivoFallo('');
    setDlgObservaciones('');
    setDlgPuedeReenviar(true);
    setProductosFactura([]);
    setDlgOpen(true);

    if (tipo === 'PARCIAL' && rowData?.id_factura) {
      setLoadingProductos(true);
      try {
        const { data } = await axios.post('/sap/bpkm/get_productos_factura', {
          id_factura: rowData.id_factura
        });

        if (Array.isArray(data) && data.length > 0) {
          const productosConEntrega = data.map(p => ({
            ...p,
            cantidad_entregada: p.cantidad || 0,
            monto_parcial: (p.cantidad || 0) * (p.precio || 0)
          }));
          setProductosFactura(productosConEntrega);
        } else {
          warn('Sin productos', 'No se encontraron productos para esta factura');
        }
      } catch (e) {
        console.error('Error cargando productos:', e);
        err('Error', getApiErrorMessage(e, 'No se pudieron cargar los productos de la factura'));
      } finally {
        setLoadingProductos(false);
      }
    }
  }

  // Guardar desde diálogo
  async function guardarDesdeDlg() {
    if (!dlgRow) return;

    if (dlgTipo === 'FALLIDA' && !dlgMotivoFallo.trim()) {
      warn('Validación', 'El motivo de fallo es obligatorio');
      return;
    }

    if (dlgTipo === 'PARCIAL' && productosFactura.length > 0) {
      const algunProductoEntregado = productosFactura.some(p => Number(p.cantidad_entregada || 0) > 0);
      if (!algunProductoEntregado) {
        warn('Validación', 'Debe indicar al menos un producto entregado con cantidad mayor a 0');
        return;
      }
    }

    setLiquidando(true);
    try {
      const result = await postLiquidarDetalleRuta({
        id_detalle_ruta: dlgRow.id_detalle_ruta,
        estado_codigo: dlgTipo,
        motivo_fallo: dlgTipo === 'FALLIDA' ? dlgMotivoFallo.trim() : null,
        observaciones: dlgTipo === 'PARCIAL' ? dlgObservaciones.trim() || null : null,
        puede_reenviar: dlgPuedeReenviar,
        fecha_hora_intento: new Date(),
        usuario: usuarioId
      });

      if (dlgTipo === 'PARCIAL' && productosFactura.length > 0) {
        const productosEntregados = productosFactura
          .filter(p => Number(p.cantidad_entregada || 0) > 0)
          .map(p => ({
            codigo_producto: p.codigo || '',
            nombre_producto: p.nombre || '',
            cantidad_pedida: Number(p.cantidad || 0),
            cantidad_entregada: Number(p.cantidad_entregada || 0),
            precio_unitario: Number(p.precio || 0),
            monto_parcial: Number(p.monto_parcial || 0)
          }));

        if (productosEntregados.length > 0 && result?.id_liquidacion) {
          try {
            await postProductosEntregaParcial({
              id_liquidacion: result.id_liquidacion,
              productos: productosEntregados,
              usuario: usuarioId
            });
          } catch (prodError) {
            console.error('Error guardando productos:', prodError);
          }
        }
      }

      const estadoTexto = dlgTipo === 'FALLIDA' ? 'Fallido' : 'Parcial';
      ok('Liquidado', `Factura ${dlgRow.folio_factura} marcada como ${estadoTexto}`);
      setDlgOpen(false);
      await cargar();
    } catch (e) {
      console.error(e);
      err('Error', getApiErrorMessage(e, 'Error al liquidar'));
    } finally {
      setLiquidando(false);
    }
  }

  // Finalizar ruta
  function finalizarRuta() {
    if (resumen.pendientes > 0) {
      warn('Validación', `No se puede finalizar: hay ${resumen.pendientes} factura(s) pendiente(s)`);
      return;
    }

    confirmDialog({
      header: 'Confirmación',
      message: '¿Finalizar esta ruta?',
      acceptLabel: 'Sí, Finalizar',
      rejectLabel: 'Cancelar',
      acceptClassName: 'p-button-success',
      accept: async () => {
        try {
          await putRutaFinalizar({ id_ruta: Number(id), usuario: usuarioId });
          ok('Finalizada', 'La ruta ha sido finalizada exitosamente');
          await cargar();
        } catch (e) {
          console.error(e);
          err('Error', getApiErrorMessage(e, 'Error al finalizar'));
        }
      }
    });
  }

  // Abrir diálogo para editar piloto/auxiliar
  async function abrirEdicionPersonal() {
    try {
      setGuardandoPersonal(true);
      const [pilotosData, auxiliaresData] = await Promise.all([
        getPersonal({ rol: 'PILOTO', estado: 1, id_sucursal: storeId }),
        getPersonal({ rol: 'AUXILIAR', estado: 1, id_sucursal: storeId })
      ]);
      setPilotos(pilotosData);
      setAuxiliares(auxiliaresData);

      // Buscar IDs actuales desde detalles
      const pilotoActual = detalles[0]?.id_piloto || null;
      const auxiliarActual = detalles[0]?.id_auxiliar || null;

      setNuevoPiloto(pilotoActual);
      setNuevoAuxiliar(auxiliarActual);
      setDlgPersonalOpen(true);
    } catch (e) {
      console.error(e);
      err('Error', getApiErrorMessage(e, 'No se pudo cargar el personal'));
    } finally {
      setGuardandoPersonal(false);
    }
  }

  // Guardar nuevo piloto/auxiliar
  async function guardarPersonal() {
    // Validar que al menos uno esté seleccionado
    if (!nuevoPiloto && !nuevoAuxiliar) {
      warn('Validación', 'Debe seleccionar al menos un piloto o auxiliar');
      return;
    }

    // Validar que no sea la misma persona
    if (nuevoPiloto && nuevoAuxiliar && nuevoPiloto === nuevoAuxiliar) {
      warn('Validación', 'El piloto y el auxiliar no pueden ser la misma persona');
      return;
    }

    setGuardandoPersonal(true);
    try {
      await putRutaActualizarPersonal({
        id_ruta: Number(id),
        id_piloto: nuevoPiloto || null,
        id_auxiliar: nuevoAuxiliar || null,
        usuario: usuarioId
      });
      ok('Actualizado', 'Personal actualizado correctamente');
      setDlgPersonalOpen(false);
      await cargar();
    } catch (e) {
      console.error(e);
      err('Error', getApiErrorMessage(e, 'Error al actualizar'));
    } finally {
      setGuardandoPersonal(false);
    }
  }

  // Info de ruta desde detalles (actualizada) o desde row (inicial)
  const estadoRutaCodigo = detalles[0]?.estado_ruta_codigo || row?.estado_codigo || '';
  const estadoRutaNombre = detalles[0]?.estado_ruta_nombre || row?.estado_nombre || '';

  const codigoRuta = row?.codigo_ruta || row?.str_codigo_ruta || `Ruta ${id}`;
  const camion = row?.camion || row?.str_placa_camion || '';
  const piloto = row?.piloto || row?.str_nombre_piloto || '';
  const auxiliar = row?.auxiliar || row?.str_nombre_auxiliar || '';
  const fechaSalida = row?.fecha_salida_plan || row?.ts_salida_plan || '';

  const tipoRuta = String(
    detalles.find((d) => d.tipo_ruta)?.tipo_ruta ||
    detalles[0]?.tipo_ruta ||
    row?.tipo_ruta ||
    row?.str_tipo_ruta ||
    ''
  ).trim().toUpperCase();
  const mostrarUbicacion = tipoRuta !== 'TE';

  // Validar si la ruta puede finalizarse
  const puedeFinalizarse = resumen.pendientes === 0 &&
    (estadoRutaCodigo === 'EN_CURSO' || estadoRutaCodigo === 'REGRESADA');

  return (
    <Layout>
      <Toast ref={toastRef} />
      <ConfirmDialog />

      <div className="container-fluid py-3 ruta-detalle-bpkm">
        <Card className="border-0 shadow-sm">
          {/* Fila 1: Encabezado principal */}
          <div className="d-flex justify-content-between align-items-center mb-3 px-3 pt-3">
            <div className="d-flex align-items-center gap-3">
              <h4 className="m-0">{codigoRuta}</h4>
              {estadoRutaNombre && <Tag value={estadoRutaNombre} severity={tagSeverity(estadoRutaCodigo)} />}
            </div>
            <div className="d-flex gap-2">
              <Button
                label="Refrescar"
                icon="pi pi-refresh"
                size="small"
                outlined
                onClick={cargar}
                loading={loading}
              />
              <Button
                label="Finalizar"
                icon="pi pi-check"
                severity="success"
                size="small"
                onClick={finalizarRuta}
                disabled={!puedeFinalizarse || !canLiquidar}
                tooltip={!canLiquidar ? 'Sin permiso para liquidar rutas' : undefined}
                tooltipOptions={{ position: 'top' }}
              />
              <Button
                label="Volver"
                icon="pi pi-arrow-left"
                severity="secondary"
                size="small"
                outlined
                onClick={() => nav('/Rutas-BPKM')}
              />
            </div>
          </div>

          {/* Fila 2: Info de la ruta */}
          <div className="row g-3 mb-3 px-3">
            {camion && (
              <div className="col-auto">
                <small className="text-muted d-block">Camión</small>
                <strong>{camion}</strong>
              </div>
            )}
            {piloto && (
              <div className="col-auto">
                <small className="text-muted d-block">Piloto</small>
                <strong>{piloto}</strong>
              </div>
            )}
            {auxiliar && (
              <div className="col-auto">
                <small className="text-muted d-block">Auxiliar</small>
                <strong>{auxiliar}</strong>
              </div>
            )}
            {fechaSalida && (
              <div className="col-auto">
                <small className="text-muted d-block">Salida Planificada</small>
                <strong>{formatDateTimeGT(fechaSalida) || '-'}</strong>
              </div>
            )}
          </div>

          {/* Fila 3: Resumen */}
          <div className="d-flex justify-content-between align-items-center px-3 mb-3">
            <div className="d-flex gap-2">
              {(estadoRutaCodigo === 'CREADA' || estadoRutaCodigo === 'EN_CURSO') && (
                <>
                  <Button
                    label="Editar Piloto/Auxiliar"
                    icon="pi pi-pencil"
                    size="small"
                    outlined
                    onClick={abrirEdicionPersonal}
                    disabled={guardandoPersonal || !canEdit}
                    tooltip={!canEdit ? 'Sin permiso para modificar rutas' : undefined}
                    tooltipOptions={{ position: 'top' }}
                  />
                  <Button
                    label={modoEdicion ? "Cancelar Edición" : "Editar Facturas"}
                    icon={modoEdicion ? "pi pi-times" : "pi pi-list"}
                    size="small"
                    outlined
                    severity={modoEdicion ? "danger" : "primary"}
                    onClick={modoEdicion ? cerrarModoEdicion : abrirModoEdicion}
                    disabled={guardandoCambios || !canEdit}
                    tooltip={!canEdit ? 'Sin permiso para modificar rutas' : undefined}
                    tooltipOptions={{ position: 'top' }}
                  />
                </>
              )}
            </div>
            <div className="fs-6">
              Facturas pendientes: <strong className="text-danger">{resumen.pendientes}</strong>
            </div>
          </div>

          {/* Panel de edición de facturas */}
          {modoEdicion && (
            <div className="px-3 mb-3">
              <Card className="border-primary">
                <div className="mb-3">
                  <h6 className="fw-bold mb-2">Facturas en esta ruta (Pendientes)</h6>
                  <DataTable
                    value={detalles.filter(d => d.estado_codigo === 'PEND')}
                    size="small"
                    emptyMessage="No hay facturas pendientes"
                    scrollHeight="200px"
                    scrollable
                  >
                    <Column field="folio_factura" header="Folio" style={{ width: '10rem' }} />
                    <Column field="cliente" header="Cliente" />
                    {mostrarUbicacion && (
                      <Column field="ciudad" header="Departamento" style={{ width: '10rem' }} />
                    )}
                    {mostrarUbicacion && (
                      <Column field="municipio" header="Municipio" style={{ width: '10rem' }} />
                    )}
                    <Column
                      header="Acción"
                      style={{ width: '8rem' }}
                      body={(rowData) => (
                        <Button
                          icon="pi pi-trash"
                          size="small"
                          severity="danger"
                          outlined
                          onClick={() => quitarFacturaDeRuta(rowData)}
                          disabled={guardandoCambios}
                          tooltip="Quitar de ruta"
                        />
                      )}
                    />
                  </DataTable>
                </div>

                <div className="mb-3">
                  <h6 className="fw-bold mb-2">Agregar facturas a la ruta</h6>
                  <div className="mb-2">
                    <div className="p-inputgroup">
                      <span className="p-inputgroup-addon">
                        <i className="pi pi-search" />
                      </span>
                      <input
                        type="text"
                        className="form-control"
                        placeholder="Buscar por folio, cliente o dirección..."
                        value={busquedaFactura}
                        onChange={(e) => setBusquedaFactura(e.target.value)}
                        onKeyPress={(e) => {
                          if (e.key === 'Enter') cargarFacturasDisponibles();
                        }}
                      />
                      <Button
                        label="Buscar"
                        icon="pi pi-search"
                        onClick={cargarFacturasDisponibles}
                        loading={loadingFacturasDisp}
                      />
                    </div>
                  </div>
                  <DataTable
                    value={facturasDisponibles}
                    size="small"
                    loading={loadingFacturasDisp}
                    emptyMessage="No hay facturas disponibles"
                    scrollHeight="200px"
                    scrollable
                  >
                    <Column field="folio_factura" header="Folio" style={{ width: '10rem' }} />
                    <Column field="nombre_cliente" header="Cliente" />
                    <Column field="direccion_entrega" header="Dirección" />
                    <Column
                      header="Acción"
                      style={{ width: '8rem' }}
                      body={(rowData) => (
                        <Button
                          icon="pi pi-plus"
                          size="small"
                          severity="success"
                          outlined
                          onClick={() => agregarFacturaARuta(rowData)}
                          disabled={guardandoCambios}
                          tooltip="Agregar a ruta"
                        />
                      )}
                    />
                  </DataTable>
                </div>

                <div className="d-flex justify-content-end gap-2">
                  <Button
                    label="Cancelar"
                    icon="pi pi-times"
                    severity="secondary"
                    outlined
                    onClick={cerrarModoEdicion}
                    disabled={guardandoCambios}
                  />
                  <Button
                    label="Guardar Cambios y Generar PDF"
                    icon="pi pi-check"
                    severity="success"
                    onClick={guardarCambiosYGenerarPDF}
                    loading={guardandoCambios}
                  />
                </div>
              </Card>
            </div>
          )}

          {/* Tabla de detalles */}
          <div className="px-3 pb-3">
            <DataTable
              value={detallesOrdenados}
              loading={loading}
              dataKey="id_detalle_ruta"
              size="small"
              stripedRows={false}
              scrollable
              scrollHeight="600px"
              emptyMessage="No hay detalles en esta ruta"
              rowClassName={(rowData) => `${getRowClass(rowData)} bpkm-row-transparent`}
              rowGroupMode="subheader"
              groupRowsBy="cliente"
              className="datatable-compact"
              rowGroupHeaderTemplate={(data) => {
                const totalFacturas = detallesOrdenados.filter(d => d.cliente === data.cliente).length;
                const pendientes = detallesOrdenados.filter(d => d.cliente === data.cliente && d.estado_codigo === 'PEND').length;
                return (
                  <div className="d-flex align-items-center justify-content-between py-2 px-2 bpkm-row-transparent">
                    <div className="d-flex align-items-center gap-2">
                      <i className="pi pi-user ruta-detalle-group-icon" style={{ fontSize: '0.9rem' }}></i>
                      <strong style={{ fontSize: '0.95rem' }}>{data.cliente || 'Sin cliente'}</strong>
                    </div>
                    <div className="d-flex gap-2">
                      <span className="badge bg-primary">{totalFacturas} factura{totalFacturas !== 1 ? 's' : ''}</span>
                      {pendientes > 0 && (
                        <span className="badge bg-danger">{pendientes} pendiente{pendientes !== 1 ? 's' : ''}</span>
                      )}
                    </div>
                  </div>
                );
              }}
            >
              <Column
                field="folio_factura"
                header="Folio"
                style={{ width: '8rem', minWidth: '8rem' }}
                frozen
              />
              {mostrarUbicacion && (
                <Column
                  field="ciudad"
                  header="Departamento"
                  style={{ width: '8rem', minWidth: '8rem' }}
                />
              )}
              {mostrarUbicacion && (
                <Column
                  field="municipio"
                  header="Municipio"
                  style={{ width: '8rem', minWidth: '8rem' }}
                />
              )}
              <Column
                field="direccion"
                header="Dirección"
                style={{ minWidth: '8rem' }}
              />
              <Column
                header="Intento"
                body={(r) => {
                  const intentoActual = r.intento_numero || 1;
                  const totalIntentos = r.total_intentos || 0;
                  return (
                    <div className="text-center">
                      <span className="fw-semibold">#{intentoActual}</span>
                      {totalIntentos > 0 && (
                        <small className="text-muted d-block" style={{ fontSize: '0.75rem' }}>
                          ({totalIntentos} intentos)
                        </small>
                      )}
                    </div>
                  );
                }}
                style={{ width: '7rem', minWidth: '7rem', textAlign: 'center' }}
              />
              <Column
                header="Estado"
                body={(r) => {
                  const codigo = String(r.estado_codigo || r.estado_nombre || '').toUpperCase();
                  const nombre = r.estado_nombre || r.estado_codigo || 'Pendiente';

                  if (codigo === 'PEND') return <Tag value={nombre} severity="secondary" />;
                  if (codigo === 'ENT') return <Tag value={nombre} severity="success" />;
                  if (codigo === 'PARC') return <Tag value={nombre} severity="warning" />;
                  if (codigo === 'FALL') return <Tag value={nombre} severity="danger" />;
                  if (codigo === 'ANUL' || codigo === 'ANULADO' || codigo === 'ANULADA') return <Tag value={nombre} severity="danger" />;
                  return <Tag value={nombre} severity="secondary" />;
                }}
                style={{ width: '10rem', minWidth: '10rem' }}
              />
              <Column
                header="Acciones"
                body={(r) => {
                  const isPendiente = String(r.estado_codigo || '').toUpperCase() === 'PEND';

                  if (!isPendiente) {
                    return (
                      <div className="d-flex align-items-center gap-1">
                        <Button
                          icon="pi pi-history"
                          rounded
                          text
                          severity="info"
                          size="small"
                          onClick={() => abrirHistorial(r)}
                          tooltip="Ver historial"
                          tooltipOptions={{ position: 'top' }}
                        />
                        <span className="text-muted small">Liquidado</span>
                      </div>
                    );
                  }

                  return (
                    <div className="d-flex align-items-center gap-1">
                      <Button
                        icon="pi pi-history"
                        rounded
                        text
                        severity="info"
                        size="small"
                        onClick={() => abrirHistorial(r)}
                        tooltip="Ver historial"
                        tooltipOptions={{ position: 'top' }}
                      />
                      <Button
                        icon="pi pi-check"
                        rounded
                        text
                        severity="success"
                        size="small"
                        onClick={() => liquidarRapido(r)}
                        disabled={liquidando || !canLiquidar}
                        tooltip={!canLiquidar ? 'Sin permiso para liquidar' : 'Entregado'}
                        tooltipOptions={{ position: 'top' }}
                      />
                      <Button
                        icon="pi pi-exclamation-triangle"
                        rounded
                        text
                        severity="warning"
                        size="small"
                        onClick={() => abrirDialogo(r, 'PARCIAL')}
                        disabled={liquidando || !canLiquidar}
                        tooltip={!canLiquidar ? 'Sin permiso para liquidar' : 'Parcial'}
                        tooltipOptions={{ position: 'top' }}
                      />
                      <Button
                        icon="pi pi-times"
                        rounded
                        text
                        severity="danger"
                        size="small"
                        onClick={() => abrirDialogo(r, 'FALLIDA')}
                        disabled={liquidando || !canLiquidar}
                        tooltip={!canLiquidar ? 'Sin permiso para liquidar' : 'Fallido'}
                        tooltipOptions={{ position: 'top' }}
                      />
                    </div>
                  );
                }}
                style={{ width: '12rem', minWidth: '12rem' }}
                frozen
                alignFrozen="right"
              />
            </DataTable>
          </div>
        </Card>

        {/* Sección de Comentarios */}
        <Card className="border-0 shadow-sm mt-3">
          <div className="px-3 pt-3 pb-2">
            <div className="d-flex align-items-center justify-content-between mb-3">
              <h6 className="m-0">
                <i className="pi pi-comments me-2"></i>
                Comentarios de la Ruta
              </h6>
              <span className="badge bg-secondary">{comentarios.length}</span>
            </div>

            {/* Formulario para agregar comentario */}
            {canComment && (
              <div className="mb-3">
                <div className="d-flex gap-2">
                  <InputTextarea
                    value={nuevoComentario}
                    onChange={(e) => setNuevoComentario(e.target.value)}
                    placeholder="Agregar un comentario..."
                    rows={2}
                    className="flex-grow-1"
                    disabled={guardandoComentario}
                  />
                  <Button
                    label="Agregar"
                    icon="pi pi-send"
                    size="small"
                    onClick={agregarComentario}
                    loading={guardandoComentario}
                    disabled={!nuevoComentario.trim()}
                  />
                </div>
              </div>
            )}

            {/* Lista de comentarios */}
            {loadingComentarios ? (
              <div className="text-center py-3">
                <i className="pi pi-spin pi-spinner" style={{ fontSize: '2rem' }}></i>
                <p className="text-muted mt-2">Cargando comentarios...</p>
              </div>
            ) : comentarios.length === 0 ? (
              <div className="text-center py-4">
                <i className="pi pi-comment ruta-detalle-empty-icon" style={{ fontSize: '2rem' }}></i>
                <p className="text-muted mt-2 mb-0">No hay comentarios aún</p>
                <small className="text-muted">Sé el primero en comentar</small>
              </div>
            ) : (
              <div className="d-flex flex-column gap-3">
                {comentarios.map((comentario) => (
                  <div
                    key={comentario.id_comentario}
                    className="border rounded p-3 ruta-detalle-comentario-item"
                  >
                    <div className="d-flex justify-content-between align-items-start mb-2">
                      <div className="d-flex align-items-center gap-2">
                        <i className="pi pi-user ruta-detalle-comentario-user-icon" style={{ fontSize: '0.875rem' }}></i>
                        <strong style={{ fontSize: '0.875rem' }}>
                          {comentario.nombre_usuario || 'Usuario'}
                        </strong>
                      </div>
                      <small className="text-muted">
                        {formatDateTimeGT(comentario.fecha_creacion) || '-'}
                      </small>
                    </div>
                    <p className="mb-0" style={{ whiteSpace: 'pre-wrap' }}>
                      {comentario.comentario}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </Card>
      </div>

      {/* Diálogo para Parcial/Fallido */}
      <Dialog
        header={dlgTipo === 'FALLIDA' ? 'Marcar como Fallido' : 'Marcar como Parcial'}
        visible={dlgOpen}
        style={{ width: dlgTipo === 'PARCIAL' && productosFactura.length > 0 ? '900px' : '500px' }}
        modal
        onHide={() => setDlgOpen(false)}
      >
        <div className="d-flex flex-column gap-3">
          <div className="small text-muted">
            Folio: <strong>{dlgRow?.folio_factura || ''}</strong>
          </div>

          {dlgTipo === 'FALLIDA' ? (
            <div>
              <label className="form-label small">Motivo de Fallo *</label>
              <InputTextarea
                value={dlgMotivoFallo}
                onChange={(e) => setDlgMotivoFallo(e.target.value)}
                rows={4}
                className="w-100"
                placeholder="Describa el motivo del fallo..."
              />
            </div>
          ) : (
            <>
              {loadingProductos ? (
                <div className="text-center py-3">
                  <i className="pi pi-spin pi-spinner" style={{ fontSize: '2rem' }}></i>
                  <div className="mt-2 small text-muted">Cargando productos...</div>
                </div>
              ) : productosFactura.length > 0 ? (
                <>
                  <div className="alert alert-info small mb-2">
                    Indique la cantidad entregada de cada producto. Solo se guardará el monto correspondiente a los productos entregados.
                  </div>
                  <DataTable
                    value={productosFactura}
                    size="small"
                    stripedRows
                    scrollable
                    scrollHeight="300px"
                  >
                    <Column
                      field="codigo"
                      header="Código"
                      style={{ width: '120px', fontSize: '0.85rem' }}
                    />
                    <Column
                      field="nombre"
                      header="Producto"
                      style={{ minWidth: '200px', fontSize: '0.85rem' }}
                    />
                    <Column
                      field="cantidad"
                      header="Pedido"
                      style={{ width: '80px', fontSize: '0.85rem', textAlign: 'right' }}
                      body={(row) => row.cantidad?.toFixed(2) || '0.00'}
                    />
                    <Column
                      header="Entregado"
                      style={{ width: '120px' }}
                      body={(row, { rowIndex }) => (
                        <InputNumber
                          value={row.cantidad_entregada}
                          onValueChange={(e) => {
                            const newProds = [...productosFactura];
                            newProds[rowIndex].cantidad_entregada = e.value || 0;
                            newProds[rowIndex].monto_parcial = (e.value || 0) * (row.precio || 0);
                            setProductosFactura(newProds);
                          }}
                          min={0}
                          max={row.cantidad || 0}
                          minFractionDigits={2}
                          maxFractionDigits={2}
                          className="w-100"
                          size="small"
                        />
                      )}
                    />
                    <Column
                      field="precio"
                      header="Precio Unit."
                      style={{ width: '100px', fontSize: '0.85rem', textAlign: 'right' }}
                      body={(row) => `Q${row.precio?.toFixed(2) || '0.00'}`}
                    />
                    <Column
                      field="monto_parcial"
                      header="Subtotal"
                      style={{ width: '100px', fontSize: '0.85rem', textAlign: 'right' }}
                      body={(row) => `Q${row.monto_parcial?.toFixed(2) || '0.00'}`}
                    />
                  </DataTable>
                  <div className="d-flex justify-content-end mt-2">
                    <strong>Total Parcial: Q{productosFactura.reduce((sum, p) => sum + (p.monto_parcial || 0), 0).toFixed(2)}</strong>
                  </div>
                </>
              ) : null}

              <div>
                <label className="form-label small">Observaciones (Opcional)</label>
                <InputTextarea
                  value={dlgObservaciones}
                  onChange={(e) => setDlgObservaciones(e.target.value)}
                  rows={3}
                  className="w-100"
                  placeholder="Comentarios adicionales sobre la entrega parcial..."
                />
              </div>
            </>
          )}

          <div className="mt-3 p-3 rounded ruta-detalle-reenviar-box">
            <div className="d-flex align-items-center gap-2">
              <input
                type="checkbox"
                id="chk-puede-reenviar"
                checked={dlgPuedeReenviar}
                onChange={(e) => setDlgPuedeReenviar(e.target.checked)}
                className="form-check-input"
                style={{ cursor: 'pointer' }}
              />
              <label htmlFor="chk-puede-reenviar" className="form-check-label mb-0" style={{ cursor: 'pointer' }}>
                ¿Puede ser reenviado en otra ruta?
              </label>
            </div>
            <div className="small text-muted mt-1 ms-4">
              Si desmarca esta opción, la factura no aparecerá en futuras creaciones de rutas.
            </div>
          </div>

          <div className="d-flex justify-content-end gap-2 mt-2">
            <Button
              label="Guardar"
              icon="pi pi-check"
              onClick={guardarDesdeDlg}
              loading={liquidando}
            />
            <Button
              label="Cancelar"
              icon="pi pi-times"
              severity="secondary"
              outlined
              onClick={() => setDlgOpen(false)}
              disabled={liquidando}
            />
          </div>
        </div>
      </Dialog>

      {/* Diálogo para Editar Piloto/Auxiliar */}
      <Dialog
        header="Editar Piloto y/o Auxiliar"
        visible={dlgPersonalOpen}
        style={{ width: '500px' }}
        modal
        onHide={() => setDlgPersonalOpen(false)}
        blockScroll
      >
        <div className="d-flex flex-column gap-3">
          <div>
            <label className="form-label small">Piloto (Opcional)</label>
            <Dropdown
              value={nuevoPiloto}
              options={pilotos}
              onChange={(e) => setNuevoPiloto(e.value)}
              optionLabel="str_nombre"
              optionValue="int_id_personal"
              placeholder="Seleccione un piloto (opcional)"
              className="w-100"
              filter
              showClear
              virtualScrollerOptions={{ itemSize: 38 }}
            />
          </div>

          <div>
            <label className="form-label small">Auxiliar (Opcional)</label>
            <Dropdown
              value={nuevoAuxiliar}
              options={auxiliares}
              onChange={(e) => setNuevoAuxiliar(e.value)}
              optionLabel="str_nombre"
              optionValue="int_id_personal"
              placeholder="Seleccione un auxiliar (opcional)"
              className="w-100"
              filter
              showClear
              virtualScrollerOptions={{ itemSize: 38 }}
            />
          </div>

          <div className="d-flex justify-content-end gap-2 mt-2">
            <Button
              label="Guardar"
              icon="pi pi-check"
              onClick={guardarPersonal}
              loading={guardandoPersonal}
            />
            <Button
              label="Cancelar"
              icon="pi pi-times"
              severity="secondary"
              outlined
              onClick={() => setDlgPersonalOpen(false)}
              disabled={guardandoPersonal}
            />
          </div>
        </div>
      </Dialog>

      <SidebarHistorialEntrega
        visible={historialVisible}
        onHide={() => {
          setHistorialVisible(false);
          setFacturaSeleccionada(null);
        }}
        factura={facturaSeleccionada}
        idFacturaSel={facturaSeleccionada?.id_factura_sel || facturaSeleccionada?.int_id_factura_sel}
        folio={facturaSeleccionada?.folio_factura || facturaSeleccionada?.folio}
        formaEntrega={facturaSeleccionada?.forma_entrega || facturaSeleccionada?.forma_nombre}
        destino={facturaSeleccionada?.direccion || facturaSeleccionada?.ciudad}
        title="Historial de Entrega"
        usuarioId={usuarioId}
        scope="OPS"
      />
    </Layout>
  );
}