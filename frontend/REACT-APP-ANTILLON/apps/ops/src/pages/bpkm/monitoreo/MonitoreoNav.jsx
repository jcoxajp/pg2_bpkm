// src/pages/bpkm/monitoreo/MonitoreoNav.jsx
import { useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

const BASE = '/Monitoreo-BPKM';

export default function MonitoreoNav() {
  const { pathname } = useLocation();
  const nav = useNavigate();

  const isBandeja = useMemo(() => pathname === BASE || pathname === `${BASE}/`, [pathname]);

  return (
    <div className="mb-3">
      <nav className="nav nav-pills nav-fill bg-body-tertiary border rounded-3 p-1" style={{ maxWidth: '300px' }}>
        <button
          className={`nav-link ${isBandeja ? 'active' : ''}`}
          onClick={() => nav(BASE)}
          style={{
            borderRadius: '0.375rem',
            fontWeight: isBandeja ? '600' : '500',
            transition: 'all 0.2s'
          }}
        >
          <i className="pi pi-eye me-2" style={{ fontSize: '0.875rem' }}></i>
          Monitoreo de Rutas
        </button>
      </nav>
    </div>
  );
}
