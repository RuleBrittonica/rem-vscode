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
exports.setupAeneasAndCharon = setupAeneasAndCharon;
const vscode = __importStar(require("vscode"));
const child_process_1 = require("child_process");
const util_1 = require("util");
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const execPromise = (0, util_1.promisify)(child_process_1.exec);
/**
 * Helper: Runs a shell command and logs its output.
 */
async function runCommand(cmd, options = {}) {
    try {
        const { stdout, stderr } = await execPromise(cmd, options);
        console.log(stdout);
        if (stderr) {
            console.error(stderr);
        }
    }
    catch (err) {
        throw new Error(`Command failed: ${cmd}\n${err}`);
    }
}
/**
 * Checks if the expected binaries exist in the provided folder.
 */
function binariesExist(binDir) {
    const expectedBinaries = ['aeneas', 'charon', 'charon-driver'];
    for (const bin of expectedBinaries) {
        if (!fs.existsSync(path.join(binDir, bin))) {
            return false;
        }
    }
    return true;
}
/**
 * Sets up Aeneas and Charon.
 *
 * This function checks the extension configuration for a pre-configured binary folder.
 * If the expected binaries are found there, it skips the setup. Otherwise, it clones the
 * Aeneas repository, sets up the OCaml switch, installs dependencies, builds CHARON and
 * Aeneas, copies the resulting binaries to the configured (or default) folder, stores their
 * paths in the extension's global state, and finally removes the cloned repository.
 */
async function setupAeneasAndCharon(context) {
    // Get the extension's configuration.
    const config = vscode.workspace.getConfiguration('remvscode');
    const configuredBinDir = config.get('aeneasBinariesPath', '');
    // Determine the folder where binaries should be placed.
    // If the user has configured a path, use that; otherwise, default to $HOME/.local/bin.
    const homeDir = process.env.HOME;
    if (!homeDir) {
        throw new Error('HOME environment variable is not defined.');
    }
    const defaultBinDir = path.join(homeDir, '.local', 'bin');
    const binDir = configuredBinDir.trim() !== '' ? configuredBinDir : defaultBinDir;
    // If the expected binaries already exist in binDir, skip setup.
    if (binariesExist(binDir)) {
        vscode.window.showInformationMessage('Aeneas and CHARON binaries already exist at the configured location.');
        console.log('[INFO] Aeneas and CHARON binaries already exist at the configured location.');
        // Optionally, update the global state.
        const binaryPaths = {
            aeneas: path.join(binDir, 'aeneas'),
            charon: path.join(binDir, 'charon'),
            'charon-driver': path.join(binDir, 'charon-driver')
        };
        await context.globalState.update('aeneasBinaries', binaryPaths);
        return;
    }
    // Ensure the target bin directory exists.
    if (!fs.existsSync(binDir)) {
        fs.mkdirSync(binDir, { recursive: true });
    }
    // Get the extension's root directory.
    const extRoot = context.extensionPath;
    // Define the repository URL and local clone directory.
    const repoUrl = 'https://github.com/RuleBrittonica/aeneas.git';
    const cloneDir = path.join(extRoot, 'aeneas');
    // Clone the repository if not already present.
    if (!fs.existsSync(cloneDir)) {
        vscode.window.showInformationMessage('Cloning Aeneas repository...');
        console.log('[INFO] Cloning Aeneas repository...');
        await runCommand(`git clone ${repoUrl} ${cloneDir}`);
    }
    else {
        vscode.window.showInformationMessage('Aeneas repository already cloned; updating...');
        console.log('[INFO] Aeneas repository already cloned; updating...');
        await runCommand(`git -C ${cloneDir} pull`);
    }
    // Set the working directory for subsequent commands.
    const options = { cwd: cloneDir };
    // 1. Set up the OCaml switch.
    let currentSwitch = '';
    try {
        const { stdout } = await execPromise('opam switch show', options);
        currentSwitch = stdout.trim();
    }
    catch (err) {
        console.error('Failed to get opam switch:', err);
    }
    if (currentSwitch !== '4.14.2') {
        vscode.window.showInformationMessage('Switching to OCaml switch 4.14.2...');
        // Create the switch if it doesn't exist, or switch to it.
        await runCommand('opam switch create 4.14.2 || opam switch 4.14.2', options);
        // Update the environment (logging for now; further parsing might be needed to update process.env)
        const { stdout: opamEnv } = await execPromise('opam env', options);
        console.log('[INFO] Updated opam environment:', opamEnv);
    }
    // 2. Install OCaml dependencies.
    vscode.window.showInformationMessage('Installing OCaml dependencies...');
    console.log('[INFO] Installing OCaml dependencies...');
    // Update opam package list.
    await runCommand('opam update --yes', options);
    await runCommand('opam upgrade --yes --verbose', options);
    await runCommand('opam install ppx_deriving visitors easy_logging zarith yojson core_unix odoc ocamlgraph menhir ocamlformat unionFind -y', options);
    // 3. Build CHARON.
    vscode.window.showInformationMessage('Building CHARON...');
    await runCommand('make setup-charon', options);
    // 4. Build Aeneas.
    vscode.window.showInformationMessage('Building Aeneas...');
    await runCommand('make', options);
    await runCommand('make test', options);
    // 5. Copy the binaries to the user's bin directory.
    const binaries = ['./bin/aeneas', './charon/bin/charon', './charon/bin/charon-driver'];
    const binaryPaths = {};
    for (const relPath of binaries) {
        const sourcePath = path.join(cloneDir, relPath);
        if (fs.existsSync(sourcePath)) {
            const destName = path.basename(relPath); // e.g. "aeneas", "charon", "charon-driver"
            const destPath = path.join(binDir, destName);
            fs.copyFileSync(sourcePath, destPath);
            // Optionally, make the binary executable.
            fs.chmodSync(destPath, 0o755);
            binaryPaths[destName] = destPath;
            vscode.window.showInformationMessage(`Copied ${relPath} to ${binDir}`);
            console.log(`[INFO] Copied ${relPath} to ${binDir}`);
        }
        else {
            vscode.window.showWarningMessage(`Binary not found: ${relPath}`);
            console.log(`[WARNING] Binary not found: ${relPath}`);
        }
    }
    // Save the binary paths in the extension's global state for later use.
    await context.globalState.update('aeneasBinaries', binaryPaths);
    vscode.window.showInformationMessage('Aeneas and CHARON setup complete.');
    // 6. Remove the cloned repository to save space.
    try {
        fs.rmSync(cloneDir, { recursive: true, force: true });
        vscode.window.showInformationMessage('Removed cloned Aeneas repository.');
    }
    catch (err) {
        vscode.window.showWarningMessage(`Failed to remove Aeneas repository: ${err}`);
    }
}
//# sourceMappingURL=aeneas.js.map