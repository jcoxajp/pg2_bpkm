// Manejo fechas(UTC-06:00)
const GT_TZ = 'America/Guatemala';

const isDateOnly = (v) => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v);

export function toLocalDate(dateLike) {
  if (!dateLike) return null;

  if (dateLike instanceof Date) return isNaN(dateLike) ? null : dateLike;

  if (typeof dateLike === 'string') {
    if (isDateOnly(dateLike)) {
      const [y, m, d] = dateLike.split('-').map(Number);
      return new Date(y, m - 1, d, 0, 0, 0, 0);
    }
    const d = new Date(dateLike);
    return isNaN(d) ? null : d;
  }

  return null;
}

export function toISODateLocal(dateLike) {
  const d = toLocalDate(dateLike);
  if (!d) return null;
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

export function formatDateOnly(dateLike) {
  if (!dateLike) return '';
  if (typeof dateLike === 'string' && isDateOnly(dateLike)) {
    const [y, m, d] = dateLike.split('-');
    return `${d}/${m}/${y}`;
  }
  const d = toLocalDate(dateLike);
  if (!d) return String(dateLike ?? '');
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const yyyy = d.getFullYear();
  return `${dd}/${mm}/${yyyy}`;
}

export function formatDateTimeGT(dateLike) {
  const d = toLocalDate(dateLike);
  if (!d) return String(dateLike ?? '');
  return new Intl.DateTimeFormat('es-GT', {
    timeZone: GT_TZ,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit'
  }).format(d);
}

export function toISODateTimeLocal(dateLike) {
  const d = toLocalDate(dateLike);
  if (!d) return null;
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  const hh = String(d.getHours()).padStart(2, '0');
  const min = String(d.getMinutes()).padStart(2, '0');
  const ss = String(d.getSeconds()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd} ${hh}:${min}:${ss}`;
}
