# ==========================================
# SiCoDiEt - Testing Móvil con Ngrok
# ==========================================
# Inicia el backend en puerto 3002 + ngrok en un solo comando.
# Docker debe estar corriendo para la base de datos.

$ErrorActionPreference = "Stop"

$scriptRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$backendPath = Resolve-Path (Join-Path $scriptRoot '..\backend')

Write-Host "=== Testing Móvil con Ngrok ===" -ForegroundColor Cyan
Write-Host ""

# Verificar Docker
Write-Host "Verificando Docker..." -ForegroundColor White
$dockerRunning = docker ps --filter "name=sicodiet-db" --format "{{.Status}}" 2>$null
if (-not $dockerRunning) {
    Write-Host "⚠️  Docker no está corriendo o la BD no está disponible." -ForegroundColor Yellow
    Write-Host "   Ejecutá: docker-compose up -d" -ForegroundColor Yellow
    Write-Host ""
    $continue = Read-Host "¿Continuar de todos modos? (s/n)"
    if ($continue -ne 's') { exit 0 }
} else {
    Write-Host "✅ Docker detectado" -ForegroundColor Green
}

# Verificar ngrok
if (-not (Get-Command ngrok -ErrorAction SilentlyContinue)) {
    Write-Host "❌ ngrok no está instalado." -ForegroundColor Red
    Write-Host "   Ejecutá: winget install ngrok" -ForegroundColor Yellow
    exit 1
}

Write-Host ""
Write-Host "1) Iniciando backend en puerto 3002..." -ForegroundColor White

# Iniciar el backend en segundo plano
$backendScript = Join-Path $scriptRoot 'start-ngrok-backend.ps1'
$backendProcess = Start-Process powershell -ArgumentList "-NoProfile", "-ExecutionPolicy", "Bypass", "-File", $backendScript -PassThru -WindowStyle Normal

# Esperar a que el backend levante
Write-Host "   Esperando que el backend inicie..." -ForegroundColor Gray
Start-Sleep -Seconds 5

# Verificar que el backend esté corriendo
$backendReady = $false
for ($i = 0; $i -lt 10; $i++) {
    try {
        $response = Invoke-WebRequest -Uri "http://localhost:3002/api/health" -UseBasicParsing -TimeoutSec 2
        if ($response.StatusCode -eq 200) {
            $backendReady = $true
            break
        }
    } catch {
        Start-Sleep -Seconds 1
    }
}

if (-not $backendReady) {
    Write-Host "❌ El backend no respondió en puerto 3002." -ForegroundColor Red
    Write-Host "   Deteniendo proceso..." -ForegroundColor Yellow
    Stop-Process -Id $backendProcess.Id -Force -ErrorAction SilentlyContinue
    exit 1
}

Write-Host "✅ Backend listo en http://localhost:3002" -ForegroundColor Green
Write-Host ""

# Iniciar ngrok
Write-Host "2) Iniciando ngrok..." -ForegroundColor White
Write-Host "   Tunnel apuntando al puerto 3002" -ForegroundColor Gray
Write-Host ""

Write-Host "============================================" -ForegroundColor Cyan
Write-Host "  📱 TESTING MÓVIL ACTIVO" -ForegroundColor Cyan
Write-Host "============================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "  Abrí la URL de ngrok en tu celular." -ForegroundColor White
Write-Host "  La URL aparecerá en la ventana de ngrok." -ForegroundColor White
Write-Host ""
Write-Host "  Para detener todo: Ctrl+C en esta ventana" -ForegroundColor Yellow
Write-Host ""
Write-Host "============================================" -ForegroundColor Cyan
Write-Host ""

# Iniciar ngrok (bloqueante)
try {
    ngrok http 3002 --host-header="localhost:3002"
} finally {
    # Limpiar: detener el backend
    Write-Host ""
    Write-Host "Deteniendo backend en puerto 3002..." -ForegroundColor Yellow
    Stop-Process -Id $backendProcess.Id -Force -ErrorAction SilentlyContinue
    Write-Host "✅ Todo detenido" -ForegroundColor Green
}
