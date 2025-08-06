# Linux Install Instructions

This script bootstraps the full REM/Aeneas/CHARON toolchain on a Debian-based Linux (e.g., Ubuntu) system.

## Prerequisites

- **sudo** privileges
- Internet access

## Installation Script

The installer is named `install.sh`.

### 1. Make the script executable

```bash
chmod +x install.sh

### 2. Run the script

```bash
./install.sh
```

The script will:

1. Update `apt` repositories.
2. Intall core packages via `apt-get` (`build-essential, git, curl, libssl-dev,
   pkg-config, opam, dune)
3. Install *Rustup* (if missing) and the `nightly-2025-02-08 toolchain and
   components)
4. Initialise *Opam*, create an OCaml `4.14.2` switch, install Coq >= `8.18.0`
   and OCaml libraries.
5. Clone and build *AENEAS + CHARON*, then install their binaries to
   `~/.local/bin`.
6. Install `rem-command-line` via `cargo`

### 3 Add to your path
If not alreading in your shells `$PATH`, add:

```bash
export PATH="$HOME/.local/bin:$HOME/.cargo/bin:$PATH"
```

## Troubleshooting

- if `opam` commands fail, try:

```bash
opam init --disable-sandboxing -y
```

- for Git merge issues in AENEAS, ensure you have a clean clone:

```bash
rm -rf ~/.cache/aeneas && git clone https://github.com/RuleBrittonica/aeneas.git ~/.cache/aeneas
```