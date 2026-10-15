import { describe, it, expect, vi, afterEach } from 'vitest';
import { createRequire } from 'module';

// require() para espiar la misma instancia de pool que usa el Model (ver AGENTS.md raíz).
const require = createRequire(import.meta.url);
const Entrega = require('../../../../src/models/entregafacturas/Entrega');
const pool = require('../../../../src/config/database');

const BASE = {
  factura: '550e8400-e29b-41d4-a716-446655440000',
  resultado: 'ENT',
  latitud: 14.6349,
  longitud: -90.5069,
};

describe('Entrega.validarCrear', () => {
  it('acepta datos válidos', () => {
    expect(Entrega.validarCrear(BASE)).toBeNull();
  });

  it('rechaza sin factura', () => {
    expect(Entrega.validarCrear({ ...BASE, factura: undefined })).toMatch(/factura/i);
  });

  it('rechaza resultado fuera de ENT/PARC/FALL', () => {
    expect(Entrega.validarCrear({ ...BASE, resultado: 'OTRO' })).toMatch(/ENT, PARC o FALL/);
  });

  it('acepta los tres resultados válidos (PARC/FALL con motivo)', () => {
    expect(Entrega.validarCrear({ ...BASE, resultado: 'ENT' })).toBeNull();
    expect(Entrega.validarCrear({ ...BASE, resultado: 'PARC', motivo: 'Cliente rechazó parte' })).toBeNull();
    expect(Entrega.validarCrear({ ...BASE, resultado: 'FALL', motivo: 'Negocio cerrado' })).toBeNull();
  });

  it('rechaza sin latitud/longitud', () => {
    expect(Entrega.validarCrear({ ...BASE, latitud: undefined })).toMatch(/latitud/i);
    expect(Entrega.validarCrear({ ...BASE, longitud: undefined })).toMatch(/longitud/i);
  });

  it('rechaza latitud/longitud no numéricas', () => {
    expect(Entrega.validarCrear({ ...BASE, latitud: 'no-es-numero' })).toMatch(/numéricas/);
  });

  it('rechaza latitud fuera de rango (-90 a 90)', () => {
    expect(Entrega.validarCrear({ ...BASE, latitud: 15151 })).toMatch(/latitud fuera de rango/);
    expect(Entrega.validarCrear({ ...BASE, latitud: -91 })).toMatch(/latitud fuera de rango/);
  });

  it('rechaza longitud fuera de rango (-180 a 180)', () => {
    expect(Entrega.validarCrear({ ...BASE, longitud: 5156156 })).toMatch(/longitud fuera de rango/);
    expect(Entrega.validarCrear({ ...BASE, longitud: -181 })).toMatch(/longitud fuera de rango/);
  });

  it('acepta los límites exactos de rango', () => {
    expect(Entrega.validarCrear({ ...BASE, latitud: 90, longitud: 180 })).toBeNull();
    expect(Entrega.validarCrear({ ...BASE, latitud: -90, longitud: -180 })).toBeNull();
  });

  it('acepta sin precisionMetros (es opcional)', () => {
    expect(Entrega.validarCrear(BASE)).toBeNull();
  });

  it('acepta precisionMetros = 0 (valor legítimo, no debe tratarse como ausente)', () => {
    expect(Entrega.validarCrear({ ...BASE, precisionMetros: 0 })).toBeNull();
  });

  it('rechaza precisionMetros no numérico o negativo', () => {
    expect(Entrega.validarCrear({ ...BASE, precisionMetros: 'no-es-numero' })).toMatch(/precision_metros/);
    expect(Entrega.validarCrear({ ...BASE, precisionMetros: -5 })).toMatch(/precision_metros/);
  });

  it('rechaza precisionMetros mayor a 1000m (geolocalización no confiable)', () => {
    expect(Entrega.validarCrear({ ...BASE, precisionMetros: 1001 })).toMatch(/precision_metros/);
    expect(Entrega.validarCrear({ ...BASE, precisionMetros: 25000 })).toMatch(/precision_metros/);
  });

  it('acepta precisionMetros = 1000 exacto (límite incluido)', () => {
    expect(Entrega.validarCrear({ ...BASE, precisionMetros: 1000 })).toBeNull();
  });

  it('rechaza latitud/longitud (0,0) — valor de respaldo de geolocalización fallida', () => {
    expect(Entrega.validarCrear({ ...BASE, latitud: 0, longitud: 0 })).toMatch(/\(0,0\)/);
  });

  it('acepta latitud o longitud en 0 individualmente (solo el par exacto es inválido)', () => {
    expect(Entrega.validarCrear({ ...BASE, latitud: 0, longitud: -90.5069 })).toBeNull();
    expect(Entrega.validarCrear({ ...BASE, latitud: 14.6349, longitud: 0 })).toBeNull();
  });

  it('rechaza PARC/FALL sin motivo', () => {
    expect(Entrega.validarCrear({ ...BASE, resultado: 'PARC' })).toMatch(/motivo/);
    expect(Entrega.validarCrear({ ...BASE, resultado: 'FALL' })).toMatch(/motivo/);
  });

  it('rechaza PARC/FALL con motivo vacío o solo espacios', () => {
    expect(Entrega.validarCrear({ ...BASE, resultado: 'PARC', motivo: '' })).toMatch(/motivo/);
    expect(Entrega.validarCrear({ ...BASE, resultado: 'FALL', motivo: '   ' })).toMatch(/motivo/);
  });

  it('acepta PARC/FALL con motivo', () => {
    expect(Entrega.validarCrear({ ...BASE, resultado: 'PARC', motivo: 'Cliente rechazó 2 de 5 cajas' })).toBeNull();
    expect(Entrega.validarCrear({ ...BASE, resultado: 'FALL', motivo: 'Negocio cerrado' })).toBeNull();
  });

  it('acepta ENT sin motivo, y también con motivo (opcional, no se rechaza)', () => {
    expect(Entrega.validarCrear({ ...BASE, resultado: 'ENT' })).toBeNull();
    expect(Entrega.validarCrear({ ...BASE, resultado: 'ENT', motivo: 'Empaque golpeado, cliente aceptó igual' })).toBeNull();
  });

  it('rechaza motivo mayor a 500 caracteres', () => {
    expect(Entrega.validarCrear({ ...BASE, resultado: 'PARC', motivo: 'x'.repeat(501) })).toMatch(/500 caracteres/);
  });

  it('acepta motivo de exactamente 500 caracteres', () => {
    expect(Entrega.validarCrear({ ...BASE, resultado: 'PARC', motivo: 'x'.repeat(500) })).toBeNull();
  });
});

describe('Entrega._formatFactura — evidencias', () => {
  const FILA = {
    uuid: 'f-1', direccion: 'Zona 1', folio_factura: 'A-1',
    resultado: 'ENT', resultado_fecha: null, motivo: null,
  };

  it('expone la lista de evidencias tal como viene de json_agg', () => {
    const factura = Entrega._formatFactura({ ...FILA, evidencias: ['ev-1', 'ev-2', 'ev-3'] });
    expect(factura.evidencias).toEqual(['ev-1', 'ev-2', 'ev-3']);
    expect(factura).not.toHaveProperty('evidencia_uuid');
  });

  it('factura sin entrega (LATERAL sin fila, evidencias null) → []', () => {
    const factura = Entrega._formatFactura({ ...FILA, resultado: null, evidencias: null });
    expect(factura.evidencias).toEqual([]);
  });
});

describe('Entrega.crear — geo en la entrega + una evidencia por foto', () => {
  const DATOS = {
    facturaUuid: '550e8400-e29b-41d4-a716-446655440000',
    resultado: 'PARC',
    latitud: 14.6349,
    longitud: -90.5069,
    precisionMetros: 12.5,
    motivo: 'Cliente recibió la mitad',
    rutasArchivo: ['entregafacturas/2026/09/24/a.jpg', 'entregafacturas/2026/09/24/b.jpg', 'entregafacturas/2026/09/24/c.jpg'],
  };

  // Responde según la sentencia y registra lo ejecutado.
  function clienteFalso({ facturaDisponible = true, yaExiste = false, fallarEnEvidencia = 0 } = {}) {
    let evidencias = 0;
    const client = {
      release: vi.fn(),
      query: vi.fn(async (sql) => {
        if (/^(BEGIN|COMMIT|ROLLBACK)$/.test(sql)) return { rows: [] };
        if (sql.includes('FOR UPDATE OF dr')) {
          return { rows: facturaDisponible ? [{ id_detalle_ruta: 10, id_ruta: 5 }] : [] };
        }
        if (sql.includes('SELECT 1 FROM bpkm.tbl_entregas_piloto')) return { rows: yaExiste ? [{}] : [] };
        if (sql.includes('INSERT INTO bpkm.tbl_entregas_piloto')) {
          return { rows: [{ id_entrega_piloto: 99, uuid: 'ent-uuid' }] };
        }
        if (sql.includes('INSERT INTO bpkm.tbl_evidencia_entrega')) {
          evidencias++;
          if (evidencias === fallarEnEvidencia) throw new Error('fallo al insertar evidencia');
          return { rows: [{ uuid: `ev-${evidencias}` }] };
        }
        throw new Error(`SQL no esperado en el test: ${sql}`);
      }),
    };
    vi.spyOn(pool, 'connect').mockResolvedValue(client);
    return client;
  }

  const sentencias = (client) => client.query.mock.calls.map(([sql]) => sql);
  const llamadasA = (client, tabla) => client.query.mock.calls.filter(([sql]) => sql.includes(`INSERT INTO bpkm.${tabla}`));

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('guarda la geo UNA vez en tbl_entregas_piloto', async () => {
    const client = clienteFalso();
    await Entrega.crear(DATOS, 7, 3);

    const inserts = llamadasA(client, 'tbl_entregas_piloto');
    expect(inserts).toHaveLength(1);
    const [sql, params] = inserts[0];
    expect(sql).toMatch(/latitud, longitud, precision_metros/);
    expect(params).toEqual([10, 'PARC', 'Cliente recibió la mitad', 14.6349, -90.5069, 12.5, 7]);
  });

  it('una evidencia por foto, en el orden de subida, sin geo', async () => {
    const client = clienteFalso();
    const resultado = await Entrega.crear(DATOS, 7, 3);

    const inserts = llamadasA(client, 'tbl_evidencia_entrega');
    expect(inserts.map(([, params]) => params)).toEqual(DATOS.rutasArchivo.map((ruta) => [99, ruta, 7]));
    for (const [sql] of inserts) expect(sql).not.toMatch(/latitud|longitud|precision_metros/);

    expect(resultado).toEqual({ error: false, entregaUuid: 'ent-uuid', evidenciaUuids: ['ev-1', 'ev-2', 'ev-3'], idRuta: 5 });
    expect(sentencias(client).at(-1)).toBe('COMMIT');
    expect(client.release).toHaveBeenCalledTimes(1);
  });

  it('precisionMetros ausente se guarda como null', async () => {
    const client = clienteFalso();
    await Entrega.crear({ ...DATOS, precisionMetros: undefined }, 7, 3);

    const [, params] = llamadasA(client, 'tbl_entregas_piloto')[0];
    expect(params[5]).toBeNull();
  });

  it('factura no disponible, 404 sin insertar nada', async () => {
    const client = clienteFalso({ facturaDisponible: false });
    const resultado = await Entrega.crear(DATOS, 7, 3);

    expect(resultado).toMatchObject({ error: true, status: 404 });
    expect(sentencias(client).some((sql) => sql.includes('INSERT'))).toBe(false);
    expect(sentencias(client)).toContain('ROLLBACK');
    expect(client.release).toHaveBeenCalledTimes(1);
  });

  it('entrega ya registrada, 409 sin insertar nada', async () => {
    const client = clienteFalso({ yaExiste: true });
    const resultado = await Entrega.crear(DATOS, 7, 3);

    expect(resultado).toMatchObject({ error: true, status: 409 });
    expect(sentencias(client).some((sql) => sql.includes('INSERT'))).toBe(false);
    expect(sentencias(client)).toContain('ROLLBACK');
  });

  it('si falla la 2ª evidencia, ROLLBACK de todo (ni entrega ni la 1ª evidencia quedan) y relanza', async () => {
    const client = clienteFalso({ fallarEnEvidencia: 2 });

    await expect(Entrega.crear(DATOS, 7, 3)).rejects.toThrow('fallo al insertar evidencia');
    expect(sentencias(client)).toContain('ROLLBACK');
    expect(sentencias(client)).not.toContain('COMMIT');
    expect(client.release).toHaveBeenCalledTimes(1);
  });
});
