# run.ps1 — Windows PowerShell equivalent of run.sh
#
# Usage:
#   .\run.ps1 -top <top_module> [-src <source_dir>] [-exts ".sv .v"]
#
# Examples:
#   .\run.ps1 -top top -src backend\tests\fixtures\src
#   .\run.ps1 -top my_chip -src C:\projects\asic\rtl

param(
    [string]$top  = "",
    [string]$src  = "",
    [string]$exts = ".sv .v .svh"
)

$ErrorActionPreference = "Stop"

$ScriptDir   = Split-Path -Parent $MyInvocation.MyCommand.Path
$BackendDir  = Join-Path $ScriptDir "backend"
$FrontendDir = Join-Path $ScriptDir "frontend"
$PublicDir   = Join-Path $FrontendDir "public"

if (-not $src) {
    $src = Join-Path $BackendDir "tests\fixtures\src"
}

if (-not $top) {
    Write-Error "Error: -top is required.`nUsage: .\run.ps1 -top <module> [-src <dir>] [-exts '.sv .v']"
    exit 1
}

# Find Python
$python = $null
if (Get-Command python3 -ErrorAction SilentlyContinue) {
    $python = "python3"
} elseif (Get-Command python -ErrorAction SilentlyContinue) {
    $python = "python"
} else {
    Write-Error "Error: python3 not found in PATH."
    exit 1
}

if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
    Write-Error "Error: node not found in PATH."
    exit 1
}

New-Item -ItemType Directory -Force -Path $PublicDir | Out-Null
$OutJson = Join-Path $PublicDir "hierarchy.json"

Write-Host ""
Write-Host "  SV Module Visualizer"
Write-Host ""
Write-Host "  Top module : $top"
Write-Host "  Source dir : $src"
Write-Host "  Output     : $OutJson"
Write-Host ""

Push-Location $BackendDir
try {
    & $python sv_analyzer.py --top $top --src $src --out $OutJson --exts $exts
} finally {
    Pop-Location
}

Write-Host ""
Write-Host "  JSON written to: $OutJson"
Write-Host ""

if (-not (Test-Path (Join-Path $FrontendDir "node_modules"))) {
    Write-Host "  Installing frontend dependencies (first run only)..."
    Push-Location $FrontendDir
    try { npm install --silent } finally { Pop-Location }
    Write-Host ""
}

Write-Host "  Launching UI at http://localhost:5173"
Write-Host "  Press Ctrl+C to stop."
Write-Host ""

Push-Location $FrontendDir
try { npm run dev } finally { Pop-Location }
