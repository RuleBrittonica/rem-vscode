# run from an Administrator or normal shell
$deps = 'rustup','opam','coqc','aeneas','charon','rem-cli'
$missing = @()

foreach ($d in $deps) {
  if (-not (Get-Command $d -ErrorAction SilentlyContinue)) {
    $missing += $d
  }
}

if ($missing.Count -gt 0) {
  Write-Host "Missing dependencies: $($missing -join ', ')" -ForegroundColor Red
  Write-Host "Run windows\install.ps1 in this folder."
  exit 1
}

Write-Host "All OK!" -ForegroundColor Green
