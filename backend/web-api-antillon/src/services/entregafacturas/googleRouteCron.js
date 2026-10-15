const cron = require('node-cron');
const GoogleRouteService = require('./GoogleRouteService');

let _initialized = false;

// Guard de PM2 cluster — sin esto, cada instancia registraría su propio cron y
// la revisión diaria llamaría a Google N veces por corrida real (N = instancias).
function initGoogleRouteCron() {
  if (process.env.NODE_APP_INSTANCE !== undefined && process.env.NODE_APP_INSTANCE !== '0') return;
  if (_initialized) return;
  _initialized = true;

  const cronExpr = process.env.GOOGLE_ROUTE_CRON || '30 7 * * *';

  cron.schedule(cronExpr, async () => {
    console.log('[GoogleRouteService cron] Iniciando revisión diaria...');
    try {
      const resultado = await GoogleRouteService.calcularRutasListas();
      console.log(`[GoogleRouteService cron] Revisión diaria completada: ${resultado.rutasProcesadas} ruta(s) procesada(s)`);
    } catch (err) {
      console.error('[GoogleRouteService cron] Error en revisión diaria:', err.message);
    }
  }, {
    timezone: 'America/Guatemala',
  });

  console.log(`[GoogleRouteService cron] Job inicializado ("${cronExpr}" America/Guatemala)`);
}

module.exports = { initGoogleRouteCron };
