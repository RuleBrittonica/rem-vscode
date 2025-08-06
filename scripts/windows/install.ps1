<#
.SYNOPSIS
  Install the full REM/Aeneas/CHARON toolchain natively on Windows 10+.

.DESCRIPTION
  1) Installs Git and OPAM (with OCaml & Coq) via WinGet.
  2) Inits OPAM, creates switch, installs Dune & libraries.
  3) Installs Rust nightly-2025-02-08 + components via rustup.
  4) Uses OPAM’s MSYS2 bash to build Aeneas & CHARON.
  5) Copies aeneas.exe, charon.exe, charon-driver.exe → %USERPROFILE%\bin.
  6) Installs rem-command-line via cargo.
#>

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

function Write-Ok($msg){ Write-Host "$msg" -ForegroundColor Green }
function Write-Warn($msg){ Write-Host "$msg" -ForegroundColor Yellow }

# 1) Ensure WinGet is available
if (-not (Get-Command winget -ErrorAction SilentlyContinue)) {
  Write-Warn "WinGet not found. Please install the 'App Installer' from the Microsoft Store."
  exit 1
}

# 2) Install Git & OPAM (with OCaml & Coq) via WinGet
Write-Host "==> Installing Git and OPAM (OCaml) via WinGet…"
winget install --exact --id Git.Git --silent --accept-package-agreements
winget install --exact --id OCaml.opam --silent --accept-package-agreements
Write-Ok "Git and OPAM installed"

# 3) Bootstrap OPAM
Write-Host "==> Initializing OPAM…"
& opam init --disable-sandboxing -y | Out-Null

#   Ensure OPAM environment is loaded in this session
& opam env --shell=powershell | Invoke-Expression

# 3.a) Create/use OCaml 4.14.2 switch
$switch = "4.14.2"
Write-Host "==> Creating / switching to OPAM switch $switch…"
if (-not (& opam switch list --short | Select-String "^$switch$")) {
  & opam switch create $switch --yes
} else {
  & opam switch $switch
}
& opam env --shell=powershell | Invoke-Expression

# 3.b) Install OCaml platform tools & Coq (≥ 8.18.0)
Write-Host "==> Installing OCaml platform libraries via OPAM…"
& opam update --yes | Out-Null
& opam upgrade --yes | Out-Null
& opam install -y dune ppx_deriving visitors easy_logging zarith yojson `
                 core_unix odoc ocamlgraph menhir ocamlformat unionFind

$reqCoq = "8.18.0"
$coqVer = (& coqc --version 2>$null) -replace '[^\d\.]',''
if ($coqVer -ne $reqCoq) {
  Write-Host "==> Installing Coq $reqCoq…"
  & opam pin add coq $reqCoq --yes --no-action
  & opam install -y coq
}
Write-Ok "OPAM, OCaml, Dune & Coq ready"

# 4) Install Rust + nightly toolchain
$rustupExe = "$env:USERPROFILE\.cargo\bin\rustup.exe"
if (-not (Test-Path $rustupExe)) {
  Write-Host "==> Installing rustup…"
  $installer = "$env:TEMP\rustup-init.exe"
  Invoke-WebRequest -Uri "https://static.rust-lang.org/rustup/dist/x86_64-pc-windows-msvc/rustup-init.exe" `
                    -OutFile $installer
  Start-Process -FilePath $installer -ArgumentList "-y" -NoNewWindow -Wait
}
# Ensure Cargo & rustup are on PATH
$env:PATH = "$env:USERPROFILE\.cargo\bin;$env:PATH"

$toolchain = "nightly-2025-02-08"
Write-Host "==> Installing Rust toolchain $toolchain…"
rustup toolchain install $toolchain --profile minimal
"rust-src","rust-std","rustc-dev","llvm-tools-preview","rust-analyzer-preview","rustfmt" `
  | ForEach-Object { rustup component add $_ --toolchain $toolchain }
Write-Ok "Rust $toolchain + components ready"

# 5) Clone & build Aeneas/CHARON under MSYS2
$repo     = "https://github.com/RuleBrittonica/aeneas.git"
$cacheDir = "$env:LOCALAPPDATA\aeneas"
if (-not (Test-Path $cacheDir)) {
  git clone $repo $cacheDir
} else {
  git -C $cacheDir pull
}

# Locate the MSYS2 bash that OPAM installed
$opamRoot = (& opam var root).Trim()
$bashPath = Join-Path $opamRoot "msys2\usr\bin\bash.exe"
if (-not (Test-Path $bashPath)) {
  Write-Warn "Could not find MSYS2 bash at $bashPath"
} else {
  # Convert Windows path to MSYS path (C:\foo → /c/foo)
  $msysPath = "/" + ($cacheDir[0..0] -join '').ToLower() + ($cacheDir.Substring(2) -replace '\\','/')
  Write-Host "==> Building CHARON & Aeneas in MSYS2…"
  & $bashPath -lc "
    cd `"$msysPath`"
    make setup-charon
    make
    make test
  "
  Write-Ok "Built Aeneas & CHARON"
}

# 6) Copy binaries → %USERPROFILE%\bin
$binDir = "$env:USERPROFILE\bin"
if (-not (Test-Path $binDir)) { New-Item -ItemType Directory -Path $binDir | Out-Null }

@("bin/aeneas.exe","charon/bin/charon.exe","charon/bin/charon-driver.exe") `
  | ForEach-Object {
      $src = Join-Path $cacheDir ($_ -replace '/','\')
      if (Test-Path $src) {
        Copy-Item $src -Destination $binDir -Force
        Write-Host "Installed $([IO.Path]::GetFileName($src)) → $binDir"
      } else {
        Write-Warn "$src not found"
      }
    }

# 7) Install rem-command-line via Cargo
if (-not (Get-Command rem-cli -ErrorAction SilentlyContinue)) {
  Write-Host "==> Installing rem-command-line…"
  cargo install rem-command-line --locked
  Write-Ok "rem-cli installed"
} else {
  Write-Ok "rem-cli already present"
}

Write-Host "`nAll done!"
Write-Host "Add `$env:USERPROFILE\bin` (and `$env:USERPROFILE\.cargo\bin`) to your User PATH if you haven't already."