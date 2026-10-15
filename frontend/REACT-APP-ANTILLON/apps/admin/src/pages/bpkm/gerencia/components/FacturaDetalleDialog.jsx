import { useEffect, useState } from 'react';
import { Dialog } from 'primereact/dialog';
import { DataTable } from 'primereact/datatable';
import { Column } from 'primereact/column';
import { Card } from 'primereact/card';
import { getFacturaMD } from '@services/bpkm/bpkmGerencia';
import { formatDateOnly } from '@utils/dateSafe';

export default function FacturaDetalleDialog({ visible, onHide, id_factura, folio }) {
  const [factura, setFactura] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (visible && (id_factura || folio)) {
      cargarFactura();
    }
  }, [visible, id_factura, folio]);

  async function cargarFactura() {
    setLoading(true);
    try {
      const data = await getFacturaMD({
        p_id_factura: id_factura || null,
        p_folio: folio || null
      });
      setFactura(data);
    } catch (e) {
      console.error('Error cargando factura:', e);
      setFactura(null);
    } finally {
      setLoading(false);
    }
  }

  const fmt = (num) => {
    const n = Number(num || 0);
    return 'Q' + n.toLocaleString('es-GT', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  const header = factura?.header || {};
  const lines = factura?.detail || []; // La función retorna 'detail', no 'lines'

  return (
    <Dialog
      header={`Detalle Factura ${folio || ''}`}
      visible={visible}
      onHide={onHide}
      style={{ width: '1000px' }}
      maximizable
    >
      {loading && (
        <div className="text-center py-5">
          <i className="pi pi-spin pi-spinner" style={{ fontSize: '2rem' }}></i>
          <p className="mt-2">Cargando detalle...</p>
        </div>
      )}

      {!loading && !factura && (
        <div className="alert alert-warning">No se encontró información de esta factura.</div>
      )}

      {!loading && factura && (
        <>
          {/* Maestro */}
          <div className="row g-2 small mb-3">
            <div className="col-md-4">
              <label className="fw-bold">Folio:</label>
              <div className="text-muted">{header.folio}</div>
            </div>
            <div className="col-md-4">
              <label className="fw-bold">Fecha:</label>
              <div>{formatDateOnly(header.fecha_factura || header.fecha) || '-'}</div>
            </div>
            <div className="col-md-4">
              <label className="fw-bold">NIT:</label>
              <div>{header.nit || '-'}</div>
            </div>
            <div className="col-md-12">
              <label className="fw-bold">Cliente:</label>
              <div className="text-muted">{header.nombre_cliente || header.card_name || '-'}</div>
            </div>
            <div className="col-md-6">
              <label className="fw-bold">Vendedor:</label>
              <div className="text-muted">{header.vendedor || '-'}</div>
            </div>
            <div className="col-md-6">
              <label className="fw-bold">Sucursal:</label>
              <div className="text-muted">{header.sucursal || '-'}</div>
            </div>
            <div className="col-md-4">
              <label className="fw-bold">Subtotal:</label>
              <div>{fmt((header.total || header.doc_total || 0) - (header.impuesto || header.vat_sum || 0))}</div>
            </div>
            <div className="col-md-4">
              <label className="fw-bold">IVA:</label>
              <div>{fmt(header.impuesto || header.vat_sum || 0)}</div>
            </div>
            <div className="col-md-4">
              <label className="fw-bold">Total:</label>
              <div className="fw-bold text-primary" style={{ fontSize: '1.1rem' }}>
                {fmt(header.total || header.doc_total || 0)}
              </div>
            </div>
            {header.comentario_sap && (
              <div className="col-12">
                <label className="fw-bold">Comentario:</label>
                <div className="fst-italic">{header.comentario_sap}</div>
              </div>
            )}
          </div>

          {/* Detalle (Líneas) */}
          <div className="mb-2">
            <strong>Líneas de Factura</strong>
          </div>
          <DataTable value={lines} size="small" stripedRows emptyMessage="Sin líneas" style={{ fontSize: '0.85rem' }}>
            <Column field="linea" header="#" style={{ width: '50px' }} />
            <Column field="item_code" header="Código" style={{ width: '120px' }} />
            <Column field="descripcion" header="Descripción" style={{ minWidth: '250px' }} />
            <Column
              field="cantidad"
              header="Cant."
              style={{ width: '80px', textAlign: 'right' }}
              body={(row) => Number(row.cantidad || 0).toFixed(2)}
            />
            <Column
              field="precio_con_iva"
              header="Precio c/IVA"
              style={{ width: '120px', textAlign: 'right' }}
              body={(row) => fmt(row.precio_con_iva)}
            />
            <Column
              field="descuento_pct"
              header="Desc %"
              style={{ width: '80px', textAlign: 'right' }}
              body={(row) => `${Number(row.descuento_pct || 0).toFixed(2)}%`}
            />
            <Column
              field="total_linea"
              header="Total"
              style={{ width: '120px', textAlign: 'right' }}
              body={(row) => fmt(row.total_linea)}
            />
          </DataTable>
        </>
      )}
    </Dialog>
  );
}
