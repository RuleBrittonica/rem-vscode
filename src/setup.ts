import * as vscode from 'vscode';
import { exec } from 'child_process';
import { promisify } from 'util';

const execPromise = promisify(exec);

/**
 * Runs a shell command and returns its stdout and stderr.
 */
async function runCommand(command: string, cwd?: string): Promise<{ stdout: string; stderr: string }> {
  return execPromise(command, { cwd });
}

/**
 * Checks whether a command exists on the PATH.
 */
async function commandExists(cmd: string): Promise<boolean> {
  try {
    await runCommand(`command -v ${cmd}`);
    return true;
  } catch {
    return false;
  }
}

/**
 * Prompts the user to install a missing dependency.
 * If accepted, it runs the provided installation command.
 */
async function promptAndInstall(dependencyName: string, pkgName: string, installCommand: string): Promise<void> {
  const choice = await vscode.window.showInformationMessage(
    `The dependency "${dependencyName}" is required but not found. Would you like to install ${pkgName}?`,
    { modal: true },
    "Yes"
  );
  if (choice === "Yes") {
    try {
      vscode.window.showInformationMessage(`Installing ${pkgName}...`);
      await runCommand(installCommand);
      vscode.window.showInformationMessage(`${pkgName} installed successfully.`);
    } catch (error) {
      throw new Error(`Failed to install ${pkgName}: ${error}`);
    }
  } else {
    throw new Error(`Missing dependency: ${dependencyName}`);
  }
}

/**
 * Ensures that a command exists. If not, prompts the user to install it.
 */
async function ensureCommand(command: string, pkgName: string, installCmd: string): Promise<void> {
  if (!(await commandExists(command))) {
    await promptAndInstall(command, pkgName, installCmd);
    if (!(await commandExists(command))) {
      throw new Error(`After installation, ${command} is still missing.`);
    }
  } else {
    console.log(`[INFO] Found ${command}.`);
  }
}

/**
 * Checks that pkg-config can locate OpenSSL.
 */
async function ensureOpensslDev(): Promise<void> {
  try {
    await runCommand(`pkg-config --exists openssl`);
    console.log("[INFO] OpenSSL found via pkg-config.");
  } catch {
    await promptAndInstall("openssl-dev", "libssl-dev", "sudo apt-get update && sudo apt-get install -y libssl-dev pkg-config");
  }
}

/**
 * Ensures that the Rust nightly toolchain is installed.
 */
async function ensureNightlyToolchain(toolchain: string): Promise<void> {
  try {
    const { stdout } = await runCommand(`rustup toolchain list`);
    if (!stdout.split('\n').some(line => line.startsWith(toolchain))) {
      await promptAndInstall(
        toolchain,
        toolchain,
        `rustup toolchain install ${toolchain} --profile minimal`
      );
    } else {
      console.log(`[INFO] Found Rust toolchain ${toolchain}.`);
    }
  } catch (error) {
    throw new Error(`Error checking rustup toolchains: ${error}`);
  }
}

/**
 * Ensures that the required Rust components are installed for the given toolchain.
 */
async function ensureRustComponent(toolchain: string, component: string): Promise<void> {
    try {
      const { stdout } = await runCommand(`rustup component list --toolchain ${toolchain} --installed`);
      const installedComponents = stdout.split('\n').map(line => line.trim());

      // Map our expected component name to the prefix to search for.
      let expectedPrefix = component;
      if (component === "llvm-tools-preview") {
        expectedPrefix = "llvm-tools";
      } else if (component === "rust-analyzer-preview") {
        expectedPrefix = "rust-analyzer";
      }
      // For rust-std, rustc-dev, rust-src, and rustfmt, a simple prefix check works.
      const found = installedComponents.some(installed => installed.startsWith(expectedPrefix));
      if (!found) {
        await promptAndInstall(
          component,
          component,
          `rustup component add --toolchain ${toolchain} ${component}`
        );
      } else {
        console.log(`[INFO] Found component ${component} (matches prefix: ${expectedPrefix}) in ${toolchain}.`);
      }
    } catch (error) {
      throw new Error(`Error checking component ${component}: ${error}`);
    }
  }

/**
 * Simple version comparison: returns true if actual >= required.
 */
function isVersionSufficient(actual: string, required: string): boolean {
  const toNumbers = (v: string) => v.split('.').map((n) => parseInt(n, 10));
  const actualNums = toNumbers(actual);
  const requiredNums = toNumbers(required);
  for (let i = 0; i < requiredNums.length; i++) {
    if ((actualNums[i] || 0) > requiredNums[i]) return true;
    if ((actualNums[i] || 0) < requiredNums[i]) return false;
  }
  return true;
}

/**
 * Ensures that Coq is installed and meets the minimum version.
 */
async function ensureCoq(minVersion: string): Promise<void> {
  try {
    // Attempt to get the version using "coqc --version".
    const { stdout } = await runCommand("coqc --version");
    // Example output: "The Coq Proof Assistant, version 8.18.0 (January 2024)"
    const versionMatch = stdout.match(/version\s+([\d.]+)/i);
    if (!versionMatch) {
      throw new Error("Unable to parse Coq version.");
    }
    const actualVersion = versionMatch[1];
    if (!isVersionSufficient(actualVersion, minVersion)) {
      throw new Error(`Coq version ${actualVersion} is less than the required ${minVersion}.`);
    }
    console.log(`[INFO] Coq version ${actualVersion} is sufficient.`);
  } catch (error) {
    // If coqc is missing or version is insufficient, prompt to install via opam.
    await promptAndInstall(
      "Coq",
      `coq (version ${minVersion})`,
      `opam pin add coq ${minVersion} --yes --no-action && opam install coq -y`
    );
  }
}

/**
 * Checks that all required dependencies are installed.
 * This function is intended to be called each time the extension loads.
 */
export async function setupEnvironment(): Promise<void> {
  // Only support Linux for now.
  if (process.platform !== "linux") {
    vscode.window.showErrorMessage("Setup script currently supports Linux only.");
    return;
  }

  try {
    // 1. Ensure fundamental tools.
    await ensureOpensslDev();
    await ensureCommand("git", "git", "sudo apt-get update && sudo apt-get install -y git");
    await ensureCommand("make", "make", "sudo apt-get update && sudo apt-get install -y make");
    await ensureCommand("cargo", "cargo", "sudo apt-get update && sudo apt-get install -y cargo");
    await ensureCommand("pkg-config", "pkg-config", "sudo apt-get update && sudo apt-get install -y pkg-config");

    // 2. Ensure Rust nightly toolchain and components.
    const nightly = "nightly-2025-02-08";
    await ensureNightlyToolchain(nightly);
    const rustComponents = [
      "rust-src",
      "rust-std",
      "rustc-dev",
      "llvm-tools-preview",
      "rust-analyzer-preview",
      "rustfmt"
    ];
    for (const component of rustComponents) {
      await ensureRustComponent(nightly, component);
    }

    // 3. Ensure OCaml-related tools.
    await ensureCommand("opam", "opam", "sudo apt-get update && sudo apt-get install -y opam");
    await ensureCommand("dune", "dune", "sudo apt-get update && sudo apt-get install -y dune");

    // 4. Ensure Coq version 8.18.0 or above.
    await ensureCoq("8.18.0");

    vscode.window.showInformationMessage("All required dependencies are installed and up-to-date.");
  } catch (error) {
    vscode.window.showErrorMessage(`Setup error: ${error}`);
    console.error(error);
  }
}

// If running this module directly (for testing), call setupEnvironment.
if (require.main === module) {
  setupEnvironment().catch(console.error);
}
