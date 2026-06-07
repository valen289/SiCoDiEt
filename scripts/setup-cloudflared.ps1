# ==========================================
# SiCoDiEt - Configuración de Cloudflare Tunnel
# ==========================================
# Este script configura Cloudflare Tunnel para acceso remoto permanente

$ErrorActionPreference = "Stop"

Write-Host "=== Configuración de Cloudflare Tunnel para SiCoDiEt ===" -ForegroundColor Cyan
Write-Host ""

# Verificar si cloudflared está instalado
if (-not (Get-Command cloudflared -ErrorAction SilentlyContinue)) {
    Write-Host "ERROR: cloudflared no está instalado." -ForegroundColor Red
    Write-Host "Descarga cloudflared desde: https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/downloads/" -ForegroundColor Yellow
    exit 1
}

Write-Host "cloudflared encontrado: $(cloudflared --version)" -ForegroundColor Green
Write-Host ""

# Paso 1: Login
Write-Host "=== Paso 1: Autenticación con Cloudflare ===" -ForegroundColor Cyan
Write-Host "Se abrirá tu navegador para que inicies sesión en Cloudflare." -ForegroundColor White
Write-Host "Si no tienes cuenta, crea una gratuita en: https://dash.cloudflare.com/sign-up" -ForegroundColor Yellow
Write-Host ""

$confirm = Read-Host "¿Listo para iniciar sesión? (s/n)"
if ($confirm -ne 's') {
    Write-Host "Cancelado. Ejecuta este script nuevamente cuando estés listo." -ForegroundColor Yellow
    exit 0
}

Write-Host "Abriendo navegador para autenticación..." -ForegroundColor White
cloudflared tunnel login

Write-Host ""
Write-Host "✅ Autenticación completada" -ForegroundColor Green
Write-Host ""

# Paso 2: Crear tunnel
Write-Host "=== Paso 2: Crear Tunnel ===" -ForegroundColor Cyan
$tunnelName = "sicodiet"

Write-Host "Verificando si el tunnel '$tunnelName' ya existe..." -ForegroundColor White
$existingTunnels = cloudflared tunnel list 2>&1 | Select-String $tunnelName

if ($existingTunnels) {
    Write-Host "⚠️  El tunnel '$tunnelName' ya existe." -ForegroundColor Yellow
    $recreate = Read-Host "¿Quieres recrearlo? (s/n)"
    if ($recreate -eq 's') {
        cloudflared tunnel delete $tunnelName
        Write-Host "Tunnel eliminado. Creando nuevo..." -ForegroundColor White
    } else {
        Write-Host "Usando tunnel existente." -ForegroundColor Green
    }
}

if (-not $existingTunnels -or $recreate -eq 's') {
    cloudflared tunnel create $tunnelName
    Write-Host "✅ Tunnel '$tunnelName' creado" -ForegroundColor Green
}

Write-Host ""

# Paso 3: Configurar DNS
Write-Host "=== Paso 3: Configurar DNS ===" -ForegroundColor Cyan
Write-Host "Necesitas un dominio para el tunnel." -ForegroundColor White
Write-Host ""
Write-Host "Opciones:" -ForegroundColor Cyan
Write-Host "1. Usar un subdominio gratuito de Cloudflare (ej: sicodiet.trycloudflare.com)" -ForegroundColor White
Write-Host "2. Usar tu propio dominio (ej: sicodiet.tu-dominio.com)" -ForegroundColor White
Write-Host ""

$domainOption = Read-Host "Elige opción (1 o 2)"

if ($domainOption -eq '1') {
    $hostname = "$tunnelName.trycloudflare.com"
    Write-Host "Usando hostname: $hostname" -ForegroundColor Green
    Write-Host "Nota: Este hostname es temporal y cambiará si recreas el tunnel." -ForegroundColor Yellow
} else {
    $domain = Read-Host "Ingresa tu dominio (ej: tu-dominio.com)"
    $subdomain = Read-Host "Ingresa el subdominio (ej: sicodiet, deja vacío para dominio raíz)"
    
    if ($subdomain) {
        $hostname = "$subdomain.$domain"
    } else {
        $hostname = $domain
    }
    
    Write-Host "Usando hostname: $hostname" -ForegroundColor Green
}

Write-Host ""
Write-Host "Configurando DNS para $hostname..." -ForegroundColor White
cloudflared tunnel route dns $tunnelName $hostname

Write-Host "✅ DNS configurado" -ForegroundColor Green
Write-Host ""

# Paso 4: Crear archivo de configuración
Write-Host "=== Paso 4: Crear configuración del tunnel ===" -ForegroundColor Cyan

$configDir = "$env:USERPROFILE\.cloudflared"
$configFile = "$configDir\config.yml"

if (-not (Test-Path $configDir)) {
    New-Item -ItemType Directory -Path $configDir -Force | Out-Null
}

# Obtener ID del tunnel
$tunnelId = (cloudflared tunnel list 2>&1 | Select-String $tunnelName | Select-String -Pattern '([a-f0-9-]{36})').Matches.Groups[1].Value

$configContent = @"
tunnel: $tunnelId
credentials-file: $configDir\$tunnelId.json

ingress:
  - hostname: $hostname
    service: http://localhost:3001
  - service: http_status:404
"@

Set-Content -Path $configFile -Value $configContent
Write-Host "✅ Configuración creada en: $configFile" -ForegroundColor Green
Write-Host ""

# Paso 5: Instalar como servicio (opcional)
Write-Host "=== Paso 5: Instalar como servicio de Windows ===" -ForegroundColor Cyan
Write-Host "Esto permitirá que el tunnel se ejecute automáticamente al iniciar Windows." -ForegroundColor White
Write-Host ""

$installService = Read-Host "¿Instalar como servicio? (s/n)"
if ($installService -eq 's') {
    cloudflared service install
    Write-Host "✅ Servicio instalado" -ForegroundColor Green
    Write-Host "Iniciando servicio..." -ForegroundColor White
    Start-Service cloudflared
    Write-Host "✅ Servicio iniciado" -ForegroundColor Green
} else {
    Write-Host "Puedes ejecutar el tunnel manualmente con:" -ForegroundColor Yellow
    Write-Host "  cloudflared tunnel run $tunnelName" -ForegroundColor White
}

Write-Host ""
Write-Host "=== Configuración completada ===" -ForegroundColor Cyan
Write-Host ""
Write-Host "📝 Próximos pasos:" -ForegroundColor Cyan
Write-Host "1. Actualiza el archivo .env con: FRONTEND_URL=https://$hostname" -ForegroundColor White
Write-Host "2. Si el backend ya está ejecutándose, deténlo y vuelve a iniciar con production: npm start" -ForegroundColor White
Write-Host "3. Accede desde cualquier dispositivo: https://$hostname" -ForegroundColor White
Write-Host ""
Write-Host "🌐 URL de acceso: https://$hostname" -ForegroundColor Green
