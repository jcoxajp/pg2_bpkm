# Modulo BPKM

**Este codigo no se ejecuta por si solo.** Es un extracto de 4 repositorios reales de Antillon, copiado tal cual. No tiene `package.json`, dependencias instalables ni archivos de entorno reales.

## Tecnologias

- Backend: Node.js, Express, PostgreSQL (`pg`)
- Frontend interno (REACT-APP-ANTILLON): React, PrimeReact, Bootstrap
- Frontend del portal del piloto (WEB-APP-ANTILLON): React, Vite, Tailwind CSS, daisyUI

## Repos de origen

| Repo original | Que aporta aqui |
|---|---|
| APIS-NODE | Backend interno de BPKM (rutas, monitoreo, selecciones, catalogos, evidencias) |
| web-api-antillon | Backend del portal del piloto (entrega de facturas, GPS, distancias) |
| REACT-APP-ANTILLON | Frontend interno (Gerencia, RRHH, Operaciones, Distancia Rutas) |
| WEB-APP-ANTILLON | Frontend del portal del piloto |

## Estructura

```
codigo_fuente/
├── backend/
│   ├── APIS-NODE/            Backend interno: controllers, middleware, models, routes, tests, migrations de bpkm/
│   └── web-api-antillon/     Backend del piloto: entregafacturas (controllers, models, routes, services, tests, migrations)
├── frontend/
│   ├── REACT-APP-ANTILLON/   Paginas y servicios de bpkm en apps/admin y apps/ops, mas Distancia Rutas
│   └── WEB-APP-ANTILLON/     Paginas del portal del piloto (entrega y detalle de facturas) y su login
└── database/
    └── bpkm.sql              Dump completo del esquema bpkm (tablas, funciones, triggers)
```

## Que se excluyo a proposito

- Archivos `.env` reales. Donde el repo original tenia uno, aqui queda solo un `.env.example` sin valores, con las claves que deberian existir.
- Componentes y utilidades genericas compartidas con otros modulos del sistema (kit de UI, manejo generico de errores), que no son propias de BPKM.

## Como ubicar el archivo real

La ruta de cada archivo dentro de esta carpeta es la misma ruta relativa que tiene en su repo de origen (por ejemplo, `backend/APIS-NODE/apps/api-local/src/routes/bpkm/rutas.js` esta en esa misma ruta en el repo APIS-NODE). Para consultar la version viva o su historial, basta buscar ese mismo archivo en el repositorio correspondiente de la tabla anterior.
