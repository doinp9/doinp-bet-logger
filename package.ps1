# Doinp Bet Logger — build dist\chrome and dist\firefox (+ zips) from this folder.
# Usage (PowerShell, from this folder):   .\package.ps1
# Chrome can also load this folder directly (manifest.json is the Chrome manifest).
$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$dist = Join-Path $root "dist"
if (Test-Path $dist) { Remove-Item $dist -Recurse -Force }

foreach ($target in @("chrome", "firefox")) {
    $out = Join-Path $dist $target
    New-Item -ItemType Directory -Path $out | Out-Null
    foreach ($item in @("src", "icons", "_locales")) {
        Copy-Item (Join-Path $root $item) -Destination $out -Recurse
    }
    $manifest = if ($target -eq "firefox") { "manifest.firefox.json" } else { "manifest.json" }
    Copy-Item (Join-Path $root $manifest) -Destination (Join-Path $out "manifest.json")
    $zip = Join-Path $dist ("doinp-bet-logger-" + $target + ".zip")
    Compress-Archive -Path (Join-Path $out "*") -DestinationPath $zip -Force
    Write-Host ("Built " + $out + "  ->  " + $zip)
}
