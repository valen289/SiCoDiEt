# ==========================================
# SiCoDiEt - Inicio local sin Docker
# ==========================================

$scriptRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$projectRoot = Resolve-Path (Join-Path $scriptRoot '..')
$frontendPath = Join-Path $projectRoot 'frontend'
$backendPath = Join-Path $projectRoot 'backend'
$publicPath = Join-Path $backendPath 'public'

Write-Host "=== Iniciando SiCoDiEt local sin Docker ===" -ForegroundColor Cyan
Write-Host ""

if (-Not (Test-Path $frontendPath)) {
    Write-Host "ERROR: No se encontró la carpeta frontend en $frontendPath" -ForegroundColor Red
    exit 1
}

if (-Not (Test-Path $backendPath)) {
    Write-Host "ERROR: No se encontró la carpeta backend en $backendPath" -ForegroundColor Red
    exit 1
}

Write-Host "1) Construyendo frontend..." -ForegroundColor White
Push-Location $frontendPath
npm install
npm run build
Pop-Location

Write-Host "2) Copiando build al backend..." -ForegroundColor White
if (-Not (Test-Path $publicPath)) { New-Item -ItemType Directory -Path $publicPath | Out-Null }
Remove-Item -Force -Recurse (Join-Path $publicPath '*') -ErrorAction SilentlyContinue
Copy-Item -Recurse (Join-Path $frontendPath 'dist\*') $publicPath

Write-Host "3) Iniciando backend..." -ForegroundColor White
Push-Location $backendPath
npm install
$env:NODE_ENV = 'production'
Write-Host "Backend iniciado en http://localhost:3001" -ForegroundColor Green
npm start
Pop-Location
