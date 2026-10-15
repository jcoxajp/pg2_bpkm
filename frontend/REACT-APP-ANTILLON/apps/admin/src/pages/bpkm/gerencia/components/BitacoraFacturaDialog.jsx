import { useEffect, useState } from 'react';
import { Dialog } from 'primereact/dialog';
import { DataTable } from 'primereact/datatable';
import { Column } from 'primereact/column';
import { Tag } from 'primereact/tag';
import { getBitacoraSel } from '@services/bpkm/selecciones';
import { formatDateTimeGT } from '@utils/dateSafe';

// Mapeo de acciones a colores según paleta del sistema
const ACCIONES_COLOR = {
  'Creación': 'info',              // Celeste
  'Anulación': 'danger',            // Rojo
  'Reactivación': 'success',        // Verde
  'Cambio Aprobado': 'success',     // Verde
  'Cambio Rechazado': 'danger',     // Rojo
  'Solicitud de Cambio': 'warning', // Naranja
  'En Ruta': 'warning',             // Naranja
  'Cerrada': 'primary',             // Azul marino
};

export default function BitacoraFacturaDialog({ visible, onHide, id_factura_sel, folio }) {
  const [bitacora, setBitacora] = useState([]);
  const [loading, setLoading] = useState(false);

  const getColorAccion = (accion) => {
    return ACCIONES_COLOR[accion] || 'secondary';
  };

  useEffect(() => {
    if (visible && id_factura_sel) {
      cargarBitacora();
    }
  }, [visible, id_factura_sel]);

  async function cargarBitacora() {
    setLoading(true);
    try {
      const data = await getBitacoraSel({
        id_factura_sel,
        scope: 'ADMIN',
        usuario: 0
      });
      setBitacora(Array.isArray(data) ? data : []);
    } catch (e) {
      console.error('Error cargando bitácora:', e);
      setBitacora([]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog
      header={`Bitácora - Factura ${folio || ''}`}
      visible={visible}
      onHide={onHide}
      style={{ width: '1000px' }}
      maximizable
    >
      <DataTable
        value={bitacora}
        loading={loading}
        emptyMessage="No hay registros en la bitácora"
        size="small"
        stripedRows
        style={{ fontSize: '0.9rem' }}
      >
        <Column
          field="fecha_creacion"
          header="Fecha"
          body={(row) => formatDateTimeGT(row.fecha_creacion) || '-'}
          style={{ width: '200px' }}
        />
        <Column
          field="accion"
          header="Acción"
          body={(row) => (
            <Tag value={row.accion} severity={getColorAccion(row.accion)} />
          )}
          style={{ width: '160px' }}
        />
        <Column field="detalle" header="Detalle" style={{ minWidth: '250px' }} />
        <Column field="nombre_creador" header="Usuario" style={{ width: '180px' }} />
      </DataTable>
    </Dialog>
  );
}
