// src/pages/bpkm/rutas/RutaCrear.jsx
import { useEffect, useMemo, useRef, useState } from 'react';
import Layout from '@ui/Layout';
import RutasNav from './RutasNav';
import { Toast } from 'primereact/toast';
import { Card } from 'primereact/card';
import { Dropdown } from 'primereact/dropdown';
import { Calendar } from 'primereact/calendar';
import { InputText } from 'primereact/inputtext';
import { InputMask } from 'primereact/inputmask';
import { ToggleButton } from 'primereact/togglebutton';
import { Divider } from 'primereact/divider';
import { Button } from 'primereact/button';
import { DataTable } from 'primereact/datatable';
import { Column } from 'primereact/column';
import { RadioButton } from 'primereact/radiobutton';
import { useNavigate } from 'react-router-dom';

import {
  getCamionesActivos,
  getPersonal,
  getSucursalesList,
  getPermisosBPKM
} from '@services/bpkm/bpkmRutas';
import { getFacturasParaRuta, getTransportesActivos } from '@services/bpkm/bpkmCatalogos';
import { postRutaCompleta, getRutaPDF } from '@services/bpkm/bpkmRutas';
import { generateRutaPdf } from '@utils/rutaPdf';
import { loadAssetAsDataURL } from '@utils/loadAssetAsDataURL';
import { toISODateTimeLocal, toISODateLocal, formatDateOnly } from '@utils/dateSafe';
import { getApiErrorMessage } from '@utils/apiError';
import { HORA_12_REGEX, a24Horas, completarMinutosEnBlanco, procesarHoraEscrita, moverCursorAMinutos } from '@utils/hora12';
import logoUrl from '@assets/img/Logo.png';

// Calcula días transcurridos desde la fecha de creación
const getDiasIndicator = (fechaCreacion) => {
  if (!fechaCreacion) return null;
  const now = new Date();
  const created = new Date(fechaCreacion);
  if (isNaN(created.getTime())) return null;
  const diffMs = now - created;
  const dias = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  let color;
  if (dias <= 1) color = '#22c55e';       // Verde: 0-1 días
  else if (dias <= 3) color = '#f59e0b';  // Amarillo: 2-3 días
  else color = '#ef4444';                 // Rojo: 4+ días
  return { dias, color };
};


const MAX_DIAS_ENTRADA = 3;
const MAX_DIAS_SALIDA = 4;

const fechaHoraInicial = (ampm) => {
  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);
  return { fecha: hoy, hora: '', ampm, ampmManual: false, fechaManual: false, tocada: false };
};

// Devuelve null si falta la fecha o la hora no es válida.
function combinarFechaHora({ fecha, hora, ampm }) {
  const m = HORA_12_REGEX.exec(hora);
  if (!fecha || !m) return null;
  const hh24 = a24Horas(m[1], ampm);
  const d = new Date(fecha);
  d.setHours(hh24, Number(m[2]), 0, 0);
  return d;
}

function CampoFechaHora({ etiqueta, datos, onChange, minDate, maxDate, marcarFechaManual }) {
  const horaRef = useRef(null);
  const horaValida = HORA_12_REGEX.test(datos.hora);
  const invalida = datos.tocada && !horaValida;
  const set = (parcial) => onChange((prev) => ({ ...prev, ...parcial }));

  return (
    <div style={{ width: 340 }}>
      <div className="small text-muted d-block mb-1">{etiqueta}</div>
      <div className="d-flex gap-3">
        <div>
          <label className="small text-muted d-block mb-1" style={{ fontSize: '0.7rem' }}>Fecha</label>
          <Calendar
            value={datos.fecha}
            onChange={(e) => set({
              fecha: e.value ? new Date(e.value.getFullYear(), e.value.getMonth(), e.value.getDate()) : null,
              ...(marcarFechaManual ? { fechaManual: true } : {})
            })}
            showIcon
            className="p-inputtext-sm"
            appendTo="self"
            minDate={minDate}
            maxDate={maxDate}
            style={{ fontSize: '0.8rem', width: 180 }}
          />
        </div>
        <div>
          <label className="small text-muted d-block mb-1" style={{ fontSize: '0.7rem' }}>Hora</label>
          <div className="d-flex gap-1">
            <InputMask
              ref={horaRef}
              mask="99:99"
              placeholder="HH:mm"
              value={datos.hora}
              autoClear={false}
              onChange={(e) => {
                const valor = e.value || '';
                const r = procesarHoraEscrita(valor, datos.ampm, datos.ampmManual);
                set({ hora: r.hora, ampm: r.ampm, tocada: true });
                if (r.hora !== valor) moverCursorAMinutos(horaRef.current?.getElement?.());
              }}
              onBlur={() => {
                const r = procesarHoraEscrita(completarMinutosEnBlanco(datos.hora), datos.ampm, datos.ampmManual);
                set({ hora: r.hora, ampm: r.ampm, tocada: true });
              }}
              className={`p-inputtext-sm ${invalida ? 'p-invalid' : ''}`}
              style={{ fontSize: '0.8rem', width: 72 }}
            />
            <ToggleButton
              checked={datos.ampm === 'PM'}
              onChange={(e) => set({ ampm: e.value ? 'PM' : 'AM', ampmManual: true })}
              onLabel="PM"
              offLabel="AM"
              style={{ fontSize: '0.8rem', width: 56 }}
            />
          </div>
        </div>
      </div>
      {invalida && (
        <small className="text-danger d-block mt-1" style={{ fontSize: '0.7rem' }}>
          Hora inválida (ej. 05:30 con PM, o 17:30)
        </small>
      )}
      {horaValida && datos.hora.startsWith('12') && (
        <small className="text-primary d-block mt-1 fw-semibold" style={{ fontSize: '0.7rem' }}>
          {datos.hora} {datos.ampm} = {datos.ampm === 'AM' ? 'madrugada' : 'mediodía'}
          {datos.fecha ? ` del ${formatDateOnly(datos.fecha)}` : ''}
        </small>
      )}
      {maxDate && (
        <small className="text-muted d-block mt-1" style={{ fontSize: '0.7rem' }}>
          Puede elegir hasta el {formatDateOnly(maxDate)}
        </small>
      )}
    </div>
  );
}

function EncabezadoColapsable({ titulo, colapsado, onToggle, className = 'px-3 pt-3 pb-2', children }) {
  return (
    <div className={`d-flex justify-content-between align-items-center ${className}`}>
      <div className="d-flex align-items-center gap-2">
        <Button
          type="button"
          icon={colapsado ? 'pi pi-chevron-down' : 'pi pi-chevron-up'}
          rounded
          text
          severity="secondary"
          size="small"
          onClick={onToggle}
          tooltip={colapsado ? 'Expandir' : 'Colapsar'}
          tooltipOptions={{ position: 'top' }}
        />
        {titulo}
      </div>
      <div className="d-flex gap-2">{children}</div>
    </div>
  );
}

export default function RutaCrear() {
  const toastRef = useRef(null);
  const navigate = useNavigate();
  const show = (severity, summary, detail) => toastRef.current?.show({ severity, summary, detail, life: 3200 });
  const ok = (s, d) => show('success', s, d);
  const warn = (s, d) => show('warn', s, d);
  const err = (s, d) => show('error', s, d);
  const usuarioId = useMemo(() => Number(localStorage.getItem('userId') || 0), []);
  const storeId = useMemo(() => Number(localStorage.getItem('storeId') || 0), []);

  const [logoDataUrl, setLogoDataUrl] = useState('');
  const [perms, setPerms] = useState([]);
  const [checkingPermissions, setCheckingPermissions] = useState(true);

  // Helper para validar permisos
  const rank = { viewer: 1, editor: 2, admin: 3 };
  const need = (perms, key, min = 'viewer') => {
    const r = rank[min] || 1;
    const p = Array.isArray(perms) ? perms.find((x) => x.key === key) : null;
    return p ? (rank[p.nivel_permiso] || 0) >= r : false;
  };

  const canCreate = need(perms, 'bpkm.rutas.new', 'editor');

  // Validar permiso al cargar
  useEffect(() => {
    (async () => {
      try {
        const data = await getPermisosBPKM(usuarioId);
        const lista = Array.isArray(data) ? data : [];
        setPerms(lista);
        const hasPermission = lista.some(p => p.key === 'bpkm.rutas.new' && ['editor', 'admin'].includes(p.nivel_permiso));
        if (!hasPermission && lista.length > 0) {
          err('Sin permiso', 'No tiene permiso para crear rutas');
          setTimeout(() => navigate('/Rutas-BPKM'), 2000);
        }
      } catch (e) {
        console.error(e);
        err('Permisos', getApiErrorMessage(e, 'No se pudieron cargar los permisos'));
      } finally {
        setCheckingPermissions(false);
      }
    })();
  }, [usuarioId]);

  // Catálogos
  const [camiones, setCamiones] = useState([]);
  const [personal, setPersonal] = useState([]);
  const [sucursales, setSucursales] = useState([]);
  const [transportes, setTransportes] = useState([]);

  // Form datos de ruta
  const [tipoRuta, setTipoRuta] = useState('RL');
  const [idCamion, setIdCamion] = useState(null);
  const [idPiloto, setIdPiloto] = useState(null);
  const [idAuxiliar, setIdAuxiliar] = useState(null);
  const [idTransporteExterno, setIdTransporteExterno] = useState(null);
  const [idSucursalSalida, setIdSucursalSalida] = useState(null);
  const [idSucursalRegreso, setIdSucursalRegreso] = useState(null);
  const [datosSalida, setDatosSalida] = useState(() => fechaHoraInicial('AM'));
  const [datosEntrada, setDatosEntrada] = useState(() => fechaHoraInicial('PM'));

  // La fecha de entrada sigue a la de salida mientras el usuario no la haya elegido directamente;
  // si ya la eligió pero queda antes de la nueva salida, se corrige igual.
  const actualizarDatosSalida = (updater) => {
    setDatosSalida((prev) => {
      const next = typeof updater === 'function' ? updater(prev) : { ...prev, ...updater };
      if (next.fecha && next.fecha.getTime() !== prev.fecha?.getTime()) {
        const maxEntradaPermitida = new Date(next.fecha);
        maxEntradaPermitida.setDate(maxEntradaPermitida.getDate() + MAX_DIAS_ENTRADA);
        setDatosEntrada((prevEntrada) => {
          if (
            prevEntrada.fechaManual && prevEntrada.fecha &&
            prevEntrada.fecha >= next.fecha && prevEntrada.fecha <= maxEntradaPermitida
          ) {
            return prevEntrada;
          }
          return { ...prevEntrada, fecha: new Date(next.fecha) };
        });
      }
      return next;
    });
  };
  const fechaSalida = useMemo(() => combinarFechaHora(datosSalida), [datosSalida]);
  const fechaEntrada = useMemo(() => combinarFechaHora(datosEntrada), [datosEntrada]);

  // Facturas disponibles (todas desde el backend)
  const [todasFacturas, setTodasFacturas] = useState([]);
  const [loadingFacturas, setLoadingFacturas] = useState(false);
  
  // Filtros
  const [filtroFolio, setFiltroFolio] = useState('');
  const [filtroMunicipio, setFiltroMunicipio] = useState(null);
  const [filtroDepartamento, setFiltroDepartamento] = useState(null);
  const [filtroCliente, setFiltroCliente] = useState(null);
  const [filtroTransporte, setFiltroTransporte] = useState(null); // Para TE
  const [filtroFechaDesde, setFiltroFechaDesde] = useState(null);
  const [filtroFechaHasta, setFiltroFechaHasta] = useState(null);

  // IDs de facturas seleccionadas
  const [idsSeleccionados, setIdsSeleccionados] = useState([]);

  // Guardando
  const [guardando, setGuardando] = useState(false);

  const [colapsadoRuta, setColapsadoRuta] = useState(false);
  const [colapsadoDisponibles, setColapsadoDisponibles] = useState(false);
  const [colapsadoSeleccionadas, setColapsadoSeleccionadas] = useState(false);

  // Pilotos y auxiliares filtrados
  const pilotos = useMemo(() => personal.filter(p => p.int_id_rol === 14), [personal]);
  const auxiliares = useMemo(() => personal.filter(p => p.int_id_rol === 15), [personal]);

  // Opciones para dropdowns de filtro (frontend)
  const municipiosOpts = useMemo(() => {
    // Si no hay departamento seleccionado, no mostrar municipios
    if (!filtroDepartamento) {
      return [];
    }
    // Filtrar municipios que pertenecen al departamento seleccionado
    const facturasFiltradas = todasFacturas.filter(f => f.ciudad === filtroDepartamento);
    const unicos = [...new Set(facturasFiltradas.map(f => f.municipio).filter(Boolean))];
    return unicos.sort().map(m => ({ label: m, value: m }));
  }, [todasFacturas, filtroDepartamento]);

  const departamentosOpts = useMemo(() => {
    const unicos = [...new Set(todasFacturas.map(f => f.ciudad).filter(Boolean))];
    return unicos.sort().map(d => ({ label: d, value: d }));
  }, [todasFacturas]);

  const clientesOpts = useMemo(() => {
    const unicos = [...new Set(todasFacturas.map(f => f.nombre_cliente).filter(Boolean))];
    return unicos.sort().map(c => ({ label: c, value: c }));
  }, [todasFacturas]);

  const transportesOpts = useMemo(() => {
    const unicos = [...new Set(todasFacturas.map(f => f.nombre_transporte_externo).filter(Boolean))];
    return unicos.sort().map(t => ({ label: t, value: t }));
  }, [todasFacturas]);

  // Facturas disponibles (filtradas por seleccionados Y por filtros)
  const facturasDisponibles = useMemo(() => {
    let filtradas = todasFacturas.filter(f => !idsSeleccionados.includes(f.id_factura_sel));

    if (filtroFolio.trim()) {
      const busq = filtroFolio.trim().toLowerCase();
      filtradas = filtradas.filter(f => 
        (f.folio_factura || '').toLowerCase().includes(busq)
      );
    }

    if (filtroMunicipio) {
      filtradas = filtradas.filter(f => f.municipio === filtroMunicipio);
    }

    if (filtroDepartamento) {
      filtradas = filtradas.filter(f => f.ciudad === filtroDepartamento);
    }

    if (filtroCliente) {
      filtradas = filtradas.filter(f => f.nombre_cliente === filtroCliente);
    }

    if (filtroTransporte) {
      filtradas = filtradas.filter(f => f.nombre_transporte_externo === filtroTransporte);
    }

    if (filtroFechaDesde) {
      const desde = toISODateLocal(filtroFechaDesde);
      filtradas = filtradas.filter(f => !f.fecha_factura || String(f.fecha_factura).slice(0, 10) >= desde);
    }

    if (filtroFechaHasta) {
      const hasta = toISODateLocal(filtroFechaHasta);
      filtradas = filtradas.filter(f => !f.fecha_factura || String(f.fecha_factura).slice(0, 10) <= hasta);
    }

    return filtradas;
  }, [todasFacturas, idsSeleccionados, filtroFolio, filtroMunicipio, filtroDepartamento, filtroCliente, filtroTransporte, filtroFechaDesde, filtroFechaHasta]);

  // Facturas seleccionadas (para tabla inferior)
  const facturasSeleccionadas = useMemo(() => {
    return todasFacturas.filter(f => idsSeleccionados.includes(f.id_factura_sel));
  }, [todasFacturas, idsSeleccionados]);

  // Paleta de colores para departamentos (sutil, alternando)
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

  const bordesDepartamento = [
    '#dee2e6', '#90caf9', '#ce93d8', '#81c784', '#ffb74d',
    '#f48fb1', '#80deea', '#aed581', '#fff176', '#ffb74d',
  ];

  const departamentosUnicos = useMemo(
    () => [...new Set(facturasSeleccionadas.map(f => f.ciudad).filter(Boolean))].sort(),
    [facturasSeleccionadas]
  );

  const getDepartamentoColores = (ciudad) => {
    const index = ciudad ? departamentosUnicos.indexOf(ciudad) : -1;
    if (index === -1) return { fondo: '#f0f0f0', borde: '#e0e0e0' };
    return {
      fondo: coloresDepartamento[index % coloresDepartamento.length],
      borde: bordesDepartamento[index % bordesDepartamento.length]
    };
  };

  const celdaUbicacion = (row) => {
    if (tipoRuta === 'TE') {
      return (
        <div style={{ fontSize: '0.85rem', lineHeight: '1.3' }}>
          {row.direccion_entrega || 'Sin dirección'}
        </div>
      );
    }
    const { fondo, borde } = getDepartamentoColores(row.ciudad);
    return (
      <div style={{ lineHeight: '1.3' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '2px' }}>
          <span
            style={{
              fontSize: '0.7rem',
              fontWeight: '600',
              padding: '2px 6px',
              backgroundColor: fondo,
              border: `1px solid ${borde}`,
              borderRadius: '3px',
              color: '#374151'
            }}
          >
            {row.ciudad || 'N/A'}
          </span>
          <span style={{ fontSize: '0.85rem', fontWeight: '500' }}>
            {row.municipio || ''}
          </span>
        </div>
        <div style={{ fontSize: '0.75rem', color: '#6c757d', marginTop: '2px' }}>
          {row.direccion_entrega || ''}
        </div>
      </div>
    );
  };

  // Fecha mínima para salida: ambos tipos pueden crear rutas desde hoy
  // La validación de traslape de horarios se maneja en BD mediante constraints
  const minFechaSalida = useMemo(() => {
    const date = new Date();
    // Tanto RL como TE pueden ser desde hoy, validando hora
    date.setHours(0, 0, 0, 0);
    return date;
  }, [tipoRuta]);

  const maxFechaSalida = useMemo(() => {
    const max = new Date(minFechaSalida);
    max.setDate(max.getDate() + MAX_DIAS_SALIDA);
    return max;
  }, [minFechaSalida]);

  // Fecha mínima para entrada: debe ser >= fecha de salida o hoy
  const minFechaEntrada = useMemo(() => {
    if (datosSalida.fecha) {
      return new Date(datosSalida.fecha);
    }
    const date = new Date();
    date.setHours(0, 0, 0, 0);
    return date;
  }, [datosSalida.fecha]);

  // Tope de días entre salida y entrada; el backend va a exigir el mismo límite.
  const maxFechaEntrada = useMemo(() => {
    const max = new Date(minFechaEntrada);
    max.setDate(max.getDate() + MAX_DIAS_ENTRADA);
    return max;
  }, [minFechaEntrada]);

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

  // Cargar catálogos iniciales (sucursales y transportes)
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const [suc, trans] = await Promise.all([
          getSucursalesList(),
          getTransportesActivos()
        ]);

        if (!alive) return;

        // Filtrar sucursales según grupos
        let sucursalesFiltradas = Array.isArray(suc) ? suc : [];

        // Grupos de sucursales
        const GRUPO_CENTRAL = [1, 17, 19]; // CENTRAL, VEMA, CEDI
        const GRUPO_XELA = [14, 15];        // XELA, PERIXELA

        // Verificar a qué grupo pertenece el usuario
        const enGrupoCentral = GRUPO_CENTRAL.includes(storeId);
        const enGrupoXela = GRUPO_XELA.includes(storeId);

        if (enGrupoCentral) {
          // Usuario de CENTRAL/VEMA/CEDI: Solo mostrar estas 3 sucursales
          sucursalesFiltradas = sucursalesFiltradas.filter(s =>
            GRUPO_CENTRAL.includes(s.int_id_sucursal)
          );
        } else if (enGrupoXela) {
          // Usuario de XELA/PERIXELA: Solo mostrar estas 2 sucursales
          sucursalesFiltradas = sucursalesFiltradas.filter(s =>
            GRUPO_XELA.includes(s.int_id_sucursal)
          );
        } else {
          // Usuario de otra sucursal: Solo su sucursal
          sucursalesFiltradas = sucursalesFiltradas.filter(s =>
            s.int_id_sucursal === storeId
          );
        }

        setSucursales(sucursalesFiltradas);
        setTransportes(Array.isArray(trans) ? trans : []);

      } catch (e) {
        console.error(e);
        err('Catálogos', 'No se pudieron cargar los catálogos');
      }
    })();
    return () => { alive = false; };
  }, [storeId]);

  const sucursalPorDefecto = useMemo(() => {
    const propia = sucursales.find(x => x.int_id_sucursal === storeId);
    if (propia) return propia.int_id_sucursal;
    return sucursales.length === 1 ? sucursales[0].int_id_sucursal : null;
  }, [sucursales, storeId]);

  useEffect(() => {
    if (sucursalPorDefecto == null) return;
    setIdSucursalSalida(prev => prev ?? sucursalPorDefecto);
    setIdSucursalRegreso(prev => prev ?? sucursalPorDefecto);
  }, [sucursalPorDefecto]);

  // Cargar camiones y personal filtrados por sucursal de salida
  useEffect(() => {
    let alive = true;
    (async () => {
      if (!idSucursalSalida) {
        setCamiones([]);
        setPersonal([]);
        return;
      }

      try {
        const [cam, pers] = await Promise.all([
          getCamionesActivos({ id_sucursal: idSucursalSalida }),
          getPersonal({ rol: null, estado: 1, id_sucursal: idSucursalSalida })
        ]);

        if (!alive) return;

        const newCamiones = Array.isArray(cam) ? cam : [];
        const newPersonal = Array.isArray(pers) ? pers : [];

        setCamiones(newCamiones);
        setPersonal(newPersonal);

        // Limpiar selecciones si ya no están disponibles
        if (idCamion && !newCamiones.find(c => c.int_id_camion === idCamion)) {
          setIdCamion(null);
        }
        if (idPiloto && !newPersonal.find(p => p.int_id_personal === idPiloto)) {
          setIdPiloto(null);
        }
        if (idAuxiliar && !newPersonal.find(p => p.int_id_personal === idAuxiliar)) {
          setIdAuxiliar(null);
        }
      } catch (e) {
        console.error(e);
        err('Filtro', 'No se pudieron cargar camiones y personal de la sucursal');
      }
    })();
    return () => { alive = false; };
  }, [idSucursalSalida]);

  // Buscar facturas disponibles (solo al montar o cuando se presiona buscar)
  const buscarFacturas = async () => {
    // Validar que el usuario tenga una sucursal asignada
    if (!storeId || storeId === 0) {
      err('Error', 'No se puede cargar facturas. El usuario no tiene una sucursal asignada.');
      setTodasFacturas([]);
      return;
    }

    setLoadingFacturas(true);
    try {
      // Determinar el código de forma de entrega según el tipo de ruta
      const formaEntregaCodigo = (tipoRuta === 'RL' || tipoRuta === 'RT') ? 'CAM' : tipoRuta === 'RC' ? 'LOCAL' : 'EXT';

      const resultado = await getFacturasParaRuta({
        creado_por: 0,
        estado_codigo: 'ACT',
        folio_like: '',
        fecha_desde: null,
        fecha_hasta: null,
        limit: 500,
        offset: 0,
        id_sucursal: storeId,
        forma_entrega_codigo: formaEntregaCodigo,
        id_sucursal_salida: idSucursalSalida || 0,
        id_transporte_externo: 0
      });

      const items = resultado?.items || [];
      setTodasFacturas(items);
    } catch (e) {
      console.error('Error buscando facturas', e);
      err('Facturas', 'No se pudieron cargar las facturas disponibles');
    } finally {
      setLoadingFacturas(false);
    }
  };

  // Recargar facturas cuando cambie el tipo de ruta
  useEffect(() => {
    // Limpiar facturas seleccionadas al cambiar tipo de ruta
    setIdsSeleccionados([]);
    buscarFacturas();
  }, [tipoRuta]);

  // Limpiar municipio cuando cambie el departamento
  useEffect(() => {
    if (filtroMunicipio) {
      setFiltroMunicipio(null);
    }
  }, [filtroDepartamento]);

  const limpiarFiltrosFacturas = () => {
    setFiltroFolio('');
    setFiltroMunicipio(null);
    setFiltroDepartamento(null);
    setFiltroCliente(null);
    setFiltroTransporte(null);
    setFiltroFechaDesde(null);
    setFiltroFechaHasta(null);
  };

  // Agregar factura (desaparece de arriba)
  const agregarFactura = (idFacturaSel) => {
    setIdsSeleccionados(prev => [...prev, idFacturaSel]);
  };

  // Quitar factura (vuelve a aparecer arriba)
  const quitarFactura = (idFacturaSel) => {
    setIdsSeleccionados(prev => prev.filter(x => x !== idFacturaSel));
  };

  // Validar y guardar
  const handleGuardar = async () => {
    // Validaciones según tipo de ruta
    if (tipoRuta === 'RL' || tipoRuta === 'RT' || tipoRuta === 'RC') {
      if (!idCamion) {
        warn('Validación', 'Debe seleccionar un camión');
        return;
      }
      if (!idPiloto) {
        warn('Validación', 'Debe seleccionar un piloto');
        return;
      }
    } else if (tipoRuta === 'TE') {
      if (!idTransporteExterno) {
        warn('Validación', 'Debe seleccionar un proveedor de transporte externo');
        return;
      }
      if (!idCamion) {
        warn('Validación', 'Debe seleccionar un camión');
        return;
      }
      if (!idPiloto) {
        warn('Validación', 'Debe seleccionar un piloto');
        return;
      }
    }

    if (!idSucursalSalida) {
      warn('Validación', 'Debe seleccionar sucursal de salida');
      return;
    }
    if (!idSucursalRegreso) {
      warn('Validación', 'Debe seleccionar sucursal de regreso');
      return;
    }
    if (!datosSalida.fecha) {
      warn('Validación', 'Debe seleccionar fecha de salida');
      return;
    }
    if (!fechaSalida) {
      setDatosSalida((prev) => ({ ...prev, tocada: true }));
      warn('Validación', 'Debe ingresar una hora de salida válida (ej. 05:30 con PM, o 17:30)');
      return;
    }
    if (!datosEntrada.fecha) {
      warn('Validación', 'Debe seleccionar fecha de entrada');
      return;
    }
    if (!fechaEntrada) {
      setDatosEntrada((prev) => ({ ...prev, tocada: true }));
      warn('Validación', 'Debe ingresar una hora de entrada válida (ej. 05:30 con PM, o 17:30)');
      return;
    }

    // Validaciones lógicas de hora
    const ahora = new Date();
    const salida = new Date(fechaSalida);
    const entrada = new Date(fechaEntrada);

    // Validar que la fecha de retorno sea posterior a la salida (mínimo 1 hora)
    const diferenciaMs = entrada.getTime() - salida.getTime();
    const diferenciaHoras = diferenciaMs / (1000 * 60 * 60);

    if (diferenciaHoras < 1) {
      warn('Validación', 'La fecha de retorno debe ser al menos 1 hora después de la salida');
      return;
    }

    // Validar que si la salida es hoy, debe ser al menos 10 minutos en el futuro
    const esMismoDia = salida.toDateString() === ahora.toDateString();
    if (esMismoDia) {
      const diferenciaMinutos = (salida.getTime() - ahora.getTime()) / (1000 * 60);
      if (diferenciaMinutos < 10) {
        warn('Validación', 'Si la salida es hoy, debe ser al menos 10 minutos en el futuro');
        return;
      }
    }

    if (idsSeleccionados.length === 0) {
      warn('Validación', 'Debe seleccionar al menos una factura');
      return;
    }

    setGuardando(true);
    try {
      const payload = {
        tipo_ruta: tipoRuta,
        id_camion: idCamion,
        id_piloto: idPiloto,
        id_auxiliar: idAuxiliar,
        id_transporte_externo: idTransporteExterno,
        id_sucursal_salida: idSucursalSalida,
        id_sucursal_regreso: idSucursalRegreso,
        fecha_salida_plan: toISODateTimeLocal(fechaSalida),
        fecha_entrada_plan: toISODateTimeLocal(fechaEntrada),
        facturas: idsSeleccionados.map(id => ({ id_factura_sel: id })),
        usuario: usuarioId
      };

      const resultado = await postRutaCompleta(payload);

      if (!resultado?.id_ruta) {
        err('Error', 'No se pudo crear la ruta');
        return;
      }

      const codigoRuta = resultado.codigo_ruta || resultado.str_codigo_ruta || `Ruta ${resultado.id_ruta}`;
      ok('Ruta Creada', `${codigoRuta} creada exitosamente`);

      // Generar PDF
      try {
        const datosPDF = await getRutaPDF({ id_ruta: resultado.id_ruta });
        
        generateRutaPdf(datosPDF, {
          company: {
            nombre: 'Comercializadora Eléctrica Ferretera, S.A.',
            direccion: '6a. Av. 14-12 Zona 9, Guatemala, Guatemala.',
            telefono: '(502) 2326 0202',
            nit: 'NIT 116426055'
          },
          logoBase64: logoDataUrl || ''
        });

        const codigoPDF = datosPDF.codigo_ruta || datosPDF.str_codigo_ruta || codigoRuta;
        ok('PDF', `PDF generado: ${codigoPDF}`);
      } catch (e) {
        console.error('Error generando PDF', e);
        const errorMsg = getApiErrorMessage(e, 'Error desconocido');
        warn('PDF', `Ruta creada pero no se pudo generar el PDF: ${errorMsg}`);
      }

      // Limpiar formulario
      limpiar();

    } catch (e) {
      console.error('Error guardando ruta', e);
      const errorMsg = getApiErrorMessage(e, 'No se pudo crear la ruta');
      err('Error al Guardar', errorMsg);
    } finally {
      setGuardando(false);
    }
  };

  const limpiar = () => {
    setTipoRuta('RL');
    setIdCamion(null);
    setIdPiloto(null);
    setIdAuxiliar(null);
    setIdTransporteExterno(null);
    setIdSucursalSalida(sucursalPorDefecto);
    setIdSucursalRegreso(sucursalPorDefecto);
    setDatosSalida(fechaHoraInicial('AM'));
    setDatosEntrada(fechaHoraInicial('PM'));
    setIdsSeleccionados([]);
    setFiltroFolio('');
    setFiltroMunicipio(null);
    setFiltroDepartamento(null);
    setFiltroCliente(null);
    setFiltroFechaDesde(null);
    setFiltroFechaHasta(null);
    buscarFacturas();
  };

  // No renderizar contenido hasta validar permisos
  if (checkingPermissions) {
    return (
      <Layout>
        <Toast ref={toastRef} />
        <div className="container-fluid py-0">
          <RutasNav />
        </div>
      </Layout>
    );
  }

  // Si no tiene permiso, no renderizar el formulario
  if (!canCreate) {
    return (
      <Layout>
        <Toast ref={toastRef} />
        <div className="container-fluid py-0">
          <RutasNav />
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <style>{`
        .compact-row td {
          padding: 0.4rem 0.5rem !important;
        }
        .p-datatable .p-datatable-tbody > tr > td {
          padding: 0.4rem 0.5rem;
        }
      `}</style>
      <Toast ref={toastRef} />
      <div className="container-fluid py-0">
        <RutasNav />
        <Card className="border-0 shadow-sm">
          <EncabezadoColapsable
            titulo={<h5 className="m-0">Crear Ruta de Distribución</h5>}
            colapsado={colapsadoRuta}
            onToggle={() => setColapsadoRuta(v => !v)}
          >
            <Button
              label="Guardar"
              icon="pi pi-save"
              severity="success"
              className="p-button-sm"
              onClick={handleGuardar}
              loading={guardando}
            />
            <Button
              label="Limpiar"
              icon="pi pi-refresh"
              severity="secondary"
              outlined
              className="p-button-sm"
              onClick={limpiar}
            />
          </EncabezadoColapsable>

          {/* Form datos de ruta */}
          <div className={`d-flex gap-2 flex-wrap px-3 pb-2 ${colapsadoRuta ? 'd-none' : ''}`}>
            {/* Selector de tipo de ruta */}
            <div style={{ width: '100%' }} className="mb-1">
              <label className="small text-muted d-block mb-1" style={{ fontSize: '0.75rem' }}>Tipo de Ruta *</label>
              <div className="d-flex gap-3">
                <div className="d-flex align-items-center">
                  <RadioButton
                    inputId="tipo-rt"
                    name="tipoRuta"
                    value="RL"
                    onChange={(e) => setTipoRuta(e.value)}
                    checked={tipoRuta === 'RL'}
                  />
                  <label htmlFor="tipo-rt" className="ms-2" style={{ fontSize: '0.85rem' }}>
                    RL - Ruta Larga
                  </label>
                </div>
                <div className="d-flex align-items-center">
                  <RadioButton
                    inputId="tipo-te"
                    name="tipoRuta"
                    value="TE"
                    onChange={(e) => setTipoRuta(e.value)}
                    checked={tipoRuta === 'TE'}
                  />
                  <label htmlFor="tipo-te" className="ms-2" style={{ fontSize: '0.85rem' }}>
                    TE - Transporte Externo
                  </label>
                </div>
                <div className="d-flex align-items-center">
                  <RadioButton
                    inputId="tipo-rc"
                    name="tipoRuta"
                    value="RC"
                    onChange={(e) => setTipoRuta(e.value)}
                    checked={tipoRuta === 'RC'}
                  />
                  <label htmlFor="tipo-rc" className="ms-2" style={{ fontSize: '0.85rem' }}>
                    RC - Ruta Corta
                  </label>
                </div>
              </div>
            </div>

            {/* Transporte Externo - solo si tipo es TE */}
            {tipoRuta === 'TE' && (
              <div style={{ width: 200 }}>
                <label className="small text-muted d-block mb-1" style={{ fontSize: '0.7rem' }}>Transporte Externo *</label>
                <Dropdown
                  value={idTransporteExterno}
                  options={transportes}
                  onChange={(e) => setIdTransporteExterno(e.value)}
                  optionLabel="str_nombre"
                  optionValue="int_id_transporte_externo"
                  placeholder="Seleccionar"
                  filter
                  showClear
                  className="p-inputtext-sm w-100"
                  appendTo="self"
                  style={{ fontSize: '0.85rem' }}
                />
              </div>
            )}

            <div style={{ width: 180 }}>
              <label className="small text-muted d-block mb-1" style={{ fontSize: '0.7rem' }}>Sucursal Salida *</label>
              <Dropdown
                value={idSucursalSalida}
                options={sucursales}
                onChange={(e) => setIdSucursalSalida(e.value)}
                optionLabel="str_nombre"
                optionValue="int_id_sucursal"
                placeholder="Seleccionar"
                filter
                showClear
                className="p-inputtext-sm w-100"
                appendTo="self"
                style={{ fontSize: '0.85rem' }}
              />
            </div>

            <div style={{ width: 180 }}>
              <label className="small text-muted d-block mb-1" style={{ fontSize: '0.7rem' }}>Sucursal Regreso *</label>
              <Dropdown
                value={idSucursalRegreso}
                options={sucursales}
                onChange={(e) => setIdSucursalRegreso(e.value)}
                optionLabel="str_nombre"
                optionValue="int_id_sucursal"
                placeholder="Seleccionar"
                filter
                showClear
                className="p-inputtext-sm w-100"
                appendTo="self"
                style={{ fontSize: '0.85rem' }}
              />
            </div>

            <div style={{ width: 180 }}>
              <label className="small text-muted d-block mb-1" style={{ fontSize: '0.7rem' }}>Camión *</label>
              <Dropdown
                value={idCamion}
                options={camiones}
                onChange={(e) => setIdCamion(e.value)}
                optionLabel="str_placa"
                optionValue="int_id_camion"
                placeholder="Seleccionar"
                filter
                showClear
                className="p-inputtext-sm w-100"
                appendTo="self"
                style={{ fontSize: '0.85rem' }}
              />
            </div>

            <div style={{ width: 220 }}>
              <label className="small text-muted d-block mb-1" style={{ fontSize: '0.7rem' }}>Piloto *</label>
              <Dropdown
                value={idPiloto}
                options={pilotos}
                onChange={(e) => setIdPiloto(e.value)}
                optionLabel="str_nombre"
                optionValue="int_id_personal"
                placeholder="Seleccionar"
                filter
                showClear
                className="p-inputtext-sm w-100"
                appendTo="self"
                style={{ fontSize: '0.85rem' }}
              />
            </div>

            <div style={{ width: 220 }}>
              <label className="small text-muted d-block mb-1" style={{ fontSize: '0.7rem' }}>Auxiliar</label>
              <Dropdown
                value={idAuxiliar}
                options={auxiliares}
                onChange={(e) => setIdAuxiliar(e.value)}
                optionLabel="str_nombre"
                optionValue="int_id_personal"
                placeholder="Opcional"
                filter
                showClear
                className="p-inputtext-sm w-100"
                appendTo="self"
              />
            </div>

            <div className="d-flex flex-wrap" style={{ width: '100%' }}>
              <CampoFechaHora
                etiqueta="Fecha Salida Plan *"
                datos={datosSalida}
                onChange={actualizarDatosSalida}
                minDate={minFechaSalida}
                maxDate={maxFechaSalida}
              />

              <Divider layout="vertical" className="d-none d-lg-block mx-3" />

              <CampoFechaHora
                etiqueta="Fecha Entrada Plan *"
                datos={datosEntrada}
                onChange={setDatosEntrada}
                minDate={minFechaEntrada}
                maxDate={maxFechaEntrada}
                marcarFechaManual
              />
            </div>
          </div>
        </Card>

        {/* Facturas disponibles */}
        <Card className="mt-3 border-0 shadow-sm">
          <EncabezadoColapsable
            titulo={<h6 className="m-0">Facturas Disponibles</h6>}
            colapsado={colapsadoDisponibles}
            onToggle={() => setColapsadoDisponibles(v => !v)}
            className="mb-2"
          >
            <Button
              label="Buscar"
              icon="pi pi-search"
              size="small"
              loading={loadingFacturas}
              onClick={buscarFacturas}
            />
            <Button
              label="Limpiar"
              icon="pi pi-filter-slash"
              size="small"
              severity="secondary"
              outlined
              onClick={limpiarFiltrosFacturas}
            />
          </EncabezadoColapsable>

          <div className={colapsadoDisponibles ? 'd-none' : ''}>
          <div className="d-flex gap-2 mb-2 flex-wrap">
            <div style={{ width: 140 }}>
              <label className="small text-muted mb-1 d-block" style={{ fontSize: '0.7rem' }}>Folio</label>
              <InputText
                value={filtroFolio}
                onChange={(e) => setFiltroFolio(e.target.value)}
                placeholder="Buscar por folio"
                className="p-inputtext-sm w-100"
                style={{ fontSize: '0.85rem' }}
              />
            </div>

            {(tipoRuta === 'RL' || tipoRuta === 'RT' || tipoRuta === 'RC') ? (
              <>
                <div style={{ width: 150 }}>
                  <label className="small text-muted mb-1 d-block" style={{ fontSize: '0.7rem' }}>Departamento</label>
                  <Dropdown
                    value={filtroDepartamento}
                    options={departamentosOpts}
                    onChange={(e) => setFiltroDepartamento(e.value)}
                    placeholder="Todos"
                    showClear
                    filter
                    className="p-inputtext-sm w-100"
                    appendTo="self"
                    style={{ fontSize: '0.85rem' }}
                  />
                </div>

                <div style={{ width: 150 }}>
                  <label className="small text-muted mb-1 d-block" style={{ fontSize: '0.7rem' }}>Municipio</label>
                  <Dropdown
                    value={filtroMunicipio}
                    options={municipiosOpts}
                    onChange={(e) => setFiltroMunicipio(e.value)}
                    placeholder={filtroDepartamento ? "Todos" : "Seleccione depto."}
                    showClear
                    filter
                    disabled={!filtroDepartamento}
                    className="p-inputtext-sm w-100"
                    appendTo="self"
                    style={{ fontSize: '0.85rem' }}
                  />
                </div>
              </>
            ) : (
              <div style={{ width: 180 }}>
                <label className="small text-muted mb-1 d-block" style={{ fontSize: '0.7rem' }}>Transporte Externo</label>
                <Dropdown
                  value={filtroTransporte}
                  options={transportesOpts}
                  onChange={(e) => setFiltroTransporte(e.value)}
                  placeholder="Todos"
                  showClear
                  filter
                  className="p-inputtext-sm w-100"
                  appendTo="self"
                  style={{ fontSize: '0.85rem' }}
                />
              </div>
            )}

            <div style={{ width: 180 }}>
              <label className="small text-muted mb-1 d-block" style={{ fontSize: '0.7rem' }}>Cliente</label>
              <Dropdown
                value={filtroCliente}
                options={clientesOpts}
                onChange={(e) => setFiltroCliente(e.value)}
                placeholder="Todos"
                showClear
                filter
                className="p-inputtext-sm w-100"
                appendTo="self"
                style={{ fontSize: '0.85rem' }}
              />
            </div>

            <div style={{ width: 170 }}>
              <label className="small text-muted mb-1 d-block" style={{ fontSize: '0.7rem' }}>Fecha Desde</label>
              <Calendar
                value={filtroFechaDesde}
                onChange={(e) => setFiltroFechaDesde(e.value)}
                placeholder="dd/mm/yyyy"
                showIcon
                showButtonBar
                className="p-inputtext-sm"
                appendTo="self"
                style={{ fontSize: '0.8rem' }}
              />
            </div>

            <div style={{ width: 170 }}>
              <label className="small text-muted mb-1 d-block" style={{ fontSize: '0.7rem' }}>Fecha Hasta</label>
              <Calendar
                value={filtroFechaHasta}
                onChange={(e) => setFiltroFechaHasta(e.value)}
                placeholder="dd/mm/yyyy"
                showIcon
                showButtonBar
                className="p-inputtext-sm"
                appendTo="self"
                style={{ fontSize: '0.8rem' }}
              />
            </div>

          </div>

          <DataTable
            value={facturasDisponibles}
            loading={loadingFacturas}
            paginator
            rows={10}
            removableSort
            emptyMessage="No hay facturas disponibles"
            size="small"
            stripedRows
            rowClassName={() => 'compact-row'}
            style={{ fontSize: '0.85rem' }}
          >
            <Column
              body={(row) => (
                <Button
                  icon="pi pi-plus"
                  rounded
                  text
                  severity="success"
                  size="small"
                  onClick={() => agregarFactura(row.id_factura_sel)}
                  tooltip="Agregar a ruta"
                  tooltipOptions={{ position: 'top' }}
                />
              )}
              style={{ width: '3rem', padding: '0.3rem' }}
            />
            <Column
              header="Días"
              style={{ width: '3.2rem', minWidth: '3.2rem', textAlign: 'center', padding: '0.25rem' }}
              body={(row) => {
                const indicator = getDiasIndicator(row.fecha_factura);
                if (!indicator) return null;
                return (
                  <div
                    title={`${indicator.dias} día${indicator.dias !== 1 ? 's' : ''} desde la creación`}
                    style={{
                      width: 36,
                      height: 36,
                      borderRadius: '50%',
                      backgroundColor: indicator.color,
                      color: '#000',
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
              header="Folio"
              sortable
              style={{ width: '9rem', fontSize: '0.85rem' }}
            />
            <Column
              field="nombre_cliente"
              header="Cliente"
              sortable
              style={{ width: '20rem', fontSize: '0.85rem' }}
            />
            <Column
              header="Ubicación"
              body={celdaUbicacion}
              style={{ minWidth: '14rem' }}
            />
            <Column
              header="Transporte"
              body={(row) => {
                if (tipoRuta === 'TE') {
                  const nombreTE = row.nombre_transporte_externo || 'Sin transporte';
                  return <span style={{ fontSize: '0.85rem', fontWeight: '500' }}>{nombreTE}</span>;
                }
                const label = tipoRuta === 'RC' ? 'Ruta Corta' : 'Ruta Larga';
                return <span style={{ fontSize: '0.85rem', color: '#6c757d' }}>{label}</span>;
              }}
              style={{ width: '12rem', fontSize: '0.85rem' }}
            />
          </DataTable>
          </div>
        </Card>

        {/* Facturas seleccionadas */}
        <Card className="mt-3 border-0 shadow-sm">
          <EncabezadoColapsable
            titulo={(
              <h6 className="m-0">
                Facturas Seleccionadas: <span className="text-primary">{idsSeleccionados.length}</span>
              </h6>
            )}
            colapsado={colapsadoSeleccionadas}
            onToggle={() => setColapsadoSeleccionadas(v => !v)}
            className="mb-2"
          />

          <div className={colapsadoSeleccionadas ? 'd-none' : ''}>
          <DataTable
            value={facturasSeleccionadas}
            emptyMessage="No hay facturas seleccionadas"
            size="small"
            stripedRows={false}
            rowClassName={() => 'compact-row'}
            style={{ fontSize: '0.85rem' }}
          >
            <Column
              body={(row) => (
                <Button
                  icon="pi pi-trash"
                  rounded
                  text
                  severity="danger"
                  size="small"
                  onClick={() => quitarFactura(row.id_factura_sel)}
                  tooltip="Quitar de ruta"
                  tooltipOptions={{ position: 'top' }}
                />
              )}
              style={{ width: '3rem', padding: '0.3rem' }}
            />
            <Column
              field="folio_factura"
              header="Folio"
              style={{ width: '9rem', fontSize: '0.85rem' }}
            />
            <Column
              field="nombre_cliente"
              header="Cliente"
              style={{ width: '16rem', fontSize: '0.85rem' }}
            />
            <Column
              header="Ubicación"
              body={celdaUbicacion}
              style={{ minWidth: '14rem' }}
            />
            <Column
              header="Transporte"
              body={(row) => {
                if (tipoRuta === 'TE') {
                  const nombreTE = row.nombre_transporte_externo || 'Sin transporte';
                  return <span style={{ fontSize: '0.85rem', fontWeight: '500' }}>{nombreTE}</span>;
                }
                const label = tipoRuta === 'RC' ? 'Ruta Corta' : 'Ruta Larga';
                return <span style={{ fontSize: '0.85rem', color: '#6c757d' }}>{label}</span>;
              }}
              style={{ width: '12rem', fontSize: '0.85rem' }}
            />
          </DataTable>
          </div>
        </Card>
      </div>
    </Layout>
  );
}