# macOS Install Instructions

This script bootstraps the full REM/Aeneas/CHARON toolchain on macOS using Homebrew and OPAM.

## Prerequisites

- **macOS 10.15+**
- **Homebrew** (will be installed if missing)
- Xcode Command Line Tools (prompted by Homebrew if not present)

## Installation Script

The installer is named `install.sh`.

### 1. Make the script executable

```bash
chmod +x install.sh
```

### 2. Run the script

```bash
./install.sh
```

The script will:
1. Install / update homebrew.
2. `brew install` core packages (`git`, `curl`, `pkg-config`, `openssl@3`,
   `opam`, `dune`, `make`)
3. Install *Rustup* (if missing) and the `nightly-2025-02-08 toolchain and
   components)
4. Initialise *Opam*, create an OCaml `4.14.2` switch, install Coq >= `8.18.0`
   and OCaml libraries.
5. Clone and build *AENEAS + CHARON*, then install their binaries to
   `~/.local/bin`.
6. Install `rem-command-line` via `cargo`

### 3 Add to your path
If not already in your shell's `$PATH`, add to your `~/.bash_profile` or `~/.zshrc`:

```bash
export PATH="$HOME/.local/bin:$HOME/.cargo/bin:$PATH"
```

## Troubleshooting

- the script sets `LDFLAGS` and `CPPFLAGS` to point to `openssl@3`
- if homebrew is slow or hangs, you may need to run:

```bash
brew update
brew doctor
```

