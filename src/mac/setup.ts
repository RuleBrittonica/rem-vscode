// src/macSetup.ts

import * as vscode from 'vscode';
import { exec } from 'child_process';
import { promisify } from 'util';
import * as os from 'os';
import * as path from 'path';

const execPromise = promisify(exec);

/** Run a shell command and return stdout/stderr. */
async function runCommand(
  command: string,
  cwd?: string
): Promise<{ stdout: string; stderr: string }> {
  return execPromise(command, { cwd, env: process.env });
}

/** True if `cmd` is on PATH. */
async function commandExists(cmd: string): Promise<boolean> {
  try {
    await runCommand(`command -v ${cmd}`);
    return true;
  } catch {
    return false;
  }
}

/** Ask user and then run an install command. */
async function promptAndInstall(
  dependencyName: string,
  pkgName: string,
  installCommand: string
): Promise<void> {
  const choice = await vscode.window.showInformationMessage(
    `The dependency "${dependencyName}" is required but not found. Install ${pkgName}?`,
    { modal: true },
    "Yes"
  );
  if (choice !== "Yes") {
    throw new Error(`Missing dependency: ${dependencyName}`);
  }
  vscode.window.showInformationMessage(`Installing ${pkgName}…`);
  await runCommand(installCommand);
  vscode.window.showInformationMessage(`${pkgName} installed.`);
}

/** Ensure `cmd` exists, otherwise prompt to install. */
async function ensureCommand(
  cmd: string,
  pkgName: string,
  installCmd: string
) {
  if (!(await commandExists(cmd))) {
    await promptAndInstall(cmd, pkgName, installCmd);
    if (!(await commandExists(cmd))) {
      throw new Error(`After install, still no ${cmd}`);
    }
  } else {
    console.log(`[INFO] Found ${cmd}`);
  }
}

/** Make sure Homebrew is installed. */
async function ensureHomebrew() {
  if (!(await commandExists("brew"))) {
    throw new Error(
      "Homebrew is required. Please install it from https://brew.sh and restart VS Code."
    );
  }
}

/** Make sure Xcode Command-Line Tools are installed. */
async function ensureXcodeCLT() {
  try {
    await runCommand("xcode-select -p");
  } catch {
    throw new Error(
      "Xcode Command-Line Tools are not installed. Run `xcode-select --install` and restart VS Code."
    );
  }
}

/**
 * Ensure OpenSSL + pkg-config.
 * Homebrew puts OpenSSL “keg-only”, so we set PKG_CONFIG_PATH.
 */
async function ensureOpensslDev() {
  try {
    // point pkg-config at Homebrew’s OpenSSL
    const { stdout: prefix } = await runCommand("brew --prefix openssl");
    const pcPath = `${prefix.trim()}/lib/pkgconfig`;
    process.env.PKG_CONFIG_PATH = pcPath;
    await runCommand("pkg-config --exists openssl");
    console.log("[INFO] OpenSSL found via pkg-config");
  } catch {
    await promptAndInstall(
      "openssl",
      "openssl + pkg-config",
      "brew install openssl pkg-config"
    );
    const { stdout: prefix2 } = await runCommand("brew --prefix openssl");
    process.env.PKG_CONFIG_PATH = `${prefix2.trim()}/lib/pkgconfig`;
  }
}

/** Ensure `rustup` and then install the nightly toolchain. */
async function ensureNightlyToolchain(toolchain: string) {
  if (!(await commandExists("rustup"))) {
    await promptAndInstall(
      "rustup",
      "rustup",
      "curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y"
    );
    // bring cargo/rustup into PATH immediately
    const cargoHome = process.env.CARGO_HOME ??
      path.join(os.homedir(), ".cargo");
    process.env.PATH = `${cargoHome}/bin:${process.env.PATH}`;
  }
  console.log("[INFO] Found rustup");

  const { stdout } = await runCommand("rustup toolchain list");
  if (!stdout.split("\n").some(line => line.startsWith(toolchain))) {
    await promptAndInstall(
      toolchain,
      `Rust nightly (${toolchain})`,
      `rustup toolchain install ${toolchain} --profile minimal`
    );
  } else {
    console.log(`[INFO] Toolchain ${toolchain} already installed`);
  }
}

/** Ensure a particular Rust component is present in that toolchain. */
async function ensureRustComponent(
  toolchain: string,
  component: string
) {
  const { stdout } = await runCommand(
    `rustup component list --toolchain ${toolchain} --installed`
  );
  const installed = stdout.split("\n").map(l => l.trim());
  const prefix =
    component === "llvm-tools-preview" ? "llvm-tools" :
    component === "rust-analyzer-preview" ? "rust-analyzer" :
    component;

  if (!installed.some(c => c.startsWith(prefix))) {
    await promptAndInstall(
      component,
      component,
      `rustup component add --toolchain ${toolchain} ${component}`
    );
  } else {
    console.log(`[INFO] Rust component ${component} OK`);
  }
}

/** Compare semantic versions a ≥ b? */
function isVersionSufficient(actual: string, required: string): boolean {
  const toNums = (v: string) => v.split(".").map(x => parseInt(x, 10));
  const A = toNums(actual), R = toNums(required);
  for (let i = 0; i < R.length; i++) {
    if ((A[i] || 0) > R[i]) return true;
    if ((A[i] || 0) < R[i]) return false;
  }
  return true;
}

/** True if `opam switch show` succeeds. */
async function isOpamInitialized(): Promise<boolean> {
  try {
    await runCommand("opam switch show");
    return true;
  } catch {
    return false;
  }
}

/**
 * Install Coq ≥ minVersion via OPAM.
 */
async function ensureCoq(minVersion: string) {
  if (!(await commandExists("opam"))) {
    await promptAndInstall("opam", "opam", "brew install opam");
  }

  if (!(await isOpamInitialized())) {
    vscode.window.showInformationMessage("Initializing OPAM…");
    // --bare avoids opening an editor; --yes skips prompts
    await runCommand("opam init --bare --yes");
    // reload OPAM env
    const { stdout } = await runCommand("opam env --shell=bash");
    // apply OPAM env vars to current process
    stdout.split("\n").forEach(line => {
      const m = line.match(/export (\w+)="(.+)"/);
      if (m) process.env[m[1]] = m[2];
    });
  }

  // ensure the desired Coq package is installed
  try {
    await runCommand("opam update --yes");
    await runCommand(`opam install coq.${minVersion} --yes`);
    console.log(`[INFO] Coq ${minVersion} installed via OPAM`);
  } catch (err) {
    throw new Error(`Failed to install Coq: ${err}`);
  }
}

/**
 * Main entry: call from your extension’s activate().
 */
export async function setupEnvironment(): Promise<void> {
  if (process.platform !== "darwin") {
    vscode.window.showErrorMessage("This setup only supports macOS.");
    return;
  }

  try {
    // 1. Homebrew & Xcode
    await ensureHomebrew();
    await ensureXcodeCLT();

    // 2. OpenSSL + pkg-config
    await ensureOpensslDev();

    // 3. Git & Make
    await ensureCommand("git", "git", "brew install git");
    await ensureCommand("make", "make", "brew install make");

    // 4. Rust via rustup
    const nightly = "nightly";
    await ensureNightlyToolchain(nightly);
    for (const comp of [
      "rust-src",
      "rust-std",
      "rustc-dev",
      "llvm-tools-preview",
      "rust-analyzer-preview",
      "rustfmt"
    ]) {
      await ensureRustComponent(nightly, comp);
    }

    // 5. OCaml / OPAM
    await ensureCommand("opam", "opam", "brew install opam");
    await ensureCommand("dune", "dune", "brew install dune");

    // 6. Coq ≥ 8.18.0
    await ensureCoq("8.18.0");

    vscode.window.showInformationMessage(
      "All dependencies are installed and up-to-date."
    );
  } catch (err) {
    vscode.window.showErrorMessage(`Setup error: ${err}`);
    console.error(err);
  }
}
