# Windows Install Instructions

This script bootstraps the full REM/Aeneas/CHARON toolchain on Windows 10+ using PowerShell and WinGet (no WSL required).

## Prerequisites

- Windows 10 version 1809+ or Windows 11
- PowerShell (built-in)
- Administrator privileges
- WinGet (App Installer)

## Installation Script

The installer is named `install.ps1`.

### 1. Open PowerShell as Administrator

1. Press **Windows** key, type `PowerShell`
2. Right-click **Windows PowerShell**, select **Run as administrator**

### 2. Unblock & run the script

```powershell
Set-ExecutionPolicy Bypass -Scope Process -Force
.\install_windows.ps1
```

The script will:
1. Install *Git* and *OPAM(OCaml & Coq)* via WinGet
2. Initialise *OPAM*, create an OCaml `4.14.2` switch, install Dune and OCaml
   libraries, pin and install Coq >= 8.18.0
3. Install *rustup* and the `nightly-2025-02-08` toolchain & components
4. Clone & build *Aeneas + CHARON* using OPAM's MSYS2 Bash
5. Copy `aeneas.exe`, `charon.exe` `charon-driver.exe` to `%USERPROFILE%\bin`
6. Install *rem-command-line* via `cargo`

### 3. Add to your PATH
Ensure the follwoing are in your *User* path
- `%USERPROFILE%\bin`
- `%USERPROFILE%\.cargo\bin`

Edit via *Settings -> System -> About -> Advanced system settings -> Environment
Variables*.

## Troubleshooting
- *WinGet missing*: Install the *App Installer* from the Microsoft Store.
- *OPAM commands not found*: Ensure you have run the script in a PowerShell session
  with administrator privileges. Restart powerShell. As a last resort, run:
```bash
opam init --disable-sandboxing -y
opam env --shell=powershell | Invoke-Expression
```
- *MSYS2 Bash not found*: check `opam var root` and look for
  `msys2\usr\bin\bash.exe`. under that folder.

