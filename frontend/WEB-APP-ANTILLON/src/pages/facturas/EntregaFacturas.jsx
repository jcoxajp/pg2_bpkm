import { useState, useEffect, useCallback, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  ArrowLeft,
  RefreshCw,
  Calendar,
  CheckCircle2,
  Truck,
  MapPin,
  User,
  X,
  FileText,
  AlertTriangle,
} from 'lucide-react'
import { Breadcrumbs } from '@ui'
import { obtenerRutasEntregaFacturas } from '@services'

export default function EntregaFacturas() {
  const navigate = useNavigate()

  // Lista de rutas principales
  const [rutas, setRutas] = useState([])
  const [cargando, setCargando] = useState(true)

  // Toast flotante
  const [toastInfo, setToastInfo] = useState({ msg: '', type: 'success' })
  const toastTimerRef = useRef(null)

  const mostrarToast = useCallback((msg, type = 'success', duracion = 3500) => {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current)
    setToastInfo({ msg, type })
    toastTimerRef.current = setTimeout(() => {
      setToastInfo({ msg: '', type: 'success' })
    }, duracion)
  }, [])

  // Cargar lista principal de rutas (GET /api/v1/entregafacturas)
  const cargarRutas = useCallback(async () => {
    setCargando(true)
    try {
      const res = await obtenerRutasEntregaFacturas()
      if (res?.ok && Array.isArray(res.rutas)) {
        setRutas(res.rutas)
      } else {
        setRutas([])
      }
    } catch (err) {
      console.error('Error al cargar rutas de entrega:', err)
      mostrarToast('Error al conectar con el servidor', 'error')
    } finally {
      setCargando(false)
    }
  }, [mostrarToast])

  useEffect(() => {
    cargarRutas()
  }, [cargarRutas])

  // Navegar a la pantalla de detalle de la ruta
  const abrirDetalleRuta = (uuid) => {
    navigate(`/entrega-facturas/${uuid}`)
  }

  return (
    <div className="w-full max-w-full overflow-x-hidden min-h-screen bg-base-100 p-3 sm:p-5 lg:p-6 text-base-content">
      {/* Toast Flotante */}
      {toastInfo.msg && (
        <div
          className="fixed top-4 right-4 z-[99999] flex items-center gap-2 px-4 py-2.5 rounded-xl shadow-xl text-white text-xs sm:text-sm font-medium transition-all animate-bounce bg-opacity-95 backdrop-blur-sm"
          style={{
            backgroundColor:
              toastInfo.type === 'error'
                ? '#dc2626'
                : toastInfo.type === 'warning'
                ? '#d97706'
                : '#059669',
          }}
        >
          {toastInfo.type === 'error' ? (
            <X className="w-4 h-4 shrink-0" />
          ) : toastInfo.type === 'warning' ? (
            <AlertTriangle className="w-4 h-4 shrink-0" />
          ) : (
            <CheckCircle2 className="w-4 h-4 shrink-0" />
          )}
          <span>{toastInfo.msg}</span>
        </div>
      )}

      {/* Breadcrumbs */}
      <div className="mb-3">
        <Breadcrumbs />
      </div>

      {/* Barra Superior: Contador a la izquierda, Botones alineados a la derecha */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
        {/* Contador / Resumen a la izquierda */}
        <div className="flex items-center gap-2">
          <span className="text-xs sm:text-sm text-base-content/70 font-medium">
            Total de Rutas: <strong className="text-base-content font-bold">{rutas.length}</strong>
          </span>
        </div>

        {/* Botones alineados a la derecha */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => navigate('/home')}
            className="btn btn-sm btn-ghost gap-1.5 text-base-content/70 hover:text-base-content border border-base-300 rounded-xl"
            title="Volver a la pantalla anterior"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Volver</span>
          </button>

          {/* Botón Refrescar en color esmeralda / verde */}
          <button
            onClick={cargarRutas}
            disabled={cargando}
            className="btn btn-sm bg-emerald-600 hover:bg-emerald-700 text-white border-emerald-600 hover:border-emerald-700 gap-1.5 rounded-xl font-medium shadow-xs transition-colors"
            title="Refrescar datos de rutas"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${cargando ? 'animate-spin' : ''}`} />
            <span>Refrescar</span>
          </button>
        </div>
      </div>

      {/* Contenido Principal: Tabla o Tarjetas */}
      {cargando ? (
        <div className="flex flex-col items-center justify-center py-20 bg-base-200/30 rounded-2xl border border-base-300">
          <span className="loading loading-spinner loading-lg text-primary mb-3"></span>
          <p className="text-sm text-base-content/60 font-medium">Cargando rutas de entrega...</p>
        </div>
      ) : rutas.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 bg-base-200/30 rounded-2xl border border-base-300 text-center px-4">
          <Truck className="w-12 h-12 text-base-content/30 mb-3" />
          <h3 className="text-base font-bold text-base-content mb-1">No hay rutas registradas</h3>
          <p className="text-xs text-base-content/60 max-w-sm mb-4">
            No se encontraron rutas de entrega disponibles en este momento.
          </p>
          <button onClick={cargarRutas} className="btn btn-sm btn-primary gap-1.5 rounded-xl">
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Actualizar</span>
          </button>
        </div>
      ) : (
        <>
          {/* Vista Escritorio (Tabla) */}
          <div className="hidden md:block bg-base-100 rounded-2xl border border-base-300 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="table table-zebra w-full text-xs sm:text-sm">
                <thead className="bg-base-200/60 text-base-content font-semibold border-b border-base-300">
                  <tr>
                    <th className="py-3.5 px-4">N° Ruta</th>
                    <th className="py-3.5 px-4">Sucursal Salida</th>
                    <th className="py-3.5 px-4">Piloto</th>
                    <th className="py-3.5 px-4">Auxiliar</th>
                    <th className="py-3.5 px-4">Camión</th>
                    <th className="py-3.5 px-4">Salida Plan</th>
                    <th className="py-3.5 px-4">Entrada Plan</th>
                    <th className="py-3.5 px-4 text-center">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {rutas.map((ruta) => (
                    <tr key={ruta.uuid} className="hover:bg-primary/5 transition-colors">
                      <td className="py-3 px-4 font-mono font-bold text-primary">
                        {ruta.numero_ruta}
                      </td>
                      <td className="py-3 px-4">
                        <span className="badge badge-ghost text-xs gap-1 font-medium">
                          <MapPin className="w-3 h-3 text-primary" />
                          {ruta.sucursal_salida || '—'}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-1.5 font-medium">
                          <User className="w-3.5 h-3.5 text-base-content/50" />
                          <span>{ruta.piloto || '—'}</span>
                        </div>
                      </td>
                      <td className="py-3 px-4 text-base-content/70">
                        {ruta.auxiliar || '—'}
                      </td>
                      <td className="py-3 px-4">
                        <span className="badge badge-outline text-xs gap-1 font-mono font-semibold">
                          <Truck className="w-3.5 h-3.5 text-secondary" />
                          {ruta.placa_camion || '—'}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-xs text-base-content/80">
                        <div className="flex items-center gap-1">
                          <Calendar className="w-3 h-3 text-base-content/40" />
                          <span>{ruta.fecha_salida_plan || '—'}</span>
                        </div>
                      </td>
                      <td className="py-3 px-4 text-xs text-base-content/80">
                        <div className="flex items-center gap-1">
                          <Calendar className="w-3 h-3 text-base-content/40" />
                          <span>{ruta.fecha_entrada_plan || '—'}</span>
                        </div>
                      </td>
                      <td className="py-3 px-4 text-center">
                        <button
                          onClick={() => abrirDetalleRuta(ruta.uuid)}
                          className="btn btn-xs sm:btn-sm btn-primary btn-outline gap-1 rounded-xl"
                          title="Ver facturas y detalles de la ruta"
                        >
                          <FileText className="w-3.5 h-3.5" />
                          <span>Ver Detalles</span>
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Vista Móvil (Tarjetas) */}
          <div className="md:hidden grid grid-cols-1 gap-3">
            {rutas.map((ruta) => (
              <div
                key={ruta.uuid}
                className="bg-base-100 rounded-2xl border border-base-300 p-4 shadow-sm space-y-3"
              >
                <div className="flex items-center justify-between border-b border-base-200 pb-2.5">
                  <div>
                    <span className="text-[10px] text-base-content/50 font-bold block uppercase tracking-wider">
                      Número de Ruta
                    </span>
                    <span className="font-mono font-bold text-sm text-primary">
                      {ruta.numero_ruta}
                    </span>
                  </div>
                  <span className="badge badge-outline text-xs gap-1 font-mono font-semibold">
                    <Truck className="w-3.5 h-3.5 text-secondary" />
                    {ruta.placa_camion || '—'}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <span className="text-[10px] text-base-content/50 block">Sucursal Salida</span>
                    <span className="font-medium flex items-center gap-1 mt-0.5">
                      <MapPin className="w-3 h-3 text-primary" />
                      {ruta.sucursal_salida || '—'}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] text-base-content/50 block">Piloto</span>
                    <span className="font-medium flex items-center gap-1 mt-0.5 truncate">
                      <User className="w-3 h-3 text-base-content/50" />
                      {ruta.piloto || '—'}
                    </span>
                  </div>
                  {ruta.auxiliar && (
                    <div className="col-span-2">
                      <span className="text-[10px] text-base-content/50 block">Auxiliar</span>
                      <span className="font-medium text-base-content/80">{ruta.auxiliar}</span>
                    </div>
                  )}
                  <div>
                    <span className="text-[10px] text-base-content/50 block">Salida Plan</span>
                    <span className="text-base-content/80 mt-0.5 flex items-center gap-1">
                      <Calendar className="w-3 h-3 text-base-content/40" />
                      {ruta.fecha_salida_plan || '—'}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] text-base-content/50 block">Entrada Plan</span>
                    <span className="text-base-content/80 mt-0.5 flex items-center gap-1">
                      <Calendar className="w-3 h-3 text-base-content/40" />
                      {ruta.fecha_entrada_plan || '—'}
                    </span>
                  </div>
                </div>

                <button
                  onClick={() => abrirDetalleRuta(ruta.uuid)}
                  className="btn btn-sm btn-primary w-full gap-1.5 rounded-xl mt-1"
                >
                  <FileText className="w-4 h-4" />
                  <span>Ver Facturas</span>
                </button>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
