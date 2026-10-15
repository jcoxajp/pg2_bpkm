import { useEffect, useMemo, useRef, useState } from 'react';
import Layout from '@ui/Layout';
import SelNav from './SelNav';
import { Toast } from 'primereact/toast';
import { Card } from 'primereact/card';
import { Toolbar } from 'primereact/toolbar';
import { InputText } from 'primereact/inputtext';
import { Button } from 'primereact/button';
import { Dropdown } from 'primereact/dropdown';
import { Divider } from 'primereact/divider';
import { useNavigate } from 'react-router-dom';

import {
  getFormasEntrega,
  getCiudades,
  getMunicipios,
  getTransportesExternos,
  findFacturaByFolio,
  getPermisosBPKM,
  fmt2
} from '@services/bpkm/bpkmRutas';
import { postRegisterInvoiceSnapshot, usersApi } from '@services';
import {
  postCrearSeleccion,
  getSelResumenPorFactura
} from '@services/bpkm/selecciones';
import { formatDateOnly } from '@utils/dateSafe';

export default function SelCrear() {
  const toastRef = useRef(null);
  const navigate = useNavigate();
  const show = (sev, s, d) => toastRef.current?.show({ severity: sev, summary: s, detail: d, life: 3200 });
  const ok = (s, d) => show('success', s, d);
  const warn = (s, d) => show('warn', s, d);
  const err = (s, d) => show('error', s, d);

  const usuarioId = useMemo(() => Number(localStorage.getItem('userId') || 0), []);
  const storeId = useMemo(() => Number(localStorage.getItem('storeId') || 0), []);

  const [perms, setPerms] = useState([]);
  const [checkingPermissions, setCheckingPermissions] = useState(true);

  // Helper para validar permisos
  const rank = { viewer: 1, editor: 2, admin: 3 };
  const need = (perms, key, min = 'viewer') => {
    const r = rank[min] || 1;
    const p = Array.isArray(perms) ? perms.find((x) => x.key === key) : null;
    return p ? (rank[p.nivel_permiso] || 0) >= r : false;
  };

  const canCreatePerm = need(perms, 'bpkm.facturas.new', 'editor');

  useEffect(() => {
    (async () => {
      try {
        const data = await getPermisosBPKM(usuarioId);
        setPerms(Array.isArray(data) ? data : []);
        const hasPermission = data.some(p => p.key === 'bpkm.facturas.new' && ['editor', 'admin'].includes(p.nivel_permiso));
        if (!hasPermission && data.length > 0) {
          err('Sin permiso', 'No tiene permiso para registrar facturas');
          setTimeout(() => navigate('/Facturas-BPKM/mis'), 2000);
        }
      } finally {
        setCheckingPermissions(false);
      }
    })();
  }, [usuarioId]);

  // búsqueda
  const [folio, setFolio] = useState('');
  const [cardCode, setCardCode] = useState('');
  const [buscando, setBuscando] = useState(false);
  const focusFolio = () => { try { document.getElementById('folioInput')?.focus(); } catch {} };
  useEffect(() => { focusFolio(); }, []);

  // factura + snapshot
  const [factura, setFactura] = useState(null);

  // resumen intentos/bloqueo
  const [resumen, setResumen] = useState({ tiene_activa: 0, intentos_total: 0, estado_activa: null });
  const [userCiudadName, setUserCiudadName] = useState('');
  const [cityTouched, setCityTouched] = useState(false);

  // combos
  const [formas, setFormas] = useState([]);
  const [ciudades, setCiudades] = useState([]);
  const [muniOpts, setMuniOpts] = useState([]);
  const [transportes, setTransportes] = useState([]);
  const formasEntregaOptions = useMemo(
    () => formas.filter((f) => {
      const codigo = String(f?.str_codigo || '').toUpperCase();
      if (codigo !== 'SUC') return true;
      return Number(storeId) === 16 || Number(storeId) === 17 || Number(storeId) === 14;
    }),
    [formas, storeId]
  );

  // selección forma
  const [formaId, setFormaId] = useState(null);
  const forma = useMemo(() => formas.find(f => f.int_id_forma_entrega === formaId) || null, [formaId, formas]);
  const code = (forma?.str_codigo || '').toUpperCase();

  // datos por forma
  const [idCiudad, setIdCiudad] = useState(null);
  const [idMunicipio, setIdMunicipio] = useState(null);
  const [direccion, setDireccion] = useState('');
  const [idTransporte, setIdTransporte] = useState(null);

  useEffect(() => {
    (async () => {
      try {
        const [fe, ciu, tr] = await Promise.all([
          getFormasEntrega(),
          getCiudades(),
          getTransportesExternos()
        ]);
        setFormas(fe || []);
        setCiudades(ciu || []);
        setTransportes(tr || []);
      } catch (e) {
        console.error(e); err('Error', 'No se pudieron cargar catálogos');
      }
    })();
  }, []);

  useEffect(() => {
    let cancelled = false;
    const profileStr = localStorage.getItem('userProfile');
    if (profileStr) {
      try {
        const profile = JSON.parse(profileStr);
        if (profile?.ciudad) {
          setUserCiudadName(String(profile.ciudad));
          return () => { cancelled = true; };
        }
      } catch {}
    }

    const username = localStorage.getItem('username');
    if (!username) return () => { cancelled = true; };

    (async () => {
      try {
        const { data } = await usersApi.post('/get_usuarios', {
          p_id_usuario: 0,
          p_username: username,
          p_estado: 1
        });
        if (cancelled) return;
        const u = Array.isArray(data) ? data[0] : null;
        if (u?.str_ciudad) {
          setUserCiudadName(String(u.str_ciudad));
        }
      } catch {}
    })();

    return () => { cancelled = true; };
  }, []);

  function limpiar() {
    setFactura(null);
    setFormaId(null);
    setIdCiudad(null); setIdMunicipio(null); setMuniOpts([]);
    setDireccion('');
    setIdTransporte(null);
    setCityTouched(false);
    setResumen({ tiene_activa: 0, intentos_total: 0, estado_activa: null });
    setFolio('');
    setCardCode('');
    setTimeout(focusFolio, 0);
  }

  const bloqueadaPorUnicaVez = Number(resumen.intentos_total || 0) >= 1;

  async function handleBuscar() {
    const f = (folio || '').trim();
    const cc = (cardCode || '').trim();
    if (f.length < 6 || cc.length < 2) {
      warn('Búsqueda', 'Ingresa Folio y Codigo de cliente (CardCode)');
      return;
    }

    limpiar();
    setFolio(f);
    setCardCode(cc);

    try {
      setBuscando(true);

      // 1) Contexto previo por folio
      try {
        const r0 = await getSelResumenPorFactura({ folio: f });
        setResumen({
          tiene_activa: Number(r0?.tiene_activa || 0),
          intentos_total: Number(r0?.intentos_total || 0),
          estado_activa: r0?.estado_activa || null
        });
        if (Number(r0?.intentos_total || 0) >= 1) {
          err('Factura ya registrada', 'Esta factura ya fue registrada previamente y no puede volver a enviarse.');
        }
      } catch {}

      // 2) Buscar en SAP
      const sap = await findFacturaByFolio({ folio: f, cardCode: cc });
      if (!sap?.ok) {
        const msg = sap?.message || `Factura activa no encontrada (${f}/${cc}). La factura debe ser de los últimos 31 días.`;
        err('Búsqueda', msg);
        return;
      }

      const h = sap.header;
      // 3) Snapshot
      const payload = {
        sap_docentry: h.DocEntry,
        sap_docnum: h.DocNum,
        folio: h.NumAtCard,
        nit: h.NIT,
        card_code: h.CardCode,
        card_name: h.CardName,
        fecha: h.DocDate,
        slp_code: h.SlpCode,
        slp_name: h.SlpName,
        sucursal: { whscode: h.SucursalCode, whsname: h.SucursalNombre },
        numero_autorizacion: h.NumeroAutorizacion,
        doc_total: h.DocTotal,
        vat_sum: h.VatSum,
        cancelado: false,
        comentario_sap: h.Comments || null,
        creado_por: usuarioId,
        lineas: (sap.lines || []).map(l => ({
          linea: l.LineNum,
          item_code: l.ItemCode,
          descripcion: l.Dscription,
          cantidad: l.Quantity,
          precio_con_iva: l.PriceAfVAT,
          descuento_pct: l.DiscPrcnt || 0,
          total_linea: l.GTotal,
          whscode: l.WhsCode,
          whsname: h.SucursalNombre
        }))
      };
      const snap = await postRegisterInvoiceSnapshot(payload);
      if (!snap?.ok || !snap?.factura_id) {
        err('Snapshot', 'No se pudo registrar la factura');
        return;
      }

      setFactura({ header: h, lines: sap.lines || [], factura_id: Number(snap.factura_id) });

      // Setear dirección del cliente automáticamente si viene en el header
      if (h.DireccionCliente) {
        setDireccion(String(h.DireccionCliente).trim());
      }

      // 4) Refrescar resumen con id_factura
      try {
        const r = await getSelResumenPorFactura({ id_factura: Number(snap.factura_id) });
        setResumen({
          tiene_activa: Number(r?.tiene_activa || 0),
          intentos_total: Number(r?.intentos_total || 0),
          estado_activa: r?.estado_activa || null
        });
        if (Number(r?.intentos_total || 0) >= 1) {
          err('Factura ya registrada', 'Esta factura ya fue registrada previamente y no puede volver a enviarse.');
        }
      } catch {}
    } catch (e) {
      console.error(e);
      err('Búsqueda', `Factura activa no encontrada (${folio}/${cardCode}). La factura debe ser de los últimos 31 días.`);
    } finally {
      setBuscando(false);
    }
  }

  async function onChangeCiudad(v) {
    setIdCiudad(v || null);
    setIdMunicipio(null);
    try {
      if (v) {
        const list = await getMunicipios({ p_departamento: v });
        setMuniOpts(Array.isArray(list) ? list : []);
      } else {
        setMuniOpts([]);
      }
    } catch {
      err('Error', 'No se pudieron cargar municipios');
    }
  }

  useEffect(() => {
    if (code === 'CAM' || code === 'LOCAL') {
      setCityTouched(false);
    }
  }, [code]);

  useEffect(() => {
    if (cityTouched) return;
    if (!userCiudadName || !ciudades.length) return;
    if (code !== 'CAM' && code !== 'LOCAL') return;
    const normalize = (val) => String(val || '').trim().toLowerCase();
    const match = ciudades.find(c => normalize(c.str_nombre) === normalize(userCiudadName));
    if (!match) return;
    if (idCiudad === match.int_id_ciudad) return;
    onChangeCiudad(match.int_id_ciudad);
  }, [code, userCiudadName, ciudades, idCiudad, cityTouched]);

  const canCreate = !!(factura?.factura_id) && !!formaId && !bloqueadaPorUnicaVez && (
    (code === 'SUC') ||
    (code === 'EXT' && !!idTransporte) ||
    (code === 'CAM' && !!idCiudad && !!idMunicipio && String(direccion).trim().length > 3) ||
    (code === 'LOCAL' && !!idCiudad && !!idMunicipio && String(direccion).trim().length > 3)
  );

  async function crearSeleccion() {
    if (bloqueadaPorUnicaVez) {
      err('No permitido', 'Esta factura ya fue registrada previamente y no puede volver a enviarse.');
      return;
    }
    if (resumen.tiene_activa) {
      warn('No permitido', 'Esta factura ya está registrada y no puede volver a enviarse.');
      return;
    }
    if (!canCreate) return;

    try {
      const resp = await postCrearSeleccion({
        id_factura: factura.factura_id,
        folio: factura.header?.NumAtCard,
        forma: Number(formaId),
        transporte_externo: code === 'EXT' ? Number(idTransporte) : null,
        departamento: (code === 'CAM' || code === 'LOCAL') ? Number(idCiudad) : null,
        municipio: (code === 'CAM' || code === 'LOCAL') ? Number(idMunicipio) : null,
        direccion: (code === 'CAM' || code === 'EXT' || code === 'LOCAL') ? String(direccion || '').trim() : null,
        id_sucursal: storeId,
        creado_por: usuarioId
      });
      if (resp?.int_id_factura_sel || resp?.ok) {
        ok('Registrada', 'La factura fue registrada para entrega');
        limpiar();
      } else {
        err('Error', 'No se pudo registrar la factura');
      }
    } catch (e) {
      console.error(e); err('Error', e?.response?.data?.error || 'No se pudo registrar');
    }
  }

  const header = factura?.header || {};

  const alerta = (() => {
    if (Number(resumen.intentos_total || 0) >= 1) {
      return { tipo: 'error', texto: 'Esta factura ya fue registrada y no puede volver a enviarse.' };
    }
    if (Number(resumen.tiene_activa || 0) === 1) {
      return { tipo: 'info', texto: 'Esta factura ya está registrada y no puede volver a enviarse.' };
    }
    return null;
  })();

  if (checkingPermissions) {
    return (
      <Layout>
        <Toast ref={toastRef} />
        <div className="container-fluid py-0">
          <SelNav />
        </div>
      </Layout>
    );
  }

  if (!canCreatePerm) {
    return (
      <Layout>
        <Toast ref={toastRef} />
        <div className="container-fluid py-0">
          <SelNav />
          <Card className="border-0 shadow-sm mt-3">
            <div className="p-4 text-center">
              <i className="pi pi-lock text-muted" style={{ fontSize: '3rem' }}></i>
              <h5 className="mt-3">Sin permiso para registrar facturas</h5>
              <p className="text-muted">No tiene permisos para registrar facturas.</p>
            </div>
          </Card>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <Toast ref={toastRef} />
      <div className="container-fluid py-0">
        <SelNav />

        <Card className="border-0 shadow-sm mb-2">
          <Toolbar
            className="py-1"
            style={{ background: 'transparent', border: 0, boxShadow: 'none', paddingLeft: 0, paddingRight: 0 }}
            start={(
              <form
                className="d-flex align-items-center gap-2 flex-wrap"
                onSubmit={(e) => { e.preventDefault(); handleBuscar(); }}
                style={{ background: 'transparent', border: 0, boxShadow: 'none' }}
              >
                <span className="small fw-semibold">Folio</span>
                <InputText
                  id="folioInput"
                  value={folio}
                  onChange={(e) => setFolio(e.target.value)}
                  placeholder="Ej. 001001CA117088"
                  className="p-inputtext-sm"
                  style={{ width: 240 }}
                />
                <span className="small fw-semibold">Codigo</span>
                <InputText
                  id="codigoInput"
                  value={cardCode}
                  onChange={(e) => setCardCode(e.target.value)}
                  placeholder="Ej. CT0001"
                  className="p-inputtext-sm"
                  style={{ width: 160 }}
                />
                <Button
                  icon="pi pi-search"
                  label="Buscar"
                  className="p-button-sm"
                  loading={buscando}
                  type="submit"
                  disabled={!folio.trim() || !cardCode.trim()}
                />
                <Button
                  icon="pi pi-filter-slash"
                  label="Limpiar"
                  className="p-button-sm"
                  outlined
                  type="button"
                  onClick={limpiar}
                />
              </form>
            )}
          />

          {factura && (
            <>
              <div className="row g-2 small px-2">
                <div className="col-12 col-lg-4">
                  <div className="text-muted">Folio</div>
                  <div className="fw-semibold">{header?.NumAtCard}</div>
                </div>
                <div className="col-12 col-lg-4">
                  <div className="text-muted">Cliente</div>
                  <div className="fw-semibold">{header?.CardCode} • {header?.CardName}</div>
                </div>
                <div className="col-6 col-lg-2">
                  <div className="text-muted">Fecha</div>
                  <div className="fw-semibold">{formatDateOnly(header?.DocDate) || '-'}</div>
                </div>
                <div className="col-6 col-lg-2">
                  <div className="text-muted">Sucursal</div>
                  <div className="fw-semibold">{header?.SucursalNombre}</div>
                </div>
                <div className="col-12">
                  <div className="text-muted">Comentario</div>
                  <div className="fw-semibold">{header?.Comments || '-'}</div>
                </div>
              </div>

              {alerta && (
                <div className={`alert ${alerta.tipo === 'error' ? 'alert-danger' : 'alert-info'} d-flex align-items-center gap-2 mt-2 mb-0 py-2`}>
                  <i className="fa fa-circle-info" />
                  <div className="small">{alerta.texto}</div>
                </div>
              )}

              <Divider className="my-2" />

              <div className="d-flex align-items-end flex-wrap gap-3 px-2">
                <div>
                  <label className="small fw-semibold d-block mb-1">Forma de entrega</label>
                  <Dropdown
                    value={formaId}
                    onChange={(e) => setFormaId(e.value == null ? null : Number(e.value))}
                    options={formasEntregaOptions}
                    optionLabel="str_nombre"
                    optionValue="int_id_forma_entrega"
                    placeholder="Seleccionar"
                    className="p-inputtext-sm"
                    style={{ width: 220 }}
                    showClear
                    filter
                    resetFilterOnHide
                  />
                </div>

                {code === 'EXT' && (
                  <>
                    <div>
                      <label className="small fw-semibold d-block mb-1">Transporte externo</label>
                      <Dropdown
                        value={idTransporte}
                        onChange={(e) => setIdTransporte(e.value == null ? null : Number(e.value))}
                        options={transportes}
                        optionLabel="str_nombre"
                        optionValue="int_id_transporte_externo"
                        placeholder="Seleccionar"
                        className="p-inputtext-sm"
                        style={{ width: 280 }}
                        showClear
                        filter
                        resetFilterOnHide
                      />
                    </div>

                    <div style={{ minWidth: 280, flex: 1 }}>
                      <label className="small fw-semibold d-block mb-1">
                        Observaciones
                        <span className="text-muted ms-1" style={{ fontSize: '0.75rem' }}>(opcional)</span>
                      </label>
                      <InputText
                        value={direccion}
                        onChange={(e) => setDireccion(e.target.value)}
                        placeholder="Ej: Entregar en horario de tarde..."
                        className="p-inputtext-sm w-100"
                      />
                    </div>
                  </>
                )}

                {(code === 'CAM' || code === 'LOCAL') && (
                  <>
                    <div>
                      <label className="small fw-semibold d-block mb-1">Departamento</label>
                      <Dropdown
                        value={idCiudad}
                        onChange={(e) => {
                          setCityTouched(true);
                          onChangeCiudad(e.value);
                        }}
                        options={ciudades}
                        optionLabel="str_nombre"
                        optionValue="int_id_ciudad"
                        placeholder="Departamento"
                        className="p-inputtext-sm"
                        style={{ width: 200 }}
                        showClear
                        filter
                        resetFilterOnHide
                      />
                    </div>

                    <div>
                      <label className="small fw-semibold d-block mb-1">Municipio</label>
                      <Dropdown
                        value={idMunicipio}
                        onChange={(e) => setIdMunicipio(e.value == null ? null : Number(e.value))}
                        options={muniOpts}
                        optionLabel="str_nombre"
                        optionValue="int_id_municipio"
                        placeholder="Municipio"
                        className="p-inputtext-sm"
                        style={{ width: 260 }}
                        disabled={!idCiudad}
                        showClear
                        filter
                        resetFilterOnHide
                      />
                    </div>

                    <div style={{ minWidth: 280, flex: 1 }}>
                      <label className="small fw-semibold d-block mb-1">Direccion</label>
                      <InputText
                        value={direccion}
                        onChange={(e) => setDireccion(e.target.value)}
                        placeholder="Referencia de entrega"
                        className="p-inputtext-sm w-100"
                      />
                    </div>
                  </>
                )}

                <div className="ms-auto d-flex align-items-center gap-2">
                  <Button
                    label="Registrar factura"
                    icon="pi pi-check"
                    severity="success"
                    className="p-button-sm"
                    onClick={crearSeleccion}
                    disabled={!canCreate || !!resumen.tiene_activa}
                    tooltip={
                      bloqueadaPorUnicaVez
                        ? 'Ya fue registrada previamente'
                        : (resumen.tiene_activa ? 'Factura ya registrada' : '')
                    }
                    tooltipOptions={{ position: 'top' }}
                  />
                </div>
              </div>
            </>
          )}
        </Card>
      </div>
    </Layout>
  );
}