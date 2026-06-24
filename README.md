# SiCoDiEt

Sistema de Consumo diario del establecimiento. Gestión de stock de
alimentos, dietas, consumos, compras y costos para producción lechera/ganadera.

## Stack

- **Backend:** Node.js + Express + MySQL (mysql2), JWT, bcrypt, express-validator.
- **Frontend:** React + Vite, Bootstrap, React Router, Axios.
- **Base de datos:** MySQL, esquema en [backend/database.sql](backend/database.sql) +
  migraciones en [backend/database/migrations/](backend/database/migrations/).

Documentación funcional detallada (requisitos, casos de uso, modelo de datos):
[DOCUMENTACION.md](DOCUMENTACION.md). Runbook de producción (backups, debugging
de errores reportados): [OPERATIONS.md](OPERATIONS.md).

## Setup local

### Con Docker (recomendado)

```powershell
cp .env.example .env   # completar las variables
docker-compose up -d
```

Esto levanta MySQL + backend (sirviendo el frontend compilado) en
`http://localhost:3001`.

### Sin Docker

Requiere Node.js y un MySQL accesible en `localhost:3306`.

```powershell
# Base de datos: ejecutar backend/database.sql en MySQL

# Backend
cd backend
cp .env.example .env   # completar las variables
npm install
npm run dev             # http://localhost:3001, con reload automático

# Frontend (en otra terminal)
cd frontend
cp .env.example .env   # opcional, ver frontend/.env.example
npm install
npm run dev             # http://localhost:5173
```

Más detalle (incluyendo variables de entorno completas) en
[DOCUMENTACION.md](DOCUMENTACION.md).

## Tests

```powershell
cd backend
npm test                 # node --test, sin dependencias adicionales
```

El frontend todavía no tiene tests automatizados.

## CI

[.github/workflows/ci.yml](.github/workflows/ci.yml) corre en cada push/PR a
`master`: tests del backend y build del frontend. El lint del frontend corre
pero no bloquea el merge (hay deuda preexistente sin resolver todavía).

## Deploy

- **Backend:** Railway, vía [Dockerfile](Dockerfile) (build) y
  [railway.json](railway.json) (config de deploy). Conectado al repo de
  GitHub — confirmar en el dashboard de Railway que el auto-deploy al pushear
  a `master` esté habilitado (Settings → Source).
- **Frontend:** Vercel, vía [frontend/vercel.json](frontend/vercel.json).
- **Acceso remoto temporal para testing** (ej. mostrarle la app a un
  productor desde el celular sin depender de Vercel/Railway): Cloudflare
  Tunnel, ver [scripts/README.md](scripts/README.md).

## Scripts

Ver [scripts/README.md](scripts/README.md) para los scripts de PowerShell
disponibles (tunnel de Cloudflare, arranque local sin Docker, export de la
base para Railway).
