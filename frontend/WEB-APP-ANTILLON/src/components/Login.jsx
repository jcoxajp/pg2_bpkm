import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { User, Lock, Eye, EyeOff } from 'lucide-react'
import { useAuth } from '@auth'
import loginImage from '../assets/Image/LoginImage.jpg'
import logoBlanco from '../assets/Image/LogoBlanco.png'

export default function Login() {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const { login, user, loading: authLoading } = useAuth()
  const navigate = useNavigate()

  // Si ya hay sesión activa, redirigir directo a /home
  useEffect(() => {
    if (!authLoading && user) {
      navigate('/home', { replace: true })
    }
  }, [user, authLoading, navigate])

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')

    if (!username.trim() || !password) {
      setError('Por favor ingresa usuario y contraseña.')
      return
    }

    try {
      setLoading(true)
      await login(username, password)
      navigate('/home', { replace: true })
    } catch (err) {
      const status = err?.status
      const apiMessage = typeof err?.message === 'string' ? err.message.trim() : ''

      // Prioriza el mensaje exacto del backend para evitar errores genéricos confusos.
      if (apiMessage) setError(apiMessage)
      else if (status === 401) setError('Usuario o contraseña incorrectos.')
      else if (status === 403) setError('Cuenta desactivada.')
      else if (status === 423) setError('Cuenta bloqueada. Intenta más tarde.')
      else if (status === 429) setError('Demasiados intentos. Espera un momento.')
      else setError('Error al iniciar sesión.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen min-h-[100dvh] flex flex-col md:flex-row bg-base-100">

      {/* ─────────────────────────────────────────
          PANEL IZQUIERDO — Imagen de fondo y marca (Desktop / Tablet)
      ───────────────────────────────────────── */}
      <div
        className="relative hidden md:flex md:w-[58%] lg:w-[62%] flex-col justify-between overflow-hidden p-8 lg:p-14"
        style={{
          backgroundImage: `url(${loginImage})`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
        }}
      >
        {/* Capa oscura de fondo */}
        <div className="absolute inset-0 bg-black/60 backdrop-blur-[1px]" />

        {/* Logo oficial Antillón en la parte superior izquierda */}
        <div className="relative z-10">
          <img
            src={logoBlanco}
            alt="Antillon"
            className="h-9 lg:h-11 w-auto object-contain drop-shadow-md"
          />
        </div>

        {/* Contenido de marca y bienvenida inferior */}
        <div className="relative z-10 pb-6 lg:pb-10">
          <h1 className="text-white text-3xl md:text-4xl lg:text-[2.6rem] font-bold leading-[1.2] mb-3">
            Bienvenido a 
            <br />
            App Antillon
          </h1>
        </div>
      </div>

      {/* ─────────────────────────────────────────
          PANEL DERECHO — Formulario de inicio de sesión (Móvil y Desktop)
      ───────────────────────────────────────── */}
      <div className="flex-1 md:w-[42%] lg:w-[38%] bg-base-100 flex flex-col min-h-screen min-h-[100dvh] overflow-y-auto">

        {/* Barra de encabezado oficial solo en móvil */}
        <div className="flex md:hidden items-center px-4 sm:px-6 py-3.5 bg-black border-b border-white/10 shadow-sm sticky top-0 z-20">
          <img src={logoBlanco} alt="Antillon" className="h-7 w-auto object-contain" />
        </div>

        {/* Formulario centrado con scroll seguro */}
        <div className="flex-1 flex items-center justify-center p-6 sm:p-10 lg:p-12 my-auto">
          <div className="w-full max-w-sm sm:max-w-md">
            <div className="mb-7 sm:mb-8">
              <h2 className="text-2xl sm:text-3xl font-bold text-base-content tracking-tight">
                Iniciar Sesión
              </h2>
              <p className="text-xs sm:text-sm text-base-content/60 mt-1">
                Ingresa tus credenciales para acceder al sistema.
              </p>
            </div>

            <form className="flex flex-col gap-4" onSubmit={handleSubmit}>

              {/* ── Mensaje de error ── */}
              {error && (
                <div className="alert alert-error text-xs sm:text-sm py-2.5 shadow-sm rounded-xl">
                  <span>{error}</span>
                </div>
              )}

              {/* ── Usuario ── */}
              <div className="form-control w-full">
                <label className="label py-1">
                  <span className="label-text text-xs font-semibold text-base-content/80">Usuario</span>
                </label>
                <label className="input input-bordered flex items-center gap-2.5 w-full min-h-[46px] rounded-xl focus-within:border-primary">
                  <User className="h-4 w-4 shrink-0 opacity-45" />
                  <input
                    autoFocus
                    type="text"
                    name="username"
                    autoComplete="username"
                    autoCapitalize="none"
                    autoCorrect="off"
                    spellCheck="false"
                    className="grow text-sm"
                    placeholder="Tu nombre de usuario"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                  />
                </label>
              </div>

              {/* ── Contraseña ── */}
              <div className="form-control w-full">
                <label className="label py-1">
                  <span className="label-text text-xs font-semibold text-base-content/80">Contraseña</span>
                </label>
                <label className="input input-bordered flex items-center gap-2.5 w-full min-h-[46px] rounded-xl focus-within:border-primary">
                  <Lock className="h-4 w-4 shrink-0 opacity-45" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    name="password"
                    autoComplete="current-password"
                    className="grow text-sm"
                    placeholder="Tu contraseña"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    className="p-1 rounded-md opacity-45 hover:opacity-90 hover:bg-base-200 active:scale-95 transition-all cursor-pointer min-w-[32px] min-h-[32px] flex items-center justify-center focus:outline-none"
                    aria-label={showPassword ? 'Ocultar contraseña' : 'Ver contraseña'}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </label>
              </div>

              {/* ── Botón de envío ── */}
              <button
                type="submit"
                disabled={loading}
                className="btn btn-primary w-full text-white font-semibold text-sm tracking-wide mt-2 min-h-[46px] rounded-xl shadow-sm hover:shadow-md active:scale-[0.99] transition-all cursor-pointer"
              >
                {loading ? (
                  <span className="loading loading-spinner loading-sm" />
                ) : (
                  'Iniciar Sesión'
                )}
              </button>
            </form>
          </div>
        </div>
      </div>

    </div>
  )
}
