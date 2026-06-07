# ==========================================
# SiCoDiEt - Backend para Ngrok (Puerto 3002)
# ==========================================
# Inicia una segunda instancia del backend en puerto 3002
# para testing en dispositivos móviles con ngrok.

$ErrorActionPreference = "Stop"

$scriptRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$projectRoot = Resolve-Path (Join-Path $scriptRoot '..')
$frontendPath = Join-Path $projectRoot 'frontend'
$backendPath = Join-Path $projectRoot 'backend'
$publicPath = Join-Path $backendPath 'public'

Write-Host "=== Backend para Ngrok (Puerto 3002) ===" -ForegroundColor Cyan
Write-Host ""

# Verificar que Docker esté corriendo (necesario para la BD)
Write-Host "Verificando Docker..." -ForegroundColor White
$dockerRunning = docker ps --filter "name=sicodiet-db" --format "{{.Status}}" 2>$null
if (-not $dockerRunning) {
    Write-Host "⚠️  Docker no está corriendo o la BD no está disponible." -ForegroundColor Yellow
    Write-Host "   Ejecutá: docker-compose up -d" -ForegroundColor Yellow
    Write-Host ""
    $continue = Read-Host "¿Continuar de todos modos? (s/n)"
    if ($continue -ne 's') { exit 0 }
} else {
    Write-Host "✅ Docker detectado: $dockerRunning" -ForegroundColor Green
}

Write-Host ""
Write-Host "1) Compilando frontend..." -ForegroundColor White
Push-Location $frontendPath
try {
    npm run build
    Write-Host "✅ Frontend compilado" -ForegroundColor Green
} catch {
    Write-Host "❌ Error compilando frontend" -ForegroundColor Red
    Pop-Location
    exit 1
}
Pop-Location

Write-Host ""
Write-Host "2) Copiando build al backend..." -ForegroundColor White
if (-Not (Test-Path $publicPath)) { New-Item -ItemType Directory -Path $publicPath | Out-Null }
Remove-Item -Force -Recurse (Join-Path $publicPath '*') -ErrorAction SilentlyContinue
Copy-Item -Recurse (Join-Path $frontendPath 'dist\*') $publicPath
Write-Host "✅ Build copiado a backend/public/" -ForegroundColor Green

Write-Host ""
Write-Host "3) Iniciando backend en puerto 3002..." -ForegroundColor White
Write-Host "   Se conecta a la BD de Docker (localhost:3306)" -ForegroundColor Gray
Write-Host ""

# Configurar variables de entorno para esta instancia
$env:PORT = "3002"
$env:NODE_ENV = "production"

# Leer credenciales de DB desde .env raíz
$envFile = Join-Path $projectRoot '.env'
if (Test-Path $envFile) {
    $envContent = Get-Content $envFile
    foreach ($line in $envContent) {
        $line = $line.Trim()
        if ($line -match '^(\w+)=(.+)$') {
            $key = $matches[1]
            $value = $matches[2].Trim('"').Trim("'")
            switch ($key) {
                'DB_HOST' { $env:DB_HOST = $value }
                'DB_PORT' { $env:DB_PORT = $value }
                'DB_USER' { $env:DB_USER = $value }
                'DB_PASSWORD' { $env:DB_PASSWORD = $value }
                'DB_NAME' { $env:DB_NAME = $value }
                'JWT_SECRET' { $env:JWT_SECRET = $value }
                'JWT_EXPIRES_IN' { $env:JWT_EXPIRES_IN = $value }
            }
        }
    }
    Write-Host "   DB: $($env:DB_HOST):$($env:DB_PORT) / $($env:DB_NAME) (user: $($env:DB_USER))" -ForegroundColor Gray
} else {
    # Fallback si no existe .env
    $env:DB_HOST = "localhost"
    $env:DB_PORT = "3306"
    $env:DB_USER = "sicodiet"
    $env:DB_PASSWORD = "secret"
    $env:DB_NAME = "gestion_tambo"
    Write-Host "   ⚠️  .env no encontrado, usando credenciales por defecto" -ForegroundColor Yellow
}

$env:FRONTEND_URL = "http://localhost:3002"

Push-Location $backendPath
try {
    npm install --ignore-scripts 2>$null
    Write-Host ""
    Write-Host "✅ Backend iniciado en http://localhost:3002" -ForegroundColor Green
    Write-Host "   Presioná Ctrl+C para detener" -ForegroundColor Yellow
    Write-Host ""
    node src/server.js
} catch {
    Write-Host "❌ Error iniciando backend" -ForegroundColor Red
    exit 1
} finally {
    Pop-Location
}
