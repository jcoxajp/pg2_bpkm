import { useEffect, useMemo, useRef, useState } from 'react';
import Layout from '@ui/Layout';
import { Toast } from 'primereact/toast';
import { Card } from 'primereact/card';
import { Button } from 'primereact/button';
import { ConfirmDialog } from 'primereact/confirmdialog';
import { getPermisosBPKM } from '@services/bpkm/bpkmCatalogos';
import PersonalCatalogo from './PersonalCatalogo';
import CamionesCatalogo from './CamionesCatalogo';
import TransportesCatalogo from './TransportesCatalogo';
import '../../styles/bpkm.css';

const rank = { viewer: 1, editor: 2, admin: 3 };
const need = (perms, key, min = 'viewer') => {
    const r = rank[min] || 1;
    const p = Array.isArray(perms) ? perms.find((x) => x.key === key) : null;
    return p ? (rank[p.nivel_permiso] || 0) >= r : false;
};

export default function NavCatalogos() {
    const toast = useRef(null);
    const userId = useMemo(() => Number(localStorage.getItem('userId') || 0), []);
    const [perms, setPerms] = useState([]);
    const [tab, setTab] = useState('');

    // cargar permisos
    useEffect(() => {
        (async () => {
            try {
                const data = await getPermisosBPKM(userId);
                setPerms(Array.isArray(data) ? data : []);
            } catch {
                setPerms([]);
            }
        })();
    }, [userId]);

    const canView = {
        personal:
            need(perms, 'bpkm.personal.view', 'viewer') ||
            need(perms, 'bpkm.personal.edit', 'viewer') ||
            need(perms, 'bpkm.personal.new', 'viewer'),
        camiones:
            need(perms, 'bpkm.camiones.view', 'viewer') ||
            need(perms, 'bpkm.camiones.edit', 'viewer') ||
            need(perms, 'bpkm.camiones.new', 'viewer'),
        transportes:
            need(perms, 'bpkm.transportes.view', 'viewer') ||
            need(perms, 'bpkm.transportes.edit', 'viewer') ||
            need(perms, 'bpkm.transportes.new', 'viewer'),
    };

    const canNew = {
        personal: need(perms, 'bpkm.personal.new', 'editor'),
        camiones: need(perms, 'bpkm.camiones.new', 'editor'),
        transportes: need(perms, 'bpkm.transportes.new', 'editor'),
    };
    const canEdit = {
        personal: need(perms, 'bpkm.personal.edit', 'editor'),
        camiones: need(perms, 'bpkm.camiones.edit', 'editor'),
        transportes: need(perms, 'bpkm.transportes.edit', 'editor'),
    };

    const visibleTabs = useMemo(() => {
        const arr = [];
        if (canView.personal) arr.push({ key: 'personal', label: 'Personal' });
        if (canView.camiones) arr.push({ key: 'camiones', label: 'Camiones' });
        if (canView.transportes) arr.push({ key: 'transportes', label: 'Transporte externo' });
        return arr;
        // eslint-disable-next-line
    }, [JSON.stringify(canView)]);

    useEffect(() => {
        if (!visibleTabs.length) return;
        if (!tab || !visibleTabs.find((t) => t.key === tab)) setTab(visibleTabs[0].key);
    }, [visibleTabs, tab]);

    return (
        <Layout>
            <div className="container-fluid py-3">
                <Toast ref={toast} />
                <ConfirmDialog />
                <div className="d-flex align-items-center justify-content-between mb-1">
                    <h5 className="mb-0">Catálogos BPKM</h5>
                    <div className="small text-muted">
                        {tab ? visibleTabs.find((t) => t.key === tab)?.label : ''}
                    </div>
                </div>

                <Card className="border-0 shadow-sm">
                    <div className="p-2">
                        {/* NAV de pestañas */}
                        <div className="d-flex bpkm-tabs mb-2">
                            {visibleTabs.map((t) => {
                                const active = tab === t.key;
                                return (
                                    <Button
                                        key={t.key}
                                        label={t.label}
                                        outlined={!active}
                                        className={`bpkm-tab ${active ? 'active' : ''}`}
                                        onClick={() => setTab(t.key)}
                                    />
                                );
                            })}
                        </div>

                        {/* Contenido por pestaña (misma página) */}
                        <div className="mt-2">
                            {tab === 'personal' && (
                                <PersonalCatalogo userId={userId} canNew={canNew.personal} canEdit={canEdit.personal} />
                            )}
                            {tab === 'camiones' && (
                                <CamionesCatalogo userId={userId} canNew={canNew.camiones} canEdit={canEdit.camiones} />
                            )}
                            {tab === 'transportes' && (
                                <TransportesCatalogo userId={userId} canNew={canNew.transportes} canEdit={canEdit.transportes} />
                            )}
                        </div>
                    </div>
                </Card>
            </div>
        </Layout>
    );
}
