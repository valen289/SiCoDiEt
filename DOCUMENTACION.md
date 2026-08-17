# Documentacion del proyecto Sicodiet

Fecha: 2026-08-17

## 1. Descripcion general

Sicodiet significa Sistema de Control y Distribucion de Alimentos y Tambo. Es una aplicacion web para gestionar alimentos e insumos de un tambo, controlar stock, registrar ingresos de alimentos, registrar consumos por lote de ganado, formular dietas balanceadas, analizar costos y compras, y consultar historiales y auditoria operativa.

El sistema esta dividido en dos partes principales:

- Frontend: aplicacion React con Vite, Bootstrap, React Router, Axios y Lucide React.
- Backend: API REST desarrollada con Node.js, Express, MySQL, JWT, bcrypt y express-validator.

La base de datos principal es MySQL. El esquema base se define en `backend/database.sql`, pero el esquema real y vigente resulta de aplicar tambien las migraciones incrementales en `backend/database/migrations/` (ver seccion 9.1).

El sistema es **multi-tambo**: todas las tablas operativas cuelgan de `tambo_id`, lo que permite en el futuro alojar varios productores en la misma base de datos sin mezclar su informacion.

## 2. Objetivo del sistema

Centralizar el control de alimentos, dietas, costos, compras y consumos del tambo para mejorar la trazabilidad, evitar errores de stock, registrar movimientos diarios, formular raciones balanceadas y facilitar la consulta de informacion por parte de duenos, encargados y trabajadores.

## 3. Alcance del sistema

El alcance observado en el proyecto incluye:

- Registro e inicio de sesion de usuarios, con invitacion por enlace/QR, verificacion en dos pasos (2FA) y bloqueo temporal tras intentos fallidos.
- Autenticacion mediante token JWT, con recuperacion de password por email (`forgot-password` / `reset-password`).
- Manejo de roles: `dueno`, `encargado` y `trabajador` (ver seccion 4).
- Perfil de usuario autoservicio: edicion de datos propios, cambio de password y foto de perfil.
- Gestion de alimentos/insumos por tipo: silo, bolson, fardo, sales (y categorias personalizadas definidas por el usuario en el frontend).
- Registro de stock actual, capacidad maxima, stock minimo y unidad de medida.
- Registro de ingresos de alimentos con comprobante/remito.
- Consulta de historial de cargas y de movimientos de stock (ingresos, consumos, ajustes) en una pantalla unificada de Historial.
- Gestion de lotes de ganado, incluyendo objetivo productivo (leche/engorde) y etapa de lactancia.
- Asociacion de insumos requeridos a lotes.
- Registro de consumos por lote e insumo, con descuento automatico de stock.
- Formulacion de dietas: calculo de costos, margenes y simulacion de escenarios (variacion de precio de insumos o de produccion esperada).
- Analisis de costos por lote y por periodo, con exportacion a CSV/PDF.
- Gestion de compras y proveedores.
- Registro y consulta de estado del rodeo (ganado).
- Generacion y gestion de alertas de stock, invocadas automaticamente tras cargas, consumos y cambios en dietas.
- Registro de actividad (auditoria) de acciones relevantes del sistema, con pantalla dedicada.
- Reportes de consumo mensual, costos mensuales, compras y stock.
- Pagina publica de aterrizaje (landing) y de politica de privacidad.

Observacion: el frontend activo en `App.jsx` conecta todas las pantallas anteriores; ya no existen modulos de backend sin pantalla asociada (ver seccion 16 para el detalle de que quedo resuelto).

## 4. Actores

El modelo de roles cambio: los roles antiguos `admin`, `operario` y `usuario` fueron renombrados (migracion `004_rename_roles.sql`) y hoy el campo `usuarios.rol` es `ENUM('dueno','encargado','trabajador')`.

| Rol (`usuarios.rol`) | Equivalente conceptual | Descripcion |
| --- | --- | --- |
| `dueno` | Administrador / Propietario | Permisos completos: usuarios, invitaciones, alimentos, lotes, dietas, costos, compras, alertas, actividad, ganado, dashboard. Unico rol que puede gestionar `/usuarios`. |
| `encargado` | Tecnico / Encargado | Igual acceso operativo que `dueno` salvo la gestion de usuarios: alimentos, lotes, dietas, costos, compras, consumos, alertas, historial, actividad, ganado, dashboard. |
| `trabajador` | Operario | Acceso restringido a `/consumos`, `/alertas` y `/perfil`. El resto de las rutas privadas lo redirigen automaticamente. |
| Sistema | — | Ejecuta validaciones, actualiza stock, genera alertas, registra movimientos y actividad, y protege rutas mediante autenticacion y autorizacion por rol. |

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
| RF-09 | El `dueno` debe poder listar usuarios desde la API. | Media |
| RF-10 | El `dueno` debe poder consultar un usuario especifico desde la API. | Media |
| RF-11 | El `dueno` debe poder actualizar nombre, email, telefono, rol y estado activo de un usuario. | Media |
| RF-12 | El `dueno` debe poder cambiar la password de un usuario. | Media |
| RF-13 | El `dueno` debe poder desactivar usuarios sin eliminarlos fisicamente de la base de datos. | Media |
| RF-14 | El sistema debe listar insumos activos. | Alta |
| RF-15 | El sistema debe filtrar insumos por tipo/categoria de alimento. | Alta |
| RF-16 | El sistema debe permitir consultar el detalle de un insumo. | Media |
| RF-17 | El sistema debe permitir crear insumos con nombre, tipo, unidad, capacidad maxima, stock actual y stock minimo. | Alta |
| RF-18 | El sistema debe permitir actualizar datos generales de un insumo. | Alta |
| RF-19 | El sistema debe permitir desactivar insumos sin eliminarlos fisicamente. | Media |
| RF-20 | El sistema debe permitir registrar ingresos de alimentos a un insumo existente. | Alta |
| RF-21 | El sistema debe incrementar el stock actual al registrar un ingreso. | Alta |
| RF-22 | El sistema debe impedir que el stock supere la capacidad maxima del insumo. | Alta |
| RF-23 | El sistema debe guardar el historial de cargas de alimentos con usuario, cantidad, fecha, hora, comprobante y observaciones. | Alta |
| RF-24 | El sistema debe registrar los ingresos, consumos y ajustes en la tabla unificada de movimientos de stock (`movimientos_stock`). | Media |
| RF-25 | El sistema debe mostrar porcentaje de ocupacion de stock y advertencia visual cuando el stock sea bajo. | Alta |
| RF-26 | El sistema debe permitir consultar historial de movimientos por insumo y rango de fechas, con exportacion. | Media |
| RF-27 | El sistema debe listar lotes activos de ganado. | Alta |
| RF-28 | El sistema debe crear lotes con nombre, tipo de animal, objetivo productivo, etapa de lactancia, cantidad de animales, consumo estimado diario y observaciones. | Alta |
| RF-29 | El sistema debe permitir actualizar informacion de lotes. | Alta |
| RF-30 | El sistema debe permitir desactivar lotes sin eliminarlos fisicamente. | Media |
| RF-31 | El sistema debe permitir asociar insumos requeridos a un lote. | Media |
| RF-32 | El sistema debe permitir desvincular insumos requeridos de un lote. | Media |
| RF-33 | El sistema debe permitir registrar consumos indicando lote, insumo, cantidad y observaciones. | Alta |
| RF-34 | El sistema debe descontar automaticamente el stock del insumo al registrar un consumo. | Alta |
| RF-35 | El sistema debe impedir registrar consumos cuando el stock disponible sea insuficiente. | Alta |
| RF-36 | El sistema debe registrar consumos con fecha, hora y usuario responsable. | Alta |
| RF-37 | El sistema debe permitir consultar consumos por fecha y lote. | Media |
| RF-38 | El sistema debe mostrar los ultimos consumos registrados en la pantalla de consumos. | Alta |
| RF-39 | El sistema debe permitir consultar alertas y filtrarlas por estado leida/no leida. | Media |
| RF-40 | El sistema debe permitir marcar una alerta como leida. | Media |
| RF-41 | El sistema debe permitir marcar todas las alertas como leidas. | Media |
| RF-42 | El `dueno` debe poder eliminar alertas. | Baja |
| RF-43 | El sistema debe permitir consultar el ultimo registro de ganado. | Media |
| RF-44 | El sistema debe permitir consultar historial de ganado. | Media |
| RF-45 | El `dueno` y el `encargado` deben poder registrar datos de ganado. | Media |
| RF-46 | El sistema debe exponer un endpoint de salud en `/api/health`. | Baja |
| RF-47 | El sistema debe permitir formular dietas con ingredientes, calculando materia seca, energia, proteina, fibra, costo y margen. | Alta |
| RF-48 | El sistema debe permitir simular una dieta variando el precio de los insumos y/o la produccion esperada, sin guardar los cambios. | Media |
| RF-49 | El sistema debe permitir cargar y actualizar el costo por kilo de cada insumo usado en dietas. | Alta |
| RF-50 | El sistema debe permitir cargar y actualizar los parametros nutricionales (materia seca, energia, proteina, fibra) de cada insumo. | Media |
| RF-51 | El sistema debe permitir crear, editar y desactivar (soft delete) dietas, disparando la verificacion de alertas correspondiente. | Alta |
| RF-52 | El sistema debe permitir registrar consumo diario por lote discriminado por turno (AM/PM) y porcentaje de sobra de comedero. | Media |
| RF-53 | El sistema debe permitir consultar el resumen de costos, costos por lote y costo diario. | Media |
| RF-54 | El sistema debe permitir exportar reportes de consumo mensual, costos mensuales, compras y stock. | Media |
| RF-55 | El sistema debe permitir gestionar proveedores y registrar compras asociadas. | Media |
| RF-56 | El sistema debe registrar y listar la actividad relevante del sistema (auditoria), permitiendo marcarla como leida o eliminarla segun el rol. | Media |
| RF-57 | El sistema debe permitir recuperar la password mediante un flujo de "olvide mi password" con token enviado por email. | Alta |
| RF-58 | El sistema debe permitir al `dueno` generar una invitacion (enlace/QR) para que un nuevo usuario se registre con un rol predefinido. | Media |
| RF-59 | El sistema debe soportar verificacion en dos pasos (2FA) durante el login cuando este habilitada para el usuario. | Media |
| RF-60 | El sistema debe bloquear temporalmente el inicio de sesion tras una cantidad de intentos fallidos consecutivos. | Alta |
| RF-61 | El sistema debe permitir a cualquier usuario autenticado editar su propio perfil (datos, password y foto). | Media |
| RF-62 | El sistema debe permitir subir y recortar una foto de perfil desde el navegador antes de enviarla al backend. | Baja |

## 6. Requisitos no funcionales

| ID | Requisito no funcional | Descripcion |
| --- | --- | --- |
| RNF-01 | Seguridad | El sistema debe proteger rutas privadas con JWT y validar permisos segun rol (`authorizeRoles`) en todas las rutas de backend. |
| RNF-02 | Proteccion de passwords | Las passwords deben almacenarse cifradas con bcrypt y no deben devolverse en respuestas de la API. |
| RNF-03 | Validacion de datos | La API debe validar campos requeridos, formatos y rangos numericos antes de guardar informacion. |
| RNF-04 | Integridad transaccional | Los movimientos que modifiquen stock, dietas y compras deben ejecutarse en transacciones para evitar inconsistencias. |
| RNF-05 | Trazabilidad | Los movimientos de carga, consumo y ajuste deben guardar usuario, fecha, hora y observaciones cuando existan; las acciones relevantes deben quedar en `logs_actividad`. |
| RNF-06 | Disponibilidad | El backend debe contar con un endpoint de salud (`/api/health`) y uno de metricas restringido a `dueno` (`/api/metrics`). |
| RNF-07 | Usabilidad | La interfaz debe estar en espanol, mostrar mensajes claros y permitir operar las funciones principales sin conocimiento tecnico. |
| RNF-08 | Responsividad | La interfaz debe adaptarse a escritorio y dispositivos moviles. |
| RNF-09 | Rendimiento | Las consultas principales deben responder de forma eficiente usando pool de conexiones, indices por `tambo_id` y filtros por fecha, lote o tipo cuando aplique. |
| RNF-10 | Mantenibilidad | El codigo debe mantenerse modular, separando rutas de backend, contexto de autenticacion, servicios API y paginas del frontend. |
| RNF-11 | Configurabilidad | Datos sensibles como credenciales de base de datos, puerto, secreto JWT y credenciales de envio de email deben manejarse mediante variables de entorno. |
| RNF-12 | Compatibilidad | El sistema debe funcionar en navegadores modernos y en un entorno Node.js con MySQL. |
| RNF-13 | Escalabilidad | La arquitectura multi-tambo (`tambo_id`) debe permitir alojar mas de un productor sin mezclar datos, y agregar nuevos modulos sin reescribir la base del sistema. |
| RNF-14 | Consistencia visual | Las pantallas deben mantener una linea grafica uniforme usando los estilos definidos y Bootstrap. |
| RNF-15 | Recuperacion ante errores | La API debe responder con mensajes de error controlados y evitar exponer detalles internos al usuario final. |
| RNF-16 | Proteccion contra fuerza bruta | El login debe limitar la tasa de intentos (rate limiting) y bloquear temporalmente la cuenta tras intentos fallidos consecutivos. |
| RNF-17 | Proteccion contra inyeccion de columnas | Las actualizaciones dinamicas (`UPDATE ... SET` construido en tiempo de ejecucion) deben filtrarse contra una lista explicita de columnas permitidas. |

## 7. Historias de usuario

| ID | Historia de usuario | Criterios de aceptacion |
| --- | --- | --- |
| HU-01 | Como usuario, quiero registrarme con mis datos personales para poder acceder al sistema. | Debe validar cedula, nombre y password; debe rechazar cedulas repetidas; debe redirigir al login al registrarse correctamente. |
| HU-02 | Como usuario, quiero iniciar sesion con mi cedula y password para acceder a las funciones privadas. | Debe aceptar credenciales validas; debe rechazar credenciales invalidas; debe guardar el token de sesion; debe pedir el segundo factor si esta habilitado. |
| HU-03 | Como usuario autenticado, quiero cerrar sesion para proteger mi cuenta cuando termino de usar el sistema. | Debe eliminar el token; debe volver a la pantalla de login; no debe permitir acceder a rutas protegidas sin sesion. |
| HU-04 | Como `dueno`, quiero administrar usuarios para controlar quienes pueden usar el sistema. | Debe listar usuarios; debe permitir editar datos y rol; debe permitir desactivar usuarios; debe permitir generar una invitacion por enlace o QR. |
| HU-05 | Como usuario, quiero consultar los alimentos por categoria para conocer el stock disponible. | Debe mostrar silo, bolson, fardo, sales y categorias personalizadas; debe mostrar stock actual, capacidad, porcentaje y dias restantes cuando existan datos. |
| HU-06 | Como `encargado`, quiero registrar ingresos de alimentos para mantener actualizado el stock. | Debe ingresar cantidad y comprobante; debe aumentar el stock; debe impedir superar la capacidad maxima. |
| HU-07 | Como usuario, quiero ver el historial de movimientos para auditar ingresos, consumos y ajustes de alimentos. | Debe mostrar tipo de movimiento, cantidad, fecha, hora, usuario y remito cuando exista; debe permitirse exportar. |
| HU-08 | Como usuario, quiero crear lotes de ganado para organizar los animales por grupo. | Debe guardar nombre, tipo de animal, objetivo productivo, etapa de lactancia, cantidad, consumo estimado y observaciones. |
| HU-09 | Como usuario, quiero editar o desactivar lotes para mantener actualizada la informacion del tambo. | Debe permitir modificar datos del lote; debe ocultar lotes desactivados del listado principal. |
| HU-10 | Como usuario, quiero ver los insumos requeridos por lote para conocer la alimentacion planificada. | Debe mostrar insumo, unidad y cantidad requerida cuando existan asociaciones. |
| HU-11 | Como `trabajador`, quiero registrar consumos por lote para dejar constancia de la alimentacion diaria. | Debe seleccionar lote e insumo; debe ingresar cantidad; debe descontar stock y guardar el consumo. |
| HU-12 | Como `trabajador`, quiero que el sistema impida consumos superiores al stock para evitar datos incorrectos. | Debe validar stock disponible antes de confirmar; debe mostrar un mensaje de stock insuficiente. |
| HU-13 | Como usuario, quiero consultar los ultimos consumos para revisar movimientos recientes. | Debe listar lote, insumo, cantidad, fecha y usuario responsable. |
| HU-14 | Como `dueno` o `encargado`, quiero registrar datos de ganado para mantener actualizado el estado del rodeo. | Debe guardar total de vacas, vacas lecheras, vacas secas, terneros, fecha y usuario. |
| HU-15 | Como usuario, quiero consultar alertas de stock para detectar insumos que requieren atencion. | Debe listar alertas; debe permitir marcarlas como leidas; debe diferenciar alertas no leidas. |
| HU-16 | Como `dueno`, quiero eliminar alertas obsoletas para mantener limpia la bandeja de alertas. | Debe permitir eliminar solo si el usuario tiene rol `dueno`. |
| HU-17 | Como `encargado`, quiero formular una dieta balanceada para un lote para saber cuanto cuesta y que margen deja. | Debe calcular materia seca, energia, proteina, fibra, costo y margen a partir de los ingredientes cargados. |
| HU-18 | Como `encargado`, quiero simular una dieta con variaciones de precio o produccion para anticipar escenarios sin guardar cambios. | Debe recalcular costo y margen con los parametros de variacion sin persistir la dieta. |
| HU-19 | Como `dueno`, quiero consultar los costos por lote y por periodo para tomar decisiones economicas. | Debe mostrar resumen de costos, desglose por lote y evolucion diaria; debe permitir exportar. |
| HU-20 | Como `dueno`, quiero registrar compras y proveedores para llevar el control de las adquisiciones del tambo. | Debe permitir crear/editar proveedores; debe permitir registrar, editar y eliminar compras. |
| HU-21 | Como `dueno`, quiero ver un registro de actividad del sistema para auditar que se hizo, quien y cuando. | Debe listar eventos con fecha y usuario; debe permitir marcarlos como leidos o eliminarlos. |
| HU-22 | Como usuario, quiero recuperar mi password si la olvido para no perder el acceso a mi cuenta. | Debe enviar un email con un enlace/token temporal; debe permitir definir una nueva password valida con ese token. |
| HU-23 | Como cualquier usuario, quiero editar mi perfil y subir una foto para personalizar mi cuenta. | Debe permitir actualizar datos propios y password; debe permitir subir y recortar una foto antes de guardarla. |
| HU-24 | Como visitante no autenticado, quiero ver una pagina de inicio informativa antes de iniciar sesion. | Debe mostrarse en `/` cuando no hay sesion activa; debe redirigir a la pantalla operativa correspondiente si ya hay sesion. |

## 8. Casos de uso

### CU-01: Iniciar sesion

| Campo | Detalle |
| --- | --- |
| Actor principal | `trabajador`, `encargado` o `dueno` |
| Objetivo | Acceder al sistema mediante credenciales validas. |
| Precondiciones | El usuario debe existir, estar activo y no estar bloqueado por intentos fallidos. |
| Flujo principal | 1. El actor ingresa cedula y password. 2. El sistema valida los datos. 3. El sistema compara la password cifrada. 4. Si el usuario tiene 2FA habilitado, el sistema solicita el codigo de verificacion (`verify-2fa`). 5. El sistema genera un JWT. 6. El frontend guarda el token y redirige segun el rol (`/consumos` para `trabajador`, `/dashboard` para el resto). |
| Flujo alternativo | Si las credenciales son invalidas, el sistema muestra un mensaje de error y suma un intento fallido; tras varios intentos, bloquea temporalmente la cuenta. |
| Postcondiciones | El usuario queda autenticado y puede acceder a rutas protegidas segun su rol. |

### CU-02: Registrar usuario

| Campo | Detalle |
| --- | --- |
| Actor principal | Usuario nuevo (por registro abierto o por invitacion) |
| Objetivo | Crear una cuenta en Sicodiet. |
| Precondiciones | La cedula no debe estar registrada previamente; si viene de invitacion, el token debe ser valido. |
| Flujo principal | 1. El actor completa nombre, apellido, rol, cedula, email, telefono y password (o abre el enlace/QR de invitacion, que valida el token y precarga el rol). 2. El sistema valida que las passwords coincidan en frontend. 3. La API valida campos requeridos. 4. La API cifra la password. 5. La API guarda el usuario. 6. El frontend redirige al login. |
| Flujo alternativo | Si la cedula ya existe, los datos no son validos o el token de invitacion vencio, se muestra un error. |
| Postcondiciones | El usuario queda registrado en estado activo. |

### CU-03: Gestionar alimentos/insumos

| Campo | Detalle |
| --- | --- |
| Actor principal | `dueno` o `encargado` |
| Objetivo | Crear, consultar, modificar o desactivar alimentos del sistema. |
| Precondiciones | El actor debe haber iniciado sesion. |
| Flujo principal | 1. El actor ingresa a la pantalla Alimentos. 2. Selecciona una categoria. 3. El sistema lista insumos activos. 4. El actor crea o edita un insumo. 5. El sistema valida los datos y guarda los cambios. |
| Flujo alternativo | Si faltan datos o los valores no son validos, la API responde con error. |
| Postcondiciones | El listado de insumos queda actualizado. |

### CU-04: Registrar ingreso de alimento

| Campo | Detalle |
| --- | --- |
| Actor principal | `dueno` o `encargado` |
| Objetivo | Registrar una carga o ingreso de alimento y actualizar stock. |
| Precondiciones | Debe existir el insumo. El usuario debe estar autenticado. |
| Flujo principal | 1. El actor abre un insumo. 2. Ingresa cantidad, comprobante y observaciones. 3. El sistema calcula el nuevo stock. 4. El sistema valida que no supere la capacidad maxima. 5. El sistema actualiza stock dentro de una transaccion. 6. El sistema guarda historial de carga y movimiento de stock. 7. El sistema verifica y genera alertas si corresponde. |
| Flujo alternativo | Si el nuevo stock supera la capacidad maxima, el sistema rechaza la operacion. |
| Postcondiciones | El stock aumenta y el movimiento queda trazado. |

### CU-05: Gestionar lotes

| Campo | Detalle |
| --- | --- |
| Actor principal | `dueno` o `encargado` |
| Objetivo | Administrar los lotes de ganado. |
| Precondiciones | El actor debe estar autenticado. |
| Flujo principal | 1. El actor ingresa a Lotes. 2. El sistema muestra lotes activos. 3. El actor crea, edita o desactiva un lote. 4. El sistema valida y guarda los datos. |
| Flujo alternativo | Si los valores no son validos, el sistema informa el error. |
| Postcondiciones | Los lotes activos quedan actualizados. |

### CU-06: Asociar insumos requeridos a lote

| Campo | Detalle |
| --- | --- |
| Actor principal | `dueno` o `encargado` |
| Objetivo | Definir que insumos requiere un lote y en que cantidad. |
| Precondiciones | Deben existir lote e insumo. |
| Flujo principal | 1. El actor selecciona lote e insumo. 2. Ingresa cantidad requerida. 3. El sistema guarda la asociacion en `lote_insumos`. 4. El sistema muestra los insumos requeridos al consultar el lote. |
| Flujo alternativo | Si falta lote, insumo o cantidad, el sistema rechaza la solicitud. |
| Postcondiciones | El lote queda vinculado al insumo requerido. |

### CU-07: Registrar consumo

| Campo | Detalle |
| --- | --- |
| Actor principal | `trabajador`, `encargado` o `dueno` |
| Objetivo | Registrar alimento consumido por un lote. |
| Precondiciones | Deben existir lote e insumo con stock suficiente. |
| Flujo principal | 1. El actor ingresa a Consumos. 2. Selecciona lote e insumo. 3. Ingresa cantidad y observaciones. 4. El sistema verifica stock. 5. El sistema descuenta stock dentro de una transaccion. 6. El sistema guarda el consumo y el movimiento de stock. 7. El sistema verifica y genera alertas si corresponde. 8. El sistema actualiza el historial mostrado. |
| Flujo alternativo | Si no hay stock suficiente, se cancela la operacion y se informa el stock actual. |
| Postcondiciones | El consumo queda registrado y el stock disminuye. |

### CU-08: Consultar historial de consumos y movimientos

| Campo | Detalle |
| --- | --- |
| Actor principal | Usuario autenticado |
| Objetivo | Revisar consumos y movimientos de stock registrados. |
| Precondiciones | Deben existir consumos o movimientos registrados. |
| Flujo principal | 1. El actor ingresa a Consumos o a Historial. 2. El sistema consulta la API. 3. El sistema muestra los movimientos con lote/insumo, cantidad, tipo, fecha y usuario, con opcion de exportar. |
| Flujo alternativo | Si no existen registros, se muestra el mensaje `Sin registros`. |
| Postcondiciones | El actor visualiza el historial disponible. |

### CU-09: Gestionar alertas

| Campo | Detalle |
| --- | --- |
| Actor principal | Usuario autenticado o `dueno` |
| Objetivo | Consultar y gestionar alertas del sistema. |
| Precondiciones | El actor debe estar autenticado. |
| Flujo principal | 1. El actor consulta alertas. 2. El sistema lista alertas con insumo asociado. 3. El actor marca una alerta como leida o marca todas. 4. El sistema actualiza el estado. |
| Flujo alternativo | Si el actor `dueno` elimina una alerta, el sistema la borra de la base. |
| Postcondiciones | Las alertas quedan actualizadas segun la accion realizada. |

### CU-10: Registrar datos de ganado

| Campo | Detalle |
| --- | --- |
| Actor principal | `dueno` o `encargado` |
| Objetivo | Registrar estado del ganado del tambo. |
| Precondiciones | El actor debe tener rol `dueno` o `encargado`. |
| Flujo principal | 1. El actor informa total de vacas, vacas lecheras, vacas secas y terneros. 2. El sistema valida valores enteros no negativos. 3. El sistema guarda el registro con fecha actual y usuario. |
| Flujo alternativo | Si el actor no tiene permiso, la API responde 403. |
| Postcondiciones | Queda disponible el ultimo registro y el historial de ganado. |

### CU-11: Formular y simular una dieta

| Campo | Detalle |
| --- | --- |
| Actor principal | `dueno` o `encargado` |
| Objetivo | Armar una dieta a partir de insumos, conocer su costo/margen y evaluar escenarios antes de guardarla. |
| Precondiciones | Deben existir insumos con costo por kilo y parametros nutricionales cargados. |
| Flujo principal | 1. El actor selecciona los insumos y cantidades de la dieta. 2. El sistema calcula materia seca, energia, proteina, fibra, costo y margen (`POST /api/dietas/calcular`). 3. Opcionalmente el actor ajusta variacion de precio y/o de produccion para simular escenarios. 4. El actor guarda la dieta. 5. El sistema la persiste en transaccion (`dietas` + `dieta_ingredientes`) y verifica alertas. |
| Flujo alternativo | Si faltan parametros nutricionales o costos de algun insumo, el calculo los omite o el sistema advierte datos incompletos. |
| Postcondiciones | La dieta queda disponible para consulta, edicion o baja logica. |

### CU-12: Analizar costos y registrar compras

| Campo | Detalle |
| --- | --- |
| Actor principal | `dueno` o `encargado` |
| Objetivo | Conocer el costo de alimentacion por lote/periodo y registrar las compras que lo generan. |
| Precondiciones | Deben existir consumos, dietas y/o compras registradas. |
| Flujo principal | 1. El actor consulta Costos (resumen, por lote, diario). 2. El actor registra proveedores y compras en Compras. 3. El sistema guarda la informacion y la deja disponible para reportes y exportacion. |
| Flujo alternativo | Si los datos de la compra son invalidos, el sistema rechaza la operacion. |
| Postcondiciones | Los costos y compras quedan disponibles para consulta y exportacion (CSV/PDF). |

### CU-13: Recuperar password

| Campo | Detalle |
| --- | --- |
| Actor principal | Usuario registrado |
| Objetivo | Recuperar el acceso a la cuenta cuando se olvido la password. |
| Precondiciones | El usuario debe existir y tener un email valido cargado. |
| Flujo principal | 1. El actor solicita recuperacion con su email (`POST /api/auth/forgot-password`). 2. El sistema genera un token temporal y lo envia por email. 3. El actor abre el enlace e ingresa una nueva password (`POST /api/auth/reset-password`). 4. El sistema valida el token y actualiza la password cifrada. |
| Flujo alternativo | Si el token vencio o es invalido, el sistema rechaza el cambio. |
| Postcondiciones | El usuario puede iniciar sesion con la nueva password. |

## 9. Modelo de datos

### 9.1 Nota sobre el esquema vigente

El esquema real de la base de datos resulta de ejecutar `backend/database.sql` **y luego** las 20 migraciones de `backend/database/migrations/` (`001_add_password_reset_tokens.sql` a `020_add_foto_usuarios.sql`) en orden. Varias migraciones ya estan incorporadas directamente en `database.sql` (tambos/`tambo_id`, roles renombrados, turnos AM/PM, objetivo productivo, `dias_restantes_origen`, etc.), pero otras todavia no (ver seccion 16, OBS-07): `password_reset_tokens`, `proveedores`/`compras`, `invitaciones`, `categoria` y `peso_unidad` en `insumos`, `etapa_lactancia` en `lotes`, bloqueo por intentos fallidos, `token_version`, campos de 2FA y `foto` en `usuarios`. Al instalar de cero hay que ejecutar ambos.

### 9.2 Tablas

| Tabla | Proposito |
| --- | --- |
| `tambos` | Raiz multi-tenant: cada tambo/productor que usa el sistema. |
| `usuarios` | Usuarios, credenciales cifradas, rol (`dueno`/`encargado`/`trabajador`), estado activo, ultimo acceso, foto de perfil, bloqueo por intentos fallidos y datos de 2FA. |
| `insumos` | Alimentos/insumos: tipo, categoria, unidad, peso por unidad, capacidad, stock actual, stock minimo y origen del calculo de dias restantes. |
| `lotes` | Grupos de animales: tipo, objetivo productivo (leche/engorde), etapa de lactancia, cantidad y consumo estimado diario. |
| `consumos` | Consumos de insumos por lote, usuario, fecha y hora. |
| `consumo_diario` | Movimientos diarios de consumo, ingreso y ajustes (uso historico, en convivencia con `movimientos_stock`). |
| `movimientos_stock` | Ledger unificado de movimientos de stock (ingreso/consumo/ajuste), con turno y usuario. |
| `ganado` | Registros historicos del estado del ganado. |
| `alertas` | Alertas de stock u otros eventos relevantes, generadas automaticamente tras cambios de stock o dietas. |
| `logs_actividad` | Auditoria general de acciones relevantes, con flag `leida`. |
| `historial_cargas_alimentos` | Ingresos de alimentos con comprobante y usuario responsable. |
| `lote_insumos` | Relaciona lotes con insumos requeridos y cantidad necesaria. |
| `costos_ingredientes` | Costo por kilo de cada insumo, usado en el calculo de dietas. |
| `parametros_nutricionales` | Materia seca, energia, proteina y fibra por insumo. |
| `dietas` | Cabecera de dieta formulada: costo, margen, ganancia esperada, precio del kilo en pie, distribucion AM/PM. |
| `dieta_ingredientes` | Lineas de ingredientes de cada dieta con cantidad y aporte nutricional. |
| `registro_diario_animales` | Registro diario a nivel animal/lote. |
| `consumo_diario_lote` | Consumo diario por lote, discriminado por turno (AM/PM) y porcentaje de sobra de comedero. |
| `proveedores` (migracion 009) | Proveedores usados en el modulo de Compras. |
| `compras` (migracion 009) | Compras registradas, asociadas a proveedor e insumo. |
| `invitaciones` (migracion 010) | Invitaciones por enlace/QR generadas por el `dueno` para altas de usuario. |
| `password_reset_tokens` (migracion 001) | Tokens temporales para el flujo de recuperacion de password. |

## 10. Endpoints principales de la API

### Autenticacion (`backend/src/routes/auth.js`, `passwordReset.js`)

| Metodo | Ruta | Descripcion |
| --- | --- | --- |
| POST | `/api/auth/register` | Registra un usuario. |
| GET | `/api/auth/invitacion/:token` | Valida un token de invitacion y devuelve los datos precargados (rol, tambo). |
| POST | `/api/auth/login` | Inicia sesion; si el usuario tiene 2FA activo, exige un paso adicional. |
| POST | `/api/auth/verify-2fa` | Verifica el codigo de doble factor y emite el JWT. |
| GET | `/api/auth/me` | Devuelve datos del usuario autenticado. |
| PUT | `/api/auth/profile` | Actualiza el perfil propio (datos, password, foto). |
| POST | `/api/auth/forgot-password` | Genera y envia por email un token de recuperacion de password. |
| POST | `/api/auth/reset-password` | Establece una nueva password a partir de un token valido. |

### Usuarios (`usuarios.js`) — requiere rol `dueno`

| Metodo | Ruta | Descripcion |
| --- | --- | --- |
| GET | `/api/usuarios` | Lista usuarios. |
| GET | `/api/usuarios/:id` | Obtiene un usuario. |
| PUT | `/api/usuarios/:id` | Actualiza datos de usuario. |
| PUT | `/api/usuarios/:id/password` | Actualiza password. |
| DELETE | `/api/usuarios/:id` | Desactiva usuario. |
| POST | `/api/usuarios/invitacion` | Genera una invitacion (enlace/QR) para un nuevo usuario con rol predefinido. |

### Insumos (`insumos.js`)

| Metodo | Ruta | Descripcion |
| --- | --- | --- |
| GET | `/api/insumos` | Lista insumos activos. Acepta filtro `tipo`/categoria. |
| GET | `/api/insumos/:id` | Obtiene detalle de un insumo. |
| POST | `/api/insumos` | Crea un insumo. |
| PUT | `/api/insumos/:id` | Actualiza un insumo. |
| POST | `/api/insumos/:id/cargar` | Registra ingreso de alimento y actualiza stock. |
| DELETE | `/api/insumos/:id` | Desactiva un insumo. |

### Lotes (`lotes.js`)

| Metodo | Ruta | Descripcion |
| --- | --- | --- |
| GET | `/api/lotes` | Lista lotes activos con insumos requeridos. |
| GET | `/api/lotes/:id` | Obtiene detalle de un lote. |
| POST | `/api/lotes` | Crea un lote. |
| PUT | `/api/lotes/:id` | Actualiza un lote. |
| POST | `/api/lotes/:id/insumos` | Asocia un insumo requerido al lote. |
| DELETE | `/api/lotes/:id/insumos/:insumoId` | Desvincula un insumo requerido del lote. |
| DELETE | `/api/lotes/:id` | Desactiva un lote. |

### Consumos (`consumos.js`)

| Metodo | Ruta | Descripcion |
| --- | --- | --- |
| GET | `/api/consumos` | Lista consumos. Acepta filtros `fecha` y `lote_id`. |
| POST | `/api/consumos` | Registra consumo y descuenta stock. |
| GET | `/api/consumos/historial` | Lista historial de cargas de alimentos con filtros. |

### Movimientos de stock (`movimientos.js`) — `dueno`/`encargado`

| Metodo | Ruta | Descripcion |
| --- | --- | --- |
| GET | `/api/movimientos` | Lista movimientos de stock (ingreso/consumo/ajuste). |
| GET | `/api/movimientos/resumen` | Resumen agregado de movimientos. |
| GET | `/api/movimientos/export` | Exporta movimientos (CSV). |
| GET | `/api/movimientos/historial-insumo` | Historial de movimientos filtrado por insumo. |

### Dietas (`dietas.js`) — `dueno`/`encargado`

| Metodo | Ruta | Descripcion |
| --- | --- | --- |
| GET | `/api/dietas` | Lista dietas activas del tambo. |
| POST | `/api/dietas/calcular` | Calcula costo, margen y aporte nutricional de una dieta borrador, con soporte de simulacion (`variacion_precio`, `variacion_produccion`) sin guardar. |
| GET | `/api/dietas/costos` | Lista costos por kilo de los insumos (`costos_ingredientes`). |
| PUT | `/api/dietas/costos/:insumoId` | Crea o actualiza el costo por kilo de un insumo. |
| GET | `/api/dietas/parametros/:insumoId` | Obtiene los parametros nutricionales de un insumo. |
| PUT | `/api/dietas/parametros/:insumoId` | Crea o actualiza los parametros nutricionales de un insumo. |
| GET | `/api/dietas/:id` | Obtiene el detalle de una dieta con sus ingredientes. |
| POST | `/api/dietas` | Crea una dieta (transaccional) y dispara la verificacion de alertas. |
| PUT | `/api/dietas/:id` | Actualiza una dieta (transaccional). |
| DELETE | `/api/dietas/:id` | Desactiva una dieta (soft delete). |

### Costos (`costos.js`) — `dueno`/`encargado`

| Metodo | Ruta | Descripcion |
| --- | --- | --- |
| GET | `/api/costos/resumen` | Resumen general de costos. |
| GET | `/api/costos/por-lote` | Desglose de costos por lote. |
| GET | `/api/costos/diario` | Evolucion diaria de costos (usada por el Dashboard). |

### Compras (`compras.js`) — `dueno`/`encargado`

| Metodo | Ruta | Descripcion |
| --- | --- | --- |
| GET | `/api/compras/proveedores` | Lista proveedores. |
| POST | `/api/compras/proveedores` | Crea un proveedor. |
| PUT | `/api/compras/proveedores/:id` | Actualiza un proveedor. |
| GET | `/api/compras` | Lista compras. |
| POST | `/api/compras` | Registra una compra. |
| PUT | `/api/compras/:id` | Actualiza una compra. |
| DELETE | `/api/compras/:id` | Elimina/anula una compra. |

### Reportes (`reportes.js`) — `dueno`/`encargado`

| Metodo | Ruta | Descripcion |
| --- | --- | --- |
| GET | `/api/reportes/consumo-mensual` | Reporte de consumo mensual. |
| GET | `/api/reportes/costos-mensual` | Reporte de costos mensuales. |
| GET | `/api/reportes/compras` | Reporte de compras. |
| GET | `/api/reportes/stock` | Reporte de stock. |

### Actividad (`actividades.js`) — `dueno`/`encargado`

| Metodo | Ruta | Descripcion |
| --- | --- | --- |
| GET | `/api/actividades` | Lista el registro de actividad/auditoria. |
| PATCH | `/api/actividades/:id/leida` | Marca una actividad como leida. |
| DELETE | `/api/actividades/:id` | Elimina un registro de actividad. |

### Ganado (`ganado.js`)

| Metodo | Ruta | Descripcion |
| --- | --- | --- |
| GET | `/api/ganado` | Obtiene ultimo registro de ganado. |
| GET | `/api/ganado/historial` | Obtiene ultimos registros historicos. |
| POST | `/api/ganado` | Crea registro de ganado. Requiere `dueno` u `encargado`. |

### Alertas (`alertas.js`)

| Metodo | Ruta | Descripcion |
| --- | --- | --- |
| GET | `/api/alertas` | Lista alertas. Acepta filtro `leidas`. |
| PUT | `/api/alertas/:id/leer` | Marca una alerta como leida. |
| PUT | `/api/alertas/leer-todas` | Marca todas las alertas como leidas. |
| DELETE | `/api/alertas/:id` | Elimina una alerta. Requiere `dueno`. |

### Sistema

| Metodo | Ruta | Descripcion |
| --- | --- | --- |
| GET | `/api/health` | Verifica que la API este activa. |
| GET | `/api/metrics` | Metricas basicas del proceso (uptime, memoria, version de Node). Requiere `dueno`. |

## 11. Arquitectura tecnica

### Frontend

El frontend se encuentra en `frontend/`.

Paginas (`src/pages/`):

| Archivo | Funcion |
| --- | --- |
| `Landing.jsx` | Pagina publica de aterrizaje, mostrada en `/` cuando no hay sesion. |
| `Login.jsx` | Pantalla de inicio de sesion (incluye paso de 2FA cuando corresponde). |
| `Register.jsx` | Pantalla de registro (soporta flujo de invitacion). |
| `ForgotPassword.jsx` / `ResetPassword.jsx` | Flujo de recuperacion de password. |
| `PrivacyPolicy.jsx` | Politica de privacidad. |
| `Dashboard.jsx` | Pantalla principal con KPIs, sparklines, distribucion por categoria y consumo semanal. Ruta indice de `Layout`, oculta para `trabajador`. |
| `Silos.jsx` | Pantalla de alimentos/stock, por categoria, e historial de cargas. |
| `Lotes.jsx` | Pantalla de lotes de ganado. |
| `Dietas.jsx` | Formulacion de dietas, analisis de costo/margen y simulador de escenarios. |
| `Consumos.jsx` | Registro e historial de consumos. Unica pantalla operativa (junto con Alertas y Perfil) accesible por `trabajador`. |
| `Historial.jsx` | Historial de movimientos de stock con filtros. |
| `Costos.jsx` | Analisis de costos por lote/periodo, con exportacion CSV/PDF. |
| `Compras.jsx` | Gestion de proveedores y compras, con exportacion CSV/PDF. |
| `Actividades.jsx` | Registro de actividad/auditoria del sistema. |
| `Alertas.jsx` | Pantalla dedicada de alertas de stock. |
| `Ganado.jsx` | Registro y consulta del estado del rodeo. |
| `Usuarios.jsx` | Administracion de usuarios, incluye invitacion por enlace/QR. |
| `Profile.jsx` | Perfil autoservicio: datos propios, password y foto de perfil. |

Componentes y utilidades relevantes (`src/components/`, `src/utils/`):

| Archivo | Funcion |
| --- | --- |
| `main.jsx` | Punto de entrada de React. |
| `App.jsx` | Define rutas activas (`RootRoute`, `ProtectedRoute`, `DuenoEncargadoRoute`, `DuenoRoute`) segun rol. |
| `context/AuthContext.jsx` | Maneja sesion, login, registro, logout y carga del usuario actual. |
| `services/api.js` | Configura Axios, agrega token JWT y maneja errores 401. |
| `components/Layout.jsx` | Layout principal con sidebar de navegacion, filtrado por rol (secciones General, Alimentos, Operaciones, Sistema). |
| `components/ProtectedRoute.jsx` | Componente reutilizable de proteccion de ruta por rol (`allowedRoles`), usado como base de los guards de `App.jsx`. |
| `components/PhoneInputField.jsx`, `PasswordRulesHint.jsx` | Controles de formulario reutilizados en registro/perfil/usuarios. |
| `components/SiloGauge.jsx`, `SiloIllustration.jsx`, `KpiSparkline.jsx`, `CategoriaDonutChart.jsx`, `ConsumoSemanalChart.jsx` | Componentes de visualizacion usados en Silos y Dashboard. |
| `utils/resizeImage.js` | `resizeImageToDataUrl(file, opciones)`: recorta a cuadrado y comprime en el navegador una foto (camara o archivo) a JPEG en `data URL`, usada por `Profile.jsx` antes de enviarla al backend. |
| `utils/reportes.js` | Helpers de exportacion/formato usados por las pantallas de reportes (Costos, Compras, Historial). |

### Backend

El backend se encuentra en `backend/`.

| Archivo | Funcion |
| --- | --- |
| `src/server.js` | Configura Express, seguridad (helmet, CORS, rate limiting), monta todas las rutas, sirve el build del frontend y expone `/api/health` y `/api/metrics`. |
| `src/config/database.js` | Configura pool de conexion MySQL. |
| `src/middleware/auth.js` | Exporta `authenticateToken` y `authorizeRoles(...roles)`, usados en (casi) todas las rutas privadas. |
| `src/routes/auth.js` | Registro, invitacion, login, 2FA, perfil propio y consulta de usuario autenticado. |
| `src/routes/passwordReset.js` | Recuperacion de password (`forgot-password` / `reset-password`). |
| `src/routes/usuarios.js` | Administracion de usuarios e invitaciones. Requiere `dueno`. |
| `src/routes/insumos.js` | Gestion de insumos y cargas de alimentos. |
| `src/routes/lotes.js` | Gestion de lotes e insumos requeridos. |
| `src/routes/consumos.js` | Registro y consulta de consumos e historial de cargas. |
| `src/routes/movimientos.js` | Ledger de movimientos de stock, resumen y exportacion. |
| `src/routes/dietas.js` | Formulacion, calculo/simulacion, costos y parametros nutricionales de dietas. |
| `src/routes/costos.js` | Analisis de costos (resumen, por lote, diario). |
| `src/routes/compras.js` | Proveedores y compras. |
| `src/routes/reportes.js` | Reportes de consumo, costos, compras y stock. |
| `src/routes/actividades.js` | Registro de actividad/auditoria. |
| `src/routes/ganado.js` | Registro y consulta de ganado. |
| `src/routes/alertas.js` | Consulta y gestion de alertas. |
| `src/utils/alertas.js` | `verificarYGenerarAlertas`, invocada tras cargas, consumos y cambios en dietas. |
| `src/utils/queryBuilder.js` | `buildUpdateSet(fields)`: arma el `SET` de un `UPDATE` dinamico validando cada columna contra una lista blanca (`COLUMNAS_PERMITIDAS`), evitando inyeccion de columnas desde el request. Usado por las rutas con actualizaciones parciales (usuarios, insumos, lotes, compras). |
| `src/scripts/initDb.js` | Inicializacion no bloqueante de la base al arrancar el servidor. |

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
| RN-08 | Los registros eliminados de usuarios, insumos y lotes se desactivan logicamente (soft delete), nunca se borran fisicamente. |
| RN-09 | Las operaciones de stock deben registrar fecha y hora del movimiento. |
| RN-10 | El registro de ganado solo puede crearse por usuarios con rol `dueno` o `encargado`. |
| RN-11 | La eliminacion de alertas, usuarios y actividad solo puede realizarla un usuario con rol `dueno`. |
| RN-12 | El rol `trabajador` solo puede operar Consumos, Alertas y Perfil; cualquier otra ruta privada lo redirige. |
| RN-13 | Toda tabla operativa pertenece a un `tambo_id`; las consultas deben acotarse al tambo del usuario autenticado. |
| RN-14 | Las actualizaciones dinamicas de campos deben construirse contra una lista explicita de columnas permitidas (`buildUpdateSet`). |
| RN-15 | Tras N intentos de login fallidos consecutivos, la cuenta se bloquea temporalmente (`bloqueado_hasta`). |
| RN-16 | Los tokens de recuperacion de password y de invitacion tienen vencimiento y son de un solo uso. |
| RN-17 | La creacion, edicion y baja de dietas debe ejecutarse en transaccion y disparar la verificacion de alertas de stock. |

## 13. Ejecución local sin Docker

### Requisitos

- Node.js instalado
- MySQL local accesible en `localhost:3306`

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

## 14. Instalación y ejecución local (sin Docker)

### Base de datos

1. Crear la base y tablas ejecutando el script `backend/database.sql` en MySQL.
2. Aplicar en orden todas las migraciones de `backend/database/migrations/` (`001_add_password_reset_tokens.sql` hasta `020_add_foto_usuarios.sql`) — ver seccion 9.1, varias funcionalidades (recuperacion de password, invitaciones, compras, foto de perfil, bloqueo por intentos fallidos, 2FA) dependen de columnas y tablas que solo existen tras aplicarlas.
3. Confirmar que exista la base `gestion_tambo`.
4. El script incluye datos iniciales de usuario administrador (`dueno`), insumos, ganado, lotes y relaciones lote-insumo.

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

## 15. Flujo operativo recomendado

1. El usuario inicia sesion (con 2FA si esta habilitado).
2. Consulta el Dashboard para una vista general (KPIs, stock, consumo semanal) — no disponible para `trabajador`.
3. Consulta alimentos por categoria en Alimentos.
4. Crea o actualiza insumos si corresponde.
5. Registra ingresos de alimentos cuando llegan cargas o remitos.
6. Crea lotes de ganado segun la organizacion del tambo.
7. Formula dietas balanceadas por lote y revisa su costo/margen en Dietas.
8. Registra consumos diarios indicando lote, insumo y cantidad.
9. Revisa historiales de movimientos y consumos en Historial y Consumos.
10. Registra compras y consulta costos en Compras y Costos.
11. Consulta alertas y datos de ganado.
12. Revisa el registro de actividad para auditoria (`dueno`/`encargado`).

## 16. Observaciones tecnicas y mejoras sugeridas

| ID | Observacion | Estado |
| --- | --- | --- |
| OBS-01 | `Dashboard.jsx` no estaba conectado en las rutas activas de `App.jsx`. | **Resuelto** — es ahora la ruta indice `/dashboard` dentro de `Layout`. |
| OBS-02 | Existian `Header.jsx` y `ProtectedRoute.jsx` duplicados respecto al `ProtectedRoute` interno de `App.jsx`. | **Resuelto** — no existe `Header.jsx`; `Layout.jsx` centraliza la navegacion y `App.jsx` reutiliza `components/ProtectedRoute.jsx` como base de sus guards por rol. |
| OBS-03 | `utils/alertas.js` no se invocaba desde consumos o cargas. | **Resuelto** — `verificarYGenerarAlertas` se invoca tras cargas, consumos y cambios en dietas. |
| OBS-04 | Faltaban pantallas completas para usuarios, ganado y alertas. | **Resuelto** — `Usuarios.jsx`, `Ganado.jsx` y `Alertas.jsx` existen y estan ruteadas. |
| OBS-05 | `logs_actividad` existia sin uso activo. | **Resuelto** — `actividades.js` + `Actividades.jsx` la usan, con flag `leida`. |
| OBS-06 | Algunas rutas de insumos y lotes importaban `authorizeRoles` sin aplicarlo. | **Resuelto** — todas las rutas privadas (salvo `passwordReset.js`, publica por diseño) aplican `authorizeRoles` de forma consistente. |
| OBS-07 | `backend/database.sql` y `backend/database/migrations/` estan parcialmente desincronizados: algunas migraciones ya fueron incorporadas al script base y otras (password reset, compras, invitaciones, foto de perfil, bloqueo de login, 2FA, `token_version`) solo existen como migracion suelta. | **Abierto** — instalar de cero requiere ejecutar ambos (ver seccion 9.1 y 14); convendria consolidar `database.sql` o documentar un script unico de bootstrap. |
| OBS-08 | Las tablas `consumo_diario` y `movimientos_stock` conviven con proposito solapado (ambas registran movimientos diarios). | **Abierto** — evaluar si `consumo_diario` puede deprecarse en favor del ledger unificado `movimientos_stock`. |
| OBS-09 | Cada archivo de rutas define su propio wrapper local de `authorizeRoles('dueno','encargado')` (p.ej. `duenoEncargado`, `soloDueno`) en lugar de un helper centralizado. | **Abierto** — duplicacion menor, no afecta el comportamiento; se podria extraer a `middleware/auth.js`. |
| OBS-10 | Frontend sin tests automatizados. | **Abierto** — a añadir (ver roadmap de testing). |

## 17. Criterios generales de aceptacion del sistema

| ID | Criterio |
| --- | --- |
| CA-01 | Un usuario no autenticado no debe acceder a pantallas privadas. |
| CA-02 | Un login valido debe permitir acceder a las pantallas habilitadas para el rol del usuario (`trabajador`: Consumos/Alertas/Perfil; `encargado`/`dueno`: todas menos Usuarios, que es exclusiva de `dueno`). |
| CA-03 | Al registrar un ingreso, el stock debe aumentar y quedar reflejado en el listado y en el historial de movimientos. |
| CA-04 | Al registrar un consumo, el stock debe disminuir y el consumo debe aparecer en el historial. |
| CA-05 | El sistema no debe permitir que el stock supere la capacidad maxima. |
| CA-06 | El sistema no debe permitir consumos mayores al stock disponible. |
| CA-07 | Los historiales deben mostrar fecha, hora, usuario y cantidad cuando los datos existan. |
| CA-08 | Las operaciones protegidas por rol deben rechazar usuarios sin permiso (403). |
| CA-09 | La interfaz debe mostrar mensajes claros de exito o error. |
| CA-10 | La base de datos debe conservar relaciones entre usuarios, lotes, insumos, consumos, cargas, dietas y compras. |
| CA-11 | Al calcular o guardar una dieta, el costo y margen mostrados deben reflejar los costos por kilo y parametros nutricionales vigentes de cada insumo. |
| CA-12 | Tras varios intentos de login fallidos, el sistema debe bloquear temporalmente la cuenta e informarlo claramente. |
| CA-13 | Un enlace de recuperacion de password o de invitacion vencido o ya usado no debe permitir completar la accion. |

## 18. Glosario

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
| Movimiento de stock | Registro unificado de un cambio de stock: ingreso, consumo o ajuste. |
| Stock minimo | Umbral a partir del cual se debe prestar atencion al nivel disponible. |
| JWT | Token utilizado para autenticar peticiones a la API. |
| Tambo | Establecimiento productor (unidad multi-tenant del sistema). |
| Dueno | Rol con permisos completos, incluida la gestion de usuarios. |
| Encargado | Rol con permisos operativos amplios, sin gestion de usuarios. |
| Trabajador | Rol restringido a registrar consumos, ver alertas y su propio perfil. |
| Dieta | Formulacion de ingredientes con calculo de costo, margen y aporte nutricional para un lote. |
| Invitacion | Enlace o QR generado por el `dueno` para que un nuevo usuario se registre con un rol predefinido. |
| 2FA | Verificacion en dos pasos durante el login, mediante un codigo adicional. |
