// src/pages/bpkm/rutas/RutasNav.jsx
import { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { getPermisosBPKM } from '@services/bpkm/bpkmRutas';

const BASE = '/Rutas-BPKM';

export default function RutasNav() {
  const { pathname } = useLocation();
  const nav = useNavigate();
  const usuarioId = useMemo(() => Number(localStorage.getItem('userId') || 0), []);

  const [perms, setPerms] = useState([]);

  // Helper para validar permisos
  const rank = { viewer: 1, editor: 2, admin: 3 };
  const need = (perms, key, min = 'viewer') => {
    const r = rank[min] || 1;
    const p = Array.isArray(perms) ? perms.find((x) => x.key === key) : null;
    return p ? (rank[p.nivel_permiso] || 0) >= r : false;
  };

  const canCreate = need(perms, 'bpkm.rutas.new', 'editor');

  useEffect(() => {
    (async () => {
      const data = await getPermisosBPKM(usuarioId);
      setPerms(Array.isArray(data) ? data : []);
    })();
  }, [usuarioId]);

  const isBandeja = useMemo(() => pathname === BASE || pathname === `${BASE}/`, [pathname]);
  const isCrear = useMemo(() => pathname.startsWith(`${BASE}/crear`), [pathname]);

  return (
    <div className="mb-3">
      <nav className="nav nav-pills nav-fill bg-light rounded-3 p-1" style={{ maxWidth: '400px' }}>
        <button
          className={`nav-link ${isBandeja ? 'active' : ''}`}
          onClick={() => nav(BASE)}
          style={{
            borderRadius: '0.375rem',
            fontWeight: isBandeja ? '600' : '500',
            transition: 'all 0.2s'
          }}
        >
          <i className="pi pi-list me-2" style={{ fontSize: '0.875rem' }}></i>
          Bandeja de Rutas
        </button>
        <button
          className={`nav-link ${isCrear ? 'active' : ''}`}
          onClick={() => canCreate && nav(`${BASE}/crear`)}
          disabled={!canCreate}
          title={!canCreate ? 'No tiene permiso para crear rutas' : ''}
          style={{
            borderRadius: '0.375rem',
            fontWeight: isCrear ? '600' : '500',
            transition: 'all 0.2s',
            cursor: !canCreate ? 'not-allowed' : 'pointer',
            opacity: !canCreate ? 0.5 : 1
          }}
        >
          <i className="pi pi-plus me-2" style={{ fontSize: '0.875rem' }}></i>
          Crear Ruta
        </button>
      </nav>
    </div>
  );
}