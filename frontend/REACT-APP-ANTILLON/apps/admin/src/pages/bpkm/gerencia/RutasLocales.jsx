import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Layout from '@ui/Layout';
import { Toast } from 'primereact/toast';
import { Card } from 'primereact/card';
import { Dropdown } from 'primereact/dropdown';
import { Calendar } from 'primereact/calendar';
import { Button } from 'primereact/button';
import { DataTable } from 'primereact/datatable';
import { Column } from 'primereact/column';
import { InputText } from 'primereact/inputtext';
import { RadioButton } from 'primereact/radiobutton';
import { Tag } from 'primereact/tag';
import { formatDateOnly, toISODateLocal, toLocalDate } from '@utils/dateSafe';
import { getApiErrorMessage } from '@utils/apiError';
import {
	getRutasLocales,
	getSucursalesList,
	getCamionesActivos,
	getPersonal
} from '@services/bpkm/bpkmRutas';
import '../../../styles/bpkm.css';

const LSKEY = 'bpkm_rutas_locales_filters_v1';
const LSKEY_RESULTS = 'bpkm_rutas_locales_results_v1';

export default function RutasLocales() {
	const navigate = useNavigate();
	const toastRef = useRef(null);
	const limitRef = useRef(25);
	const restoredFiltersRef = useRef(false);
	const restoredResultsRef = useRef(false);
	const skipNextAutoSearchRef = useRef(false);
	const show = (severity, summary, detail) =>
		toastRef.current?.show({ severity, summary, detail, life: 3000 });

	const persisted = useMemo(() => {
		try {
			return JSON.parse(sessionStorage.getItem(LSKEY) || '{}');
		} catch {
			return {};
		}
	}, []);
	const persistedResults = useMemo(() => {
		try {
			return JSON.parse(sessionStorage.getItem(LSKEY_RESULTS) || '{}');
		} catch {
			return {};
		}
	}, []);
	const suppressAutoSearchRef = useRef(
		Array.isArray(persistedResults?.rows) && persistedResults.rows.length > 0
	);
	const persistedSucursalId = Number(persisted.fSucursalId || 0) || 0;
	const persistedCamionId = Number(persisted.fCamionId || 0) || 0;
	const persistedPilotoId = Number(persisted.fPilotoId || 0) || 0;

	// Filtros
	const [fDesde, setFDesde] = useState(
		persisted.fDesde ? toLocalDate(persisted.fDesde) : null
	);
	const [fHasta, setFHasta] = useState(
		persisted.fHasta ? toLocalDate(persisted.fHasta) : null
	);
	const [fSucursal, setFSucursal] = useState(null);
	const [fCamion, setFCamion] = useState(null);
	const [fPiloto, setFPiloto] = useState(null);
	const [fFolio, setFFolio] = useState(persisted.fFolio ?? '');
	const [fTipoRuta, setFTipoRuta] = useState(persisted.fTipoRuta ?? '');
	const [fEstadoRuta, setFEstadoRuta] = useState(persisted.fEstadoRuta ?? 'EN_CURSO');

	// Catalogos
	const [sucursales, setSucursales] = useState([]);
	const [camiones, setCamiones] = useState([]);
	const [pilotos, setPilotos] = useState([]);
	const [combosReady, setCombosReady] = useState(false);
	const [filtersReady, setFiltersReady] = useState(false);
	const [resultsReady, setResultsReady] = useState(false);

	// Data
	const [rows, setRows] = useState([]);
	const [loading, setLoading] = useState(false);
	const [pagination, setPagination] = useState({ total: 0, page: 1, limit: 25 });
	const [resumen, setResumen] = useState({ EN_CURSO: 0 });
	const [sortField, setSortField] = useState(null);
	const [sortOrder, setSortOrder] = useState(null);
	const getEstadoRutaValue = (row) =>
		row?.estado_ruta ??
		row?.estado_ruta_codigo ??
		row?.estado_ruta_nombre ??
		row?.estado_nombre ??
		'';

	const sortRowsBy = (items, field, order) => {
		if (!field || !order) return items;
		const dir = order === 1 ? 1 : -1;
		return [...items].sort((a, b) => {
			const va = a?.[field];
			const vb = b?.[field];

			if (va == null && vb == null) return 0;
			if (va == null) return 1 * dir;
			if (vb == null) return -1 * dir;

			const da = typeof va === 'string' ? Date.parse(va) : NaN;
			const db = typeof vb === 'string' ? Date.parse(vb) : NaN;
			if (!Number.isNaN(da) && !Number.isNaN(db)) {
				return (da - db) * dir;
			}

			const na = Number(va);
			const nb = Number(vb);
			if (!Number.isNaN(na) && !Number.isNaN(nb)) {
				return (na - nb) * dir;
			}

			return String(va).localeCompare(String(vb)) * dir;
		});
	};

	const lastCamionesPilotosSucursalRef = useRef(0);

	async function cargarCombos() {
		try {
			const [s, c, p] = await Promise.all([
				getSucursalesList(),
				getCamionesActivos(),
				getPersonal({ rol: 'PILOTO', estado: 1 })
			]);
			setSucursales(Array.isArray(s) ? s : []);
			setCamiones(Array.isArray(c) ? c : []);
			setPilotos(Array.isArray(p) ? p : []);
		} catch (e) {
			console.error(e);
			show('error', 'Error', getApiErrorMessage(e, 'No se pudieron cargar los catálogos'));
		} finally {
			setCombosReady(true);
		}
	}

	const buildParams = (pageOverride, limitOverride) => ({
		fecha_desde: fDesde ? toISODateLocal(fDesde) : '',
		fecha_hasta: fHasta ? toISODateLocal(fHasta) : '',
		folio_factura: String(fFolio || '').trim(),
		id_sucursal: fSucursal?.int_id_sucursal || 0,
		id_camion: fCamion?.int_id_camion || 0,
		id_piloto: fPiloto?.int_id_personal || 0,
		tipo_ruta: String(fTipoRuta || '').trim(),
		estado_ruta: String(fEstadoRuta || '').trim(),
		page: pageOverride ?? pagination.page,
		limit: limitOverride ?? pagination.limit
	});

	async function buscar(pageOverride, limitOverride) {
		try {
			setLoading(true);
			const params = buildParams(pageOverride, limitOverride);
			const paramsKey = JSON.stringify(params);
			const data = await getRutasLocales(params);
			const items = Array.isArray(data?.items) ? data.items : [];
			const normalizedItems = items.map((item) => ({
				...item,
				estado_ruta_display: getEstadoRutaValue(item)
			}));
			const totalFromPayload =
				data?.total ??
				data?.total_count ??
				items[0]?.total_count;
			const nextPagination = {
				total: Number(totalFromPayload ?? items.length ?? 0),
				page: Number(data?.page ?? params.page ?? 1),
				limit: Number(data?.limit ?? params.limit ?? 25)
			};

			const nextResumen = { EN_CURSO: Number(data?.resumen?.por_estado?.EN_CURSO ?? 0) };

			setRows(normalizedItems);
			setPagination(nextPagination);
			setResumen(nextResumen);
			sessionStorage.setItem(
				LSKEY_RESULTS,
				JSON.stringify({
					paramsKey,
					rows: normalizedItems,
					pagination: nextPagination,
					resumen: nextResumen,
					sortField,
					sortOrder
				})
			);
		} catch (e) {
			console.error(e);
			show('error', 'Error', getApiErrorMessage(e, 'No se pudo cargar rutas locales'));
		} finally {
			setLoading(false);
		}
	}

	function limpiarFiltros() {
		setFDesde(null);
		setFHasta(null);
		setFFolio('');
		setFSucursal(null);
		setFCamion(null);
		setFPiloto(null);
		setFTipoRuta('');
		setFEstadoRuta('EN_CURSO');
		setPagination((prev) => ({ ...prev, page: 1 }));
		sessionStorage.removeItem(LSKEY_RESULTS);
	}

	const onPage = (event) => {
		const nextPage = Math.floor(event.first / event.rows) + 1;
		const nextLimit = event.rows;
		setPagination((prev) => ({ ...prev, page: nextPage, limit: nextLimit }));
		buscar(nextPage, nextLimit);
	};

	useEffect(() => {
		cargarCombos();
	}, []);

	// Camión y Piloto dependen de la Sucursal (misma sucursal de salida) - se recargan
	// filtrados cuando cambia el filtro de Sucursal; los catálogos ya aceptan id_sucursal
	// en el backend. Se espera a que termine la restauración de filtros persistidos.
	useEffect(() => {
		if (!filtersReady) return;
		const idSucursal = fSucursal?.int_id_sucursal || 0;
		if (lastCamionesPilotosSucursalRef.current === idSucursal) return;
		lastCamionesPilotosSucursalRef.current = idSucursal;
		(async () => {
			try {
				const [c, p] = await Promise.all([
					getCamionesActivos({ id_sucursal: idSucursal }),
					getPersonal({ rol: 'PILOTO', estado: 1, id_sucursal: idSucursal })
				]);
				const nextCamiones = Array.isArray(c) ? c : [];
				const nextPilotos = Array.isArray(p) ? p : [];
				setCamiones(nextCamiones);
				setPilotos(nextPilotos);
				setFCamion((prev) =>
					prev && !nextCamiones.some((x) => x.int_id_camion === prev.int_id_camion) ? null : prev
				);
				setFPiloto((prev) =>
					prev && !nextPilotos.some((x) => x.int_id_personal === prev.int_id_personal) ? null : prev
				);
			} catch (e) {
				console.error(e);
				show('error', 'Error', getApiErrorMessage(e, 'No se pudieron cargar los catálogos'));
			}
		})();
	}, [fSucursal, filtersReady]);

	useEffect(() => {
		if (restoredFiltersRef.current) return;
		if (!combosReady) return;

		if (persistedSucursalId) {
			const match = sucursales.find(
				(s) => Number(s?.int_id_sucursal || 0) === persistedSucursalId
			);
			if (match) setFSucursal(match);
		}

		if (persistedCamionId) {
			const match = camiones.find(
				(c) => Number(c?.int_id_camion || 0) === persistedCamionId
			);
			if (match) setFCamion(match);
		}

		if (persistedPilotoId) {
			const match = pilotos.find(
				(p) => Number(p?.int_id_personal || 0) === persistedPilotoId
			);
			if (match) setFPiloto(match);
		}

		restoredFiltersRef.current = true;
		setFiltersReady(true);
	}, [
		combosReady,
		sucursales,
		camiones,
		pilotos,
		persistedSucursalId,
		persistedCamionId,
		persistedPilotoId
	]);

	useEffect(() => {
		if (restoredResultsRef.current) return;
		if (!filtersReady) return;
		if (!Array.isArray(persistedResults?.rows)) {
			restoredResultsRef.current = true;
			suppressAutoSearchRef.current = false;
			setResultsReady(true);
			return;
		}

		const restoredPage = persistedResults?.pagination?.page ?? pagination.page;
		const restoredLimit = persistedResults?.pagination?.limit ?? pagination.limit;
		const currentParamsKey = JSON.stringify(buildParams(restoredPage, restoredLimit));

		if (persistedResults.paramsKey === currentParamsKey) {
			skipNextAutoSearchRef.current = true;
			setRows(persistedResults.rows || []);
			if (persistedResults.pagination) {
				setPagination(persistedResults.pagination);
			}
			setResumen({ EN_CURSO: Number(persistedResults?.resumen?.EN_CURSO ?? 0) });
			if (persistedResults.sortField) setSortField(persistedResults.sortField);
			if (persistedResults.sortOrder) setSortOrder(persistedResults.sortOrder);
		} else {
			skipNextAutoSearchRef.current = true;
			setPagination((prev) => ({ ...prev, page: 1 }));
			buscar(1, limitRef.current);
		}

		restoredResultsRef.current = true;
		suppressAutoSearchRef.current = false;
		setResultsReady(true);
	}, [
		fDesde,
		fHasta,
		fSucursal,
		fCamion,
		fPiloto,
		fTipoRuta,
		fEstadoRuta,
		persistedResults,
		filtersReady
	]);

	useEffect(() => {
		limitRef.current = pagination.limit;
	}, [pagination.limit]);

	useEffect(() => {
		if (!filtersReady || !resultsReady) return;
		if (suppressAutoSearchRef.current) return;
		if (skipNextAutoSearchRef.current) {
			skipNextAutoSearchRef.current = false;
			return;
		}
		setPagination((prev) => ({ ...prev, page: 1 }));
		buscar(1, limitRef.current);
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [
		fDesde,
		fHasta,
		fSucursal,
		fCamion,
		fPiloto,
		fTipoRuta,
		fEstadoRuta,
		filtersReady,
		resultsReady
	]);

	useEffect(() => {
		if (!filtersReady || !resultsReady) return;
		if (suppressAutoSearchRef.current) return;
		if (skipNextAutoSearchRef.current) {
			skipNextAutoSearchRef.current = false;
			return;
		}
		const timer = setTimeout(() => {
			setPagination((prev) => ({ ...prev, page: 1 }));
			buscar(1, limitRef.current);
		}, 500);
		return () => clearTimeout(timer);
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [fFolio]);

	useEffect(() => {
		sessionStorage.setItem(
			LSKEY,
			JSON.stringify({
				fDesde: fDesde ? toISODateLocal(fDesde) : null,
				fHasta: fHasta ? toISODateLocal(fHasta) : null,
				fSucursalId: fSucursal?.int_id_sucursal || 0,
				fCamionId: fCamion?.int_id_camion || 0,
				fPilotoId: fPiloto?.int_id_personal || 0,
				fFolio: String(fFolio || '').trim(),
				fTipoRuta: String(fTipoRuta || '').trim(),
				fEstadoRuta: String(fEstadoRuta || '').trim()
			})
		);
	}, [fDesde, fHasta, fSucursal, fCamion, fPiloto, fFolio, fTipoRuta, fEstadoRuta]);

	const totalRegistros = pagination.total || rows.length;
	const tipoRutaOptions = [
		{ label: 'Todas', value: '' },
		{ label: 'Ruta Corta', value: 'RC' },
		{ label: 'Ruta Larga', value: 'RL' },
		{ label: 'Transporte Externo', value: 'TE' }
	];
	const estadoRutaOptions = [
		{ label: 'Todos', value: '' },
		{ label: 'En curso', value: 'EN_CURSO' },
		{ label: 'Finalizada', value: 'FINALIZADA' }
	];
	const getEstadoRutaTag = (value) => {
		const normalized = String(value || '').trim().toUpperCase().replace(/\s+/g, '_');
		if (!normalized) return { label: '-', severity: 'secondary' };
		if (normalized === 'EN_CURSO') return { label: 'En curso', severity: 'warning' };
		if (normalized === 'FINALIZADA' || normalized === 'FINALIZADO') {
			return { label: 'Finalizada', severity: 'info' };
		}
		if (normalized === 'CREADA') return { label: 'Creada', severity: 'info' };
		if (normalized === 'REGRESADA') return { label: 'Regresada', severity: 'success' };
		if (normalized === 'CANCELADA' || normalized === 'CANCELADO') {
			return { label: 'Cancelada', severity: 'danger' };
		}
		return { label: value || '-', severity: 'secondary' };
	};
	const getTipoRutaLabel = (value) => {
		if (value === 'RC') return 'Ruta Corta';
		if (value === 'RT' || value === 'RL') return 'Ruta Larga';
		if (value === 'TE') return 'Transporte Externo';
		return value || '-';
	};
	const getTipoRutaTag = (value) => {
		if (value === 'RC') return { label: 'Ruta Corta', severity: 'success' };
		if (value === 'RT' || value === 'RL') return { label: 'Ruta Larga', severity: 'secondary' };
		if (value === 'TE') return { label: 'Transporte Externo', severity: 'info' };
		return { label: value || '-', severity: 'secondary' };
	};
	const sortedRows = useMemo(
		() => sortRowsBy(rows, sortField, sortOrder),
		[rows, sortField, sortOrder]
	);

	const accionesBody = (row) => (
		<div className="d-flex gap-1 justify-content-end">
			<Button
				icon="pi pi-arrow-right"
				rounded
				text
				severity="info"
				size="small"
				onClick={() => navigate(`/Rutas-Locales/${row.id_ruta}`, { state: { row } })}
				tooltip="Ver detalle"
				tooltipOptions={{ position: 'top' }}
			/>
		</div>
	);

	return (
		<Layout>
			<Toast ref={toastRef} />

			<div className="container-fluid py-0">
				<Card className="border-0 shadow-sm">
					<div className="d-flex justify-content-between align-items-center px-3 pt-3 pb-2">
						<div>
							<h5 className="m-0">Rutas Cortas y Transporte Externo</h5>
							<small className="text-muted">
								{totalRegistros} registro{totalRegistros !== 1 ? 's' : ''} encontrado{totalRegistros !== 1 ? 's' : ''}
							</small>
						</div>
						<div className="d-flex gap-2">
							<Button
								label="Buscar"
								icon="pi pi-search"
								size="small"
								loading={loading}
								onClick={() => buscar(1, pagination.limit)}
							/>
							<Button
								label="Limpiar"
								icon="pi pi-filter-slash"
								size="small"
								severity="secondary"
								outlined
								onClick={limpiarFiltros}
							/>
						</div>
					</div>

					<div className="px-3 pb-3">
						<div className="row g-3">
							<div className="col-6 col-sm-4 col-md-2">
								<label className="form-label small text-muted mb-1">Fecha desde</label>
								<Calendar
									value={fDesde}
									onChange={(e) => setFDesde(e.value)}
									showIcon
									dateFormat="dd/mm/yy"
									placeholder="Seleccionar fecha"
									className="w-100"
									appendTo="self"
								/>
							</div>

							<div className="col-6 col-sm-4 col-md-2">
								<label className="form-label small text-muted mb-1">Fecha hasta</label>
								<Calendar
									value={fHasta}
									onChange={(e) => setFHasta(e.value)}
									showIcon
									dateFormat="dd/mm/yy"
									placeholder="Seleccionar fecha"
									className="w-100"
									appendTo="self"
								/>
							</div>

							<div className="col-6 col-sm-4 col-md-2">
								<label className="form-label small text-muted mb-1">Sucursal</label>
								<Dropdown
									value={fSucursal}
									onChange={(e) => setFSucursal(e.value)}
									options={sucursales}
									optionLabel="str_nombre"
									placeholder="Todas"
									filter
									showClear
									className="w-100"
									appendTo="self"
								/>
							</div>

							<div className="col-6 col-sm-4 col-md-2">
								<label className="form-label small text-muted mb-1">Camión</label>
								<Dropdown
									value={fCamion}
									onChange={(e) => setFCamion(e.value)}
									options={camiones}
									optionLabel="str_placa"
									placeholder="Todos"
									filter
									showClear
									className="w-100"
									appendTo="self"
								/>
							</div>

							<div className="col-6 col-sm-4 col-md-2">
								<label className="form-label small text-muted mb-1">Piloto</label>
								<Dropdown
									value={fPiloto}
									onChange={(e) => setFPiloto(e.value)}
									options={pilotos}
									optionLabel="str_nombre"
									placeholder="Todos"
									filter
									showClear
									className="w-100"
									appendTo="self"
								/>
							</div>

							<div className="col-6 col-sm-4 col-md-2">
								<label className="form-label small text-muted mb-1">Folio Factura</label>
								<InputText
									value={fFolio}
									onChange={(e) => setFFolio(String(e.target.value || '').toUpperCase())}
									placeholder="Ej. CR5304"
									className="w-100"
								/>
							</div>

							<div className="w-100 d-none d-md-block" />

							<div className="col-12 col-md-6">
								<label className="form-label small text-muted mb-1">Estado de ruta</label>
								<div className="d-flex flex-wrap gap-3">
									{estadoRutaOptions.map((opt) => (
										<div key={opt.value || 'all'} className="d-flex align-items-center">
											<RadioButton
												inputId={`estado-ruta-${opt.value || 'all'}`}
												name="estado_ruta"
												value={opt.value}
												onChange={(e) => setFEstadoRuta(e.value)}
												checked={fEstadoRuta === opt.value}
											/>
											<label htmlFor={`estado-ruta-${opt.value || 'all'}`} className="ms-2 mb-0 cursor-pointer">
												{opt.label}
												{opt.value === 'EN_CURSO' ? ` (${resumen.EN_CURSO ?? 0})` : ''}
											</label>
										</div>
									))}
								</div>
							</div>

							<div className="col-12 col-md-6">
								<label className="form-label small text-muted mb-1">Tipo de ruta</label>
								<div className="d-flex flex-wrap gap-3">
									{tipoRutaOptions.map((opt) => (
										<div key={opt.value || 'all'} className="d-flex align-items-center">
											<RadioButton
												inputId={`tipo-ruta-${opt.value || 'all'}`}
												name="tipo_ruta"
												value={opt.value}
												onChange={(e) => setFTipoRuta(e.value)}
												checked={fTipoRuta === opt.value}
											/>
											<label htmlFor={`tipo-ruta-${opt.value || 'all'}`} className="ms-2 mb-0 cursor-pointer">
												{opt.label}
											</label>
										</div>
									))}
								</div>
							</div>
						</div>
					</div>

					<div className="px-3 pb-3">
						<DataTable
							value={sortedRows}
							loading={loading}
							dataKey="id_ruta"
							size="small"
							stripedRows
							paginator
							lazy
							scrollable
							tableStyle={{ width: '100%', minWidth: '1370px', tableLayout: 'fixed' }}
							sortMode="single"
							removableSort
							sortField={sortField}
							sortOrder={sortOrder}
							onSort={(e) => {
								setSortField(e.sortField);
								setSortOrder(e.sortOrder);
							}}
							rows={pagination.limit}
							first={(pagination.page - 1) * pagination.limit}
							totalRecords={pagination.total}
							onPage={onPage}
							rowsPerPageOptions={[10, 25, 50, 100]}
							emptyMessage="No se encontraron rutas locales"
						>
							<Column
								field="numero_ruta"
								header="Código de Ruta"
								sortable
								style={{ width: '9.7%' }}
							/>
							<Column
								field="nombre_piloto"
								header="Piloto / Auxiliar"
								body={(r) => (
									<>
										<div>{r.nombre_piloto || '-'}</div>
										<div className="small text-muted">{r.nombre_auxiliar || '-'}</div>
									</>
								)}
								sortable
								style={{ width: '14%' }}
							/>
							<Column
								field="sucursal_salida"
								header={<>Sucursal /<br />Camión</>}
								body={(r) => (
									<>
										<div>{r.sucursal_salida || '-'}</div>
										<div className="small text-muted">{r.placa_camion || '-'}</div>
									</>
								)}
								sortable
								style={{ width: '10.2%' }}
							/>
							<Column
								field="fecha_salida_plan"
								header="Fecha salida"
								body={(r) => formatDateOnly(toISODateLocal(r.fecha_salida_plan)) || '-'}
								sortable
								style={{ width: '13.2%' }}
							/>
							<Column
								field="distancia_calculada"
								header="Distancia"
								body={(r) => (
									r.distancia_calculada != null
										? `${Number(r.distancia_calculada).toFixed(1)} km`
										: '-'
								)}
								sortable
								style={{ width: '10.2%' }}
							/>
							<Column
								field="total_facturas"
								header={<>Total<br />facturas</>}
								body={(r) => (
									<div className="text-center">
										<span className="badge bg-primary">{Number(r.total_facturas || 0)}</span>
									</div>
								)}
								sortable
								style={{ width: '6.6%' }}
							/>
							<Column
								field="tipo_ruta"
								header="Tipo de ruta"
								body={(r) => {
									const tag = getTipoRutaTag(r.tipo_ruta);
									return <Tag value={tag.label} severity={tag.severity} />;
								}}
								sortable
								style={{ width: '11.9%' }}
							/>
							<Column
								field="estado_ruta_display"
								header="Estado"
								body={(r) => {
									const tag = getEstadoRutaTag(r.estado_ruta_display);
									return <Tag value={tag.label} severity={tag.severity} />;
								}}
								sortable
								style={{ width: '10.2%' }}
							/>
							<Column
								field="porcentaje_entrega"
								header="% Entrega"
								body={(r) => {
									const porcentaje = Number(r.porcentaje_entrega || 0);
									const color = porcentaje >= 95 ? '#28a745' : porcentaje >= 85 ? '#f59e0b' : '#dc3545';
									return (
										<div className="text-end fw-bold" style={{ color }}>
											{porcentaje.toFixed(1)}%
										</div>
									);
								}}
								sortable
								style={{ width: '9.2%' }}
							/>
							<Column
								header="Acciones"
								body={accionesBody}
								style={{ width: '4.8%' }}
								frozen
								alignFrozen="right"
							/>
						</DataTable>
					</div>
				</Card>
			</div>
		</Layout>
	);
}
