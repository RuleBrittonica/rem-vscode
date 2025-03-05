#!/bin/bash
set -euo pipefail

log_info() {
  echo "[INFO] $*"
}

log_error() {
  echo "[ERROR] $*" >&2
}

# Attempt to install a package using an available package manager.
install_package() {
  local pkg="$1"

  if command -v apt-get >/dev/null 2>&1; then
    log_info "Using apt-get to install $pkg"
    sudo apt-get update && sudo apt-get install -y "$pkg"
  elif command -v yum >/dev/null 2>&1; then
    log_info "Using yum to install $pkg"
    sudo yum install -y "$pkg"
  elif command -v pacman >/dev/null 2>&1; then
    log_info "Using pacman to install $pkg"
    sudo pacman -S --noconfirm "$pkg"
  elif command -v brew >/dev/null 2>&1; then
    log_info "Using brew to install $pkg"
    brew install "$pkg"
  else
    log_error "No supported package manager found. Please install $pkg manually."
    exit 1
  fi
}

# Check if a command exists; if not, attempt to install it.
# For the 'cargo' command on macOS, we install the 'rust' package.
ensure_command() {
  local cmd="$1"
  local pkg="$2"

  if ! command -v "$cmd" >/dev/null 2>&1; then
    log_info "'$cmd' not found. Attempting to install package '$pkg'..."
    install_package "$pkg"
    if ! command -v "$cmd" >/dev/null 2>&1; then
      log_error "Installation of '$pkg' did not result in '$cmd' being available. Aborting."
      exit 1
    fi
  else
    log_info "Found required command: $cmd"
  fi
}

# Install OpenSSL development libraries and pkg-config.
install_openssl_dev() {
  if command -v apt-get >/dev/null 2>&1; then
    log_info "Using apt-get to install libssl-dev and pkg-config"
    sudo apt-get update && sudo apt-get install -y libssl-dev pkg-config
  elif command -v yum >/dev/null 2>&1; then
    log_info "Using yum to install openssl-devel and pkg-config"
    sudo yum install -y openssl-devel pkg-config
  elif command -v pacman >/dev/null 2>&1; then
    log_info "Using pacman to install openssl and pkgconf"
    sudo pacman -S --noconfirm openssl pkgconf
  elif command -v brew >/dev/null 2>&1; then
    log_info "Using brew to install openssl and pkg-config"
    brew install openssl pkg-config
  else
    log_error "No supported package manager found. Please install OpenSSL development libraries and pkg-config manually."
    exit 1
  fi
}

# Ensure that pkg-config can locate OpenSSL.
ensure_openssl() {
  if pkg-config --exists openssl; then
    log_info "Found OpenSSL via pkg-config."
  else
    log_info "OpenSSL not found via pkg-config. Installing OpenSSL development libraries..."
    install_openssl_dev
  fi
}

# 1. Preliminary Checks and Install Missing Packages
# List of required commands.
# For 'cargo' we choose the package name based on the OS.
declare -A required_cmds=(
  ["git"]="git"
  ["make"]="make"
  ["cargo"]=$([[ "$(uname)" == "Darwin" ]] && echo "rust" || echo "cargo")
  ["pkg-config"]="pkg-config"
)

for cmd in "${!required_cmds[@]}"; do
  ensure_command "$cmd" "${required_cmds[$cmd]}"
done

ensure_openssl

# 2. Create Base Directory and Clone/Update Repositories
BASE_DIR="rem-matt-verification-example"
if [ ! -d "$BASE_DIR" ]; then
  log_info "Creating base directory '$BASE_DIR'..."
  mkdir "$BASE_DIR"
else
  log_info "Directory '$BASE_DIR' already exists."
fi
cd "$BASE_DIR"

repos=(
  "https://github.com/RuleBrittonica/rem-cli.git"
  "https://github.com/RuleBrittonica/rem-extract.git"
  "https://github.com/RuleBrittonica/rem-borrower.git"
  "https://github.com/RuleBrittonica/rem-constraint.git"
  "https://github.com/RuleBrittonica/rem-controller.git"
  "https://github.com/RuleBrittonica/rem-repairer.git"
  "https://github.com/RuleBrittonica/rem-utils.git"
  "https://github.com/RuleBrittonica/rem-verification.git"
)

for repo in "${repos[@]}"; do
  repo_name=$(basename "$repo" .git)
  if [ ! -d "$repo_name" ]; then
    log_info "Cloning repository '$repo_name' from $repo..."
    git clone "$repo"
  else
    if [ -d "$repo_name/.git" ]; then
      log_info "Repository '$repo_name' already exists. Updating repository..."
      git -C "$repo_name" pull
    else
      log_info "Directory '$repo_name' exists but is not a git repository. Skipping update."
    fi
  fi
done

# 3. Run the Aeneas Setup Script in rem-cli
cd rem-cli

# Check out the 'dev' branch and update it
git checkout dev
git pull

# Ensure opam is installed (required by setup_aeneas.sh)
if ! command -v opam >/dev/null 2>&1; then
  log_info "'opam' not found. Attempting to install 'opam'..."
  install_package opam
  if ! command -v opam >/dev/null 2>&1; then
    log_error "Installation of 'opam' did not result in 'opam' being available. Aborting."
    exit 1
  fi
  # Initialize opam if needed
  log_info "Initializing opam..."
  opam init -y
  eval "$(opam env)"
fi

# 4. Install rustup (if needed) and Set Up Both Stable and Nightly Toolchains
if ! command -v rustup >/dev/null 2>&1; then
  log_info "'rustup' not found. Attempting to install rustup..."
  ensure_command curl curl
  curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y
  # Source the cargo environment for the current session
  source "$HOME/.cargo/env"
  # Export Cargo's bin directory so it's available to sub-processes
  export PATH="$HOME/.cargo/bin:$PATH"
fi

if ! command -v rustup >/dev/null 2>&1; then
  log_error "rustup installation failed. Aborting."
  exit 1
fi

# Install the latest stable toolchain.
log_info "Installing stable Rust toolchain..."
rustup toolchain install stable

# Now install the specified nightly toolchain.
TOOLCHAIN="nightly-2025-02-08"
log_info "Installing Rust nightly toolchain ${TOOLCHAIN} with minimal profile..."
rustup toolchain install "${TOOLCHAIN}" --profile minimal

# Attempt to add required components to the nightly toolchain.
for component in rust-src rust-std rustc-dev llvm-tools-preview rust-analyzer-preview rustfmt; do
    log_info "Adding component '${component}' to nightly toolchain ${TOOLCHAIN}..."
    if ! rustup component add --toolchain "${TOOLCHAIN}" "${component}"; then
        log_error "Component '${component}' is not available for ${TOOLCHAIN}. Aborting."
        exit 1
    fi
done

# Ensure that dune and CoQ are both installed
log_info "Ensuring dune is installed via opam..."
if ! opam list --installed --short | grep -q "^dune\$"; then
  opam install dune -y
fi

log_info "Pinning coq to version 8.18.0 and installing it via opam..."
opam pin add coq 8.18.0 --yes --no-action || true
opam install coq -y

# Update opam environment to ensure that dune is in PATH.
eval "$(opam env)"

# 5. Run the Aeneas Setup Script
# Ensure the setup script exists and is executable.
if [ ! -f "setup_aeneas.sh" ]; then
  log_error "setup_aeneas.sh not found in rem-cli."
  exit 1
fi

chmod +x setup_aeneas.sh
if [ ! -x "setup_aeneas.sh" ]; then
  log_error "setup_aeneas.sh is not executable even after chmod."
  exit 1
fi

log_info "Running Aeneas setup script..."
./setup_aeneas.sh

# 6. Build the Release Version of rem-cli
log_info "Building the release version of rem-cli..."
cargo build --release

log_info "Multi-repo setup complete!"