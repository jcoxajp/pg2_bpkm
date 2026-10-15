import { useState, useEffect, useCallback, useRef, useMemo, Fragment } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
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
  Camera,
  Image as ImageIcon,
  Trash2,
  AlertTriangle,
  FileCheck,
  FileClock,
  Clock,
  Eye,
  ListFilter,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Building2,
  ChevronsUpDown,
  Plus,
} from 'lucide-react'
import { Breadcrumbs } from '@ui'
import {
  obtenerDetalleRutaEntrega,
  registrarEntregaFactura,
  obtenerArchivoFactura,
} from '@services'

const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024 // Límite por imagen: 10 MB
const MAX_TOTAL_SIZE_BYTES = 30 * 1024 * 1024 // Límite total: 30 MB

const RESULTADO_CONFIG = {
  ENT: {
    label: 'Entregado',
    badgeClass: 'badge-success text-white',
    icon: CheckCircle2,
    colorClass: 'text-emerald-600',
  },
  PARC: {
    label: 'Entrega Parcial',
    badgeClass: 'badge-warning text-white',
    icon: AlertTriangle,
    colorClass: 'text-amber-600',
  },
  FALL: {
    label: 'Fallida',
    badgeClass: 'badge-error text-white',
    icon: X,
    colorClass: 'text-rose-600',
  },
  PENDIENTE: {
    label: 'Pendiente',
    badgeClass: 'bg-amber-500 text-white font-semibold',
    icon: FileClock,
    colorClass: 'text-amber-600',
  },
}

export default function DetalleEntregaFacturas() {
  const navigate = useNavigate()
  const { uuid } = useParams()

  // Datos de la ruta
  const [ruta, setRuta] = useState(null)
  const [cargando, setCargando] = useState(true)

  // Factura activa seleccionada para abrir el modal de carga de foto
  const [facturaSeleccionada, setFacturaSeleccionada] = useState(null)
  const [modalFotoOpen, setModalFotoOpen] = useState(false)

  // Filtro de facturas en frontend ('TODOS' | 'PENDIENTES' | 'ENTREGADOS')
  const [filtroEstado, setFiltroEstado] = useState('TODOS')

  // Estado del formulario dentro del modal
  const [resultadoEntrega, setResultadoEntrega] = useState('ENT')
  const [motivoEntrega, setMotivoEntrega] = useState('')
  const [errorMotivo, setErrorMotivo] = useState(null)
  const [fotos, setFotos] = useState([])
  const [errorFoto, setErrorFoto] = useState(null)
  const [enviandoEntrega, setEnviandoEntrega] = useState(false)

  const fotosDuplicadasIds = useMemo(() => {
    const ids = new Set()
    for (let i = 0; i < fotos.length; i++) {
      for (let j = i + 1; j < fotos.length; j++) {
        const a = fotos[i]
        const b = fotos[j]
        const mismoNombreYTamaño =
          a.file && b.file && a.file.name === b.file.name && a.file.size === b.file.size
        const mismoPreview = a.preview && b.preview && a.preview === b.preview
        if (mismoNombreYTamaño || mismoPreview) {
          ids.add(a.id)
          ids.add(b.id)
        }
      }
    }
    return ids
  }, [fotos])

  // Estado para controlar qué grupos de clientes están expandidos (por defecto todos colapsados)
  const [gruposExpandidos, setGruposExpandidos] = useState({})

  // Ubicación GPS obligatoria (capturada en tiempo real para el envío)
  const [ubicacionGps, setUbicacionGps] = useState(null)
  const [obteniendoGps, setObteniendoGps] = useState(false)
  const [errorUbicacion, setErrorUbicacion] = useState(null)

  // Visor de foto ampliada a pantalla completa
  const [fotoVisualizadaUrl, setFotoVisualizadaUrl] = useState(null)
  const [fotoVisualizadaTitulo, setFotoVisualizadaTitulo] = useState('')
  const [fotosVisualizadas, setFotosVisualizadas] = useState([])
  const [indiceFotoVisualizada, setIndiceFotoVisualizada] = useState(0)
  const [cargandoArchivoFoto, setCargandoArchivoFoto] = useState(false)

  // Caché en memoria reconsultar la API si se abre la misma imagen varias veces
  const cacheEvidenciasRef = useRef(new Map())

  // Obtener archivo de evidencia con caché en memoria
  const obtenerArchivoFacturaConCache = useCallback(async (evidenciaUuid) => {
    if (!evidenciaUuid) return null
    if (cacheEvidenciasRef.current.has(evidenciaUuid)) {
      return cacheEvidenciasRef.current.get(evidenciaUuid)
    }
    const url = await obtenerArchivoFactura(evidenciaUuid)
    if (url) {
      cacheEvidenciasRef.current.set(evidenciaUuid, url)
    }
    return url
  }, [])

  // Navegación carrusel de imágenes
  const fotoAnterior = useCallback(() => {
    if (fotosVisualizadas.length <= 1) return
    setIndiceFotoVisualizada((prev) => {
      const nuevo = prev > 0 ? prev - 1 : fotosVisualizadas.length - 1
      setFotoVisualizadaUrl(fotosVisualizadas[nuevo])
      return nuevo
    })
  }, [fotosVisualizadas])

  const fotoSiguiente = useCallback(() => {
    if (fotosVisualizadas.length <= 1) return
    setIndiceFotoVisualizada((prev) => {
      const nuevo = prev < fotosVisualizadas.length - 1 ? prev + 1 : 0
      setFotoVisualizadaUrl(fotosVisualizadas[nuevo])
      return nuevo
    })
  }, [fotosVisualizadas])

  const cerrarVisorFoto = useCallback(() => {
    setFotoVisualizadaUrl(null)
    setFotosVisualizadas([])
    setIndiceFotoVisualizada(0)
  }, [])

  // Atajos de teclado (Escape, Flecha Izquierda, Flecha Derecha)
  useEffect(() => {
    if (!fotoVisualizadaUrl) return
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') cerrarVisorFoto()
      if (e.key === 'ArrowLeft') fotoAnterior()
      if (e.key === 'ArrowRight') fotoSiguiente()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [fotoVisualizadaUrl, fotoAnterior, fotoSiguiente, cerrarVisorFoto])

  // Helper para verificar si la factura cuenta con evidencias
  const tieneEvidenciasRegistradas = (factura) => {
    return (
      (Array.isArray(factura?.evidencias) && factura.evidencias.length > 0) ||
      Boolean(factura?.evidencia_uuid)
    )
  }

  // Referencia para input nativo de cámara
  const cameraInputRef = useRef(null)
  const reemplazandoFotoIdRef = useRef(null)

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

  // Cargar información de la ruta
  const cargarDetalleRuta = useCallback(async () => {
    if (!uuid) return
    setCargando(true)
    try {
      const res = await obtenerDetalleRutaEntrega(uuid)
      if (res?.ok && res.ruta) {
        setRuta(res.ruta)
      } else {
        mostrarToast(res?.message || 'No se pudo cargar la información de la ruta', 'error')
      }
    } catch (err) {
      console.error('Error al cargar detalle de ruta:', err)
      mostrarToast('Error de conexión con el servidor', 'error')
    } finally {
      setCargando(false)
    }
  }, [uuid, mostrarToast])

  useEffect(() => {
    cargarDetalleRuta()
  }, [cargarDetalleRuta])

  // Facturas filtradas por estado en frontend
  const totalFacturas = ruta?.facturas?.length || 0

  const countPendientes = useMemo(() => {
    return (ruta?.facturas || []).filter((f) => !f.resultado || f.resultado === 'PENDIENTE').length
  }, [ruta?.facturas])

  const countEntregados = useMemo(() => {
    return (ruta?.facturas || []).filter((f) => f.resultado === 'ENT').length
  }, [ruta?.facturas])

  const facturasFiltradas = useMemo(() => {
    if (!ruta?.facturas) return []
    if (filtroEstado === 'PENDIENTES') {
      return ruta.facturas.filter((f) => !f.resultado || f.resultado === 'PENDIENTE')
    }
    if (filtroEstado === 'ENTREGADOS') {
      return ruta.facturas.filter((f) => f.resultado === 'ENT')
    }
    return ruta.facturas
  }, [ruta?.facturas, filtroEstado])

  // Agrupar facturas por cliente / dirección de entrega para vista TreeTable
  const gruposClientes = useMemo(() => {
    if (!facturasFiltradas || facturasFiltradas.length === 0) return []

    const gruposMap = new Map()

    facturasFiltradas.forEach((factura) => {
      const direccionRaw = (factura.direccion || 'Sin Dirección').trim()
      const clave = direccionRaw.toLowerCase()

      if (!gruposMap.has(clave)) {
        gruposMap.set(clave, {
          id: clave,
          direccion: direccionRaw,
          cliente: factura.cliente || factura.nombre_cliente || null,
          facturas: [],
        })
      }

      gruposMap.get(clave).facturas.push(factura)
    })

    return Array.from(gruposMap.values()).map((grupo) => {
      const total = grupo.facturas.length
      const entregadas = grupo.facturas.filter((f) => f.resultado === 'ENT').length
      const pendientes = grupo.facturas.filter((f) => !f.resultado || f.resultado === 'PENDIENTE').length
      const parciales = grupo.facturas.filter((f) => f.resultado === 'PARC').length
      const fallidas = grupo.facturas.filter((f) => f.resultado === 'FALL').length

      return {
        ...grupo,
        total,
        entregadas,
        pendientes,
        parciales,
        fallidas,
      }
    })
  }, [facturasFiltradas])

  const toggleGrupo = useCallback((grupoId) => {
    setGruposExpandidos((prev) => ({
      ...prev,
      [grupoId]: !prev[grupoId],
    }))
  }, [])

  // Solo grupos con 2 o más facturas se consideran agrupaciones colapsables
  const gruposMultiples = useMemo(() => {
    return gruposClientes.filter((g) => g.total > 1)
  }, [gruposClientes])

  // Están todos expandidos si todos los grupos múltiples tienen su estado en true
  const todosExpandidos = useMemo(() => {
    if (gruposMultiples.length === 0) return false
    return gruposMultiples.every((g) => Boolean(gruposExpandidos[g.id]))
  }, [gruposMultiples, gruposExpandidos])

  const toggleTodosGrupos = useCallback(() => {
    if (todosExpandidos) {
      setGruposExpandidos({})
    } else {
      const nuevoEstado = {}
      gruposMultiples.forEach((g) => {
        nuevoEstado[g.id] = true
      })
      setGruposExpandidos(nuevoEstado)
    }
  }, [todosExpandidos, gruposMultiples])

  // Valida que latitud, longitud y precisión sean números reales válidos y distintos de 0, null o undefined
  const esUbicacionValida = (gps) => {
    if (!gps) return false
    const { latitud, longitud, precision_metros } = gps
    if (latitud === null || latitud === undefined || typeof latitud !== 'number' || isNaN(latitud) || latitud === 0) {
      return false
    }
    if (longitud === null || longitud === undefined || typeof longitud !== 'number' || isNaN(longitud) || longitud === 0) {
      return false
    }
    if (precision_metros === null || precision_metros === undefined || typeof precision_metros !== 'number' || isNaN(precision_metros) || precision_metros <= 0) {
      return false
    }
    return true
  }

  // Obtener coordenadas GPS en tiempo real de alta precisión (obligatorio para registrar entrega)
  const obtenerCoordenadasGPS = useCallback(() => {
    return new Promise((resolve, reject) => {
      if (!('geolocation' in navigator)) {
        const err = new Error('Tu navegador no permite acceder a tu ubicación.')
        setErrorUbicacion(err.message)
        reject(err)
        return
      }

      setObteniendoGps(true)
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setObteniendoGps(false)
          const lat = pos.coords.latitude
          const lng = pos.coords.longitude
          const acc = pos.coords.accuracy

          // Si el dispositivo devuelve ceros o coordenadas inválidas
          if (!lat || !lng || (lat === 0 && lng === 0) || !acc) {
            const err = new Error('Debes activar la ubicación en tu dispositivo.')
            setErrorUbicacion(err.message)
            reject(err)
            return
          }

          const coords = {
            latitud: lat,
            longitud: lng,
            precision_metros: acc,
          }
          setUbicacionGps(coords)
          setErrorUbicacion(null)
          resolve(coords)
        },
        (err) => {
          setObteniendoGps(false)
          let mensaje = 'No se pudo obtener tu ubicación.'
          if (err.code === 1) {
            mensaje = 'Debes permitir el acceso a tu ubicación para registrar esta factura.'
          } else if (err.code === 2) {
            mensaje = 'Asegúrate de tener encendida la ubicación de tu dispositivo para continuar.'
          } else if (err.code === 3) {
            mensaje = 'No se pudo obtener la ubicación. Intenta de nuevo.'
          }
          setErrorUbicacion(mensaje)
          reject(new Error(mensaje))
        },
        {
          enableHighAccuracy: true,
          timeout: 15000,
          maximumAge: 0,
        }
      )
    })
  }, [])

  // Solicitar ubicación en segundo plano al abrir el modal o seleccionar foto
  const solicitarUbicacionGPS = useCallback(() => {
    obtenerCoordenadasGPS().catch((err) => {
      console.warn('Ubicación GPS en segundo plano no disponible:', err?.message)
    })
  }, [obtenerCoordenadasGPS])

  // Procesar archivo fotográfico (permite JPG, PNG, WEBP y HEIC/HEIF)
  const procesarArchivoFoto = useCallback((file) => {
    if (!file) return
    setErrorFoto(null)

    const fileName = (file.name || '').toLowerCase()
    const isHeic =
      fileName.endsWith('.heic') ||
      fileName.endsWith('.heif') ||
      file.type === 'image/heic' ||
      file.type === 'image/heif'
    const isImage = (file.type && file.type.startsWith('image/')) || isHeic

    if (!isImage) {
      setErrorFoto('El archivo seleccionado no es una imagen válida (JPG, PNG, WEBP o HEIC).')
      mostrarToast('Selecciona un archivo de imagen (JPG, PNG, WEBP o HEIC)', 'warning')
      return
    }

    if (file.size > MAX_FILE_SIZE_BYTES) {
      setErrorFoto('La foto supera el límite de 10 MB.')
      mostrarToast('La foto supera los 10 MB permitidos', 'error')
      return
    }

    const idReemplazo = reemplazandoFotoIdRef.current
    const pesoExistente = fotos
      .filter((f) => f.id !== idReemplazo)
      .reduce((acc, f) => acc + (f.file?.size || 0), 0)

    if (pesoExistente + file.size > MAX_TOTAL_SIZE_BYTES) {
      setErrorFoto('El total de imágenes supera los 30 MB permitidos.')
      mostrarToast('El total de imágenes supera los 30 MB permitidos', 'error')
      return
    }

    const pesoFormateado =
      file.size >= 1024 * 1024
        ? `${(file.size / (1024 * 1024)).toFixed(1)} MB`
        : `${Math.round(file.size / 1024)} KB`

    const reader = new FileReader()
    reader.onload = (evt) => {
      const idReemplazo = reemplazandoFotoIdRef.current
      reemplazandoFotoIdRef.current = null

      const nuevaFoto = {
        id: idReemplazo || `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        file,
        preview: evt.target.result,
        nombre: file.name || `comprobante-${Date.now()}.${isHeic ? 'heic' : 'png'}`,
        peso: pesoFormateado,
        esHeic: isHeic,
      }
      setFotos((prev) => {
        if (idReemplazo) {
          return prev.map((f) => (f.id === idReemplazo ? nuevaFoto : f))
        }
        if (prev.length >= 3) {
          mostrarToast('Máximo 3 fotos permitidas', 'warning')
          return prev
        }
        const yaExiste = prev.some(
          (f) =>
            (f.file && f.file.name === file.name && f.file.size === file.size) ||
            (f.preview && f.preview === evt.target.result)
        )
        if (yaExiste) {
          mostrarToast('Este archivo ya ha sido agregado', 'warning')
        }
        return [...prev, nuevaFoto]
      })
    }
    reader.readAsDataURL(file)

    solicitarUbicacionGPS()
  }, [solicitarUbicacionGPS, mostrarToast])

  const handleFotoSeleccionada = (e) => {
    const file = e.target.files?.[0]
    if (file) procesarArchivoFoto(file)
    e.target.value = ''
  }

  const repetirFoto = (id) => {
    reemplazandoFotoIdRef.current = id
    cameraInputRef.current?.click()
  }

  const eliminarFoto = (idAEliminar) => {
    setFotos((prev) => prev.filter((f) => f.id !== idAEliminar))
    setErrorFoto(null)
  }

  const limpiarFormularioFoto = () => {
    reemplazandoFotoIdRef.current = null
    setFotos([])
    setErrorFoto(null)
    setMotivoEntrega('')
    setErrorMotivo(null)
    setUbicacionGps(null)
    setErrorUbicacion(null)
    setObteniendoGps(false)
  }

  // Abrir modal de carga de foto para una factura específica
  const abrirModalFotoFactura = (factura) => {
    setFacturaSeleccionada(factura)
    setResultadoEntrega(factura.resultado || 'ENT')
    limpiarFormularioFoto()
    setMotivoEntrega((factura.motivo || '').slice(0, 500))
    setModalFotoOpen(true)
    solicitarUbicacionGPS()
  }

  // Cerrar modal de foto
  const cerrarModalFoto = () => {
    setModalFotoOpen(false)
    setFacturaSeleccionada(null)
    limpiarFormularioFoto()
  }

  // Guardar entrega de factura (POST /api/v1/entregafacturas)
  const handleGuardarEntregaFactura = async () => {
    if (!facturaSeleccionada) return
    if (!fotos || fotos.length === 0) {
      mostrarToast('Debes tomar la foto del comprobante', 'warning')
      return
    }
    if (fotosDuplicadasIds.size > 0) {
      mostrarToast('Elimina o cambia los archivos duplicados para continuar', 'warning')
      return
    }

    const pesoTotal = fotos.reduce((acc, f) => acc + (f.file?.size || 0), 0)
    if (pesoTotal > MAX_TOTAL_SIZE_BYTES) {
      mostrarToast('El total de imágenes supera los 30 MB permitidos', 'error')
      return
    }

    const algunaExcede = fotos.some((f) => (f.file?.size || 0) > MAX_FILE_SIZE_BYTES)
    if (algunaExcede) {
      mostrarToast('Cada imagen no puede superar los 10 MB permitidos', 'error')
      return
    }

    // Validación de motivo: obligatorio únicamente cuando el resultado es Parcial o Fallido
    const esParcialOFallida = resultadoEntrega === 'PARC' || resultadoEntrega === 'FALL'
    if (esParcialOFallida && !motivoEntrega.trim()) {
      const msgError = `Debes ingresar el motivo de la entrega ${resultadoEntrega === 'PARC' ? 'parcial' : 'fallida'}.`
      setErrorMotivo(msgError)
      mostrarToast(msgError, 'warning', 4000)
      return
    }

    if (esParcialOFallida && motivoEntrega.trim().length > 500) {
      const msgError = 'El motivo no puede exceder los 500 caracteres.'
      setErrorMotivo(msgError)
      mostrarToast(msgError, 'warning', 4000)
      return
    }

    // Verificar si ya tenemos coordenadas GPS válidas; si no, solicitarlas
    let coordsGps = ubicacionGps
    if (!esUbicacionValida(coordsGps)) {
      try {
        coordsGps = await obtenerCoordenadasGPS()
      } catch (err) {
        const msgError = err?.message || 'Debes proporcionar tu ubicación para registrar esta factura.'
        setErrorUbicacion(msgError)
        mostrarToast(msgError, 'warning', 4000)
        return
      }
    }

    // Validación si la ubicación no es válida
    if (!esUbicacionValida(coordsGps)) {
      const msgError = 'Debes proporcionar tu ubicación para registrar esta factura.'
      setErrorUbicacion(msgError)
      mostrarToast(msgError, 'warning', 4000)
      return
    }

    setErrorUbicacion(null)
    setErrorMotivo(null)
    setEnviandoEntrega(true)
    try {
      const payload = {
        factura: facturaSeleccionada.uuid,
        resultado: resultadoEntrega,
        motivo: esParcialOFallida ? motivoEntrega.trim() : (motivoEntrega.trim() || null),
        latitud: coordsGps.latitud,
        longitud: coordsGps.longitud,
        precision_metros: Math.round(Number(coordsGps.precision_metros)),
        foto: fotos[0]?.file,
        fotos: fotos.map((f) => f.file),
      }

      const res = await registrarEntregaFactura(payload)
      if (res?.ok) {
        mostrarToast('Comprobante de factura registrado exitosamente', 'success')
        cerrarModalFoto()
        await cargarDetalleRuta()
      } else {
        mostrarToast(res?.message || 'No se pudo registrar la entrega', 'error')
      }
    } catch (err) {
      console.error('Error al registrar entrega:', err)
      mostrarToast('Error al enviar la entrega de factura', 'error')
    } finally {
      setEnviandoEntrega(false)
    }
  }

  // Ver foto en carrusel
  const verComprobanteFactura = async (factura) => {
    const listaUuids = Array.isArray(factura?.evidencias) && factura.evidencias.length > 0
      ? factura.evidencias.filter(Boolean)
      : (factura?.evidencia_uuid ? [factura.evidencia_uuid] : [])

    if (listaUuids.length === 0) {
      mostrarToast('Esta factura no cuenta con evidencia fotográfica registrada', 'warning')
      return
    }
    setCargandoArchivoFoto(true)
    setFotoVisualizadaTitulo(`Comprobante Folio ${factura.folio_factura}`)
    try {
      const urls = await Promise.all(
        listaUuids.map(async (idEvidencia) => {
          return await obtenerArchivoFacturaConCache(idEvidencia)
        })
      )
      const urlsValidas = urls.filter(Boolean)

      if (urlsValidas.length > 0) {
        setFotosVisualizadas(urlsValidas)
        setIndiceFotoVisualizada(0)
        setFotoVisualizadaUrl(urlsValidas[0])
      } else {
        mostrarToast('No se encontró archivo de evidencia para esta factura', 'warning')
      }
    } catch (err) {
      console.error('Error al obtener foto de comprobante:', err)
      mostrarToast('No se pudo cargar la imagen del comprobante', 'error')
    } finally {
      setCargandoArchivoFoto(false)
    }
  }

  // Bloquear scroll de la página de fondo con modales abiertos
  useEffect(() => {
    if (modalFotoOpen || fotoVisualizadaUrl) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => {
      document.body.style.overflow = ''
    }
  }, [modalFotoOpen, fotoVisualizadaUrl])

  // Manejo de teclado para cerrar modales y navegar en el carrusel
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        if (fotoVisualizadaUrl) {
          cerrarVisorFoto()
        } else if (modalFotoOpen) {
          cerrarModalFoto()
        }
      } else if (fotoVisualizadaUrl && fotosVisualizadas.length > 1) {
        if (e.key === 'ArrowLeft') {
          fotoAnterior()
        } else if (e.key === 'ArrowRight') {
          fotoSiguiente()
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [fotoVisualizadaUrl, modalFotoOpen, fotosVisualizadas, fotoAnterior, fotoSiguiente, cerrarVisorFoto])

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

      {/* Input nativo de cámara con captura directa obligatoria */}
      <input
        type="file"
        ref={cameraInputRef}
        accept="image/*,.heic,.HEIC,.heif,.HEIF"
        capture="environment"
        onChange={handleFotoSeleccionada}
        className="hidden"
      />

      {/* Breadcrumbs */}
      <div className="mb-3">
        <Breadcrumbs />
      </div>

      {/* Barra Superior con Contador a la izquierda y Botones a la derecha */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
        <div className="flex items-center gap-2">
          <span className="text-xs sm:text-sm text-base-content/70 font-medium">
            Facturas de esta Ruta: <strong className="text-base-content font-bold">{totalFacturas}</strong>
          </span>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => navigate('/entrega-facturas')}
            className="btn btn-sm btn-ghost gap-1.5 text-base-content/70 hover:text-base-content border border-base-300 rounded-xl"
            title="Volver a la lista de rutas"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Volver</span>
          </button>

          <button
            onClick={cargarDetalleRuta}
            disabled={cargando}
            className="btn btn-sm bg-emerald-600 hover:bg-emerald-700 text-white border-emerald-600 hover:border-emerald-700 gap-1.5 rounded-xl font-medium shadow-xs transition-colors"
            title="Refrescar detalle de facturas"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${cargando ? 'animate-spin' : ''}`} />
            <span>Refrescar</span>
          </button>
        </div>
      </div>

      {/* Tarjeta de Resumen de la Ruta */}
      {cargando ? (
        <div className="flex flex-col items-center justify-center py-20 bg-base-200/30 rounded-2xl border border-base-300">
          <span className="loading loading-spinner loading-lg text-primary mb-3"></span>
          <p className="text-sm text-base-content/60 font-medium">Cargando detalle de la entrega...</p>
        </div>
      ) : !ruta ? (
        <div className="flex flex-col items-center justify-center py-20 bg-base-200/30 rounded-2xl border border-base-300 text-center px-4">
          <Truck className="w-12 h-12 text-base-content/30 mb-3" />
          <h3 className="text-base font-bold text-base-content mb-1">Ruta no encontrada</h3>
          <p className="text-xs text-base-content/60 max-w-sm mb-4">
            No se pudo obtener la información para la ruta seleccionada.
          </p>
          <button onClick={() => navigate('/entrega-facturas')} className="btn btn-sm btn-primary rounded-xl">
            Volver a Rutas
          </button>
        </div>
      ) : (
        <div className="space-y-5 w-full max-w-full">
          {/* Tarjeta de Resumen de la Entrega */}
          <div className="relative bg-gradient-to-br from-base-100 via-base-100 to-primary/5 rounded-2xl border border-primary/25 border-l-4 border-l-primary p-4 sm:p-5 shadow-sm hover:shadow-md transition-shadow w-full max-w-full overflow-hidden">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-primary/10 pb-3.5 mb-3.5">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-primary/10 text-primary border border-primary/20 shadow-2xs shrink-0">
                  <Truck className="w-6 h-6" />
                </div>
                <div className="min-w-0">
                  <span className="text-[10px] text-primary font-bold uppercase tracking-wider block">
                    Detalle de la Entrega
                  </span>
                  <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                    <h2 className="text-base sm:text-lg font-mono font-bold text-base-content">
                      Ruta <span className="text-primary">{ruta.numero_ruta}</span>
                    </h2>
                    <span className="badge badge-neutral text-xs font-mono font-semibold">
                      {ruta.placa_camion}
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-3 text-xs text-base-content/70">
                <span className="badge badge-ghost border border-base-300/80 bg-base-100/80 text-xs gap-1.5 font-medium py-1 px-2.5 shadow-2xs">
                  <MapPin className="w-3.5 h-3.5 text-primary" />
                  <span>{ruta.sucursal_salida}</span>
                </span>
              </div>
            </div>

            {/* Grid de Datos de la Ruta */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-xs">
              <div className="bg-base-200/40 rounded-xl p-2.5 border border-base-300/50 flex flex-col justify-between">
                <span className="text-[10px] text-base-content/50 block font-semibold uppercase tracking-wider">Piloto</span>
                <div className="flex items-start gap-1.5 mt-1" title={ruta.piloto}>
                  <User className="w-3.5 h-3.5 text-primary shrink-0 mt-0.5" />
                  <span className="font-semibold text-xs text-base-content leading-tight line-clamp-2 break-words">
                    {ruta.piloto}
                  </span>
                </div>
              </div>
              <div className="bg-base-200/40 rounded-xl p-2.5 border border-base-300/50 flex flex-col justify-between">
                <span className="text-[10px] text-base-content/50 block font-semibold uppercase tracking-wider">Auxiliar</span>
                <span className="font-medium text-xs text-base-content/80 mt-1 leading-tight line-clamp-2 break-words" title={ruta.auxiliar || '—'}>
                  {ruta.auxiliar || '—'}
                </span>
              </div>
              <div className="bg-base-200/40 rounded-xl p-2.5 border border-base-300/50 flex flex-col justify-between">
                <span className="text-[10px] text-base-content/50 block font-semibold uppercase tracking-wider">Salida Plan</span>
                <span className="text-base-content/80 mt-1 flex items-center gap-1.5 truncate" title={ruta.fecha_salida_plan || '—'}>
                  <Calendar className="w-3.5 h-3.5 text-base-content/40 shrink-0" />
                  <span className="truncate">{ruta.fecha_salida_plan || '—'}</span>
                </span>
              </div>
              <div className="bg-base-200/40 rounded-xl p-2.5 border border-base-300/50 flex flex-col justify-between">
                <span className="text-[10px] text-base-content/50 block font-semibold uppercase tracking-wider">Entrada Plan</span>
                <span className="text-base-content/80 mt-1 flex items-center gap-1.5 truncate" title={ruta.fecha_entrada_plan || '—'}>
                  <Calendar className="w-3.5 h-3.5 text-base-content/40 shrink-0" />
                  <span className="truncate">{ruta.fecha_entrada_plan || '—'}</span>
                </span>
              </div>
            </div>
          </div>

          {/* Tabla de Facturas */}
          <div className="space-y-3 w-full max-w-full">
            <div className="flex flex-col items-start gap-2.5">
              <div className="flex items-center gap-2">
                <FileText className="w-4 h-4 text-primary shrink-0" />
                <h3 className="font-bold text-sm sm:text-base text-base-content">
                  Facturas Asignadas
                </h3>
              </div>

              {/* Barra de Filtros y Control de TreeTable */}
              <div className="flex flex-wrap items-center justify-between gap-2 w-full max-w-full">
                {/* Filtros: Todos, Pendientes, Entregados */}
                <div className="flex flex-wrap items-center gap-1.5 p-1 bg-base-200/80 rounded-xl max-w-full">
                  <button
                    type="button"
                    onClick={() => setFiltroEstado('TODOS')}
                    className={`btn btn-xs sm:btn-sm gap-1.5 rounded-lg font-medium transition-all ${
                      filtroEstado === 'TODOS'
                        ? 'btn-neutral shadow-xs'
                        : 'btn-ghost text-base-content/70 hover:bg-base-300/60'
                    }`}
                  >
                    <ListFilter className="w-3.5 h-3.5" />
                    <span>Todos</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setFiltroEstado('PENDIENTES')}
                    className={`btn btn-xs sm:btn-sm gap-1.5 rounded-lg font-medium transition-all ${
                      filtroEstado === 'PENDIENTES'
                        ? 'bg-amber-500 hover:bg-amber-600 text-white border-none shadow-xs font-semibold'
                        : 'btn-ghost text-base-content/70 hover:text-amber-600 hover:bg-amber-500/10'
                    }`}
                  >
                    <FileClock className="w-3.5 h-3.5" />
                    <span>Pendientes</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setFiltroEstado('ENTREGADOS')}
                    className={`btn btn-xs sm:btn-sm gap-1.5 rounded-lg font-medium transition-all ${
                      filtroEstado === 'ENTREGADOS'
                        ? 'bg-emerald-600 hover:bg-emerald-700 text-white border-none shadow-xs font-semibold'
                        : 'btn-ghost text-base-content/70 hover:text-emerald-600 hover:bg-emerald-500/10'
                    }`}
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Entregados</span>
                  </button>
                </div>

                {/* Botón para expandir/colapsar todos los clientes en TreeTable (solo si hay grupos con múltiples facturas) */}
                {gruposMultiples.length > 0 && (
                  <button
                    type="button"
                    onClick={toggleTodosGrupos}
                    className="btn btn-xs sm:btn-sm btn-ghost gap-1.5 border border-base-300 rounded-xl text-base-content/70 hover:text-base-content"
                    title={todosExpandidos ? 'Colapsar todos los clientes' : 'Expandir todos los clientes'}
                  >
                    <ChevronsUpDown className="w-3.5 h-3.5" />
                    <span>{todosExpandidos ? 'Colapsar todos' : 'Expandir todos'}</span>
                  </button>
                )}
              </div>
            </div>

            {!ruta.facturas || ruta.facturas.length === 0 ? (
              <div className="text-center py-12 bg-base-200/20 rounded-2xl border border-dashed border-base-300">
                <FileText className="w-10 h-10 text-base-content/30 mx-auto mb-2" />
                <p className="text-xs text-base-content/60 font-medium">
                  No hay facturas asignadas a esta ruta
                </p>
              </div>
            ) : facturasFiltradas.length === 0 ? (
              <div className="text-center py-12 bg-base-200/20 rounded-2xl border border-dashed border-base-300 p-6 space-y-2">
                <FileText className="w-9 h-9 text-base-content/30 mx-auto" />
                <p className="text-xs font-semibold text-base-content/80">
                  No hay facturas con estado {filtroEstado === 'PENDIENTES' ? '"Pendientes"' : '"Entregados"'} en esta ruta
                </p>
                <button
                  type="button"
                  onClick={() => setFiltroEstado('TODOS')}
                  className="btn btn-xs btn-outline btn-primary rounded-lg mt-2 cursor-pointer"
                >
                  Mostrar todas
                </button>
              </div>
            ) : (
              <>
                {/* Vista Escritorio: TreeTable Agrupada por Cliente */}
                <div className="hidden md:block bg-base-100 rounded-2xl border border-base-300 shadow-sm overflow-hidden w-full max-w-full">
                  <div className="overflow-x-auto">
                    <table className="table w-full text-xs sm:text-sm">
                      <thead className="bg-base-200/60 text-base-content font-semibold border-b border-base-300">
                        <tr>
                          <th className="py-3.5 px-4 w-2/5">Cliente / Folio Factura</th>
                          <th className="py-3.5 px-4 w-1/4">Dirección de Entrega</th>
                          <th className="py-3.5 px-4 w-1/6">Estado</th>
                          <th className="py-3.5 px-4">Fecha Registro</th>
                          <th className="py-3.5 px-4 text-center">Acciones</th>
                        </tr>
                      </thead>
                      <tbody>
                        {gruposClientes.map((grupo) => {
                          const esIndividual = grupo.total === 1

                          // Si solo hay una factura para este cliente, se muestra directamente sin colapsable ni árbol
                          if (esIndividual) {
                            const factura = grupo.facturas[0]
                            const conf = RESULTADO_CONFIG[factura.resultado] || RESULTADO_CONFIG.PENDIENTE
                            const IconoResultado = conf.icon

                            return (
                              <tr
                                key={factura.uuid}
                                className="hover:bg-primary/5 transition-colors bg-base-100 border-b border-base-200"
                              >
                                {/* Folio Factura */}
                                <td className="py-3 px-4">
                                  <div className="flex flex-col">
                                    <span className="font-mono font-bold text-xs sm:text-sm text-primary">
                                      {factura.folio_factura}
                                    </span>
                                    {grupo.cliente && (
                                      <span className="text-[11px] text-base-content/60 truncate max-w-xs" title={grupo.cliente}>
                                        {grupo.cliente}
                                      </span>
                                    )}
                                  </div>
                                </td>

                                {/* Dirección de Entrega */}
                                <td className="py-3 px-4 max-w-xs">
                                  <div className="flex items-start gap-1 text-xs text-base-content/80">
                                    <MapPin className="w-3.5 h-3.5 text-base-content/40 shrink-0 mt-0.5" />
                                    <span className="truncate" title={factura.direccion}>
                                      {factura.direccion}
                                    </span>
                                  </div>
                                </td>

                                {/* Estado y Motivo */}
                                <td className="py-3 px-4">
                                  <span className={`badge ${conf.badgeClass} text-xs gap-1 font-semibold`}>
                                    <IconoResultado className="w-3 h-3" />
                                    <span>{conf.label}</span>
                                  </span>
                                  {factura.motivo && (
                                    <span className="text-[11px] text-base-content/60 block mt-1 italic line-clamp-2" title={factura.motivo}>
                                      Motivo: {factura.motivo}
                                    </span>
                                  )}
                                </td>

                                {/* Fecha de Registro */}
                                <td className="py-3 px-4 text-xs text-base-content/70">
                                  {factura.resultado_fecha || '—'}
                                </td>

                                {/* Acciones */}
                                <td className="py-3 px-4 text-center">
                                  <div className="flex items-center justify-center">
                                    {tieneEvidenciasRegistradas(factura) || factura.resultado ? (
                                      <button
                                        type="button"
                                        onClick={() => verComprobanteFactura(factura)}
                                        disabled={cargandoArchivoFoto}
                                        className="btn btn-xs sm:btn-sm btn-outline btn-primary gap-1.5 rounded-xl font-medium"
                                        title="Ver foto de la evidencia"
                                      >
                                        <Eye className="w-3.5 h-3.5" />
                                        <span>Ver Foto</span>
                                      </button>
                                    ) : (
                                      <button
                                        type="button"
                                        onClick={() => abrirModalFotoFactura(factura)}
                                        className="btn btn-xs sm:btn-sm btn-primary gap-1.5 rounded-xl font-medium"
                                      >
                                        <Camera className="w-3.5 h-3.5" />
                                        <span>Cargar Foto</span>
                                      </button>
                                    )}
                                  </div>
                                </td>
                              </tr>
                            )
                          }

                          // Si hay 2 o más facturas del mismo cliente, se muestra el grupo colapsable TreeTable
                          const estaExpandido = Boolean(gruposExpandidos[grupo.id])

                          return (
                            <Fragment key={grupo.id}>
                              {/* Fila Encabezado del Cliente (Nodo Principal de Árbol) */}
                              <tr
                                onClick={() => toggleGrupo(grupo.id)}
                                className="bg-base-200/60 hover:bg-base-200/90 cursor-pointer font-medium select-none transition-colors border-t border-b border-base-300"
                              >
                                <td colSpan={2} className="py-3 px-4">
                                  <div className="flex items-center gap-2.5">
                                    <span className="text-primary transition-transform duration-200">
                                      {estaExpandido ? (
                                        <ChevronDown className="w-4 h-4" />
                                      ) : (
                                        <ChevronRight className="w-4 h-4" />
                                      )}
                                    </span>
                                    <div className="p-1 rounded-lg bg-primary/10 text-primary shrink-0">
                                      <Building2 className="w-3.5 h-3.5" />
                                    </div>
                                    <div className="min-w-0">
                                      <span className="font-bold text-xs sm:text-sm text-base-content block truncate" title={grupo.direccion}>
                                        {grupo.cliente ? `${grupo.cliente} — ${grupo.direccion}` : grupo.direccion}
                                      </span>
                                    </div>
                                  </div>
                                </td>
                                <td className="py-3 px-4">
                                  <div className="flex items-center gap-1.5 flex-wrap">
                                    <span className="badge badge-sm badge-neutral font-semibold text-[11px]">
                                      {grupo.total} Facturas
                                    </span>
                                    {grupo.entregadas > 0 && (
                                      <span className="badge badge-sm badge-success text-white text-[11px] font-medium">
                                        {grupo.entregadas} ent
                                      </span>
                                    )}
                                    {grupo.pendientes > 0 && (
                                      <span className="badge badge-sm badge-warning text-white text-[11px] font-medium">
                                        {grupo.pendientes} pend
                                      </span>
                                    )}
                                    {grupo.fallidas > 0 && (
                                      <span className="badge badge-sm badge-error text-white text-[11px] font-medium">
                                        {grupo.fallidas} fall
                                      </span>
                                    )}
                                  </div>
                                </td>
                                <td colSpan={2} className="py-3 px-4 text-right">
                                  <span className="text-[11px] text-base-content/50 hover:text-primary transition-colors">
                                    {estaExpandido ? 'Clic para colapsar' : 'Clic para expandir'}
                                  </span>
                                </td>
                              </tr>

                              {/* Filas Hijas: Facturas del Cliente */}
                              {estaExpandido &&
                                grupo.facturas.map((factura) => {
                                  const conf = RESULTADO_CONFIG[factura.resultado] || RESULTADO_CONFIG.PENDIENTE
                                  const IconoResultado = conf.icon

                                  return (
                                    <tr
                                      key={factura.uuid}
                                      className="hover:bg-primary/5 transition-colors bg-base-100/60 border-b border-base-200/80"
                                    >
                                      {/* Folio Factura con sangría de árbol */}
                                      <td className="py-3 px-4 pl-9">
                                        <div className="flex items-center gap-2">
                                          <span className="text-base-content/30 font-mono text-xs">└─</span>
                                          <span className="font-mono font-bold text-xs sm:text-sm text-primary">
                                            {factura.folio_factura}
                                          </span>
                                        </div>
                                      </td>

                                      {/* Dirección de Entrega */}
                                      <td className="py-3 px-4 max-w-xs">
                                        <div className="flex items-start gap-1 text-xs text-base-content/80">
                                          <MapPin className="w-3.5 h-3.5 text-base-content/40 shrink-0 mt-0.5" />
                                          <span className="truncate" title={factura.direccion}>
                                            {factura.direccion}
                                          </span>
                                        </div>
                                      </td>

                                      {/* Estado y Motivo */}
                                      <td className="py-3 px-4">
                                        <span className={`badge ${conf.badgeClass} text-xs gap-1 font-semibold`}>
                                          <IconoResultado className="w-3 h-3" />
                                          <span>{conf.label}</span>
                                        </span>
                                        {factura.motivo && (
                                          <span className="text-[11px] text-base-content/60 block mt-1 italic line-clamp-2" title={factura.motivo}>
                                            Motivo: {factura.motivo}
                                          </span>
                                        )}
                                      </td>

                                      {/* Fecha de Registro */}
                                      <td className="py-3 px-4 text-xs text-base-content/70">
                                        {factura.resultado_fecha || '—'}
                                      </td>

                                      {/* Acciones */}
                                      <td className="py-3 px-4 text-center">
                                        <div className="flex items-center justify-center">
                                          {tieneEvidenciasRegistradas(factura) || factura.resultado ? (
                                            <button
                                              type="button"
                                              onClick={() => verComprobanteFactura(factura)}
                                              disabled={cargandoArchivoFoto}
                                              className="btn btn-xs sm:btn-sm btn-outline btn-primary gap-1.5 rounded-xl font-medium"
                                              title="Ver foto de la evidencia"
                                            >
                                              <Eye className="w-3.5 h-3.5" />
                                              <span>Ver Foto</span>
                                            </button>
                                          ) : (
                                            <button
                                              type="button"
                                              onClick={() => abrirModalFotoFactura(factura)}
                                              className="btn btn-xs sm:btn-sm btn-primary gap-1.5 rounded-xl font-medium"
                                            >
                                              <Camera className="w-3.5 h-3.5" />
                                              <span>Cargar Foto</span>
                                            </button>
                                          )}
                                        </div>
                                      </td>
                                    </tr>
                                  )
                                })}
                            </Fragment>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Vista Móvil: Tarjetas de Facturas (Agrupadas solo si hay 2 o más facturas del mismo cliente) */}
                <div className="md:hidden grid grid-cols-1 gap-3.5 w-full max-w-full">
                  {gruposClientes.map((grupo) => {
                    const esIndividual = grupo.total === 1

                    // Si solo hay una factura para este cliente, se muestra directamente sin estructura colapsable
                    if (esIndividual) {
                      const factura = grupo.facturas[0]
                      const conf = RESULTADO_CONFIG[factura.resultado] || RESULTADO_CONFIG.PENDIENTE
                      const IconoResultado = conf.icon

                      return (
                        <div
                          key={factura.uuid}
                          className="bg-base-100 rounded-2xl border border-base-300 p-3.5 shadow-sm space-y-2.5 w-full max-w-full overflow-hidden"
                        >
                          <div className="flex items-center justify-between border-b border-base-200 pb-2">
                            <div className="flex items-center gap-2 min-w-0">
                              <span className="font-mono font-bold text-xs sm:text-sm text-primary">
                                {factura.folio_factura}
                              </span>
                              {grupo.cliente && (
                                <span className="badge badge-xs badge-ghost text-base-content/70 truncate max-w-[130px]" title={grupo.cliente}>
                                  {grupo.cliente}
                                </span>
                              )}
                            </div>
                            <span className={`badge ${conf.badgeClass} text-[11px] gap-1 font-semibold shrink-0`}>
                              <IconoResultado className="w-3 h-3" />
                              <span>{conf.label}</span>
                            </span>
                          </div>

                          <div className="flex items-start gap-1.5 text-xs text-base-content/80">
                            <MapPin className="w-3.5 h-3.5 text-base-content/40 shrink-0 mt-0.5" />
                            <span className="break-words line-clamp-2" title={factura.direccion}>
                              {factura.direccion}
                            </span>
                          </div>

                          {factura.motivo && (
                            <div className="text-[11px] text-base-content/70 italic bg-base-200/50 p-2 rounded-lg">
                              <span className="font-semibold not-italic text-base-content/80">Motivo: </span>
                              {factura.motivo}
                            </div>
                          )}

                          {factura.resultado_fecha && (
                            <div className="flex items-center gap-1 text-[11px] text-base-content/50">
                              <Clock className="w-3 h-3" />
                              <span>Registrado el: {factura.resultado_fecha}</span>
                            </div>
                          )}

                          <div className="pt-0.5">
                            {tieneEvidenciasRegistradas(factura) || factura.resultado ? (
                              <button
                                type="button"
                                onClick={() => verComprobanteFactura(factura)}
                                disabled={cargandoArchivoFoto}
                                className="btn btn-xs sm:btn-sm btn-outline btn-primary w-full gap-1.5 rounded-xl font-semibold"
                                title="Ver foto de la evidencia"
                              >
                                <Eye className="w-3.5 h-3.5" />
                                <span>Ver Foto</span>
                              </button>
                            ) : (
                              <button
                                type="button"
                                onClick={() => abrirModalFotoFactura(factura)}
                                className="btn btn-xs sm:btn-sm btn-primary w-full gap-1.5 rounded-xl font-semibold"
                              >
                                <Camera className="w-3.5 h-3.5" />
                                <span>Cargar Foto</span>
                              </button>
                            )}
                          </div>
                        </div>
                      )
                    }

                    // Si hay 2 o más facturas del mismo cliente, se muestra la tarjeta contenedora colapsable
                    const estaExpandido = Boolean(gruposExpandidos[grupo.id])

                    return (
                      <div
                        key={grupo.id}
                        className="bg-base-100 rounded-2xl border border-base-300 shadow-sm overflow-hidden w-full max-w-full"
                      >
                        {/* Cabecera del Cliente en Móvil */}
                        <div
                          onClick={() => toggleGrupo(grupo.id)}
                          className="p-3.5 bg-base-200/50 flex items-center justify-between gap-2 cursor-pointer select-none border-b border-base-200"
                        >
                          <div className="flex items-start gap-2 min-w-0">
                            <div className="p-1.5 rounded-lg bg-primary/10 text-primary shrink-0 mt-0.5">
                              <Building2 className="w-4 h-4" />
                            </div>
                            <div className="min-w-0">
                              <h4 className="font-bold text-xs sm:text-sm text-base-content leading-tight truncate">
                                {grupo.cliente ? `${grupo.cliente}` : grupo.direccion}
                              </h4>
                              {grupo.cliente && (
                                <p className="text-[11px] text-base-content/60 truncate mt-0.5">
                                  {grupo.direccion}
                                </p>
                              )}
                              <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                                <span className="badge badge-xs badge-neutral font-semibold text-[10px]">
                                  {grupo.total} Facturas
                                </span>
                                {grupo.entregadas > 0 && (
                                  <span className="badge badge-xs badge-success text-white text-[10px]">
                                    {grupo.entregadas} ent
                                  </span>
                                )}
                                {grupo.pendientes > 0 && (
                                  <span className="badge badge-xs badge-warning text-white text-[10px]">
                                    {grupo.pendientes} pend
                                  </span>
                                )}
                                {grupo.fallidas > 0 && (
                                  <span className="badge badge-xs badge-error text-white text-[10px]">
                                    {grupo.fallidas} fall
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                          <span className="text-primary shrink-0">
                            {estaExpandido ? (
                              <ChevronDown className="w-4 h-4" />
                            ) : (
                              <ChevronRight className="w-4 h-4" />
                            )}
                          </span>
                        </div>

                        {/* Facturas Hijas del Cliente en Móvil */}
                        {estaExpandido && (
                          <div className="p-2.5 space-y-2 bg-base-200/20">
                            {grupo.facturas.map((factura) => {
                              const conf = RESULTADO_CONFIG[factura.resultado] || RESULTADO_CONFIG.PENDIENTE
                              const IconoResultado = conf.icon

                              return (
                                <div
                                  key={factura.uuid}
                                  className="bg-base-100 rounded-xl border border-base-300 p-3 shadow-xs space-y-2.5 w-full max-w-full overflow-hidden"
                                >
                                  <div className="flex items-center justify-between border-b border-base-200 pb-2">
                                    <span className="font-mono font-bold text-xs sm:text-sm text-primary">
                                      {factura.folio_factura}
                                    </span>
                                    <span className={`badge ${conf.badgeClass} text-[11px] gap-1 font-semibold`}>
                                      <IconoResultado className="w-3 h-3" />
                                      <span>{conf.label}</span>
                                    </span>
                                  </div>

                                  {factura.motivo && (
                                    <div className="text-[11px] text-base-content/70 italic bg-base-200/50 p-2 rounded-lg">
                                      <span className="font-semibold not-italic text-base-content/80">Motivo: </span>
                                      {factura.motivo}
                                    </div>
                                  )}

                                  {factura.resultado_fecha && (
                                    <div className="flex items-center gap-1 text-[11px] text-base-content/50">
                                      <Clock className="w-3 h-3" />
                                      <span>Registrado el: {factura.resultado_fecha}</span>
                                    </div>
                                  )}

                                  <div className="pt-0.5">
                                    {tieneEvidenciasRegistradas(factura) || factura.resultado ? (
                                      <button
                                        type="button"
                                        onClick={() => verComprobanteFactura(factura)}
                                        disabled={cargandoArchivoFoto}
                                        className="btn btn-xs sm:btn-sm btn-outline btn-primary w-full gap-1.5 rounded-xl font-semibold"
                                        title="Ver foto de la evidencia"
                                      >
                                        <Eye className="w-3.5 h-3.5" />
                                        <span>Ver Foto</span>
                                      </button>
                                    ) : (
                                      <button
                                        type="button"
                                        onClick={() => abrirModalFotoFactura(factura)}
                                        className="btn btn-xs sm:btn-sm btn-primary w-full gap-1.5 rounded-xl font-semibold"
                                      >
                                        <Camera className="w-3.5 h-3.5" />
                                        <span>Cargar Foto</span>
                                      </button>
                                    )}
                                  </div>
                                </div>
                              )
                            })}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Modal de Carga de Foto y Registro de Entrega */}
      {modalFotoOpen && facturaSeleccionada && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/60 backdrop-blur-xs overflow-y-auto"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              cerrarModalFoto()
            }
          }}
        >
          <div className="bg-base-100 rounded-2xl sm:rounded-3xl border border-base-300 shadow-2xl w-full max-w-lg max-h-[92vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            {/* Header del Modal */}
            <div className="flex items-center justify-between p-4 sm:p-5 border-b border-base-300 bg-base-200/40">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-primary/10 text-primary">
                  <Camera className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-sm sm:text-base text-base-content flex items-center gap-2">
                    <span>Factura {facturaSeleccionada.folio_factura}</span>
                  </h3>
                  <p className="text-[11px] text-base-content/60 truncate max-w-xs sm:max-w-md">
                    {facturaSeleccionada.direccion}
                  </p>
                </div>
              </div>
              <button
                onClick={cerrarModalFoto}
                className="btn btn-sm btn-circle btn-ghost text-base-content/60 hover:text-base-content"
                title="Cerrar modal"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Cuerpo del Modal */}
            <div className="p-4 sm:p-6 overflow-y-auto space-y-4 flex-1">
              {/* Selector de Resultado */}
              <div className="form-control">
                <label className="label py-1">
                  <span className="label-text font-semibold text-xs text-base-content">
                    Resultado de la Entrega:
                  </span>
                </label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setResultadoEntrega('ENT')
                      if (errorMotivo) setErrorMotivo(null)
                    }}
                    className={`btn btn-sm rounded-xl gap-1 text-xs transition-all ${
                      resultadoEntrega === 'ENT'
                        ? 'bg-emerald-600 text-white hover:bg-emerald-700 border-emerald-600 shadow-sm'
                        : 'btn-outline border-base-300 hover:border-emerald-500'
                    }`}
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Entregado</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setResultadoEntrega('PARC')
                      if (errorMotivo) setErrorMotivo(null)
                    }}
                    className={`btn btn-sm rounded-xl gap-1 text-xs transition-all ${
                      resultadoEntrega === 'PARC'
                        ? 'bg-amber-500 text-white hover:bg-amber-600 border-amber-500 shadow-sm'
                        : 'btn-outline border-base-300 hover:border-amber-500'
                    }`}
                  >
                    <AlertTriangle className="w-3.5 h-3.5" />
                    <span>Parcial</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setResultadoEntrega('FALL')
                      if (errorMotivo) setErrorMotivo(null)
                    }}
                    className={`btn btn-sm rounded-xl gap-1 text-xs transition-all ${
                      resultadoEntrega === 'FALL'
                        ? 'bg-rose-600 text-white hover:bg-rose-700 border-rose-600 shadow-sm'
                        : 'btn-outline border-base-300 hover:border-rose-500'
                    }`}
                  >
                    <X className="w-3.5 h-3.5" />
                    <span>Fallida</span>
                  </button>
                </div>
              </div>

              {/* Campo Motivo (Obligatorio únicamente para Parcial o Fallida, máx. 500 caracteres) */}
              {(resultadoEntrega === 'PARC' || resultadoEntrega === 'FALL') && (
                <div className="form-control animate-in fade-in slide-in-from-top-2 duration-200">
                  <div className="flex items-center justify-between py-1">
                    <span className="label-text font-semibold text-xs text-base-content flex items-center gap-1">
                      <span>Motivo de {resultadoEntrega === 'PARC' ? 'Entrega Parcial' : 'Entrega Fallida'}</span>
                      <span className="text-error font-bold">*</span>
                    </span>
                    <span
                      className={`text-[11px] font-mono select-none transition-colors ${
                        motivoEntrega.length >= 500
                          ? 'text-error font-bold'
                          : motivoEntrega.length >= 450
                          ? 'text-warning font-semibold'
                          : 'text-base-content/50'
                      }`}
                    >
                      {motivoEntrega.length}/500
                    </span>
                  </div>
                  <textarea
                    value={motivoEntrega}
                    maxLength={500}
                    onChange={(e) => {
                      if (e.target.value.length <= 500) {
                        setMotivoEntrega(e.target.value)
                      }
                      if (errorMotivo) setErrorMotivo(null)
                    }}
                    placeholder={`Ingresa el motivo de la entrega ${resultadoEntrega === 'PARC' ? 'parcial' : 'fallida'}... (máx. 500 caracteres)`}
                    className={`textarea textarea-bordered rounded-xl text-xs w-full min-h-[70px] resize-none focus:outline-none focus:border-primary ${
                      errorMotivo ? 'textarea-error border-error' : 'border-base-300'
                    }`}
                    rows={2}
                  />
                  {errorMotivo && (
                    <span className="text-[11px] text-error font-medium mt-1">
                      {errorMotivo}
                    </span>
                  )}
                </div>
              )}

                {/* Carga del Comprobante */}
                <div>
                  <div className="flex items-center justify-between py-1">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="label-text font-semibold text-xs text-base-content">
                        Comprobante de entrega
                      </span>
                      <span className="text-[11px] text-base-content/60 font-normal">
                        (Max. 10Mb por imagen)
                      </span>
                    </div>
                    {fotos.length === 3 && (
                      <span className="text-[11px] font-mono text-error font-bold">
                        {fotos.length}/3 fotos
                      </span>
                    )}
                  </div>

                  {fotos.length === 0 ? (
                    <div
                      onClick={() => {
                        reemplazandoFotoIdRef.current = null
                        cameraInputRef.current?.click()
                      }}
                      className="flex flex-col items-center justify-center p-6 sm:p-7 rounded-2xl border-2 border-dashed border-primary/30 bg-primary/[0.02] hover:border-primary hover:bg-primary/[0.06] transition-all cursor-pointer select-none text-center group"
                    >
                      <div className="p-3.5 bg-primary/10 rounded-2xl text-primary mb-2 group-hover:scale-110 transition-transform shadow-2xs">
                        <Camera className="w-6 h-6" />
                      </div>
                      <span className="text-xs sm:text-sm font-semibold text-primary">
                        Tomar foto
                      </span>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {fotos.map((item, index) => {
                        const esDuplicado = fotosDuplicadasIds.has(item.id)
                        return (
                          <div
                            key={item.id}
                            className={`flex items-center justify-between p-2.5 sm:p-3 rounded-xl transition-all ${
                              esDuplicado
                                ? 'bg-amber-500/10 border-2 border-amber-500 shadow-xs'
                                : 'bg-base-100 border border-base-300 shadow-xs'
                            }`}
                          >
                            <div
                              onClick={() => {
                                setFotosVisualizadas([item.preview])
                                setIndiceFotoVisualizada(0)
                                setFotoVisualizadaUrl(item.preview)
                                setFotoVisualizadaTitulo(`Vista Previa: ${item.nombre}`)
                              }}
                              className="flex items-center gap-2.5 min-w-0 cursor-pointer group flex-1"
                              title={item.nombre}
                            >
                              {item.esHeic ? (
                                <div className="w-10 h-10 rounded-lg border border-primary/30 bg-primary/10 flex flex-col items-center justify-center shrink-0 text-primary group-hover:scale-105 transition-transform">
                                  <ImageIcon className="w-4 h-4" />
                                  <span className="text-[8px] font-bold uppercase tracking-tight">HEIC</span>
                                </div>
                              ) : (
                                <div className="relative w-10 h-10 rounded-lg overflow-hidden border border-base-300 shrink-0 group-hover:border-primary transition-colors">
                                  <img
                                    src={item.preview}
                                    alt={item.nombre}
                                    onError={(e) => {
                                      e.currentTarget.style.display = 'none'
                                    }}
                                    className="w-full h-full object-cover group-hover:scale-110 transition-transform"
                                  />
                                  <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white">
                                    <Eye className="w-3.5 h-3.5" />
                                  </div>
                                </div>
                              )}
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-1.5 min-w-0">
                                  <p
                                    className={`text-xs font-semibold truncate group-hover:text-primary transition-colors ${
                                      esDuplicado ? 'text-amber-700 dark:text-amber-400 font-bold' : 'text-base-content'
                                    }`}
                                    title={item.nombre}
                                  >
                                    {item.nombre}
                                  </p>
                                  {esDuplicado && (
                                    <span className="badge badge-xs bg-amber-500 text-white font-bold text-[9px] px-1.5 py-0 border-0 shrink-0">
                                      Duplicado
                                    </span>
                                  )}
                                </div>
                                <p className="text-[10px] text-base-content/50 flex items-center gap-1.5 mt-0.5">
                                  <span>{item.peso}</span>
                                </p>
                              </div>
                            </div>

                            <div className="flex items-center gap-1 shrink-0">
                              <button
                                type="button"
                                onClick={() => {
                                  setFotosVisualizadas([item.preview])
                                  setIndiceFotoVisualizada(0)
                                  setFotoVisualizadaUrl(item.preview)
                                  setFotoVisualizadaTitulo(`Vista Previa: ${item.nombre}`)
                                }}
                                className="btn btn-xs btn-outline btn-primary gap-1 rounded-lg font-medium"
                                title="Vista previa"
                              >
                                <Eye className="w-3.5 h-3.5" />
                                <span className="hidden sm:inline">Ver</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => repetirFoto(item.id)}
                                className="btn btn-xs btn-outline btn-neutral gap-1 rounded-lg font-medium"
                                title="Cambiar"
                              >
                                <Camera className="w-3.5 h-3.5" />
                                <span className="hidden sm:inline">Cambiar</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => eliminarFoto(item.id)}
                                className="btn btn-xs btn-ghost text-error hover:bg-error/10 rounded-lg p-1.5"
                                title="Eliminar"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                        )
                      })}

                      {fotosDuplicadasIds.size > 0 && (
                        <div className="flex items-center gap-2 p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-700 dark:text-amber-300 text-xs font-medium">
                          <AlertTriangle className="w-4 h-4 shrink-0 text-amber-500" />
                          <span>Se han detectado archivos duplicados</span>
                        </div>
                      )}

                      {fotos.length < 3 && (
                        <button
                          type="button"
                          onClick={() => {
                            reemplazandoFotoIdRef.current = null
                            cameraInputRef.current?.click()
                          }}
                          className="btn btn-sm btn-outline border-dashed border-primary/40 text-primary hover:border-primary hover:bg-primary/5 w-full gap-1.5 rounded-xl text-xs font-semibold py-2.5 h-auto transition-all"
                        >
                          <Plus className="w-4 h-4" />
                          <span>Agregar foto</span>
                        </button>
                      )}
                    </div>
                  )}

                {errorFoto && (
                  <p className="text-xs text-error font-medium mt-1.5">{errorFoto}</p>
                )}

                {errorUbicacion && (
                  <div className="flex items-start gap-2 p-3 mt-3 rounded-xl bg-error/10 border border-error/30 text-error text-xs font-medium">
                    <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                    <div className="flex-1 min-w-0">
                      <p className="leading-snug">{errorUbicacion}</p>
                      <button
                        type="button"
                        onClick={() => {
                          setErrorUbicacion(null)
                          solicitarUbicacionGPS()
                        }}
                        disabled={obteniendoGps}
                        className="btn btn-xs btn-outline btn-error gap-1 rounded-lg mt-2"
                      >
                        <RefreshCw className={`w-3 h-3 ${obteniendoGps ? 'animate-spin' : ''}`} />
                        <span>Reintentar</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Footer del Modal */}
            <div className="p-3 sm:p-4 border-t border-base-300 bg-base-200/40 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={cerrarModalFoto}
                disabled={enviandoEntrega || obteniendoGps}
                className="btn btn-sm btn-ghost border border-base-300 rounded-xl text-xs"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleGuardarEntregaFactura}
                disabled={fotos.length === 0 || fotosDuplicadasIds.size > 0 || enviandoEntrega || obteniendoGps}
                title={fotosDuplicadasIds.size > 0 ? 'Elimina o cambia las fotos duplicadas' : undefined}
                className="btn btn-sm btn-primary gap-1.5 rounded-xl text-xs font-semibold"
              >
                {enviandoEntrega ? (
                  <>
                    <span className="loading loading-spinner loading-xs"></span>
                    <span>Enviando...</span>
                  </>
                ) : obteniendoGps ? (
                  <>
                    <span className="loading loading-spinner loading-xs"></span>
                    <span>Obteniendo ubicación...</span>
                  </>
                ) : (
                  <>
                    <FileCheck className="w-4 h-4" />
                    <span>Guardar</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Carrusel  con Miniaturas */}
      {fotoVisualizadaUrl && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center p-3 sm:p-6 bg-black/85 backdrop-blur-md"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              cerrarVisorFoto()
            }
          }}
        >
          <div className="bg-base-100 rounded-2xl sm:rounded-3xl border border-base-300 shadow-2xl max-w-2xl sm:max-w-3xl w-full overflow-hidden flex flex-col max-h-[92vh] animate-in fade-in zoom-in-95 duration-150">
            {/* Header del Visor */}
            <div className="flex items-center justify-between p-3.5 sm:p-4 border-b border-base-300 bg-base-200/50">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="p-1.5 rounded-lg bg-primary/10 text-primary shrink-0">
                  <ImageIcon className="w-4 h-4" />
                </div>
                <span className="font-bold text-xs sm:text-sm text-base-content truncate">
                  {fotoVisualizadaTitulo}
                </span>
              </div>
              <button
                onClick={cerrarVisorFoto}
                className="btn btn-xs sm:btn-sm btn-circle btn-ghost text-base-content/60 hover:text-base-content hover:bg-base-300/60"
                title="Cerrar visor"
              >
                <X className="w-4 h-4 sm:w-4.5 sm:h-4.5" />
              </button>
            </div>

            {/* Imagen con altura fija */}
            <div className="relative w-full h-[54vh] sm:h-[62vh] min-h-[320px] max-h-[65vh] bg-gradient-to-b from-black/95 via-black/90 to-black/95 flex items-center justify-center overflow-hidden select-none">
              <img
                key={fotoVisualizadaUrl}
                src={fotoVisualizadaUrl}
                alt="Comprobante ampliado"
                className="max-h-full max-w-full w-auto h-auto object-contain shadow-2xl transition-all duration-200 animate-in fade-in zoom-in-98"
              />

              {/* Controles flotantes (Flechas Anterior y Siguiente) */}
              {fotosVisualizadas.length > 1 && (
                <>
                  <button
                    type="button"
                    onClick={fotoAnterior}
                    className="absolute left-3 top-1/2 -translate-y-1/2 z-10 w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-black/60 hover:bg-black/90 text-white backdrop-blur-md flex items-center justify-center transition-all shadow-xl active:scale-90 hover:scale-105 border border-white/20 hover:border-white/40"
                    title="Foto anterior (←)"
                  >
                    <ChevronLeft className="w-5 h-5" />
                  </button>
                  <button
                    type="button"
                    onClick={fotoSiguiente}
                    className="absolute right-3 top-1/2 -translate-y-1/2 z-10 w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-black/60 hover:bg-black/90 text-white backdrop-blur-md flex items-center justify-center transition-all shadow-xl active:scale-90 hover:scale-105 border border-white/20 hover:border-white/40"
                    title="Foto siguiente (→)"
                  >
                    <ChevronRight className="w-5 h-5" />
                  </button>
                </>
              )}
            </div>

            {/* Barra inferior: Sección de miniaturas (solo si hay más de 1 imagen) y botón cerrar */}
            <div className="p-3 sm:p-3.5 border-t border-base-300 bg-base-200/50 backdrop-blur-sm flex items-center justify-between gap-3">
              {fotosVisualizadas.length > 1 ? (
                <div className="flex items-center gap-2.5 p-1 overflow-visible">
                  {fotosVisualizadas.map((url, idx) => {
                    const esActiva = idx === indiceFotoVisualizada
                    return (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => {
                          setIndiceFotoVisualizada(idx)
                          setFotoVisualizadaUrl(url)
                        }}
                        className={`group relative w-12 h-12 sm:w-14 sm:h-14 rounded-xl overflow-hidden border-2 transition-all duration-200 shrink-0 focus:outline-none ${
                          esActiva
                            ? 'border-primary ring-2 ring-primary/40 scale-105 shadow-md'
                            : 'border-base-300/80 opacity-60 hover:opacity-100 hover:border-base-content/40 hover:scale-102'
                        }`}
                        title={`Ver imagen ${idx + 1}`}
                      >
                        <img
                          src={url}
                          alt={`Miniatura ${idx + 1}`}
                          className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300"
                        />
                        <span
                          className={`absolute bottom-0.5 right-0.5 text-[9px] font-bold px-1 rounded shadow-sm leading-tight ${
                            esActiva
                              ? 'bg-primary text-primary-content'
                              : 'bg-black/70 text-white'
                          }`}
                        >
                          {idx + 1}
                        </span>
                      </button>
                    )
                  })}
                </div>
              ) : (
                <div />
              )}

              <button
                type="button"
                onClick={cerrarVisorFoto}
                className="btn btn-xs sm:btn-sm btn-ghost border border-base-300 hover:bg-base-300 rounded-xl text-xs font-semibold px-3 sm:px-4 shrink-0"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
