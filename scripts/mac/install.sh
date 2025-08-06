#!/usr/bin/env bash
set -euo pipefail

# 1) Homebrew & Core Packages
echo "=> Checking for Homebrew…"
if ! command -v brew >/dev/null; then
  echo "   Homebrew not found. Installing…"
  /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
  echo 'eval "$(/opt/homebrew/bin/brew shellenv)"' >> ~/.bash_profile
  eval "$(/opt/homebrew/bin/brew shellenv)"
fi

echo "=> Updating Homebrew…"
brew update

echo "=> Installing core packages…"
brew install \
  git \
  curl \
  pkg-config \
  openssl@3 \
  opam \
  dune \
  make

# ensure we pick up openssl@3
export LDFLAGS="-L$(brew --prefix openssl@3)/lib"
export CPPFLAGS="-I$(brew --prefix openssl@3)/include"

# 2) Rust Toolchain
if ! command -v rustup >/dev/null; then
  echo "=> Installing rustup…"
  curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y
  export PATH="$HOME/.cargo/bin:$PATH"
fi

TOOLCHAIN="nightly-2025-02-08"
echo "=> Ensuring Rust toolchain $TOOLCHAIN…"
rustup toolchain install "$TOOLCHAIN" --profile minimal
for comp in rust-src rust-std rustc-dev llvm-tools-preview rust-analyzer-preview rustfmt; do
  rustup component add "$comp" --toolchain "$TOOLCHAIN"
done

# 3) OPAM / OCaml / Coq
echo "=> Initializing OPAM (if needed)…"
if ! opam config env >/dev/null 2>&1; then
  opam init -y --disable-sandboxing
fi
eval "$(opam env)"

SWITCH="4.14.2"
echo "=> Setting up OPAM switch $SWITCH…"
opam switch create "$SWITCH" --yes || opam switch "$SWITCH"
eval "$(opam env)"

echo "=> Updating OPAM…"
opam update --yes
opam upgrade --yes

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

# 4) Aeneas & CHARON

# This is a pinned version of aeneas that is known to work with the current
# setup.It has a couple of changes to the Mkaefile to remove Nix compatibility
# but make it easier to build across the board. Feel free to install from source
# but YMMV.
REPO="https://github.com/RuleBrittonica/aeneas.git"
CLONE="$HOME/.cache/aeneas"
BIN_DIR="${XDG_BIN_HOME:-$HOME/.local/bin}"

echo "=> Cloning/updating Aeneas…"
if [ ! -d "$CLONE" ]; then
  git clone "$REPO" "$CLONE"
else
  git -C "$CLONE" pull
fi

echo "=> Building CHARON & Aeneas…"
cd "$CLONE"
make setup-charon
make
make test

echo "=> Installing binaries to $BIN_DIR…"
mkdir -p "$BIN_DIR"
for rel in bin/aeneas charon/bin/charon charon/bin/charon-driver; do
  cp -v "$CLONE/$rel" "$BIN_DIR" && chmod +x "$BIN_DIR/$(basename "$rel")" || \
    echo "Warning: $rel not found"
done

# 5) rem-command-line
echo "=> Setting Rust default to $TOOLCHAIN…"
rustup default "$TOOLCHAIN"

if ! command -v rem-cli >/dev/null; then
  echo "=> Installing rem-command-line…"
  cargo install rem-command-line --locked
else
  echo "=> rem-cli already installed, skipping"
fi

echo
echo "Done! Make sure:"
echo '    export PATH="$HOME/.local/bin:$PATH"'
