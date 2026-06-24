# Scripts de Configuración

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
.\scripts\setup-cloudflared.ps1
# Abrir la URL del tunnel en el celular
```

### Después de configurar un tunnel

Una vez obtenido el tunnel (Cloudflare):

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
