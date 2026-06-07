# ==========================================
# SiCoDiEt - Configuración de Ngrok (Puerto 3002)
# ==========================================
# Este script configura ngrok para acceso remoto temporal
# desde dispositivos móviles. Requiere el backend corriendo
# en puerto 3002 (usar start-ngrok-backend.ps1 primero).

Write-Host "=== Configuración de Ngrok para SiCoDiEt ===" -ForegroundColor Cyan
Write-Host ""

# Verificar si ngrok está instalado
if (-not (Get-Command ngrok -ErrorAction SilentlyContinue)) {
    Write-Host "ERROR: ngrok no está instalado." -ForegroundColor Red
    Write-Host "Descarga ngrok desde: https://ngrok.com/download" -ForegroundColor Yellow
    Write-Host "O ejecuta: winget install ngrok" -ForegroundColor Yellow
    exit 1
}

Write-Host "ngrok encontrado: $(ngrok version)" -ForegroundColor Green
Write-Host ""

# Verificar si está autenticado
$configPath = "$env:USERPROFILE\.ngrok2\ngrok.yml"
if (-not (Test-Path $configPath)) {
    Write-Host "⚠️  ngrok no está autenticado." -ForegroundColor Yellow
    Write-Host ""
    Write-Host "Pasos para autenticar:" -ForegroundColor Cyan
    Write-Host "1. Crea una cuenta gratuita en: https://dashboard.ngrok.com/signup" -ForegroundColor White
    Write-Host "2. Ve a: https://dashboard.ngrok.com/get-started/your-authtoken" -ForegroundColor White
    Write-Host "3. Copia tu authtoken" -ForegroundColor White
    Write-Host ""
    
    $token = Read-Host "Pega tu authtoken aquí"
    if ($token) {
        ngrok authtoken $token
        Write-Host "✅ Autenticación completada" -ForegroundColor Green
    } else {
        Write-Host "❌ No se proporcionó token. Ejecuta este script nuevamente." -ForegroundColor Red
        exit 1
    }
} else {
    Write-Host "✅ ngrok ya está autenticado" -ForegroundColor Green
}

Write-Host ""
Write-Host "=== Iniciando ngrok ===" -ForegroundColor Cyan
Write-Host "Presiona Ctrl+C para detener ngrok" -ForegroundColor Yellow
Write-Host ""

# Iniciar ngrok
ngrok http 3002 --host-header="localhost:3002"
