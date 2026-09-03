<#
.SYNOPSIS
  Builds the Sproutly Flutter web app with the required flags baked in.

.DESCRIPTION
  The web build MUST pass -no-tree-shake-icons: the app builds IconData
  dynamically (notification icons resolved from stored values), which makes the
  Flutter icon tree-shaker abort ("value '0' ... not a valid unicode codepoint").
  This wrapper bakes it in so it can't be forgotten. Mirrors the `web` target in
  ./Makefile for environments without make (e.g. local PowerShell on Windows).

.PARAMETER ApiBaseUrl
  Backend the built app should talk to. Defaults to production.

.EXAMPLE
  ./build-web.ps1
  ./build-web.ps1 -ApiBaseUrl http://localhost:3000/api
#>
param(
    [string]$ApiBaseUrl = "https://api.sproutly.duforge.tech/api"
)

$ErrorActionPreference = "Stop"
Set-Location -Path $PSScriptRoot

Write-Host "Building Sproutly web -> API_BASE_URL=$ApiBaseUrl" -ForegroundColor Cyan
flutter build web --no-tree-shake-icons --dart-define=API_BASE_URL=$ApiBaseUrl
if ($LASTEXITCODE -ne 0) { throw "flutter build web failed (exit $LASTEXITCODE)" }
Write-Host "Built build/web" -ForegroundColor Green
