# Documentacion del proyecto SiCoDiEt

Fecha: 2026-06-01

## 1. Descripcion general

SiCoDiEt significa Sistema de Control y Distribucion de Alimentos y Tambo. Es una aplicacion web para gestionar alimentos e insumos de un tambo, controlar stock, registrar ingresos de alimentos, registrar consumos por lote de ganado y consultar historiales operativos.

El sistema esta dividido en dos partes principales:

- Frontend: aplicacion React con Vite, Bootstrap, React Router, Axios y Lucide React.
- Backend: API REST desarrollada con Node.js, Express, MySQL, JWT, bcrypt y express-validator.

La base de datos principal es MySQL y se define en `backend/database.sql`.

## 2. Objetivo del sistema

Centralizar el control de alimentos y consumos del tambo para mejorar la trazabilidad, evitar errores de stock, registrar movimientos diarios y facilitar la consulta de informacion por parte de administradores, operarios y usuarios autorizados.

## 3. Alcance del sistema

El alcance observado en el proyecto incluye:

- Registro e inicio de sesion de usuarios.
- Autenticacion mediante token JWT.
- Manejo de roles: `admin`, `usuario` y `operario`.
- Gestion de alimentos/insumos por tipo: silo, bolson, fardo y sales.
- Registro de stock actual, capacidad maxima, stock minimo y unidad de medida.
- Registro de ingresos de alimentos con comprobante/remito.
- Consulta de historial de cargas de alimentos.
- Gestion de lotes de ganado.
- Asociacion de insumos requeridos a lotes desde la API.
- Registro de consumos por lote e insumo.
- Descuento automatico de stock al registrar consumos.
- Consulta de historial de consumos.
- Gestion de alertas desde la API.
- Registro y consulta de datos de ganado desde la API.
- Gestion administrativa de usuarios desde la API.

Observacion: el frontend activo en `App.jsx` muestra las rutas `/login`, `/register`, `/silos`, `/lotes` y `/consumos`. Tambien existe un componente `Dashboard.jsx`, rutas de `alertas`, `ganado` y `usuarios` en backend, pero no todas esas funciones tienen una pantalla activa conectada en la navegacion actual.

## 4. Actores

| Actor | Descripcion |
| --- | --- |
| Administrador | Usuario con permisos completos para administrar usuarios, consultar datos y eliminar alertas. |
| Operario | Usuario operativo que puede registrar movimientos diarios y datos de ganado donde el backend lo permite. |
| Usuario | Usuario autenticado que puede consultar informacion y operar las funciones generales habilitadas. |
| Sistema | Ejecuta validaciones, actualiza stock, registra historiales y protege rutas mediante autenticacion. |

## 5. Requisitos funcionales

| ID | Requisito funcional | Prioridad |
| --- | --- | --- |
| RF-01 | El sistema debe permitir registrar usuarios con cedula, nombre, password, email, telefono y rol. | Alta |
| RF-02 | El sistema debe validar que la cedula del usuario registrado sea unica. | Alta |
| RF-03 | El sistema debe validar que la password tenga al menos 6 caracteres. | Alta |
| RF-04 | El sistema debe permitir iniciar sesion con cedula y password. | Alta |
| RF-05 | El sistema debe emitir un token JWT al iniciar sesion correctamente. | Alta |
| RF-06 | El sistema debe permitir consultar los datos del usuario autenticado mediante `/api/auth/me`. | Alta |
| RF-07 | El sistema debe permitir cerrar sesion eliminando el token del almacenamiento de sesion del navegador. | Alta |
| RF-08 | El sistema debe proteger las rutas privadas y redirigir a login cuando no exista una sesion valida. | Alta |
| RF-09 | El administrador debe poder listar usuarios desde la API. | Media |
| RF-10 | El administrador debe poder consultar un usuario especifico desde la API. | Media |
| RF-11 | El administrador debe poder actualizar nombre, email, telefono, rol y estado activo de un usuario. | Media |
| RF-12 | El administrador debe poder cambiar la password de un usuario. | Media |
| RF-13 | El administrador debe poder desactivar usuarios sin eliminarlos fisicamente de la base de datos. | Media |
| RF-14 | El sistema debe listar insumos activos. | Alta |
| RF-15 | El sistema debe filtrar insumos por tipo de alimento. | Alta |
| RF-16 | El sistema debe permitir consultar el detalle de un insumo. | Media |
| RF-17 | El sistema debe permitir crear insumos con nombre, tipo, unidad, capacidad maxima, stock actual y stock minimo. | Alta |
| RF-18 | El sistema debe permitir actualizar datos generales de un insumo. | Alta |
| RF-19 | El sistema debe permitir desactivar insumos sin eliminarlos fisicamente. | Media |
| RF-20 | El sistema debe permitir registrar ingresos de alimentos a un insumo existente. | Alta |
| RF-21 | El sistema debe incrementar el stock actual al registrar un ingreso. | Alta |
| RF-22 | El sistema debe impedir que el stock supere la capacidad maxima del insumo. | Alta |
| RF-23 | El sistema debe guardar el historial de cargas de alimentos con usuario, cantidad, fecha, hora, comprobante y observaciones. | Alta |
| RF-24 | El sistema debe registrar los ingresos tambien en la tabla de movimientos diarios. | Media |
| RF-25 | El sistema debe mostrar porcentaje de ocupacion de stock y advertencia visual cuando el stock sea bajo. | Alta |
| RF-26 | El sistema debe permitir consultar historial de cargas por insumo y rango de fechas desde la API. | Media |
| RF-27 | El sistema debe listar lotes activos de ganado. | Alta |
| RF-28 | El sistema debe crear lotes con nombre, tipo de animal, cantidad de animales, consumo estimado diario y observaciones. | Alta |
| RF-29 | El sistema debe permitir actualizar informacion de lotes. | Alta |
| RF-30 | El sistema debe permitir desactivar lotes sin eliminarlos fisicamente. | Media |
| RF-31 | El sistema debe permitir asociar insumos requeridos a un lote desde la API. | Media |
| RF-32 | El sistema debe permitir desvincular insumos requeridos de un lote desde la API. | Media |
| RF-33 | El sistema debe permitir registrar consumos indicando lote, insumo, cantidad y observaciones. | Alta |
| RF-34 | El sistema debe descontar automaticamente el stock del insumo al registrar un consumo. | Alta |
| RF-35 | El sistema debe impedir registrar consumos cuando el stock disponible sea insuficiente. | Alta |
| RF-36 | El sistema debe registrar consumos con fecha, hora y usuario responsable. | Alta |
| RF-37 | El sistema debe permitir consultar consumos por fecha y lote desde la API. | Media |
| RF-38 | El sistema debe mostrar los ultimos consumos registrados en la pantalla de consumos. | Alta |
| RF-39 | El sistema debe permitir consultar alertas y filtrarlas por estado leida/no leida desde la API. | Media |
| RF-40 | El sistema debe permitir marcar una alerta como leida. | Media |
| RF-41 | El sistema debe permitir marcar todas las alertas como leidas. | Media |
| RF-42 | El administrador debe poder eliminar alertas desde la API. | Baja |
| RF-43 | El sistema debe permitir consultar el ultimo registro de ganado. | Media |
| RF-44 | El sistema debe permitir consultar historial de ganado. | Media |
| RF-45 | El administrador y el operario deben poder registrar datos de ganado desde la API. | Media |
| RF-46 | El sistema debe exponer un endpoint de salud en `/api/health`. | Baja |

## 6. Requisitos no funcionales

| ID | Requisito no funcional | Descripcion |
| --- | --- | --- |
| RNF-01 | Seguridad | El sistema debe proteger rutas privadas con JWT y validar permisos segun rol cuando corresponda. |
| RNF-02 | Proteccion de passwords | Las passwords deben almacenarse cifradas con bcrypt y no deben devolverse en respuestas de la API. |
| RNF-03 | Validacion de datos | La API debe validar campos requeridos, formatos y rangos numericos antes de guardar informacion. |
| RNF-04 | Integridad transaccional | Los movimientos que modifiquen stock deben ejecutarse en transacciones para evitar inconsistencias. |
| RNF-05 | Trazabilidad | Los movimientos de carga y consumo deben guardar usuario, fecha, hora y observaciones cuando existan. |
| RNF-06 | Disponibilidad | El backend debe contar con un endpoint de salud para verificar que el servicio este activo. |
| RNF-07 | Usabilidad | La interfaz debe estar en espanol, mostrar mensajes claros y permitir operar las funciones principales sin conocimiento tecnico. |
| RNF-08 | Responsividad | La interfaz debe adaptarse a escritorio y dispositivos moviles. |
| RNF-09 | Rendimiento | Las consultas principales deben responder de forma eficiente usando pool de conexiones y filtros por fecha, lote o tipo cuando aplique. |
| RNF-10 | Mantenibilidad | El codigo debe mantenerse modular, separando rutas de backend, contexto de autenticacion, servicios API y paginas del frontend. |
| RNF-11 | Configurabilidad | Datos sensibles como credenciales de base de datos, puerto y secreto JWT deben manejarse mediante variables de entorno. |
| RNF-12 | Compatibilidad | El sistema debe funcionar en navegadores modernos y en un entorno Node.js con MySQL. |
| RNF-13 | Escalabilidad | La arquitectura debe permitir agregar nuevos modulos, rutas y pantallas sin reescribir la base del sistema. |
| RNF-14 | Consistencia visual | Las pantallas deben mantener una linea grafica uniforme usando los estilos definidos y Bootstrap. |
| RNF-15 | Recuperacion ante errores | La API debe responder con mensajes de error controlados y evitar exponer detalles internos al usuario final. |

## 7. Historias de usuario

| ID | Historia de usuario | Criterios de aceptacion |
| --- | --- | --- |
| HU-01 | Como usuario, quiero registrarme con mis datos personales para poder acceder al sistema. | Debe validar cedula, nombre y password; debe rechazar cedulas repetidas; debe redirigir al login al registrarse correctamente. |
| HU-02 | Como usuario, quiero iniciar sesion con mi cedula y password para acceder a las funciones privadas. | Debe aceptar credenciales validas; debe rechazar credenciales invalidas; debe guardar el token de sesion. |
| HU-03 | Como usuario autenticado, quiero cerrar sesion para proteger mi cuenta cuando termino de usar el sistema. | Debe eliminar el token; debe volver a la pantalla de login; no debe permitir acceder a rutas protegidas sin sesion. |
| HU-04 | Como administrador, quiero administrar usuarios para controlar quienes pueden usar el sistema. | Debe listar usuarios; debe permitir editar datos y rol; debe permitir desactivar usuarios. |
| HU-05 | Como usuario, quiero consultar los alimentos por categoria para conocer el stock disponible. | Debe mostrar silo, bolson, fardo y sales; debe mostrar stock actual, capacidad, porcentaje y dias restantes cuando existan datos. |
| HU-06 | Como operario, quiero registrar ingresos de alimentos para mantener actualizado el stock. | Debe ingresar cantidad y comprobante; debe aumentar el stock; debe impedir superar la capacidad maxima. |
| HU-07 | Como usuario, quiero ver el historial de cargas para auditar ingresos de alimentos. | Debe mostrar cantidad, fecha, hora, usuario y remito cuando exista. |
| HU-08 | Como usuario, quiero crear lotes de ganado para organizar los animales por grupo. | Debe guardar nombre, tipo de animal, cantidad, consumo estimado y observaciones. |
| HU-09 | Como usuario, quiero editar o desactivar lotes para mantener actualizada la informacion del tambo. | Debe permitir modificar datos del lote; debe ocultar lotes desactivados del listado principal. |
| HU-10 | Como usuario, quiero ver los insumos requeridos por lote para conocer la alimentacion planificada. | Debe mostrar insumo, unidad y cantidad requerida cuando existan asociaciones. |
| HU-11 | Como operario, quiero registrar consumos por lote para dejar constancia de la alimentacion diaria. | Debe seleccionar lote e insumo; debe ingresar cantidad; debe descontar stock y guardar el consumo. |
| HU-12 | Como operario, quiero que el sistema impida consumos superiores al stock para evitar datos incorrectos. | Debe validar stock disponible antes de confirmar; debe mostrar un mensaje de stock insuficiente. |
| HU-13 | Como usuario, quiero consultar los ultimos consumos para revisar movimientos recientes. | Debe listar lote, insumo, cantidad, fecha y usuario responsable. |
| HU-14 | Como administrador u operario, quiero registrar datos de ganado para mantener actualizado el estado del rodeo. | Debe guardar total de vacas, vacas lecheras, vacas secas, terneros, fecha y usuario. |
| HU-15 | Como usuario, quiero consultar alertas de stock para detectar insumos que requieren atencion. | Debe listar alertas; debe permitir marcarlas como leidas; debe diferenciar alertas no leidas. |
| HU-16 | Como administrador, quiero eliminar alertas obsoletas para mantener limpia la bandeja de alertas. | Debe permitir eliminar solo si el usuario tiene rol admin. |

## 8. Casos de uso

### CU-01: Iniciar sesion

| Campo | Detalle |
| --- | --- |
| Actor principal | Usuario, Operario o Administrador |
| Objetivo | Acceder al sistema mediante credenciales validas. |
| Precondiciones | El usuario debe existir y estar activo. |
| Flujo principal | 1. El actor ingresa cedula y password. 2. El sistema valida los datos. 3. El sistema compara la password cifrada. 4. El sistema genera un JWT. 5. El frontend guarda el token y redirige a la seccion principal. |
| Flujo alternativo | Si las credenciales son invalidas, el sistema muestra un mensaje de error. |
| Postcondiciones | El usuario queda autenticado y puede acceder a rutas protegidas. |

### CU-02: Registrar usuario

| Campo | Detalle |
| --- | --- |
| Actor principal | Usuario nuevo |
| Objetivo | Crear una cuenta en SiCoDiEt. |
| Precondiciones | La cedula no debe estar registrada previamente. |
| Flujo principal | 1. El actor completa nombre, apellido, rol, cedula, email, telefono y password. 2. El sistema valida que las passwords coincidan en frontend. 3. La API valida campos requeridos. 4. La API cifra la password. 5. La API guarda el usuario. 6. El frontend redirige al login. |
| Flujo alternativo | Si la cedula ya existe o los datos no son validos, se muestra un error. |
| Postcondiciones | El usuario queda registrado en estado activo. |

### CU-03: Gestionar alimentos/insumos

| Campo | Detalle |
| --- | --- |
| Actor principal | Usuario autenticado |
| Objetivo | Crear, consultar, modificar o desactivar alimentos del sistema. |
| Precondiciones | El actor debe haber iniciado sesion. |
| Flujo principal | 1. El actor ingresa a la pantalla Alimentos. 2. Selecciona una categoria. 3. El sistema lista insumos activos. 4. El actor crea o edita un insumo. 5. El sistema valida los datos y guarda los cambios. |
| Flujo alternativo | Si faltan datos o los valores no son validos, la API responde con error. |
| Postcondiciones | El listado de insumos queda actualizado. |

### CU-04: Registrar ingreso de alimento

| Campo | Detalle |
| --- | --- |
| Actor principal | Usuario autenticado u Operario |
| Objetivo | Registrar una carga o ingreso de alimento y actualizar stock. |
| Precondiciones | Debe existir el insumo. El usuario debe estar autenticado. |
| Flujo principal | 1. El actor abre un insumo. 2. Ingresa cantidad, comprobante y observaciones. 3. El sistema calcula el nuevo stock. 4. El sistema valida que no supere la capacidad maxima. 5. El sistema actualiza stock. 6. El sistema guarda historial de carga y movimiento diario. |
| Flujo alternativo | Si el nuevo stock supera la capacidad maxima, el sistema rechaza la operacion. |
| Postcondiciones | El stock aumenta y el movimiento queda trazado. |

### CU-05: Gestionar lotes

| Campo | Detalle |
| --- | --- |
| Actor principal | Usuario autenticado |
| Objetivo | Administrar los lotes de ganado. |
| Precondiciones | El actor debe estar autenticado. |
| Flujo principal | 1. El actor ingresa a Lotes. 2. El sistema muestra lotes activos. 3. El actor crea, edita o desactiva un lote. 4. El sistema valida y guarda los datos. |
| Flujo alternativo | Si los valores no son validos, el sistema informa el error. |
| Postcondiciones | Los lotes activos quedan actualizados. |

### CU-06: Asociar insumos requeridos a lote

| Campo | Detalle |
| --- | --- |
| Actor principal | Usuario autenticado |
| Objetivo | Definir que insumos requiere un lote y en que cantidad. |
| Precondiciones | Deben existir lote e insumo. |
| Flujo principal | 1. El actor selecciona lote e insumo. 2. Ingresa cantidad requerida. 3. El sistema guarda la asociacion en `lote_insumos`. 4. El sistema muestra los insumos requeridos al consultar el lote. |
| Flujo alternativo | Si falta lote, insumo o cantidad, el sistema rechaza la solicitud. |
| Postcondiciones | El lote queda vinculado al insumo requerido. |

### CU-07: Registrar consumo

| Campo | Detalle |
| --- | --- |
| Actor principal | Operario o Usuario autenticado |
| Objetivo | Registrar alimento consumido por un lote. |
| Precondiciones | Deben existir lote e insumo con stock suficiente. |
| Flujo principal | 1. El actor ingresa a Consumos. 2. Selecciona lote e insumo. 3. Ingresa cantidad y observaciones. 4. El sistema verifica stock. 5. El sistema descuenta stock. 6. El sistema guarda el consumo y el movimiento diario. 7. El sistema actualiza el historial mostrado. |
| Flujo alternativo | Si no hay stock suficiente, se cancela la operacion y se informa el stock actual. |
| Postcondiciones | El consumo queda registrado y el stock disminuye. |

### CU-08: Consultar historial de consumos

| Campo | Detalle |
| --- | --- |
| Actor principal | Usuario autenticado |
| Objetivo | Revisar consumos registrados. |
| Precondiciones | Deben existir consumos registrados. |
| Flujo principal | 1. El actor ingresa a Consumos. 2. El sistema consulta la API. 3. El sistema muestra los ultimos consumos con lote, insumo, cantidad, fecha y usuario. |
| Flujo alternativo | Si no existen registros, se muestra el mensaje `Sin registros`. |
| Postcondiciones | El actor visualiza el historial disponible. |

### CU-09: Gestionar alertas

| Campo | Detalle |
| --- | --- |
| Actor principal | Usuario autenticado o Administrador |
| Objetivo | Consultar y gestionar alertas del sistema. |
| Precondiciones | El actor debe estar autenticado. |
| Flujo principal | 1. El actor consulta alertas. 2. El sistema lista alertas con insumo asociado. 3. El actor marca una alerta como leida o marca todas. 4. El sistema actualiza el estado. |
| Flujo alternativo | Si el actor administrador elimina una alerta, el sistema la borra de la base. |
| Postcondiciones | Las alertas quedan actualizadas segun la accion realizada. |

### CU-10: Registrar datos de ganado

| Campo | Detalle |
| --- | --- |
| Actor principal | Administrador u Operario |
| Objetivo | Registrar estado del ganado del tambo. |
| Precondiciones | El actor debe tener rol `admin` u `operario`. |
| Flujo principal | 1. El actor informa total de vacas, vacas lecheras, vacas secas y terneros. 2. El sistema valida valores enteros no negativos. 3. El sistema guarda el registro con fecha actual y usuario. |
| Flujo alternativo | Si el actor no tiene permiso, la API responde 403. |
| Postcondiciones | Queda disponible el ultimo registro y el historial de ganado. |

## 9. Modelo de datos

| Tabla | Proposito |
| --- | --- |
| `usuarios` | Guarda usuarios, credenciales cifradas, rol, estado activo y ultimo acceso. |
| `insumos` | Guarda alimentos/insumos, tipo, unidad, capacidad, stock actual y stock minimo. |
| `lotes` | Guarda grupos de animales con cantidad y consumo estimado diario. |
| `consumos` | Guarda consumos de insumos por lote, usuario, fecha y hora. |
| `consumo_diario` | Guarda movimientos diarios de consumo, ingreso y ajustes. |
| `ganado` | Guarda registros historicos del estado del ganado. |
| `alertas` | Guarda alertas de stock u otros eventos relevantes. |
| `logs_actividad` | Tabla prevista para auditoria general de acciones. |
| `historial_cargas_alimentos` | Guarda ingresos de alimentos con comprobante y usuario responsable. |
| `lote_insumos` | Relaciona lotes con insumos requeridos y cantidad necesaria. |

## 10. Endpoints principales de la API

### Autenticacion

| Metodo | Ruta | Descripcion |
| --- | --- | --- |
| POST | `/api/auth/register` | Registra un usuario. |
| POST | `/api/auth/login` | Inicia sesion y devuelve token JWT. |
| GET | `/api/auth/me` | Devuelve datos del usuario autenticado. |

### Usuarios

| Metodo | Ruta | Descripcion |
| --- | --- | --- |
| GET | `/api/usuarios` | Lista usuarios. Requiere admin. |
| GET | `/api/usuarios/:id` | Obtiene un usuario. Requiere admin. |
| PUT | `/api/usuarios/:id` | Actualiza datos de usuario. Requiere admin. |
| PUT | `/api/usuarios/:id/password` | Actualiza password. Requiere admin. |
| DELETE | `/api/usuarios/:id` | Desactiva usuario. Requiere admin. |

### Insumos

| Metodo | Ruta | Descripcion |
| --- | --- | --- |
| GET | `/api/insumos` | Lista insumos activos. Acepta filtro `tipo`. |
| GET | `/api/insumos/:id` | Obtiene detalle de un insumo. |
| POST | `/api/insumos` | Crea un insumo. |
| PUT | `/api/insumos/:id` | Actualiza un insumo. |
| POST | `/api/insumos/:id/cargar` | Registra ingreso de alimento y actualiza stock. |
| DELETE | `/api/insumos/:id` | Desactiva un insumo. |

### Lotes

| Metodo | Ruta | Descripcion |
| --- | --- | --- |
| GET | `/api/lotes` | Lista lotes activos con insumos requeridos. |
| GET | `/api/lotes/:id` | Obtiene detalle de un lote. |
| POST | `/api/lotes` | Crea un lote. |
| PUT | `/api/lotes/:id` | Actualiza un lote. |
| POST | `/api/lotes/:id/insumos` | Asocia un insumo requerido al lote. |
| DELETE | `/api/lotes/:id/insumos/:insumoId` | Desvincula un insumo requerido del lote. |
| DELETE | `/api/lotes/:id` | Desactiva un lote. |

### Consumos

| Metodo | Ruta | Descripcion |
| --- | --- | --- |
| GET | `/api/consumos` | Lista consumos. Acepta filtros `fecha` y `lote_id`. |
| POST | `/api/consumos` | Registra consumo y descuenta stock. |
| GET | `/api/consumos/historial` | Lista historial de cargas de alimentos con filtros. |

### Ganado

| Metodo | Ruta | Descripcion |
| --- | --- | --- |
| GET | `/api/ganado` | Obtiene ultimo registro de ganado. |
| GET | `/api/ganado/historial` | Obtiene ultimos registros historicos. |
| POST | `/api/ganado` | Crea registro de ganado. Requiere admin u operario. |

### Alertas

| Metodo | Ruta | Descripcion |
| --- | --- | --- |
| GET | `/api/alertas` | Lista alertas. Acepta filtro `leidas`. |
| PUT | `/api/alertas/:id/leer` | Marca una alerta como leida. |
| PUT | `/api/alertas/leer-todas` | Marca todas las alertas como leidas. |
| DELETE | `/api/alertas/:id` | Elimina una alerta. Requiere admin. |

### Salud

| Metodo | Ruta | Descripcion |
| --- | --- | --- |
| GET | `/api/health` | Verifica que la API este activa. |

## 11. Arquitectura tecnica

### Frontend

El frontend se encuentra en `frontend/`.

Archivos principales:

| Archivo | Funcion |
| --- | --- |
| `src/main.jsx` | Punto de entrada de React. |
| `src/App.jsx` | Define rutas activas y proteccion de pantallas. |
| `src/context/AuthContext.jsx` | Maneja sesion, login, registro, logout y carga del usuario actual. |
| `src/services/api.js` | Configura Axios, agrega token JWT y maneja errores 401. |
| `src/pages/Login.jsx` | Pantalla de inicio de sesion. |
| `src/pages/Register.jsx` | Pantalla de registro. |
| `src/pages/Silos.jsx` | Pantalla de alimentos/stock e historial de cargas. |
| `src/pages/Lotes.jsx` | Pantalla de lotes de ganado. |
| `src/pages/Consumos.jsx` | Pantalla de registro e historial de consumos. |
| `src/pages/Dashboard.jsx` | Dashboard disponible en codigo, no conectado en rutas activas actuales. |
| `src/components/Layout.jsx` | Layout principal con navegacion. |

### Backend

El backend se encuentra en `backend/`.

Archivos principales:

| Archivo | Funcion |
| --- | --- |
| `src/server.js` | Configura Express, CORS, rutas y endpoint de salud. |
| `src/config/database.js` | Configura pool de conexion MySQL. |
| `src/middleware/auth.js` | Valida JWT y roles. |
| `src/routes/auth.js` | Registro, login y consulta de usuario autenticado. |
| `src/routes/usuarios.js` | Administracion de usuarios. |
| `src/routes/insumos.js` | Gestion de insumos y cargas de alimentos. |
| `src/routes/lotes.js` | Gestion de lotes e insumos requeridos. |
| `src/routes/consumos.js` | Registro y consulta de consumos e historial de cargas. |
| `src/routes/ganado.js` | Registro y consulta de ganado. |
| `src/routes/alertas.js` | Consulta y gestion de alertas. |
| `src/utils/alertas.js` | Funcion preparada para generar alertas de stock. |

## 12. Reglas de negocio principales

| ID | Regla |
| --- | --- |
| RN-01 | Una cedula no puede repetirse entre usuarios. |
| RN-02 | Solo usuarios activos pueden iniciar sesion. |
| RN-03 | Las passwords deben tener al menos 6 caracteres. |
| RN-04 | El stock de un insumo no puede superar su capacidad maxima al registrar ingresos. |
| RN-05 | El stock de un insumo no puede quedar negativo al registrar consumos. |
| RN-06 | Los consumos deben quedar asociados a lote, insumo y usuario. |
| RN-07 | Los ingresos de alimentos deben quedar asociados a insumo y usuario. |
| RN-08 | Los registros eliminados de usuarios, insumos y lotes se desactivan logicamente cuando la ruta lo implementa. |
| RN-09 | Las operaciones de stock deben registrar fecha y hora del movimiento. |
| RN-10 | El registro de ganado solo puede crearse por usuarios con rol `admin` u `operario`. |
| RN-11 | La eliminacion de alertas solo puede realizarla un usuario con rol `admin`. |

## 13. Ejecución local sin Docker

### Requisitos

- Node.js instalado
- MySQL local accesible en `localhost:3306`
- ngrok instalado y autenticado

### Configuración inicial

1. Copiar `.env.example` a `.env`:
   ```powershell
   Copy-Item .env.example .env
   ```

2. Editar `.env` y configurar las variables de base de datos según tu entorno.

### Compilar el frontend

```powershell
cd frontend
npm install
npm run build
cd ..\backend
```

### Iniciar el backend

```powershell
npm install
$env:NODE_ENV='production'
npm start
```

### Verificar localmente

- Frontend: http://localhost:3001
- API Health: http://localhost:3001/api/health

## 14. Conexión con ngrok

Usa ngrok para exponer tu backend en un túnel público y probar la página desde cualquier red.

### 1. Ejecutar el script de ngrok

```powershell
.\scripts\setup-ngrok.ps1
```

### 2. Agregar la URL pública a `.env`

Después de obtener la URL de ngrok, agrega o actualiza la variable:

```env
FRONTEND_URL=http://localhost:3001,http://192.168.1.244:3001,https://abc123.ngrok-free.dev
```

### 3. Reiniciar el backend si cambias `FRONTEND_URL`

Si ya tienes el backend corriendo, deténlo y vuélvelo a iniciar con:

```powershell
$env:NODE_ENV='production'
npm start
```

### 4. Compartir la URL de ngrok

La URL pública de ngrok es la que podrás usar para acceder al sitio desde otros dispositivos.

### Notas

- No se necesita Docker para esta configuración.
- El backend sirve el frontend compilado desde `backend/public` en modo producción.
- Asegúrate de compilar el frontend antes de usar el túnel.

## 15. Instalación y ejecución local (sin Docker)

### Base de datos

1. Crear la base y tablas ejecutando el script `backend/database.sql` en MySQL.
2. Confirmar que exista la base `gestion_tambo`.
3. El script incluye datos iniciales de usuario administrador, insumos, ganado, lotes y relaciones lote-insumo.

### Backend

1. Entrar a `backend/`.
2. Ejecutar `npm install`.
3. Crear archivo `.env` con las variables necesarias.
4. Ejecutar `npm run dev` o `npm start`.

Variables esperadas:

```env
PORT=3002
DB_HOST=localhost
DB_USER=root
DB_PASS=
DB_NAME=gestion_tambo
JWT_SECRET=secret_seguro_para_desarrollo
JWT_EXPIRES_IN=8h
NODE_ENV=development
```

Nota tecnica: `frontend/vite.config.js` apunta el proxy `/api` a `http://localhost:3002`. Si el backend queda usando su puerto por defecto `3001`, hay que cambiar `PORT=3002` en `.env` o ajustar el proxy de Vite.

### Frontend

1. Entrar a `frontend/`.
2. Ejecutar `npm install`.
3. Ejecutar `npm run dev`.
4. Abrir la URL mostrada por Vite, normalmente `http://localhost:5173`.

## 16. Flujo operativo recomendado

1. El usuario inicia sesion.
2. Consulta alimentos por categoria en Alimentos.
3. Crea o actualiza insumos si corresponde.
4. Registra ingresos de alimentos cuando llegan cargas o remitos.
5. Crea lotes de ganado segun la organizacion del tambo.
6. Registra consumos diarios indicando lote, insumo y cantidad.
7. Revisa historiales de cargas y consumos.
8. Consulta alertas y datos de ganado desde las funciones disponibles o futuras pantallas conectadas al backend.

## 17. Observaciones tecnicas y mejoras sugeridas

| ID | Observacion | Recomendacion |
| --- | --- | --- |
| OBS-01 | `Dashboard.jsx` existe pero no esta conectado en las rutas activas de `App.jsx`. | Agregar ruta `/dashboard` si se quiere usar como pantalla principal. |
| OBS-02 | Existen `Header.jsx` y `ProtectedRoute.jsx`, pero `App.jsx` usa su propio `ProtectedRoute` interno y `Layout.jsx`. | Unificar componentes para evitar duplicidad. |
| OBS-03 | `utils/alertas.js` contiene generacion de alertas de stock, pero no se observa llamada desde consumos o cargas. | Invocar la verificacion despues de modificar stock. |
| OBS-04 | La API permite administracion de usuarios, ganado y alertas, pero faltan pantallas completas para algunas funciones. | Crear modulos frontend para usuarios, ganado y alertas. |
| OBS-05 | La tabla `logs_actividad` existe, pero no se observa uso activo. | Registrar acciones relevantes para auditoria general. |
| OBS-06 | Algunas rutas de insumos y lotes importan `authorizeRoles` pero no lo aplican. | Definir politica de permisos y aplicarla de forma consistente. |

## 18. Criterios generales de aceptacion del sistema

| ID | Criterio |
| --- | --- |
| CA-01 | Un usuario no autenticado no debe acceder a pantallas privadas. |
| CA-02 | Un login valido debe permitir acceder a Alimentos, Lotes y Consumos. |
| CA-03 | Al registrar un ingreso, el stock debe aumentar y quedar reflejado en el listado. |
| CA-04 | Al registrar un consumo, el stock debe disminuir y el consumo debe aparecer en el historial. |
| CA-05 | El sistema no debe permitir que el stock supere la capacidad maxima. |
| CA-06 | El sistema no debe permitir consumos mayores al stock disponible. |
| CA-07 | Los historiales deben mostrar fecha, hora, usuario y cantidad cuando los datos existan. |
| CA-08 | Las operaciones protegidas por rol deben rechazar usuarios sin permiso. |
| CA-09 | La interfaz debe mostrar mensajes claros de exito o error. |
| CA-10 | La base de datos debe conservar relaciones entre usuarios, lotes, insumos, consumos y cargas. |

## 19. Glosario

| Termino | Definicion |
| --- | --- |
| Insumo | Alimento o recurso utilizado para alimentar el ganado. |
| Silo | Tipo de almacenamiento o alimento controlado por el sistema. |
| Bolson | Tipo de alimento o deposito registrado como insumo. |
| Fardo | Alimento compactado, por ejemplo alfalfa. |
| Sales | Sales minerales usadas como suplemento. |
| Lote | Grupo de animales con caracteristicas y consumo estimado. |
| Consumo | Movimiento de salida de stock asociado a un lote. |
| Carga | Movimiento de ingreso de stock asociado a un insumo. |
| Stock minimo | Umbral a partir del cual se debe prestar atencion al nivel disponible. |
| JWT | Token utilizado para autenticar peticiones a la API. |
