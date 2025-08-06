#!/usr/bin/env bash
set -euo pipefail

# 1) Setup build environment

echo "=> Updating apt repositories…"
sudo apt-get update

echo "=> Installing core system packages…"
sudo apt-get install -y \
    build-essential \
    git \
    curl \
    libssl-dev \
    pkg-config \
    opam \
    dune

# 2) Install rustup (hopefully you already have it!) and ensure correct toolchain
if ! command -v rustup >/dev/null 2>&1; then
  echo "=> Installing rustup…"
  curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y
  export PATH="$HOME/.cargo/bin:$PATH"
fi

TOOLCHAIN="nightly-2025-02-08"
echo "=> Installing Rust toolchain $TOOLCHAIN…"
rustup toolchain install "$TOOLCHAIN" --profile minimal
for comp in rust-src rust-std rustc-dev llvm-tools-preview rust-analyzer-preview rustfmt; do
  rustup component add "$comp" --toolchain "$TOOLCHAIN"
done

# 3) Ensure OPAM is initialized and install CoQ dependencies
if ! opam config env >/dev/null 2>&1; then
  echo "=> Initializing OPAM…"
  opam init -y --disable-sandboxing
fi
eval "$(opam env)"

SWITCH="4.14.2"
echo "=> Creating/updating OPAM switch $SWITCH…"
opam switch create "$SWITCH" --yes || opam switch "$SWITCH"
eval "$(opam env)"

echo "=> Updating OPAM packages…"
opam update --yes
opam upgrade --yes --verbose

echo "=> Installing OCaml libraries…"
opam install -y \
  ppx_deriving visitors easy_logging zarith yojson \
  core_unix odoc ocamlgraph menhir ocamlformat unionFind

REQ_COQ="8.18.0"
if ! coqc --version 2>/dev/null | grep -qE "version[[:space:]]+$REQ_COQ"; then
  echo "=> Installing Coq $REQ_COQ…"
  opam pin add coq "$REQ_COQ" --yes --no-action
  opam install -y coq
fi

# 4) Install Aeneas and CHARON

# This is a pinned version of aeneas that is known to work with the current
# setup.It has a couple of changes to the Mkaefile to remove Nix compatibility
# but make it easier to build across the board. Feel free to install from source
# but YMMV.
REPO="https://github.com/RuleBrittonica/aeneas.git"
CLONE_DIR="$HOME/.cache/aeneas"

echo "=> Cloning/updating Aeneas repo…"
if [ ! -d "$CLONE_DIR" ]; then
  git clone "$REPO" "$CLONE_DIR"
else
  git -C "$CLONE_DIR" pull
fi

echo "=> Building CHARON…"
cd "$CLONE_DIR"
make setup-charon

echo "=> Building Aeneas…"
make

echo "=> Running Aeneas install tests..."
make test

BIN_DIR="${XDG_BIN_HOME:-$HOME/.local/bin}"
mkdir -p "$BIN_DIR"
for rel in bin/aeneas charon/bin/charon charon/bin/charon-driver; do
  if [ -f "$CLONE_DIR/$rel" ]; then
    echo "    → Installing $(basename "$rel") to $BIN_DIR"
    cp "$CLONE_DIR/$rel" "$BIN_DIR"
    chmod +x "$BIN_DIR/$(basename "$rel")"
  else
    echo "Warning: $rel not found"
  fi
done

# 5) Ensure rem-command-line is installed

echo "=> Switching Rust default to $TOOLCHAIN…"
rustup default "$TOOLCHAIN"

if ! command -v rem-cli >/dev/null 2>&1; then
  echo "=> Installing rem-command-line via cargo…"
  cargo install rem-command-line --locked
else
  echo "=> rem-cli already present (skipping)"
fi

echo "All done! Make sure \$HOME/.local/bin is on your PATH:"
echo '    export PATH="$HOME/.local/bin:$PATH"'
