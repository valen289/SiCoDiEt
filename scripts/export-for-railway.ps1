# ============================================================
# SiCoDiEt - Exportar base de datos local para importar en Railway
# Uso: .\scripts\export-for-railway.ps1
# ============================================================

$ErrorActionPreference = "Stop"

# Leer credenciales del .env
$envPath = "$PSScriptRoot\..\backend\.env"
if (-not (Test-Path $envPath)) {
    Write-Error "No se encontro backend\.env"
    exit 1
}

$env_vars = @{}
Get-Content $envPath | ForEach-Object {
    if ($_ -match '^\s*([^#=]+?)\s*=\s*(.*?)\s*$') {
        $env_vars[$Matches[1]] = $Matches[2]
    }
}

$DB_HOST = $env_vars['DB_HOST']
$DB_USER = $env_vars['DB_USER']
$DB_PASS = $env_vars['DB_PASSWORD']
$DB_NAME = $env_vars['DB_NAME']
$OUTPUT  = "$PSScriptRoot\..\pilot-data.sql"

Write-Host ""
Write-Host "Exportando base de datos '$DB_NAME' desde $DB_HOST..."
Write-Host ""

# Buscar mysqldump
$mysqldump = $null
$candidates = @(
    "mysqldump",
    "C:\Program Files\MySQL\MySQL Server 8.0\bin\mysqldump.exe",
    "C:\Program Files\MySQL\MySQL Server 8.4\bin\mysqldump.exe",
    "C:\xampp\mysql\bin\mysqldump.exe",
    "C:\laragon\bin\mysql\mysql-8.0\bin\mysqldump.exe"
)

foreach ($c in $candidates) {
    try {
        $null = & $c --version 2>&1
        $mysqldump = $c
        break
    } catch {}
}

if (-not $mysqldump) {
    Write-Error @"
No se encontro mysqldump en el sistema.
Opciones:
  1. Agregar C:\Program Files\MySQL\MySQL Server 8.x\bin\ al PATH y volver a ejecutar
  2. Usar MySQL Workbench: Server > Data Export > Export to Self-Contained File
"@
    exit 1
}

# Ejecutar dump
# --no-create-db : no incluye CREATE DATABASE / USE (Railway ya tiene la DB creada)
# --add-drop-table : agrega DROP TABLE IF EXISTS antes de cada CREATE para importacion limpia
$env:MYSQL_PWD = $DB_PASS
& $mysqldump `
    -h $DB_HOST `
    -u $DB_USER `
    --no-create-db `
    --add-drop-table `
    --skip-triggers `
    --single-transaction `
    $DB_NAME | Out-File -FilePath $OUTPUT -Encoding utf8

if ($LASTEXITCODE -ne 0) {
    Write-Error "mysqldump fallo con codigo $LASTEXITCODE"
    exit 1
}

$size = [math]::Round((Get-Item $OUTPUT).Length / 1KB, 1)

Write-Host "Archivo generado: pilot-data.sql ($size KB)"
Write-Host ""
Write-Host "Proximos pasos para importar en Railway:"
Write-Host ""
Write-Host "  1. Instalar Railway CLI (solo la primera vez):"
Write-Host "     npm install -g @railway/cli"
Write-Host ""
Write-Host "  2. Conectarse:"
Write-Host "     railway login"
Write-Host "     railway link   # elegir el proyecto SiCoDiEt"
Write-Host ""
Write-Host "  3. Importar los datos:"
Write-Host "     railway run mysql `$MYSQLDATABASE < pilot-data.sql"
Write-Host ""
Write-Host "     (Railway inyecta automaticamente las variables de conexion)"
Write-Host ""
