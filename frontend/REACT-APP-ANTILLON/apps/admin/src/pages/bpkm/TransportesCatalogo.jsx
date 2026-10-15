import { useEffect, useRef, useState } from 'react';
import { Toast } from 'primereact/toast';
import { DataTable } from 'primereact/datatable';
import { Column } from 'primereact/column';
import { InputText } from 'primereact/inputtext';
import { Button } from 'primereact/button';
import { Sidebar } from 'primereact/sidebar';
import { InputSwitch } from 'primereact/inputswitch';
import { Tag } from 'primereact/tag';
import { RadioButton } from 'primereact/radiobutton';
import '../../styles/bpkm.css';
import { transportesList, transporteCreate, transporteUpdate } from '@services/bpkm/bpkmCatalogos';
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

export default function TransportesCatalogo({ userId, canNew, canEdit }) {
  const toast = useRef(null);
  const nombreRef = useRef(null); // ⬅ focus
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [estado, setEstado] = useState(1);
  const [buscar, setBuscar] = useState('');
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState('create');
  const [form, setForm] = useState({});

  const dataKey = 'int_id_transporte_externo';

  const loadList = async () => {
    setLoading(true);
    try {
      const like = buscar ? `%${buscar}%` : '';
      const d = await transportesList({ id_transporte_externo: 0, nombre_like: like, estado });
      setRows(Array.isArray(d) ? d : []);
    } catch (e) {
      const msg = e?.response?.data?.error || e?.message || 'No se pudo cargar.';
      toast.current?.show({ severity: 'error', summary: 'Error', detail: msg });
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { loadList(); /* eslint-disable-next-line */ }, [estado]);

  const onChange = (k, v) => setForm((s) => ({ ...s, [k]: v }));

  const openCreate = () => {
    setMode('create');
    setForm({ id_transporte_externo: 0, nombre: '', estado: 1 });
    setOpen(true);
  };
  const openEdit = (row) => {
    setMode('edit');
    setForm({
      id_transporte_externo: row.int_id_transporte_externo || row.id_transporte_externo || row.id,
      nombre: String(row.str_nombre || row.nombre || ''),
      estado: Number(row.int_estado ?? row.estado ?? 1),
      usuario_creador: row.str_usuario_creador || row.usuario_creador,
      fecha_creacion: row.str_f_creacion || row.f_creacion,
      usuario_modificador: row.str_usuario_modificador || row.usuario_modificador,
      fecha_actualizacion: row.str_f_modificacion || row.f_modificacion,
    });
    setOpen(true);
  };

  // ⬅ focus automático al crear
  useEffect(() => {
    if (open && mode === 'create') {
      setTimeout(() => nombreRef.current?.focus?.(), 0);
    }
  }, [open, mode]);

  const save = async () => {
    try {
      if (!form.nombre) return toast.current?.show({ severity: 'warn', summary: 'Validación', detail: 'Nombre requerido.' });

      if (mode === 'create') {
        await transporteCreate({ nombre: form.nombre.trim(), estado: 1, usuario: userId });
      } else {
        await transporteUpdate({
          id_transporte: form.id_transporte_externo,
          nombre: form.nombre.trim(),
          estado: form.estado,
          usuario: userId,
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
      {canEdit && <Button icon="pi pi-pen-to-square" rounded text onClick={() => openEdit(r)} />}
    </div>
  );

  const Audit = () => (
    <div className="audit-card mt-2">
      <div className="row g-2">
        <div className="col-12 col-md-6">
          <div className="kv-label">Creado por</div>
          <div className="kv-value">{form.usuario_creador || '-'}</div>
          <div className="kv-label mt-1">Fecha creación</div>
          <div className="kv-value">{formatDateTimeGT(form.fecha_creacion) || '-'}</div>
        </div>
        <div className="col-12 col-md-6">
          <div className="kv-label">Actualizado por</div>
          <div className="kv-value">{form.usuario_modificador || '-'}</div>
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
              <RadioButton inputId="tr-activos" value={1} checked={estado === 1} onChange={(e) => setEstado(e.value)} />
              <label htmlFor="tr-activos" className="ms-2 small">Activos</label>
            </div>
            <div className="d-flex align-items-center">
              <RadioButton inputId="tr-inactivos" value={0} checked={estado === 0} onChange={(e) => setEstado(e.value)} />
              <label htmlFor="tr-inactivos" className="ms-2 small">Inactivos</label>
            </div>
            <div className="d-flex align-items-center">
              <RadioButton inputId="tr-todos" value={2} checked={estado === 2} onChange={(e) => setEstado(e.value)} />
              <label htmlFor="tr-todos" className="ms-2 small">Todos</label>
            </div>
          </div>
        </div>
        <div className="d-flex gap-3 align-items-center">
          <span className="small text-muted">Buscar:</span>
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
          {canNew && <Button label="Nuevo" icon="pi pi-plus" severity="success" onClick={openCreate} size="small" />}
          <Button icon="pi pi-refresh" text rounded onClick={loadList} size="small" />
        </div>
      </div>

      <DataTable
        key="transportes"
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
        <Column header="No." body={(r) => r?.int_id_transporte_externo ?? ''} />
        <Column header="Nombre" sortable sortField="str_nombre" body={(r) => r?.str_nombre ?? r?.nombre ?? ''} />
        <Column header="Estado" body={(r) => <EstadoTag v={r?.int_estado ?? r?.estado} />} style={{ width: 120 }} />
        <Column header="" body={ActionCol} style={{ width: 80 }} />
      </DataTable>

      <Sidebar visible={open} position="right" onHide={() => setOpen(false)} style={{ width: 520 }}>
        <div className="d-flex align-items-center justify-content-between mb-3">
          <h6 className="mb-0">{mode === 'create' ? 'Nuevo transporte' : 'Editar transporte'}</h6>
          <div className="d-flex gap-2">
            <Button label="Guardar" icon="pi pi-check" severity="success" onClick={save} />
          </div>
        </div>

        <div className="row g-3">
          <div className="col-12">
            <label className="form-label small">Nombre</label>
            <InputText ref={nombreRef} value={form.nombre || ''} onChange={(e) => onChange('nombre', e.target.value)} className="w-100" maxLength={120} />
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
