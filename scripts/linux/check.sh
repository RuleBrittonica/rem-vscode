#!/usr/bin/env bash
set -euo pipefail

# list your binaries here
deps=( rustup opam coqc aeneas charon rem-cli )

missing=()
for cmd in "${deps[@]}"; do
  if ! command -v "$cmd" &>/dev/null; then
    missing+=("$cmd")
  fi
done

if [ ${#missing[@]} -gt 0 ]; then
  echo "Missing dependencies: ${missing[*]}"
  echo "Run the install script in this folder."
  exit 1
fi

echo "All OK!"