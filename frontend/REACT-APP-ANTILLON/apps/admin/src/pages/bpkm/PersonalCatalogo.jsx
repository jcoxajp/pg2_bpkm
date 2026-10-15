// src/pages/bpkm/PersonalCatalogo.jsx
import { useEffect, useRef, useState, useCallback } from 'react';
import { Toast } from 'primereact/toast';
import { DataTable } from 'primereact/datatable';
import { Column } from 'primereact/column';
import { InputText } from 'primereact/inputtext';
import { Dropdown } from 'primereact/dropdown';
import { Button } from 'primereact/button';
import { Sidebar } from 'primereact/sidebar';
import { InputSwitch } from 'primereact/inputswitch';
import { Tag } from 'primereact/tag';
import { RadioButton } from 'primereact/radiobutton';
import '../../styles/bpkm.css';
import {
  rolesPersonal,
  personalList,
  personalCreate,
  personalUpdate,
  getSucursalesList
} from '@services/bpkm/bpkmCatalogos';
import { formatDateTimeGT } from '@utils/dateSafe';

const estadoOptions = [
  { label: 'Activos', value: 1 },
  { label: 'Inactivos', value: 0 },
  { label: 'Todos', value: 2 },
];

const EstadoTag = ({ v }) => {
  const sev = Number(v) === 1 ? 'success' : 'secondary';
  const label = Number(v) === 1 ? 'Activo' : 'Inactivo';
  return <Tag value={label} severity={sev} rounded className="tag-pill" />;
};

export default function PersonalCatalogo({ userId, canNew, canEdit }) {
  const toast = useRef(null);
  const roleRef = useRef(null);
  const [roles, setRoles] = useState([]);
  const [sucursales, setSucursales] = useState([]);
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [estado, setEstado] = useState(1);
  const [buscar, setBuscar] = useState('');
  const [idSucursalFiltro, setIdSucursalFiltro] = useState(0);
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState('create');
  const [form, setForm] = useState({});

  const dataKey = 'int_id_personal';

  const ensureCatalogos = useCallback(async () => {
    if (!roles.length) {
      const d = await rolesPersonal();
      const opts = Array.isArray(d)
        ? d.map((x) => ({
            label: x.str_nombre_rol || x.nombre,
            value: x.int_id_rol || x.id_rol
          }))
        : [];
      setRoles(opts);
    }

    if (!sucursales.length) {
      const s = await getSucursalesList();
      const opts = [
        { label: 'Todas', value: 0 },
        ...(Array.isArray(s)
          ? s.map((x) => ({
              label: x.str_nombre_sucursal || x.str_nombre || x.nombre,
              value: x.int_id_sucursal ?? x.id_sucursal
            }))
          : [])
      ];
      setSucursales(opts);
    }
  }, [roles.length, sucursales.length]);

  // Cargar roles y sucursales al entrar a la pantalla
  useEffect(() => {
    ensureCatalogos();
  }, [ensureCatalogos]);

  const loadList = async () => {
    setLoading(true);
    try {
      const like = buscar ? `%${buscar}%` : '';
      const d = await personalList({
        id_personal: 0,
        id_rol: 0,
        nombre_like: like,
        estado,
        id_sucursal: idSucursalFiltro
      });
      setRows(Array.isArray(d) ? d : []);
    } catch (e) {
      const msg = e?.response?.data?.error || e?.message || 'No se pudo cargar.';
      toast.current?.show({ severity: 'error', summary: 'Error', detail: msg });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadList();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [estado, idSucursalFiltro]);

  const onChange = (k, v) => setForm((s) => ({ ...s, [k]: v }));

  const openCreate = async () => {
    await ensureCatalogos();
    setMode('create');
    setForm({
      id_personal: 0,
      id_rol: null,
      nombre: '',
      telefono: '',
      estado: 1,
      id_sucursal: null
    });
    setOpen(true);
  };

  const openEdit = async (row) => {
    await ensureCatalogos();
    setMode('edit');
    setForm({
      id_personal: row.int_id_personal || row.id_personal || row.id,
      id_rol: row.int_id_rol || row.id_rol || null,
      nombre: row.str_nombre || row.nombre || '',
      telefono: String(row.str_telefono || row.telefono || ''),
      estado: Number(row.int_estado ?? row.estado ?? 1),
      id_sucursal: row.int_id_sucursal || row.id_sucursal || null,
      nombre_creador: row.str_nombre_creador || row.nombre_creador,
      fecha_creacion: row.str_f_creacion || row.fecha_creacion,
      nombre_actualizador: row.str_nombre_actualizador || row.nombre_actualizador,
      fecha_actualizacion: row.str_f_actualizacion || row.fecha_actualizacion
    });
    setOpen(true);
  };

  // Focus automático al rol en modo crear
  useEffect(() => {
    if (open && mode === 'create') {
      setTimeout(() => roleRef.current?.focus?.(), 0);
    }
  }, [open, mode]);

  const save = async () => {
    try {
      if (!form.nombre || !form.id_rol) {
        return toast.current?.show({
          severity: 'warn',
          summary: 'Validación',
          detail: 'Rol y nombre requeridos.'
        });
      }

      const payloadBase = {
        id_rol: form.id_rol,
        nombre: form.nombre.trim(),
        telefono: (form.telefono || '').replace(/[^\d+]/g, ''),
        usuario: userId,
        id_sucursal: form.id_sucursal || null
      };

      if (mode === 'create') {
        await personalCreate({
          ...payloadBase,
          estado: 1
        });
      } else {
        await personalUpdate({
          ...payloadBase,
          id_personal: form.id_personal,
          estado: form.estado
        });
      }

      toast.current?.show({ severity: 'success', summary: 'OK', detail: 'Guardado.' });
      setOpen(false);
      await loadList();
    } catch (e) {
      const msg = e?.response?.data?.error || e?.message || 'No se pudo guardar.';
      toast.current?.show({ severity: 'error', summary: 'Error', detail: msg });
    }
  };

  const ActionCol = (r) => (
    <div className="d-flex justify-content-center">
      {canEdit && (
        <Button
          icon="pi pi-pen-to-square"
          rounded
          text
          onClick={() => openEdit(r)}
        />
      )}
    </div>
  );

  const Audit = () => (
    <div className="audit-card mt-2">
      <div className="row g-2">
        <div className="col-12 col-md-6">
          <div className="kv-label">Creado por</div>
          <div className="kv-value">{form.nombre_creador || '-'}</div>
          <div className="kv-label mt-1">Fecha creación</div>
          <div className="kv-value">
            {formatDateTimeGT(form.fecha_creacion) || '-'}
          </div>
        </div>
        <div className="col-12 col-md-6">
          <div className="kv-label">Actualizado por</div>
          <div className="kv-value">{form.nombre_actualizador || '-'}</div>
          <div className="kv-label mt-1">Fecha actualización</div>
          <div className="kv-value">
            {formatDateTimeGT(form.fecha_actualizacion) || '-'}
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <>
      <Toast ref={toast} />

      {/* Filtros + acciones */}
      <div className="mb-3">
        <div className="d-flex align-items-center gap-3 mb-2">
          <span className="small text-muted" style={{ minWidth: '60px' }}>
            Estado:
          </span>
          <div className="d-flex gap-3">
            <div className="d-flex align-items-center">
              <RadioButton
                inputId="est-activos"
                value={1}
                checked={estado === 1}
                onChange={(e) => setEstado(e.value)}
              />
              <label htmlFor="est-activos" className="ms-2 small">
                Activos
              </label>
            </div>
            <div className="d-flex align-items-center">
              <RadioButton
                inputId="est-inactivos"
                value={0}
                checked={estado === 0}
                onChange={(e) => setEstado(e.value)}
              />
              <label htmlFor="est-inactivos" className="ms-2 small">
                Inactivos
              </label>
            </div>
            <div className="d-flex align-items-center">
              <RadioButton
                inputId="est-todos"
                value={2}
                checked={estado === 2}
                onChange={(e) => setEstado(e.value)}
              />
              <label htmlFor="est-todos" className="ms-2 small">
                Todos
              </label>
            </div>
          </div>
        </div>
        <div className="d-flex gap-3 align-items-center">
          <span className="small text-muted" style={{ minWidth: '60px' }}>Sucursal:</span>
          <Dropdown
            value={idSucursalFiltro}
            options={sucursales}
            onChange={(e) => setIdSucursalFiltro(e.value)}
            className="p-inputtext-md"
            style={{ minWidth: '180px', height: '35px' }}
            showClear={idSucursalFiltro !== 0}
            placeholder="Todas"
          />
          <span className="small text-muted ms-2">Buscar:</span>
          <span className="p-input-icon-left">
            <i className="pi pi-search" style={{ left: '0.75rem' }} />
            <InputText
              value={buscar}
              onChange={(e) => setBuscar(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && loadList()}
              placeholder="Buscar por nombre"
              className="p-inputtext-sm"
              style={{ minWidth: '200px', paddingLeft: '2.25rem' }}
            />
          </span>
          {canNew && (
            <Button
              label="Nuevo"
              icon="pi pi-plus"
              severity="success"
              onClick={openCreate}
              size="small"
            />
          )}
          <Button
            icon="pi pi-refresh"
            text
            rounded
            onClick={loadList}
            size="small"
          />
        </div>
      </div>

      {/* Tabla */}
      <DataTable
        key="personal"
        value={rows}
        dataKey={dataKey}
        paginator
        rows={50}
        rowsPerPageOptions={[50, 100]}
        loading={loading}
        emptyMessage={loading ? '' : 'Sin registros'}
        stripedRows
        showGridlines
      >
        <Column header="No." body={(r) => r?.int_id_personal ?? ''} />
        <Column
          header="Nombre"
          sortable
          sortField="str_nombre"
          body={(r) => r?.str_nombre ?? r?.nombre ?? ''}
        />
        <Column
          header="Rol"
          body={(r) => r?.str_nombre_rol ?? r?.nombre_rol ?? ''}
        />
        <Column
          header="Sucursal"
          body={(r) => r?.str_nombre_sucursal ?? '-'}
          style={{ minWidth: '120px' }}
        />
        <Column
          header="Teléfono"
          body={(r) => r?.str_telefono ?? r?.telefono ?? ''}
        />
        <Column
          header="Estado"
          body={(r) => <EstadoTag v={r?.int_estado ?? r?.estado} />}
          style={{ width: 120 }}
        />
        <Column header="" body={ActionCol} style={{ width: 80 }} />
      </DataTable>

      {/* Sidebar */}
      <Sidebar
        visible={open}
        position="right"
        onHide={() => setOpen(false)}
        style={{ width: 520 }}
      >
        <div className="d-flex align-items-center justify-content-between mb-3">
          <h6 className="mb-0">
            {mode === 'create' ? 'Nuevo personal' : 'Editar personal'}
          </h6>
          <div className="d-flex gap-2">
            <Button
              label="Guardar"
              icon="pi pi-check"
              severity="success"
              onClick={save}
            />
          </div>
        </div>

        <div className="row g-3">
          <div className="col-12">
            <label className="form-label small">Rol</label>
            <Dropdown
              ref={roleRef}
              value={form.id_rol}
              options={roles}
              onChange={(e) => onChange('id_rol', e.value)}
              placeholder="Seleccione"
              className="w-100"
              disabled={!canEdit && mode !== 'create'}
            />
          </div>
          <div className="col-12">
            <label className="form-label small">Sucursal</label>
            <Dropdown
              value={form.id_sucursal}
              options={sucursales.filter((s) => s.value !== 0)}
              onChange={(e) => onChange('id_sucursal', e.value)}
              placeholder="Seleccione sucursal"
              className="w-100"
              disabled={!canEdit && mode !== 'create'}
            />
          </div>
          <div className="col-12">
            <label className="form-label small">Nombre</label>
            <InputText
              value={form.nombre || ''}
              onChange={(e) => onChange('nombre', e.target.value)}
              className="w-100"
              maxLength={120}
            />
          </div>
          <div className="col-12">
            <label className="form-label small">Teléfono</label>
            <InputText
              value={form.telefono || ''}
              onChange={(e) => onChange('telefono', e.target.value)}
              className="w-100"
              maxLength={16}
            />
          </div>

          <div className="col-12 d-flex align-items-center justify-content-between">
            <div className="small text-muted">Activo</div>
            <InputSwitch
              checked={!!(mode === 'create' ? 1 : form.estado)}
              onChange={(e) => onChange('estado', e.value ? 1 : 0)}
              disabled={mode === 'create' || !canEdit}
            />
          </div>

          <Audit />
        </div>
      </Sidebar>
    </>
  );
}
