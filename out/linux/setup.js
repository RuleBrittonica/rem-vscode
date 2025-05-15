"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.setupEnvironment = setupEnvironment;
const vscode = __importStar(require("vscode"));
const child_process_1 = require("child_process");
const util_1 = require("util");
const execPromise = (0, util_1.promisify)(child_process_1.exec);
/**
 * Runs a shell command and returns its stdout and stderr.
 */
async function runCommand(command, cwd) {
    return execPromise(command, { cwd });
}
/**
 * Checks whether a command exists on the PATH.
 */
async function commandExists(cmd) {
    try {
        await runCommand(`command -v ${cmd}`);
        return true;
    }
    catch {
        return false;
    }
}
/**
 * Prompts the user to install a missing dependency.
 * If accepted, it runs the provided installation command.
 */
async function promptAndInstall(dependencyName, pkgName, installCommand) {
    const choice = await vscode.window.showInformationMessage(`The dependency "${dependencyName}" is required but not found. Would you like to install ${pkgName}?`, { modal: true }, "Yes");
    if (choice === "Yes") {
        try {
            vscode.window.showInformationMessage(`Installing ${pkgName}...`);
            await runCommand(installCommand);
            vscode.window.showInformationMessage(`${pkgName} installed successfully.`);
        }
        catch (error) {
            throw new Error(`Failed to install ${pkgName}: ${error}`);
        }
    }
    else {
        throw new Error(`Missing dependency: ${dependencyName}`);
    }
}
/**
 * Ensures that a command exists. If not, prompts the user to install it.
 */
async function ensureCommand(command, pkgName, installCmd) {
    if (!(await commandExists(command))) {
        await promptAndInstall(command, pkgName, installCmd);
        if (!(await commandExists(command))) {
            throw new Error(`After installation, ${command} is still missing.`);
        }
    }
    else {
        console.log(`[INFO] Found ${command}.`);
    }
}
/**
 * Checks that pkg-config can locate OpenSSL.
 */
async function ensureOpensslDev() {
    try {
        await runCommand(`pkg-config --exists openssl`);
        console.log("[INFO] OpenSSL found via pkg-config.");
    }
    catch {
        await promptAndInstall("openssl-dev", "libssl-dev", "sudo apt-get update && sudo apt-get install -y libssl-dev pkg-config");
    }
}
/**
 * Ensures that the Rust nightly toolchain is installed.
 */
async function ensureNightlyToolchain(toolchain) {
    // Ensure that rustup is installed. Attempt to install the toolchain if
    // missing.
    if (!(await commandExists("rustup"))) {
        await promptAndInstall("rustup", "rustup", "curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y");
    }
    if (!(await commandExists("rustup"))) {
        throw new Error("Failed to install rustup.");
    }
    else {
        console.log("[INFO] Found rustup.");
    }
    try {
        const { stdout } = await runCommand(`rustup toolchain list`);
        if (!stdout.split('\n').some(line => line.startsWith(toolchain))) {
            await promptAndInstall(toolchain, toolchain, `rustup toolchain install ${toolchain} --profile minimal`);
        }
        else {
            console.log(`[INFO] Found Rust toolchain ${toolchain}.`);
        }
    }
    catch (error) {
        throw new Error(`Error checking rustup toolchains: ${error}`);
    }
}
/**
 * Ensures that the required Rust components are installed for the given toolchain.
 */
async function ensureRustComponent(toolchain, component) {
    try {
        const { stdout } = await runCommand(`rustup component list --toolchain ${toolchain} --installed`);
        const installedComponents = stdout.split('\n').map(line => line.trim());
        // Map our expected component name to the prefix to search for.
        let expectedPrefix = component;
        if (component === "llvm-tools-preview") {
            expectedPrefix = "llvm-tools";
        }
        else if (component === "rust-analyzer-preview") {
            expectedPrefix = "rust-analyzer";
        }
        // For rust-std, rustc-dev, rust-src, and rustfmt, a simple prefix check works.
        const found = installedComponents.some(installed => installed.startsWith(expectedPrefix));
        if (!found) {
            await promptAndInstall(component, component, `rustup component add --toolchain ${toolchain} ${component}`);
        }
        else {
            console.log(`[INFO] Found component ${component} (matches prefix: ${expectedPrefix}) in ${toolchain}.`);
        }
    }
    catch (error) {
        throw new Error(`Error checking component ${component}: ${error}`);
    }
}
/**
 * Simple version comparison: returns true if actual >= required.
 */
function isVersionSufficient(actual, required) {
    const toNumbers = (v) => v.split('.').map((n) => parseInt(n, 10));
    const actualNums = toNumbers(actual);
    const requiredNums = toNumbers(required);
    for (let i = 0; i < requiredNums.length; i++) {
        if ((actualNums[i] || 0) > requiredNums[i])
            return true;
        if ((actualNums[i] || 0) < requiredNums[i])
            return false;
    }
    return true;
}
/**
 * Ensures that Coq is installed and meets the minimum version.
 */
async function ensureCoq(minVersion) {
    try {
        const { stdout } = await runCommand("coqc --version");
        const versionMatch = stdout.match(/version\s+([\d.]+)/i);
        if (!versionMatch) {
            throw new Error("Unable to parse Coq version.");
        }
        const actualVersion = versionMatch[1];
        if (!isVersionSufficient(actualVersion, minVersion)) {
            throw new Error(`Coq version ${actualVersion} is less than the required ${minVersion}.`);
        }
        console.log(`[INFO] Coq version ${actualVersion} is sufficient.`);
    }
    catch (error) {
        // Check if opam has been initialized before trying to install Coq
        if (!(await isOpamInitialized())) {
            vscode.window.showErrorMessage("Opam has not been initialized. Please run `opam init` in your terminal and then restart VS Code.");
            throw new Error("Opam has not been initialized.");
        }
        await promptAndInstall("Coq", `coq (version ${minVersion})`, `opam pin add coq ${minVersion} --yes --no-action && opam install coq -y`);
    }
}
async function isOpamInitialized() {
    try {
        // This command should work if opam has been initialized.
        await runCommand("opam config env");
        return true;
    }
    catch (error) {
        return false;
    }
}
/**
 * Checks that all required dependencies are installed.
 * This function is intended to be called each time the extension loads.
 */
async function setupEnvironment() {
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
    }
    catch (error) {
        vscode.window.showErrorMessage(`Setup error: ${error}`);
        console.error(error);
    }
}
// If running this module directly (for testing), call setupEnvironment.
if (require.main === module) {
    setupEnvironment().catch(console.error);
}
//# sourceMappingURL=setup.js.map