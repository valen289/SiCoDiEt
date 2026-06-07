# Scripts de Configuración

## start-mobile-test.ps1 (Recomendado)

Inicia testing en dispositivo móvil con ngrok en un solo comando.

**Requisitos:**
- Docker corriendo (`docker-compose up -d`) para la base de datos
- ngrok instalado (`winget install ngrok`)
- Cuenta gratuita en ngrok.com

**Uso:**
```powershell
.\scripts\start-mobile-test.ps1
```

**Qué hace:**
1. Verifica que Docker esté corriendo
2. Compila el frontend
3. Inicia el backend en puerto 3002
4. Inicia ngrok apuntando al puerto 3002
5. Muestra la URL para abrir en el celular
6. Al presionar Ctrl+C, detiene todo automáticamente

**Notas:**
- La URL de ngrok cambia cada vez que se reinicia
- Docker debe estar corriendo (para la base de datos)
- No interfiere con Docker en puerto 3001

---

## start-ngrok-backend.ps1

Inicia una segunda instancia del backend en puerto 3002 para ngrok.

**Uso:**
```powershell
.\scripts\start-ngrok-backend.ps1
```

**Qué hace:**
1. Compila el frontend
2. Copia el build a `backend/public/`
3. Inicia el backend en puerto 3002
4. Se conecta a la base de datos de Docker (localhost:3306)

**Notas:**
- Usar junto con `setup-ngrok.ps1` o `start-mobile-test.ps1`
- No interfiere con Docker en puerto 3001

---

## setup-ngrok.ps1

Configura ngrok para acceso remoto temporal (puerto 3002).

**Requisitos:**
- ngrok instalado (`winget install ngrok`)
- Backend corriendo en puerto 3002 (`start-ngrok-backend.ps1`)

**Uso:**
```powershell
.\scripts\setup-ngrok.ps1
```

**Qué hace:**
1. Verifica que ngrok esté instalado
2. Guía la autenticación con tu token
3. Inicia ngrok apuntando al puerto 3002
4. Muestra la URL pública para compartir

**Notas:**
- La URL cambia cada vez que se reinicia ngrok (versión gratuita)
- Requiere mantener la terminal abierta
- Límite de 1 tunnel simultáneo en plan gratuito

---

## setup-cloudflared.ps1

Configura Cloudflare Tunnel para acceso remoto permanente.

**Requisitos:**
- cloudflared instalado (se descarga automáticamente)
- Cuenta gratuita en Cloudflare

**Uso:**
```powershell
.\scripts\setup-cloudflared.ps1
```

**Qué hace:**
1. Verifica que cloudflared esté instalado
2. Autentica con Cloudflare (abre navegador)
3. Crea el tunnel "sicodiet"
4. Configura DNS (propio o subdominio gratuito)
5. Crea archivo de configuración
6. Opcionalmente instala como servicio de Windows

**Notas:**
- URL permanente y personalizada
- HTTPS automático
- Funciona como servicio (no necesita terminal abierta)
- Gratis sin límites significativos

---

## start-local.ps1

Inicia SiCoDiEt localmente sin Docker.

**Uso:**
```powershell
.\scripts\start-local.ps1
```

**Qué hace:**
1. Compila el frontend
2. Copia el build al backend
3. Inicia el backend en puerto 3001

---

## Flujo de Trabajo

### Desarrollo en PC (siempre disponible)
```powershell
docker-compose up -d
# Acceder a: http://localhost:3001
```

### Testing en Móvil (cuando lo necesites)
```powershell
.\scripts\start-mobile-test.ps1
# Abrir la URL de ngrok en el celular
# Ctrl+C para detener todo
```

### Después de configurar un tunnel

Una vez obtenido el tunnel (ngrok o Cloudflare):

1. Actualizar `.env` con la URL pública:
   ```env
   FRONTEND_URL=http://localhost:3001,http://192.168.1.244:3001,https://tu-url-publica.com
   ```

2. Si usás Docker, reconstruí el contenedor:
   ```powershell
   docker-compose down
   docker-compose up -d --build
   ```

3. Probar acceso desde cualquier dispositivo navegando a la URL pública.
