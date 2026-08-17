# CLAUDE.md — Contexto de SiCoDiEt

## ¿Qué es SiCoDiEt?

**SiCoDiEt** = **Si**stema de **Co**ntrol y **Di**stribución de Alimentos y Tambo (también referenciado como "Sistema de Consumo Diario del Establecimiento").

Es una **aplicación web para gestión operativa de un tambo lechero/ganadero**. Permite controlar el stock de alimentos, registrar ingresos y consumos diarios por lote de ganado, y auditar todos los movimientos. El usuario final es el productor o el operario del tambo — no un perfil técnico.

---

## Stack tecnológico

| Capa | Tecnología |
|------|-----------|
| Backend | Node.js + Express, MySQL (mysql2), JWT, bcrypt, express-validator |
| Frontend | React + Vite, Bootstrap, React Router, Axios, Lucide React |
| Base de datos | MySQL — esquema en `backend/database.sql` |
| Deploy backend | Railway (vía Dockerfile + railway.json) |
| Deploy frontend | Vercel (vía frontend/vercel.json) |
| CI | GitHub Actions (`.github/workflows/ci.yml`) — tests backend + build frontend en cada push a `master` |
| Backup | `.github/workflows/db-backup.yml` — mysqldump diario a Railway, artifact 30 días |

---

## Estructura del proyecto

```
SICODIET/
├── backend/
│   ├── src/
│   │   ├── server.js          # Entry point Express
│   │   ├── config/database.js # Pool MySQL
│   │   ├── middleware/auth.js # JWT + roles
│   │   ├── routes/            # auth, usuarios, insumos, lotes, consumos, ganado, alertas
│   │   └── utils/alertas.js   # Generación de alertas de stock
│   └── database.sql           # Esquema + datos iniciales
├── frontend/
│   └── src/
│       ├── App.jsx            # Router + ProtectedRoute
│       ├── context/AuthContext.jsx
│       ├── services/api.js    # Axios + JWT header
│       └── pages/             # Login, Register, Silos, Lotes, Consumos, Dashboard
├── DOCUMENTACION.md           # Requisitos, casos de uso, modelo de datos completo
├── OPERATIONS.md              # Runbook de producción
└── docker-compose.yml         # MySQL + backend local
```

---

## Roles de usuario

| Rol | Permisos |
|-----|----------|
| `admin` | Todo: gestión de usuarios, alertas, ganado, insumos, lotes, consumos |
| `operario` | Registrar consumos, ingresos, datos de ganado |
| `usuario` | Consultar información y operar funciones generales |

---

## Módulos funcionales activos

### 1. Autenticación
- Login/registro con cédula + password (bcrypt)
- JWT con expiración configurable (`JWT_EXPIRES_IN`)
- Rutas protegidas en frontend y backend

### 2. Insumos / Alimentos (pantalla: Silos)
- 4 tipos: **silo, bolson, fardo, sales**
- Cada insumo tiene: stock actual, capacidad máxima, stock mínimo, unidad
- Se pueden crear, editar, desactivar (soft delete)
- Registro de ingresos: aumenta stock, guarda historial de cargas + movimiento diario
- Validación: el stock no puede superar la capacidad máxima

### 3. Lotes de ganado
- Grupos de animales con: nombre, tipo de animal, cantidad, consumo estimado diario
- Se pueden asociar insumos requeridos (tabla `lote_insumos`)
- Soft delete

### 4. Consumos
- Registro diario: lote + insumo + cantidad + observaciones
- Descuenta stock automáticamente (transacción)
- Validación: no permite consumo mayor al stock disponible
- Historial con: lote, insumo, cantidad, fecha, hora, usuario

### 5. Ganado
- Registro de estado del rodeo: vacas totales, lecheras, secas, terneros
- Solo admin/operario pueden crear registros
- Historial disponible vía API

### 6. Alertas
- Generadas cuando el stock baja del mínimo
- Se pueden marcar como leídas (individual o todas)
- Solo admin puede eliminar alertas

---

## Modelo de datos (tablas principales)

| Tabla | Propósito |
|-------|-----------|
| `usuarios` | Credenciales, rol, estado activo |
| `insumos` | Alimentos: stock, capacidad, tipo |
| `lotes` | Grupos de animales |
| `consumos` | Consumos por lote/insumo/usuario |
| `consumo_diario` | Movimientos diarios (ingresos, consumos, ajustes) |
| `historial_cargas_alimentos` | Ingresos de alimentos con comprobante |
| `lote_insumos` | Relación lote ↔ insumo requerido |
| `ganado` | Historial del estado del rodeo |
| `alertas` | Alertas de stock |
| `logs_actividad` | Auditoría general (tabla existe, aún no en uso activo) |

---

## Reglas de negocio críticas

- El stock **no puede superar** la capacidad máxima al cargar.
- El stock **no puede quedar negativo** al registrar consumos.
- Los consumos e ingresos deben ejecutarse en **transacciones** (integridad).
- Eliminaciones son **lógicas** (soft delete) — nunca físicas para usuarios, insumos y lotes.
- Solo usuarios **activos** pueden iniciar sesión.
- La **cédula** es única por usuario.

---

## Estado actual del proyecto

### Pantallas activas en frontend
- `/login`, `/register`, `/silos` (alimentos), `/lotes`, `/consumos`

### Pendiente / Incompleto (a tener en cuenta al implementar)
| Problema | Recomendación |
|----------|--------------|
| `Dashboard.jsx` existe pero no está en las rutas de `App.jsx` | Agregar ruta `/dashboard` |
| `utils/alertas.js` no se invoca al modificar stock | Llamarla después de cargas y consumos |
| Faltan pantallas para: usuarios, ganado, alertas | Crear módulos frontend |
| `authorizeRoles` importado pero no aplicado en algunas rutas | Definir política de permisos consistente |
| `Header.jsx` y `ProtectedRoute.jsx` duplicados con los de `App.jsx` | Unificar componentes |
| `logs_actividad` existe pero sin uso | Registrar acciones relevantes |
| Frontend sin tests automatizados | A añadir |

---

## Cómo ejecutar en local

### Con Docker (recomendado)
```powershell
cp .env.example .env   # completar variables
docker-compose up -d
# App en http://localhost:3001
```

### Sin Docker
```powershell
# 1. Ejecutar backend/database.sql en MySQL para crear la BD gestion_tambo

# 2. Backend
cd backend
cp .env.example .env
npm install
npm run dev   # http://localhost:3001

# 3. Frontend (otra terminal)
cd frontend
npm install
npm run dev   # http://localhost:5173
```

Variables `.env` del backend:
```
PORT=3002
DB_HOST=localhost
DB_USER=root
DB_PASS=
DB_NAME=gestion_tambo
JWT_SECRET=secret_seguro_para_desarrollo
JWT_EXPIRES_IN=8h
NODE_ENV=development
```

> ⚠️ `vite.config.js` apunta el proxy `/api` a `http://localhost:3002`. Mantener el puerto consistente.

---

## Principios de implementación

Al agregar código nuevo, seguir estos principios que ya establece el proyecto:

1. **Backend modular**: cada recurso tiene su propio archivo de rutas en `backend/src/routes/`. No meter lógica de negocio en `server.js`.
2. **Transacciones para movimientos de stock**: cualquier operación que modifique `stock_actual` debe usar transacción MySQL.
3. **Soft delete siempre**: nunca `DELETE` físico en usuarios, insumos ni lotes — usar campo `activo = false`.
4. **JWT en todas las rutas privadas**: usar el middleware `auth.js`. Si la ruta es solo para admin/operario, agregar `authorizeRoles`.
5. **Variables de entorno para todo lo sensible**: no hardcodear credenciales ni el `JWT_SECRET`.
6. **Frontend en español**: mensajes, labels, validaciones — todo en español para el productor.
7. **Bootstrap para UI**: mantener la línea visual con Bootstrap + los estilos existentes. No introducir otro framework de UI sin consenso.
8. **Axios centralizado**: usar `src/services/api.js` para todas las llamadas. No crear instancias de Axios sueltas en los componentes.
9. **AuthContext para sesión**: no manejar el token JWT directamente en los componentes — usar el contexto.
10. **Invocar generación de alertas** después de cualquier modificación de stock (actualmente faltante — es deuda técnica).

---

## Dónde quiere llegar el proyecto

SiCoDiEt está en **fase beta activa** con un solo desarrollador. El objetivo a mediano plazo es:

- Completar las pantallas faltantes (dashboard, usuarios admin, ganado, alertas con UI completa).
- Conectar `utils/alertas.js` al flujo real de stock.
- Añadir tests al frontend.
- Escalar a múltiples tambos/productores si el piloto es exitoso.
- Eventualmente incorporar APM (Sentry u otro) cuando crezca la base de usuarios.
- Posiblemente añadir módulo de **dietas** (ya mencionado en el nombre del sistema) y **costos/compras** como funcionalidades futuras.

El sistema debe seguir siendo operable por un productor sin conocimiento técnico — la usabilidad y los mensajes claros son una prioridad no negociable.
