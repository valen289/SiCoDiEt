# Plan SiCoDiEt → SaaS funcional
**Última revisión:** 2026-08-17

---

## Lo que ya está (no tocar, no reimplementar)

Antes de planificar conviene saber qué ya existe y está bien hecho:

- Multi-tenancy con `tambo_id` en JWT y en todas las queries ✓
- Auto-registro que crea el tambo en el mismo request ✓
- Sistema de invitaciones con tabla `invitaciones` y token ✓
- 2FA por email al iniciar sesión ✓
- Forgot/reset password ✓
- Password fuerte con regex (mayúscula, número, carácter especial, 8 chars) ✓
- Alertas de stock con email al dueño/encargado cuando es crítico ✓
- Módulos completos: insumos, lotes, consumos (con turno AM/PM y % sobra), dietas, compras, costos, proveedores, actividades, historial, reportes ✓
- Token versioning para invalidar sesiones remotas ✓
- Helmet, rate limiting, compression, CORS bien configurado ✓

---

## Premisa del plan

El plan está dividido en 4 fases. Cada fase tiene sentido completo sin la siguiente — no es un roadmap que solo vale si llegás al final. La Fase 0 es innegociable para cobrar. La Fase 1 es lo que hace que el producto sea usable en el campo real. La Fase 2 es retención. La Fase 3 es escala.

---

## FASE 0 — Fundamentos SaaS
**Objetivo:** poder cobrar y garantizar aislamiento entre clientes.
**Duración estimada:** 2–3 semanas

### 0.1 — Sistema de billing y planes

**Por qué es primero:** sin esto, SiCoDiEt es un servicio gratuito indefinidamente. No importa cuántas features agregues, si no podés cobrar no es un SaaS.

**Qué implementar:**

Backend:
- Tabla `suscripciones` con: `tambo_id`, `plan` (free/pro/enterprise), `estado` (activa/vencida/cancelada), `fecha_inicio`, `fecha_vencimiento`, `proveedor_pago` (mercadopago/stripe), `external_subscription_id`.
- Tabla `pagos` con historial de cobros.
- Middleware `checkSuscripcion` que corre después de `authenticateToken` en rutas que requieran plan pago — si el tambo tiene plan free y supera los límites, responde 402 con mensaje claro.
- Webhook endpoint `/api/billing/webhook` para recibir eventos de Mercado Pago (pago confirmado, vencimiento, cancelación) y actualizar la tabla `suscripciones`.
- Endpoint `GET /api/billing/estado` para que el frontend muestre el plan actual y vencimiento.

Frontend:
- Página `/suscripcion` con los planes disponibles, el plan actual del tambo, y botón de upgrade.
- Banner no intrusivo en el Layout cuando el tambo está en free y cerca del límite.
- Redirect a `/suscripcion` cuando la API responde 402.

**Límites del plan free sugeridos:**
- Máximo 3 usuarios
- Máximo 10 insumos activos
- Máximo 5 lotes activos
- Historial visible: últimos 30 días
- Sin acceso a módulo Costos ni Compras
- Sin exportación de datos

**Integración de pago:** Mercado Pago primero (mercado local Uruguay/Argentina). SDK: `mercadopago` npm. Flujo: crear preferencia en el backend → redirigir al usuario → recibir webhook de confirmación → activar suscripción. Stripe como segundo si se expande a otros mercados.

---

### 0.2 — Auditoría completa de aislamiento multi-tambo

**Por qué ahora:** antes de tener múltiples clientes pagando, hay que asegurarse de que ningún endpoint expone datos de otro tambo. El sistema parece bien construido pero hay que verificarlo sistemáticamente.

**Qué hacer:**

Recorrer cada archivo en `backend/src/routes/` y verificar que:
1. Toda query de lectura tiene `WHERE tambo_id = ?` con `req.user.tambo_id`.
2. Toda query de escritura inserta `tambo_id = req.user.tambo_id`.
3. Al buscar un recurso por ID (ej. `GET /insumos/:id`), se verifica que el recurso pertenece al tambo del usuario — no alcanza con buscar por `id` solo.

El punto 3 es el más peligroso. Si `GET /insumos/42` no valida `tambo_id`, un usuario de un tambo puede leer insumos de otro tambo si adivina el ID.

**Resultado esperado:** checklist documentado con el estado de cada ruta. Cualquier agujero se cierra antes de la Fase 1.

---

### 0.3 — Rate limiting por tambo, no por IP

**Por qué:** el servidor ya reconoce el problema en un comentario del código — varios trabajadores del mismo tambo comparten IP (un router de campo). Con el límite actual de 600 req/15min por IP, 4 trabajadores activos pueden agotarlo.

**Qué cambiar:**

En `server.js`, agregar un segundo limiter que aplique después de autenticación, limitando por `req.user.tambo_id`:

```js
const tamboLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: isProduction ? 800 : 1000,
  keyGenerator: (req) => req.user?.tambo_id ? `tambo_${req.user.tambo_id}` : req.ip,
  // Solo aplicar en rutas autenticadas — las públicas (login, register) siguen por IP
});
```

Aplicar este limiter después de `authenticateToken` en las rutas privadas. El limiter de IP existente se mantiene para las rutas públicas (protección contra bots).

---

## FASE 1 — Completar el producto core
**Objetivo:** que el sistema sea 100% operable sin salir de la app.
**Duración estimada:** 3–4 semanas

### 1.1 — Módulo Ganado en el frontend

**Por qué:** el backend de ganado existe completo (`GET /api/ganado`, `GET /api/ganado/historial`, `POST /api/ganado`). Solo falta la pantalla. Es la pieza más fácil de esta fase.

**Qué implementar:**

Página `frontend/src/pages/Ganado.jsx`:
- Card de resumen: último registro con vacas totales, lecheras, secas, terneros, fecha.
- Formulario de nuevo registro (solo visible para `dueno` y `encargado`).
- Tabla de historial con los últimos 30 registros.
- Gráfico de línea simple con evolución de vacas lecheras en el tiempo (usa los datos de historial que ya devuelve la API).

Agregar ruta `/ganado` en `App.jsx` con `DuenoEncargadoRoute`.
Agregar ítem en el menú de `Layout.jsx`.

---

### 1.2 — Exportación de datos

**Por qué:** el productor necesita pasar los datos a su contador, a informes veterinarios, o simplemente tener un backup descargable. Sin esto, los datos quedan "presos" en el sistema — lo que es un argumento de venta pero también una fricción de salida que no es saludable a largo plazo.

**Qué implementar:**

Backend — endpoint `GET /api/exportar`:
- Query params: `tipo` (consumos / insumos / costos / compras), `fecha_inicio`, `fecha_fin`, `formato` (csv / xlsx).
- Genera el archivo en memoria y lo devuelve como stream con el Content-Type correcto.
- Filtrado por `tambo_id` obligatorio.
- Solo disponible para plan pro en adelante (integrar con el middleware de la Fase 0.1).

Frontend — botón "Exportar" en las páginas de Historial, Costos, Compras:
- Abre un modal pequeño para elegir rango de fechas y formato.
- Llama al endpoint y descarga el archivo directamente.

Librería backend: `exceljs` para XLSX, nativo para CSV (no agregar dependencias innecesarias para algo que es un join + loop).

---

### 1.3 — Pre-carga de cantidades desde la dieta activa en Consumos

**Por qué:** en `Consumos.jsx` ya se carga `ingredientesBase` desde la dieta activa. Pero el trabajador todavía tiene que confirmar o ingresar cantidades. El paso que falta es calcular la cantidad sugerida automáticamente: `cantidad_por_animal × cantidad_animales_del_lote` y pre-cargar ese valor en el campo editable.

**Qué cambiar:**

En `Consumos.jsx`, cuando se carga la dieta activa de un lote:
```
cantidadSugerida = ingrediente.cantidad_kg × lote.cantidad_animales
```

Mostrar el campo con la cantidad sugerida ya cargada, con un indicador visual (por ejemplo, color diferente o texto "Sugerido por dieta") para que el trabajador sepa que ese número viene de la dieta y puede ajustarlo.

Si el trabajador cambia el valor, mostrar la diferencia porcentual respecto a la dieta (ej. "−8% vs. dieta activa"). Eso da trazabilidad sin agregar fricción.

En el backend, guardar si el consumo fue exactamente el formulado o hubo desvío — añadir columna `origen_cantidad` ENUM('dieta','manual') en `consumos`.

---

### 1.4 — UI para envío de invitaciones

**Por qué:** la tabla `invitaciones` y el flujo de registro con token ya existen, pero no hay interfaz para que el `dueno` genere y envíe invitaciones a nuevos usuarios. Hoy esto probablemente se hace a mano en la base de datos.

**Qué implementar:**

En la página `Usuarios.jsx` (ya existe, solo para `dueno`), agregar sección "Invitar usuario":
- Formulario: email del invitado + rol a asignar (encargado / trabajador).
- Al enviar, el backend genera un token único, lo inserta en `invitaciones` con expiración de 7 días, y manda un email con el link de registro que incluye el token.
- Listado de invitaciones pendientes con opción de revocar.

Backend — endpoints ya necesarios:
- `POST /api/usuarios/invitar` — genera token, inserta en `invitaciones`, envía email. Solo `dueno`.
- `DELETE /api/usuarios/invitaciones/:token` — revoca. Solo `dueno`.
- `GET /api/usuarios/invitaciones` — lista pendientes. Solo `dueno`.

---

### 1.5 — Tests de integración para el flujo crítico

**Por qué:** los módulos de consumos e insumos tocan datos reales de stock. Un bug en esas rutas tiene consecuencia directa en el negocio del productor. Con múltiples clientes, una regresión puede afectar a todos.

**Qué cubrir mínimamente** (backend, con `node:test` que ya está configurado):

- Registro de consumo reduce stock correctamente.
- Consumo que supera stock es rechazado con 400.
- Carga de alimento aumenta stock y no supera capacidad máxima.
- Un usuario no puede leer insumos de otro tambo (test de aislamiento).
- Login con 2FA funciona end-to-end.
- Invitación expirada es rechazada.

No hace falta 100% de cobertura. Hace falta que los caminos que mueven stock estén cubiertos.

---

## FASE 2 — Retención y engagement
**Objetivo:** que el productor abra la app todos los días y recomiende el producto.
**Duración estimada:** 3–4 semanas

### 2.1 — PWA con soporte offline para registro de consumos

**Por qué:** el campo tiene mala señal. El caso de uso más importante del sistema (registrar el consumo de la mañana) es exactamente cuando el trabajador está en el tambo, lejos del router. Si no puede cargar, no carga — y los datos se pierden.

**Qué implementar:**

`frontend/public/sw.js` — Service Worker con estrategia:
- **Cache-first** para assets estáticos (JS, CSS, fuentes).
- **Network-first** para las llamadas a la API.
- **Background sync** para el registro de consumos: si el POST a `/api/consumos` falla por falta de red, se guarda en IndexedDB y se reintenta cuando vuelve la conexión.

`frontend/public/manifest.json` — ya debería existir o es trivial crearlo. Define nombre, ícono, color, `display: standalone`.

En el frontend, banner "Instalá la app" en mobile que muestra el prompt de instalación del browser.

Indicador visual de modo offline en el Layout: pill rojo/gris cuando no hay conexión, con texto "Offline — tus consumos se sincronizarán cuando vuelva la señal".

**Qué NO hacer en offline:** crear insumos, editar dietas, cambiar usuarios. Solo el registro de consumos necesita funcionar offline — es el 90% del uso del `trabajador`.

---

### 2.2 — Push notifications (Web Push)

**Por qué:** el email de stock crítico es útil pero el productor no lo lee a las 6am. Una push notification en el celular sí llega.

**Qué implementar:**

Backend:
- Tabla `push_subscriptions` con: `usuario_id`, `endpoint`, `keys_p256dh`, `keys_auth`.
- Endpoint `POST /api/notificaciones/suscribir` — guarda la suscripción Web Push del browser.
- Endpoint `DELETE /api/notificaciones/suscribir` — cancela.
- En `utils/alertas.js`, cuando se genera una alerta crítica, además del email ya existente, llamar a `webpush.sendNotification()` para todos los `push_subscriptions` del tambo con rol `dueno` o `encargado`.
- Librería: `web-push` npm.

Frontend:
- En `Layout.jsx` o en el perfil, botón "Activar notificaciones". Pide permiso del browser, obtiene la suscripción, la manda al backend.
- Manejar el caso donde el browser no soporta Web Push (Safari < 16.4).

**Qué notificar:**
- Stock crítico (≤5 días) — ya detectado, solo agregar el canal push.
- Stock bajo (≤7 días) — mismo mecanismo.
- Consumo del turno AM no registrado a las 10am (cron job diario que verifica si hay consumos del turno AM para todos los lotes activos del tambo).

---

### 2.3 — Reporte semanal automático por email

**Por qué:** el dueño que no abre la app todos los días igual recibe un resumen de lo que pasó en la semana. Mantiene el producto presente y muestra valor aunque el uso sea intermitente.

**Qué implementar:**

Cron job (puede ser un workflow de GitHub Actions que llame a un endpoint, o un cron interno con `node-cron`):
- Corre todos los lunes a las 8am.
- Por cada tambo activo con suscripción activa, genera un email con:
  - Consumo total de la semana en kg y costo total.
  - Los 3 insumos con menos días restantes.
  - Lotes activos y variación de cantidad de animales.
  - Comparación con la semana anterior (mismo formato que el dashboard).

Backend:
- Endpoint `POST /api/reportes/semanal` — protegido por secret interno, no por JWT. Genera y manda los emails.
- El endpoint ya devuelve los datos porque el módulo `/api/reportes` existe; solo hay que agregar el template de email y el trigger.

Template de email: HTML simple, mobile-first, con los mismos colores del dashboard. Librería: `nodemailer` ya está instalada.

---

### 2.4 — Página de perfil de tambo

**Por qué:** hoy el tambo es solo un ID en la base. No hay forma de cambiar el nombre del establecimiento, subir un logo, o configurar preferencias globales. Para un producto que le presentás a un productor, eso se siente como una app de demo.

**Qué implementar:**

Backend:
- `GET /api/tambo` — devuelve nombre, logo_url, moneda, zona horaria. Solo `dueno`.
- `PUT /api/tambo` — actualiza. Solo `dueno`.
- `POST /api/tambo/logo` — sube logo (multer + almacenamiento en filesystem o S3). Solo `dueno`.

Frontend — sección en la página de perfil o página `/configuracion`:
- Nombre del establecimiento (editable).
- Logo (upload con preview).
- Zona horaria (select) — para que los timestamps de consumos sean correctos independientemente del servidor.

**Descartado:** selector de moneda local (UYU/ARS/USD). Un selector que solo cambia el símbolo mostrado sin convertir los montos reales es engañoso — el sistema sigue todo internamente en USD. Si en algún momento se justifica multi-moneda real, requiere tasas de conversión, no solo un `<select>`.

La zona horaria es un dato que afecta la experiencia de todos los usuarios del tambo, no solo del dueño que la configura.

---

## FASE 3 — Escala
**Objetivo:** poder crecer a decenas de tambos sin que la operación se vuelva manual.
**Duración estimada:** 4–6 semanas (solo cuando haya suficientes clientes para justificarlo)

### 3.1 — Panel de administración interno

**Por qué:** cuando tenés 20 tambos activos, necesitás poder ver el estado global sin entrar a cada cuenta. Esto no es para los clientes — es para vos como operador del SaaS.

**Qué implementar:**

Ruta interna `/admin` — protegida por rol `superadmin` (nuevo rol a agregar en la DB, solo asignable desde migrations, nunca desde la UI de cliente):
- Lista de todos los tambos: nombre, plan, cantidad de usuarios, fecha de último uso, estado de suscripción.
- Búsqueda y filtro por plan / estado.
- Posibilidad de extender una suscripción manualmente (para casos de cortesía o soporte).
- Ver métricas agregadas: tambos activos, ingresos mensuales, usuarios totales.

No es un panel de soporte técnico — es un panel de gestión de clientes. No necesita ver los datos del tambo (eso violaría la privacidad de los clientes).

---

### 3.2 — APM y monitoreo de errores (Sentry)

**Por qué:** con múltiples clientes en producción, un error silencioso en Railway que afecta a un tambo específico puede pasar desapercibido horas. Hoy la única forma de enterarse es que el productor llame.

**Qué implementar:**

Backend:
- `npm install @sentry/node` + inicializar en `server.js` antes de las rutas.
- Capturar errores no manejados en el error handler existente.
- Tag `tambo_id` en cada transacción para poder filtrar errores por cliente.
- Alerta de Sentry si el error rate supera un umbral en 15 minutos.

Frontend:
- `npm install @sentry/react` + `Sentry.init()` en `main.jsx`.
- `Sentry.ErrorBoundary` wrapping `<AppRoutes />`.
- Tag `tambo_id` y `rol` en el scope del usuario autenticado.

**Cuándo activarlo:** cuando haya más de 5 tambos activos o cuando diagnosticar un error tarde más de 30 minutos. Antes de eso es overhead innecesario.

---

### 3.3 — API pública con autenticación por API key

**Por qué:** algunos productores van a querer integrar SiCoDiEt con su sistema de gestión lechera existente (SIGI, Infortambo, DairyComp, etc.). Una API pública documentada es un canal de ventas y un diferenciador.

**Qué implementar:**

Backend:
- Tabla `api_keys` con: `tambo_id`, `key_hash` (la key hasheada, nunca en claro), `nombre`, `permisos` (array JSON: read_consumos, read_insumos, write_consumos), `activa`, `ultimo_uso`.
- Middleware `authenticateApiKey` — alternativo a `authenticateToken`, busca el header `X-API-Key`, hashea y busca en DB, carga `req.user` con los datos del tambo.
- Endpoints públicos bajo `/api/v1/` con los permisos granulares de la key.
- Rate limiting separado y más estricto para API keys (las integrations no deben saturar el servidor).

Frontend — sección en `/configuracion`:
- Generar nueva API key (se muestra solo una vez en pantalla, igual que GitHub).
- Ver keys existentes con nombre y últimos 4 chars.
- Revocar.

Documentación: un `/api/v1/docs` con Swagger o simplemente un markdown en el repo. La documentación es tan importante como la implementación.

---

## Orden de implementación sugerido

**Última verificación de estado: 2026-08-17.** Varios ítems de Fase 1 resultaron ser trabajo previo que ya existía en el working tree sin commitear (se detectó y commiteó junto con la auditoría de aislamiento) — el estado de abajo es el real, verificado contra el código, no una suposición.

**Decisión del 2026-08-17: billing (0.1) se deja para el final a propósito.** El criterio es completar todo el producto (incluida Fase 3 donde no dependa de billing) antes de encarar monetización — no por bloqueo técnico, sino por preferencia explícita: primero dejar todo completo, recién ahí "hacer los planes".

| # | Feature | Fase | Estado | Bloqueado por | Impacto |
|---|---------|------|--------|---------------|---------|
| 1 | Auditoría de aislamiento (0.2) | 0 | ✅ Hecho | — | Seguridad |
| 2 | Módulo Ganado frontend (1.1) | 1 | ✅ Hecho | — | Completitud del producto |
| 3 | UI de invitaciones (1.4) | 1 | ✅ Hecho | — | Onboarding de equipo |
| 4 | Pre-carga dieta en consumos (1.3) | 1 | ✅ Hecho | — | UX core |
| 5 | Exportación de datos (1.2) | 1 | ✅ Hecho | — | Valor para usuario |
| 6 | Tests de integración (1.5) | 1 | ✅ Hecho | — | Confianza al iterar |
| 7 | UI perfil de tambo (2.4) | 2 | ✅ Hecho* | — | Profesionalismo |
| 8 | Rate limiting por tambo (0.3) | 0 | ✅ Hecho | — | Confiabilidad |
| 9 | PWA + offline (2.1) | 2 | ❌ Pendiente | — | Field usability |
| 10 | Push notifications (2.2) | 2 | ❌ Pendiente | — | Retención |
| 11 | Reporte semanal (2.3) | 2 | ❌ Pendiente | — | Engagement pasivo |
| 12 | API pública (3.3) | 3 | ❌ Pendiente | — | Integraciones |
| 13 | Sentry APM (3.2) | 3 | ❌ Pendiente | +5 tambos activos (criterio de negocio, no de orden) | Monitoreo |
| 14 | Billing / planes (0.1) | 0 | ❌ Pendiente — **a propósito, al final** | — | **Monetización** |
| 15 | Panel admin interno (3.1) | 3 | ❌ Pendiente | Billing (#14) | Operación a escala |

\* Perfil de tambo se implementó sin el selector de moneda (ver "Descartado" más arriba) — nombre, logo y zona horaria sí, con propagación real a las queries de negocio (`CURDATE()`/`CURTIME()`/`NOW()` del servidor reemplazados por la hora del tambo).

**Lo próximo:** #9 (PWA + offline), #10 (push notifications) o #11 (reporte semanal) — sin bloqueos entre sí, por orden de preferencia de negocio.

---

## Lo que expresamente NO hay que hacer (todavía)

- **App mobile nativa (React Native / Flutter):** la PWA cubre el 90% del caso de uso mobile con fracción del costo. Nativa tiene sentido cuando la base de usuarios ya justifica mantener dos codebases.
- **Base de datos por tambo:** la arquitectura multi-tenant por `tambo_id` en tablas compartidas es correcta para la escala actual. Separar DBs tiene sentido con cientos de tambos con millones de filas — estás muy lejos de eso.
- **Microservicios:** monolito modular bien construido hasta que el cuello de botella sea demostrable, no hipotético.
- **i18n (internacionalización):** el sistema está en español, el mercado objetivo es Uruguay/Argentina. Agregar idiomas agrega complejidad de mantenimiento sin retorno claro por ahora.
