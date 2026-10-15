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
import { camionesList, camionCreate, camionUpdate, getSucursalesList } from '@services/bpkm/bpkmCatalogos';
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

export default function CamionesCatalogo({ userId, canNew, canEdit }) {
  const toast = useRef(null);
  const placaRef = useRef(null);
  const [rows, setRows] = useState([]);
  const [sucursales, setSucursales] = useState([]);
  const [loading, setLoading] = useState(false);
  const [estado, setEstado] = useState(1);
  const [buscar, setBuscar] = useState('');
  const [idSucursalFiltro, setIdSucursalFiltro] = useState(0);
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState('create');
  const [form, setForm] = useState({});

  const dataKey = 'int_id_camion';

  const ensureSucursales = useCallback(async () => {
    if (!sucursales.length) {
      try {
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
      } catch (e) {
        console.error('Error cargando sucursales:', e);
      }
    }
  }, [sucursales.length]);

  useEffect(() => {
    ensureSucursales();
  }, [ensureSucursales]);

  const loadList = async () => {
    setLoading(true);
    try {
      const like = buscar ? `%${buscar}%` : '';
      const d = await camionesList({ id_camion: 0, placa_like: like, estado, id_sucursal: idSucursalFiltro });
      setRows(Array.isArray(d) ? d : []);
    } catch (e) {
      const msg = e?.response?.data?.error || e?.message || 'No se pudo cargar.';
      toast.current?.show({ severity: 'error', summary: 'Error', detail: msg });
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { loadList(); /* eslint-disable-next-line */ }, [estado, idSucursalFiltro]);

  const onChange = (k, v) => setForm((s) => ({ ...s, [k]: v }));

  const openCreate = async () => {
    await ensureSucursales();
    setMode('create');
    setForm({ id_camion: 0, placa: '', estado: 1, id_sucursal: null });
    setOpen(true);
  };
  const openEdit = async (row) => {
    await ensureSucursales();
    setMode('edit');
    setForm({
      id_camion: row.int_id_camion || row.id_camion || row.id,
      placa: String(row.str_placa || row.placa || ''),
      estado: Number(row.int_estado ?? row.estado ?? 1),
      id_sucursal: row.int_id_sucursal || row.id_sucursal || null,
      nombre_creador: row.str_nombre_creador || row.nombre_creador,
      fecha_creacion: row.str_fecha_creacion || row.fecha_creacion,
      nombre_actualizador: row.str_nombre_actualizador || row.nombre_actualizador,
      fecha_actualizacion: row.str_fecha_actualizacion || row.fecha_actualizacion,
    });
    setOpen(true);
  };

  // ⬅ focus automático al crear
  useEffect(() => {
    if (open && mode === 'create') {
      setTimeout(() => placaRef.current?.focus?.(), 0);
    }
  }, [open, mode]);

  const save = async () => {
    try {
      if (!form.placa) return toast.current?.show({ severity: 'warn', summary: 'Validación', detail: 'Placa requerida.' });
      const placa = String(form.placa).toUpperCase();
      if (!/^[-A-Z0-9]{6,10}$/.test(placa))
        return toast.current?.show({ severity: 'warn', summary: 'Validación', detail: 'Placa inválida.' });

      if (mode === 'create') {
        await camionCreate({ placa, estado: 1, usuario: userId, id_sucursal: form.id_sucursal || null });
      } else {
        await camionUpdate({ id_camion: form.id_camion, estado: form.estado, usuario: userId, id_sucursal: form.id_sucursal || null });
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
      {canEdit && <Button icon="pi pi-pen-to-square" rounded text onClick={() => openEdit(r)} />}
    </div>
  );

  const Audit = () => (
    <div className="audit-card mt-2">
      <div className="row g-2">
        <div className="col-12 col-md-6">
          <div className="kv-label">Creado por</div>
          <div className="kv-value">{form.nombre_creador || '-'}</div>
          <div className="kv-label mt-1">Fecha creación</div>
          <div className="kv-value">{formatDateTimeGT(form.fecha_creacion) || '-'}</div>
        </div>
        <div className="col-12 col-md-6">
          <div className="kv-label">Actualizado por</div>
          <div className="kv-value">{form.nombre_actualizador || '-'}</div>
          <div className="kv-label mt-1">Fecha actualización</div>
          <div className="kv-value">{formatDateTimeGT(form.fecha_actualizacion) || '-'}</div>
        </div>
      </div>
    </div>
  );

  return (
    <>
      <Toast ref={toast} />

      <div className="mb-3">
        <div className="d-flex align-items-center gap-3 mb-2">
          <span className="small text-muted" style={{ minWidth: '60px' }}>Estado:</span>
          <div className="d-flex gap-3">
            <div className="d-flex align-items-center">
              <RadioButton inputId="cam-activos" value={1} checked={estado === 1} onChange={(e) => setEstado(e.value)} />
              <label htmlFor="cam-activos" className="ms-2 small">Activos</label>
            </div>
            <div className="d-flex align-items-center">
              <RadioButton inputId="cam-inactivos" value={0} checked={estado === 0} onChange={(e) => setEstado(e.value)} />
              <label htmlFor="cam-inactivos" className="ms-2 small">Inactivos</label>
            </div>
            <div className="d-flex align-items-center">
              <RadioButton inputId="cam-todos" value={2} checked={estado === 2} onChange={(e) => setEstado(e.value)} />
              <label htmlFor="cam-todos" className="ms-2 small">Todos</label>
            </div>
          </div>
        </div>
        <div className="d-flex gap-3 align-items-center">
          <span className="small text-muted" style={{ minWidth: '60px' }}>Sucursal:</span>
          <Dropdown
            value={idSucursalFiltro}
            options={sucursales}
            onChange={(e) => setIdSucursalFiltro(e.value)}
            className="p-inputtext-sd"
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
              placeholder="Buscar por placa"
              className="p-inputtext-sm"
              style={{ minWidth: '200px', paddingLeft: '2.25rem' }}
            />
          </span>
          {canNew && <Button label="Nuevo" icon="pi pi-plus" severity="success" onClick={openCreate} size="small" />}
          <Button icon="pi pi-refresh" text rounded onClick={loadList} size="small" />
        </div>
      </div>

      <DataTable
        key="camiones"
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
        <Column header="No." body={(r) => r?.int_id_camion ?? ''} />
        <Column header="Placa" sortable sortField="str_placa" body={(r) => r?.str_placa ?? r?.placa ?? ''} />
        <Column header="Sucursal" body={(r) => r?.str_nombre_sucursal ?? '-'} style={{ minWidth: '120px' }} />
        <Column header="Estado" body={(r) => <EstadoTag v={r?.int_estado ?? r?.estado} />} style={{ width: 120 }} />
        <Column header="" body={ActionCol} style={{ width: 80 }} />
      </DataTable>

      <Sidebar visible={open} position="right" onHide={() => setOpen(false)} style={{ width: 520 }}>
        <div className="d-flex align-items-center justify-content-between mb-3">
          <h6 className="mb-0">{mode === 'create' ? 'Nuevo camión' : 'Editar camión'}</h6>
          <div className="d-flex gap-2">
            <Button label="Guardar" icon="pi pi-check" severity="success" onClick={save} />
          </div>
        </div>

        <div className="row g-3">
          <div className="col-12">
            <label className="form-label small">Placa</label>
            <InputText
              ref={placaRef}
              value={form.placa || ''}
              onChange={(e) => onChange('placa', String(e.target.value).toUpperCase())}
              className="w-100"
              maxLength={10}
              disabled={mode === 'edit' && !canEdit}
            />
          </div>

          <div className="col-12">
            <label className="form-label small">Sucursal</label>
            <Dropdown
              value={form.id_sucursal}
              options={sucursales.filter(s => s.value !== 0)}
              onChange={(e) => onChange('id_sucursal', e.value)}
              placeholder="Seleccione sucursal"
              className="w-100"
              disabled={mode === 'edit' && !canEdit}
            />
          </div>

          <div className="col-12 d-flex align-items-center justify-content-between">
            <div className="small text-muted">Activo</div>
            <InputSwitch checked={!!(mode === 'create' ? 1 : form.estado)} onChange={(e) => onChange('estado', e.value ? 1 : 0)} disabled={mode === 'create' || !canEdit} />
          </div>

          <Audit />
        </div>
      </Sidebar>
    </>
  );
}
