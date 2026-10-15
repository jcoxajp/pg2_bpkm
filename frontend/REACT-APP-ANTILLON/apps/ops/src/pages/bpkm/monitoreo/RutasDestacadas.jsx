// src/pages/bpkm/monitoreo/RutasDestacadas.jsx
import { useState } from 'react';
import { Panel } from 'primereact/panel';
import { Button } from 'primereact/button';
import { Tag } from 'primereact/tag';
import { formatDateTimeGT } from '@utils/dateSafe';

const COLLAPSE_KEY_PREFIX = 'bpkm_monitoreo_destacadas_collapsed_';

export default function RutasDestacadas({ titulo, rutas, tipo, onRegistrar, icono = 'pi-clock' }) {
  const storageKey = `${COLLAPSE_KEY_PREFIX}${tipo}`;
  // Colapsada por defecto; si el usuario la expande o la vuelve a colapsar, esa preferencia se
  // respeta entre recargas de la página.
  const [collapsed, setCollapsed] = useState(() => {
    try {
      const guardado = sessionStorage.getItem(storageKey);
      return guardado === null ? true : guardado === 'true';
    } catch {
      return true;
    }
  });

  const onToggle = (e) => {
    setCollapsed(e.value);
    try {
      sessionStorage.setItem(storageKey, String(e.value));
    } catch {
      // sessionStorage puede fallar en ventana privada o con storage bloqueado - sin persistencia
      // en ese caso, pero no debe romper el toggle en sí.
    }
  };

  if (!rutas || rutas.length === 0) return null;

  const getSeverity = () => {
    if (tipo === 'proximas') return 'warning';
    if (tipo === 'regresadas') return 'info';
    return 'secondary';
  };

  const getIcon = () => {
    if (tipo === 'proximas') return 'pi-send';
    if (tipo === 'regresadas') return 'pi-sign-in';
    return icono;
  };

  const headerTemplate = (options) => (
    <div className="flex align-items-center justify-content-between w-100 p-3" style={{ display: 'flex' }}>
      <div className="d-flex align-items-center">
        <i className={`pi ${getIcon()} me-2 text-${tipo === 'proximas' ? 'warning' : 'info'}`} style={{ fontSize: '1.25rem' }}></i>
        <h6 className="m-0 fw-bold">{titulo}</h6>
        <Tag value={rutas.length} severity={getSeverity()} className="ms-2" />
      </div>
      <Button
        icon={options.collapsed ? 'pi pi-chevron-down' : 'pi pi-chevron-up'}
        rounded
        text
        severity="secondary"
        onClick={options.onTogglerClick}
        tooltip={options.collapsed ? 'Expandir' : 'Colapsar'}
        tooltipOptions={{ position: 'top' }}
      />
    </div>
  );

  return (
    <div className="mb-3">
      <Panel
        toggleable
        collapsed={collapsed}
        onToggle={onToggle}
        headerTemplate={headerTemplate}
        className="border-0 shadow-sm"
      >
        <div className="row g-3">
          {rutas.map((ruta) => (
            <div key={ruta.id_ruta} className="col-md-4 col-lg-3">
              <div className="border shadow-sm rounded h-100 p-3 bg-body-tertiary">
                <div className="d-flex flex-column h-100">
                  {/* Código de ruta */}
                  <div className="mb-2">
                    <div className="small text-muted">Ruta</div>
                    <div className="fw-bold">{ruta.codigo_ruta}</div>
                  </div>

                  {/* Piloto */}
                  <div className="mb-2">
                    <div className="small text-muted">
                      <i className="pi pi-user me-1"></i>
                      Piloto
                    </div>
                    <div className="small">{ruta.piloto || '-'}</div>
                  </div>

                  {/* Camión */}
                  <div className="mb-2">
                    <div className="small text-muted">
                      <i className="pi pi-car me-1"></i>
                      Camión
                    </div>
                    <div className="small">{ruta.camion || '-'}</div>
                  </div>

                  {/* Fecha planificada */}
                  <div className="mb-3">
                    <div className="small text-muted">
                      <i className="pi pi-calendar me-1"></i>
                      {tipo === 'proximas' ? 'Salida planificada' : 'Entrada planificada'}
                    </div>
                    <div className="small fw-semibold">
                      {tipo === 'proximas'
                        ? formatDateTimeGT(ruta.fecha_salida_plan) || '-'
                        : formatDateTimeGT(ruta.fecha_entrada_plan) || '-'
                      }
                    </div>
                  </div>

                  {/* Estado de monitoreo */}
                  {tipo === 'regresadas' && (
                    <div className="mb-3">
                      <div className="d-flex gap-2 flex-wrap">
                        {ruta.tiene_salida && (
                          <Tag severity="success" value="Salida ✓" className="small" />
                        )}
                        {!ruta.tiene_entrada && (
                          <Tag severity="warning" value="Sin entrada" className="small" />
                        )}
                      </div>
                    </div>
                  )}

                  {/* Botón de acción */}
                  <div className="mt-auto">
                    <Button
                      label="Registrar"
                      icon="pi pi-pencil"
                      size="small"
                      className="w-100"
                      severity={tipo === 'proximas' ? 'warning' : 'info'}
                      outlined
                      onClick={() => onRegistrar(ruta)}
                      disabled={ruta.bpkm_aprobado}
                      tooltip={ruta.bpkm_aprobado ? 'No se puede registrar' : 'Registrar monitoreo'}
                      tooltipOptions={{ position: 'top' }}
                    />
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </Panel>
    </div>
  );
}
