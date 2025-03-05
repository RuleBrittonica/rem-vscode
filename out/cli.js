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
exports.ensureRemCommandLineInstalled = ensureRemCommandLineInstalled;
const vscode = __importStar(require("vscode"));
const child_process_1 = require("child_process");
const util_1 = require("util");
const execPromise = (0, util_1.promisify)(child_process_1.exec);
/**
 * Checks if a given command exists in the system's PATH.
 */
async function commandExists(command) {
    try {
        await execPromise(`command -v ${command}`);
        return true;
    }
    catch {
        return false;
    }
}
/**
 * Gets the current rustc version as a string (e.g., "1.75.0").
 */
async function getRustVersion() {
    const { stdout } = await execPromise('rustc --version');
    const match = stdout.match(/rustc\s+([\d.]+)/);
    if (!match) {
        throw new Error('Unable to parse rustc version.');
    }
    return match[1];
}
/**
 * Compares two version strings.
 * Returns 1 if v1 > v2, -1 if v1 < v2, and 0 if equal.
 */
function compareVersions(v1, v2) {
    const parts1 = v1.split('.').map(Number);
    const parts2 = v2.split('.').map(Number);
    for (let i = 0; i < Math.max(parts1.length, parts2.length); i++) {
        const p1 = parts1[i] || 0;
        const p2 = parts2[i] || 0;
        if (p1 > p2)
            return 1;
        if (p1 < p2)
            return -1;
    }
    return 0;
}
/**
 * Ensures that rem-command-line is installed via cargo.
 * It first switches the active rust toolchain to nightly-2025-02-08,
 * then checks that rustc is at least version 1.84.0.
 * If not, it prompts the user to update the toolchain.
 */
async function ensureRemCommandLineInstalled() {
    const commandName = 'rem-command-line';
    const requiredVersion = '1.84.0';
    const targetToolchain = 'nightly-2025-02-08';
    // Switch to the required toolchain.
    try {
        await execPromise(`rustup default ${targetToolchain}`);
        vscode.window.showInformationMessage(`Switched rust toolchain to ${targetToolchain}.`);
        console.log(`[INFO] Switched rust toolchain to ${targetToolchain}.`);
    }
    catch (error) {
        vscode.window.showErrorMessage(`Failed to switch to ${targetToolchain}: ${error}`);
        console.log(`[ERROR] Failed to switch to ${targetToolchain}: ${error}`);
        throw error;
    }
    // Check current rustc version.
    let rustVersion;
    try {
        rustVersion = await getRustVersion();
        if (compareVersions(rustVersion, requiredVersion) < 0) {
            const choice = await vscode.window.showInformationMessage(`Your rustc version is ${rustVersion}. rem-command-line requires rustc ${requiredVersion} or newer. Would you like to update your toolchain?`, { modal: true }, "Yes", "No");
            if (choice === "Yes") {
                vscode.window.showInformationMessage("Updating rustup toolchains...");
                console.log(`[INFO] Updating rustup toolchains...`);
                // Update all installed toolchains.
                await execPromise(`rustup update`);
                rustVersion = await getRustVersion();
                if (compareVersions(rustVersion, requiredVersion) < 0) {
                    vscode.window.showErrorMessage(`Toolchain update did not succeed. Current rustc version is ${rustVersion}.`);
                    console.log(`[ERROR] rustc version ${rustVersion} is too old after update.`);
                    throw new Error(`rustc version ${rustVersion} is too old after update.`);
                }
            }
            else {
                vscode.window.showErrorMessage(`rustc version ${rustVersion} is too old. Please update your toolchain.`);
                console.log(`[ERROR] rustc version ${rustVersion} is too old.`);
                throw new Error(`rustc version ${rustVersion} is too old.`);
            }
        }
    }
    catch (error) {
        vscode.window.showErrorMessage(`Error checking rustc version: ${error}`);
        throw error;
    }
    // Check if rem-command-line is already installed.
    const command_alias = 'rem-cli';
    // Whilst rem-command-line is the crate name, rem-cli is the binary name.
    if (await commandExists(command_alias)) {
        vscode.window.showInformationMessage(`${commandName} is already installed.`);
        console.log(`[INFO] Found ${commandName}.`);
        return;
    }
    vscode.window.showInformationMessage(`${commandName} not found. Installing via cargo...`);
    console.log(`[INFO] ${commandName} not found. Installing via cargo...`);
    try {
        // Install rem-command-line using cargo.
        await execPromise(`cargo install rem-command-line --locked`);
        vscode.window.showInformationMessage(`${commandName} installed successfully.`);
        console.log(`[INFO] ${commandName} installed successfully.`);
    }
    catch (error) {
        vscode.window.showErrorMessage(`Failed to install ${commandName}: ${error}`);
        console.log(`[ERROR] Failed to install ${commandName}: ${error}`);
        throw error;
    }
    console.log(`[INFO] ${commandName} setup completed.`);
}
//# sourceMappingURL=cli.js.map