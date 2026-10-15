// src/pages/bpkm/sel/SelNav.jsx
import { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { getPermisosBPKM } from '@services/bpkm/bpkmRutas';

const BASE = '/Facturas-BPKM';

export default function SelNav() {
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

  const canView = need(perms, 'bpkm.facturas.view', 'viewer');
  const canCreate = need(perms, 'bpkm.facturas.new', 'editor');

  useEffect(() => {
    (async () => {
      const data = await getPermisosBPKM(usuarioId);
      setPerms(Array.isArray(data) ? data : []);
    })();
  }, [usuarioId]);

  const isMis = useMemo(() => pathname === `${BASE}/mis` || pathname === BASE || pathname === `${BASE}/`, [pathname]);
  const isCrear = useMemo(() => pathname.startsWith(`${BASE}/crear`), [pathname]);

  return (
    <div className="mb-3">
      <nav className="nav nav-pills nav-fill bg-light rounded-3 p-1" style={{ maxWidth: '400px' }}>
        <button
          className={`nav-link ${isCrear ? 'active' : ''}`}
          onClick={() => canCreate && nav(`${BASE}/crear`)}
          disabled={!canCreate}
          title={!canCreate ? 'No tiene permiso para registrar facturas' : ''}
          style={{
            borderRadius: '0.375rem',
            fontWeight: isCrear ? '600' : '500',
            transition: 'all 0.2s',
            cursor: !canCreate ? 'not-allowed' : 'pointer',
            opacity: !canCreate ? 0.5 : 1
          }}
        >
          <i className="pi pi-plus me-2" style={{ fontSize: '0.875rem' }}></i>
          Registrar Factura
        </button>
        <button
          className={`nav-link ${isMis ? 'active' : ''}`}
          onClick={() => canView && nav(`${BASE}/mis`)}
          disabled={!canView}
          title={!canView ? 'No tiene permiso para ver mis facturas' : ''}
          style={{
            borderRadius: '0.375rem',
            fontWeight: isMis ? '600' : '500',
            transition: 'all 0.2s',
            cursor: !canView ? 'not-allowed' : 'pointer',
            opacity: !canView ? 0.5 : 1
          }}
        >
          <i className="pi pi-list me-2" style={{ fontSize: '0.875rem' }}></i>
          Mis Facturas
        </button>
      </nav>
    </div>
  );
}
