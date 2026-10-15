// src/pages/bpkm/monitoreo/MonitoreoRegistro.jsx
import { useEffect, useMemo, useRef, useState } from 'react';
import { Dropdown } from 'primereact/dropdown';
import { Calendar } from 'primereact/calendar';
import { InputMask } from 'primereact/inputmask';
import { ToggleButton } from 'primereact/togglebutton';
import { InputTextarea } from 'primereact/inputtextarea';
import { Button } from 'primereact/button';
import { RadioButton } from 'primereact/radiobutton';
import { Message } from 'primereact/message';
import { patchMonitoreoBpkm, getMonitoreoPorRuta, getRutasConMonitoreo } from '@services/bpkm/bpkmMonitoreo';
import { getApiErrorMessage } from '@utils/apiError';
import { formatDateTimeGT, formatDateOnly } from '@utils/dateSafe';
import { HORA_12_REGEX, a24Horas, completarMinutosEnBlanco, procesarHoraEscrita, moverCursorAMinutos } from '@utils/hora12';

export default function MonitoreoRegistro({ rutaInicial, onExito, onCancelar }) {
  const horaRef = useRef(null);
  const storeId = useMemo(() => Number(localStorage.getItem('storeId') || 0), []);

  const [ruta, setRuta] = useState(rutaInicial);
  const [rutas, setRutas] = useState([]);
  const [tipo, setTipo] = useState('S'); // 'S' = Salida, 'E' = Entrada
  const [fechaHora, setFechaHora] = useState(new Date());
  const [fechaHoraInicial, setFechaHoraInicial] = useState(new Date());
  // Buffer del InputMask de hora, independiente de fechaHora: puede quedar incompleto mientras se
  // escribe (ej. "08:_") y solo se aplica a fechaHora cuando el patrón HH:mm ya es válido. Empieza
  // vacío a propósito - no se prellena con la hora planificada.
  const [horaTexto, setHoraTexto] = useState('');
  const [ampm, setAmpm] = useState('AM');
  const [ampmManual, setAmpmManual] = useState(false);
  // Evita mostrar el error de "hora inválida" desde el primer render, cuando el campo está vacío
  // porque nadie lo ha tocado todavía, no porque el usuario haya escrito algo incorrecto.
  const [horaTocada, setHoraTocada] = useState(false);
  const [comentario, setComentario] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [monitoreoActual, setMonitoreoActual] = useState({ salida: null, entrada: null });
  const [bpkmAprobado, setBpkmAprobado] = useState(false);

  useEffect(() => {
    if (!rutaInicial) {
      cargarRutas();
    }
  }, [rutaInicial]);

  useEffect(() => {
    if (ruta?.id_ruta) {
      // Verificar si BPKM está aprobado
      if (rutaInicial) {
        setBpkmAprobado(rutaInicial.bpkm_aprobado === true);
      }

      // Si la ruta viene con info de monitoreo (desde rutaInicial), usarla directamente
      if (rutaInicial && rutaInicial.monitoreo_salida !== undefined) {
        setMonitoreoActual({
          salida: rutaInicial.monitoreo_salida,
          entrada: rutaInicial.monitoreo_entrada
        });

        // Auto-seleccionar tipo y establecer fecha por defecto
        if (!rutaInicial.monitoreo_salida) {
          setTipo('S');
          // Usar fecha de salida planificada como default (solo la fecha - la hora se deja en
          // blanco a propósito, ver comentario de horaTexto)
          if (rutaInicial.fecha_salida_plan) {
            const fechaPlan = new Date(rutaInicial.fecha_salida_plan);
            setFechaHora(fechaPlan);
            setFechaHoraInicial(fechaPlan);
            setHoraTexto('');
            setHoraTocada(false);
            setAmpm('AM');
            setAmpmManual(false);
          }
        } else if (!rutaInicial.monitoreo_entrada) {
          setTipo('E');
          // Usar fecha de entrada planificada como default (solo la fecha)
          if (rutaInicial.fecha_entrada_plan) {
            const fechaPlan = new Date(rutaInicial.fecha_entrada_plan);
            setFechaHora(fechaPlan);
            setFechaHoraInicial(fechaPlan);
            setHoraTexto('');
            setHoraTocada(false);
            setAmpm('AM');
            setAmpmManual(false);
          }
        }
      } else {
        // Si no, cargar desde la API
        cargarMonitoreoActual();
      }
    }
  }, [ruta, rutaInicial]);

  async function cargarRutas() {
    try {
      // limit: 100 (tope del backend) - este selector necesita ver todas las rutas abiertas de la
      // sucursal, no solo una página; con paginación real, sin esto solo traería las primeras 25.
      const data = await getRutasConMonitoreo({
        estado_codigo: '',
        fecha_desde: null,
        fecha_hasta: null,
        id_suc_salida: storeId, // Filtrar por sucursal del usuario logueado
        id_camion: 0,
        id_piloto: 0,
        id_auxiliar: 0,
        creado_por: 0,
        limit: 100
      });

      // Filtrar rutas válidas - incluir también Finalizadas y Liquidadas
      const rutasValidas = data.items.filter(r =>
        r.estado_nombre === 'Creada' ||
        r.estado_nombre === 'En curso' ||
        r.estado_nombre === 'Regresada' ||
        r.estado_nombre === 'Finalizada' ||
        r.estado_nombre === 'Liquidada'
      );

      setRutas(rutasValidas || []);
    } catch (e) {
      console.error(e);
      setError(getApiErrorMessage(e, 'No se pudieron cargar las rutas'));
    }
  }

  async function cargarMonitoreoActual() {
    if (!ruta?.id_ruta) return;

    try {
      const eventos = await getMonitoreoPorRuta(ruta.id_ruta);
      const salida = eventos.find(e => e.tipo === 'S');
      const entrada = eventos.find(e => e.tipo === 'E');

      setMonitoreoActual({ salida, entrada });

      // Auto-seleccionar tipo basado en lo que falta y establecer fecha planificada
      if (!salida) {
        setTipo('S');
        if (ruta.fecha_salida_plan) {
          const fechaPlan = new Date(ruta.fecha_salida_plan);
          setFechaHora(fechaPlan);
          setFechaHoraInicial(fechaPlan);
          setHoraTexto('');
          setHoraTocada(false);
          setAmpm('AM');
            setAmpmManual(false);
        }
      } else if (!entrada) {
        setTipo('E');
        if (ruta.fecha_entrada_plan) {
          const fechaPlan = new Date(ruta.fecha_entrada_plan);
          setFechaHora(fechaPlan);
          setFechaHoraInicial(fechaPlan);
          setHoraTexto('');
          setHoraTocada(false);
          setAmpm('AM');
            setAmpmManual(false);
        }
      }
    } catch (e) {
      console.error(e);
    }
  }

  function handleFechaChange(e) {
    const nuevaFecha = e.value;
    if (!nuevaFecha) return;
    setFechaHora((prev) => {
      const next = new Date(prev);
      next.setFullYear(nuevaFecha.getFullYear(), nuevaFecha.getMonth(), nuevaFecha.getDate());
      return next;
    });
  }

  // Combina hora de 12h + AM/PM en hora de 24h (12 AM = 0, 12 PM = 12) y la aplica a fechaHora
  // solo si horaStr ya es una hora completa y válida.
  function aplicarHoraSiValida(horaStr, ampmValor) {
    const match = HORA_12_REGEX.exec(horaStr);
    if (!match) return; // incompleto o inválido - no tocar fechaHora todavía
    const [, hh12, mm] = match;
    const hh24 = a24Horas(hh12, ampmValor);
    setFechaHora((prev) => {
      const next = new Date(prev);
      next.setHours(hh24, Number(mm), 0, 0);
      return next;
    });
  }

  function handleHoraChange(e) {
    const valor = e.value || '';
    setHoraTocada(true);
    const cambio = aplicarEscritura(valor);
    if (cambio) moverCursorAMinutos(horaRef.current?.getElement?.());
  }

  // Devuelve true si el valor mostrado cambió respecto a lo que el usuario tecleó (cero inicial u
  // hora de 24 horas convertida), que es cuando hay que corregir el cursor.
  function aplicarEscritura(valor) {
    const r = procesarHoraEscrita(valor, ampm, ampmManual);
    setHoraTexto(r.hora);
    setAmpm(r.ampm);
    aplicarHoraSiValida(r.hora, r.ampm);
    return r.hora !== valor;
  }

  function handleHoraBlur() {
    setHoraTocada(true);
    aplicarEscritura(completarMinutosEnBlanco(horaTexto));
  }

  function handleAmpmChange(e) {
    const valor = e.value ? 'PM' : 'AM';
    setAmpm(valor);
    setAmpmManual(true);
    aplicarHoraSiValida(horaTexto, valor);
  }

  // true si horaTexto todavía no es una hora real y válida - bloquea el envío y activa el estado
  // visual de error, para que nunca se registre una hora distinta a la que se ve en el campo.
  const horaInvalida = !HORA_12_REGEX.test(horaTexto);

  // Sin nada que registrar: BPKM ya aprobado, o ya existen salida y entrada. El botón de envío ya
  // se deshabilita en estos casos; los campos de entrada también deben quedar de solo lectura.
  const soloLectura = bpkmAprobado || (monitoreoActual.salida !== null && monitoreoActual.entrada !== null);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');

    if (!ruta) {
      setError('Debe seleccionar una ruta');
      return;
    }

    if (horaInvalida) {
      setHoraTocada(true);
      setError('La hora ingresada no es válida - ejemplos: 05:30 con PM, o 17:30');
      return;
    }

    // Validar que no se registre entrada sin salida
    if (tipo === 'E') {
      if (!monitoreoActual.salida) {
        setError('No se puede registrar la entrada porque no se ha registrado la salida');
        return;
      }

      // Validar que fecha de entrada sea posterior a salida
      const fechaSalida = new Date(monitoreoActual.salida.fecha_hora);
      if (fechaHora <= fechaSalida) {
        setError('La fecha de entrada debe ser posterior a la fecha de salida');
        return;
      }
    }

    try {
      setLoading(true);

      // Convertir fecha a formato local sin conversión UTC
      // Crear string en formato ISO local: YYYY-MM-DD HH:mm:ss
      const year = fechaHora.getFullYear();
      const month = String(fechaHora.getMonth() + 1).padStart(2, '0');
      const day = String(fechaHora.getDate()).padStart(2, '0');
      const hours = String(fechaHora.getHours()).padStart(2, '0');
      const minutes = String(fechaHora.getMinutes()).padStart(2, '0');
      const seconds = String(fechaHora.getSeconds()).padStart(2, '0');
      const fechaLocal = `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;

      // El backend toma el usuario del token, no del body.
      const payload = {
        id_ruta: ruta.id_ruta,
        tipo,
        fecha_hora: fechaLocal,
        comentario: comentario.trim() || null
      };

      await patchMonitoreoBpkm(payload);

      if (onExito) onExito();
    } catch (e) {
      console.error('Error al registrar monitoreo:', e);
      setError(getApiErrorMessage(e, 'Error al registrar monitoreo'));
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="p-fluid">
      {/* Alerta si BPKM está aprobado */}
      {bpkmAprobado && rutaInicial && (
        <Message
          severity="warn"
          className="mb-3 w-100"
          content={
            <div>
              <div className="small text-danger mt-1">No se puede realizar el registro de monitoreo.</div>
            </div>
          }
        />
      )}

      {error && (
        <Message severity="error" text={error} className="mb-3 w-100" />
      )}

      {/* Selector de ruta (solo si no viene pre-seleccionada) */}
      {!rutaInicial && (
        <div className="field mb-3">
          <label htmlFor="ruta" className="font-semibold">
            Ruta <span className="text-danger">*</span>
          </label>
          <Dropdown
            id="ruta"
            value={ruta}
            onChange={(e) => setRuta(e.value)}
            options={rutas}
            optionLabel="codigo_ruta"
            placeholder="Seleccionar ruta"
            filter
            filterBy="codigo_ruta,piloto,auxiliar,camion"
            itemTemplate={(r) => (
              <div>
                <div className="font-bold">{r.codigo_ruta}</div>
                <div className="text-sm text-muted">
                  {r.piloto} / {r.auxiliar || 'Sin auxiliar'} - {r.camion} - {r.estado_nombre}
                </div>
              </div>
            )}
            valueTemplate={(r) => (r ? r.codigo_ruta : 'Seleccionar ruta')}
            className="w-100"
            appendTo="self"
            required
          />
        </div>
      )}

      {/* Info de ruta pre-seleccionada */}
      {rutaInicial && (
        <div className="mb-3 p-3 bg-body-tertiary border rounded">
          <div className="font-bold mb-2">Ruta: {ruta?.codigo_ruta}</div>
          <div className="text-sm mb-1">
            <strong>Piloto:</strong> {ruta?.piloto}
          </div>
          <div className="text-sm mb-1">
            <strong>Auxiliar:</strong> {ruta?.auxiliar || '-'}
          </div>
          <div className="text-sm mb-1">
            <strong>Camión:</strong> {ruta?.camion}
          </div>
          {ruta?.fecha_salida_plan && (
            <div className="text-sm mb-1">
              <strong>Salida planificada:</strong>{' '}
              {formatDateTimeGT(ruta.fecha_salida_plan)}
            </div>
          )}
          {ruta?.fecha_entrada_plan && (
            <div className="text-sm">
              <strong>Entrada planificada:</strong>{' '}
              {formatDateTimeGT(ruta.fecha_entrada_plan)}
            </div>
          )}
        </div>
      )}

      {/* Estado actual de monitoreo */}
      {ruta && (
        <div className="mb-3 p-3 border rounded">
          <div className="font-semibold mb-2">Estado actual:</div>
          <div className="d-flex gap-3">
            <div className="flex-1">
              <div className="small text-muted">Salida:</div>
              <div className={monitoreoActual.salida ? 'text-success' : 'text-danger'}>
                {monitoreoActual.salida ? (
                  <>
                    <i className="pi pi-check-circle me-1"></i>
                    Registrada {formatDateTimeGT(monitoreoActual.salida.fecha_hora)}
                  </>
                ) : (
                  <>
                    <i className="pi pi-times-circle me-1"></i>
                    No registrada
                  </>
                )}
              </div>
            </div>
            <div className="flex-1">
              <div className="small text-muted">Entrada:</div>
              <div className={monitoreoActual.entrada ? 'text-success' : 'text-warning'}>
                {monitoreoActual.entrada ? (
                  <>
                    <i className="pi pi-check-circle me-1"></i>
                    Registrada {formatDateTimeGT(monitoreoActual.entrada.fecha_hora)}
                  </>
                ) : (
                  <>
                    <i className="pi pi-times-circle me-1"></i>
                    No registrada
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tipo de registro */}
      <div className="field mb-3">
        <label className="font-semibold mb-2 d-block">
          Tipo de Registro <span className="text-danger">*</span>
        </label>
        <div className="d-flex gap-4">
          <div className="flex align-items-center">
            <RadioButton
              inputId="tipo_salida"
              name="tipo"
              value="S"
              onChange={(e) => setTipo(e.value)}
              checked={tipo === 'S'}
              disabled={monitoreoActual.salida !== null}
            />
            <label htmlFor="tipo_salida" className="ms-2">
              Salida {monitoreoActual.salida && <span className="text-muted">(ya registrada)</span>}
            </label>
          </div>
          <div className="flex align-items-center">
            <RadioButton
              inputId="tipo_entrada"
              name="tipo"
              value="E"
              onChange={(e) => setTipo(e.value)}
              checked={tipo === 'E'}
              disabled={!monitoreoActual.salida || monitoreoActual.entrada !== null}
            />
            <label htmlFor="tipo_entrada" className="ms-2">
              Entrada {(!monitoreoActual.salida || monitoreoActual.entrada) && <span className="text-muted">
                {!monitoreoActual.salida ? '(requiere salida)' : '(ya registrada)'}
              </span>}
            </label>
          </div>
        </div>
      </div>

      {/* Fecha (Calendar), hora en formato 12h (InputMask) y AM/PM (ToggleButton) en controles
          separados. */}
      <div className="field mb-3">
        <label className="font-semibold d-block mb-2">
          Fecha y Hora <span className="text-danger">*</span>
        </label>
        <div className="row g-2">
          <div className="col-6">
            <Calendar
              id="fechaHora"
              value={fechaHora}
              onChange={handleFechaChange}
              showIcon
              className="w-100"
              dateFormat="dd/mm/yy"
              appendTo="self"
              disabled={soloLectura}
              required
              minDate={tipo === 'S'
                ? (ruta?.fecha_salida_plan ? new Date(new Date(ruta.fecha_salida_plan).setHours(0, 0, 0, 0)) : null)
                : (monitoreoActual.salida?.fecha_hora ? new Date(new Date(monitoreoActual.salida.fecha_hora).setHours(0, 0, 0, 0)) : null)
              }
              maxDate={tipo === 'S'
                ? (ruta?.fecha_salida_plan ? new Date(new Date(ruta.fecha_salida_plan).setHours(23, 59, 59, 999)) : null)
                : (ruta?.fecha_entrada_plan ? (() => {
                    const maxDate = new Date(ruta.fecha_entrada_plan);
                    maxDate.setDate(maxDate.getDate() + 10);
                    return maxDate;
                  })() : null)
              }
            />
          </div>
          <div className="col-3">
            <InputMask
              ref={horaRef}
              id="horaTexto"
              mask="99:99"
              placeholder="HH:mm"
              value={horaTexto}
              onChange={handleHoraChange}
              autoClear={false}
              onBlur={handleHoraBlur}
              className={`w-100 ${horaTocada && horaInvalida ? 'p-invalid' : ''}`}
              disabled={soloLectura}
              required
            />
          </div>
          <div className="col-3">
            <ToggleButton
              id="ampm"
              checked={ampm === 'PM'}
              onChange={handleAmpmChange}
              onLabel="PM"
              offLabel="AM"
              disabled={soloLectura}
              className="w-100"
            />
          </div>
        </div>
        {horaTocada && horaInvalida && (
          <small className="text-danger d-block mt-1">
            <i className="pi pi-exclamation-triangle me-1"></i>
            Hora inválida - ejemplos: 05:30 con PM, o 17:30
          </small>
        )}
        {!horaInvalida && horaTexto.startsWith('12') && (
          <small className="text-primary d-block mt-1 fw-semibold">
            <i className="pi pi-eye me-1"></i>
            {horaTexto} {ampm} = {ampm === 'AM' ? 'madrugada' : 'mediodía'} del {formatDateOnly(fechaHora)}
          </small>
        )}
        {!(horaTocada && horaInvalida) && fechaHoraInicial && (
          <small className="text-muted d-block mt-1">
            <i className="pi pi-info-circle me-1"></i>
            {tipo === 'S'
              ? 'Solo se permite registrar en el día planificado de salida'
              : 'Se permite registrar desde la fecha de salida hasta 10 días después de la entrada planificada'
            }
          </small>
        )}
      </div>

      {/* Comentario */}
      <div className="field mb-3">
        <label htmlFor="comentario" className="font-semibold">
          Comentario (opcional)
        </label>
        <InputTextarea
          id="comentario"
          value={comentario}
          onChange={(e) => setComentario(e.target.value)}
          rows={3}
          placeholder="Ingrese observaciones o comentarios..."
          maxLength={500}
          disabled={soloLectura}
        />
        <small className="text-muted">{comentario.length}/500 caracteres</small>
      </div>

      {/* Botones */}
      <div className="d-flex gap-2 justify-content-end mt-4">
        <Button
          type="button"
          label="Cancelar"
          icon="pi pi-times"
          severity="secondary"
          outlined
          onClick={onCancelar}
          disabled={loading}
        />
        <Button
          type="submit"
          label="Registrar"
          icon="pi pi-check"
          severity="success"
          loading={loading}
          disabled={
            !ruta ||
            bpkmAprobado ||
            horaInvalida ||
            (tipo === 'S' && monitoreoActual.salida !== null) ||
            (tipo === 'E' && (!monitoreoActual.salida || monitoreoActual.entrada !== null))
          }
        />
      </div>
    </form>
  );
}
