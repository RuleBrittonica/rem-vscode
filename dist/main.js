"use strict";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/main.ts
var main_exports = {};
__export(main_exports, {
  activate: () => activate,
  deactivate: () => deactivate
});
module.exports = __toCommonJS(main_exports);
var vscode4 = __toESM(require("vscode"));
var import_child_process4 = require("child_process");

// src/linux/setup.ts
var vscode = __toESM(require("vscode"));
var import_child_process = require("child_process");
var import_util = require("util");
var execPromise = (0, import_util.promisify)(import_child_process.exec);
async function runCommand(command, cwd) {
  return execPromise(command, { cwd });
}
async function commandExists(cmd) {
  try {
    await runCommand(`command -v ${cmd}`);
    return true;
  } catch {
    return false;
  }
}
async function promptAndInstall(dependencyName, pkgName, installCommand) {
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
async function ensureCommand(command, pkgName, installCmd) {
  if (!await commandExists(command)) {
    await promptAndInstall(command, pkgName, installCmd);
    if (!await commandExists(command)) {
      throw new Error(`After installation, ${command} is still missing.`);
    }
  } else {
    console.log(`[INFO] Found ${command}.`);
  }
}
async function ensureOpensslDev() {
  try {
    await runCommand(`pkg-config --exists openssl`);
    console.log("[INFO] OpenSSL found via pkg-config.");
  } catch {
    await promptAndInstall("openssl-dev", "libssl-dev", "sudo apt-get update && sudo apt-get install -y libssl-dev pkg-config");
  }
}
async function ensureNightlyToolchain(toolchain) {
  if (!await commandExists("rustup")) {
    await promptAndInstall("rustup", "rustup", "curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y");
  }
  if (!await commandExists("rustup")) {
    throw new Error("Failed to install rustup.");
  } else {
    console.log("[INFO] Found rustup.");
  }
  try {
    const { stdout } = await runCommand(`rustup toolchain list`);
    if (!stdout.split("\n").some((line) => line.startsWith(toolchain))) {
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
async function ensureRustComponent(toolchain, component) {
  try {
    const { stdout } = await runCommand(`rustup component list --toolchain ${toolchain} --installed`);
    const installedComponents = stdout.split("\n").map((line) => line.trim());
    let expectedPrefix = component;
    if (component === "llvm-tools-preview") {
      expectedPrefix = "llvm-tools";
    } else if (component === "rust-analyzer-preview") {
      expectedPrefix = "rust-analyzer";
    }
    const found = installedComponents.some((installed) => installed.startsWith(expectedPrefix));
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
function isVersionSufficient(actual, required) {
  const toNumbers = (v) => v.split(".").map((n) => parseInt(n, 10));
  const actualNums = toNumbers(actual);
  const requiredNums = toNumbers(required);
  for (let i = 0; i < requiredNums.length; i++) {
    if ((actualNums[i] || 0) > requiredNums[i]) return true;
    if ((actualNums[i] || 0) < requiredNums[i]) return false;
  }
  return true;
}
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
  } catch (error) {
    if (!await isOpamInitialized()) {
      vscode.window.showErrorMessage("Opam has not been initialized. Please run `opam init` in your terminal and then restart VS Code.");
      throw new Error("Opam has not been initialized.");
    }
    await promptAndInstall(
      "Coq",
      `coq (version ${minVersion})`,
      `opam pin add coq ${minVersion} --yes --no-action && opam install coq -y`
    );
  }
}
async function isOpamInitialized() {
  try {
    await runCommand("opam config env");
    return true;
  } catch (error) {
    return false;
  }
}
async function setupEnvironment() {
  if (process.platform !== "linux") {
    vscode.window.showErrorMessage("Setup script currently supports Linux only.");
    return;
  }
  try {
    await ensureOpensslDev();
    await ensureCommand("git", "git", "sudo apt-get update && sudo apt-get install -y git");
    await ensureCommand("make", "make", "sudo apt-get update && sudo apt-get install -y make");
    await ensureCommand("cargo", "cargo", "sudo apt-get update && sudo apt-get install -y cargo");
    await ensureCommand("pkg-config", "pkg-config", "sudo apt-get update && sudo apt-get install -y pkg-config");
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
    await ensureCommand("opam", "opam", "sudo apt-get update && sudo apt-get install -y opam");
    await ensureCommand("dune", "dune", "sudo apt-get update && sudo apt-get install -y dune");
    await ensureCoq("8.18.0");
    vscode.window.showInformationMessage("All required dependencies are installed and up-to-date.");
  } catch (error) {
    vscode.window.showErrorMessage(`Setup error: ${error}`);
    console.error(error);
  }
}
if (require.main === module) {
  setupEnvironment().catch(console.error);
}

// src/linux/aeneas.ts
var vscode2 = __toESM(require("vscode"));
var import_child_process2 = require("child_process");
var import_util2 = require("util");
var fs = __toESM(require("fs"));
var path = __toESM(require("path"));
var execPromise2 = (0, import_util2.promisify)(import_child_process2.exec);
async function runCommand2(cmd, options = {}) {
  try {
    const { stdout, stderr } = await execPromise2(cmd, options);
    console.log(stdout);
    if (stderr) {
      console.error(stderr);
    }
  } catch (err) {
    throw new Error(`Command failed: ${cmd}
${err}`);
  }
}
function binariesExist(binDir) {
  const expectedBinaries = ["aeneas", "charon", "charon-driver"];
  for (const bin of expectedBinaries) {
    if (!fs.existsSync(path.join(binDir, bin))) {
      return false;
    }
  }
  return true;
}
async function setupAeneasAndCharon(context) {
  const config = vscode2.workspace.getConfiguration("remvscode");
  const configuredBinDir = config.get("aeneasBinariesPath", "");
  const homeDir = process.env.HOME;
  if (!homeDir) {
    throw new Error("HOME environment variable is not defined.");
  }
  const defaultBinDir = path.join(homeDir, ".local", "bin");
  const binDir = configuredBinDir.trim() !== "" ? configuredBinDir : defaultBinDir;
  if (binariesExist(binDir)) {
    vscode2.window.showInformationMessage("Aeneas and CHARON binaries already exist at the configured location.");
    console.log("[INFO] Aeneas and CHARON binaries already exist at the configured location.");
    const binaryPaths2 = {
      aeneas: path.join(binDir, "aeneas"),
      charon: path.join(binDir, "charon"),
      "charon-driver": path.join(binDir, "charon-driver")
    };
    await context.globalState.update("aeneasBinaries", binaryPaths2);
    return;
  }
  if (!fs.existsSync(binDir)) {
    fs.mkdirSync(binDir, { recursive: true });
  }
  const extRoot = context.extensionPath;
  const repoUrl = "https://github.com/RuleBrittonica/aeneas.git";
  const cloneDir = path.join(extRoot, "aeneas");
  if (!fs.existsSync(cloneDir)) {
    vscode2.window.showInformationMessage("Cloning Aeneas repository...");
    console.log("[INFO] Cloning Aeneas repository...");
    await runCommand2(`git clone ${repoUrl} ${cloneDir}`);
  } else {
    vscode2.window.showInformationMessage("Aeneas repository already cloned; updating...");
    console.log("[INFO] Aeneas repository already cloned; updating...");
    await runCommand2(`git -C ${cloneDir} pull`);
  }
  const options = { cwd: cloneDir };
  let currentSwitch = "";
  try {
    const { stdout } = await execPromise2("opam switch show", options);
    currentSwitch = stdout.trim();
  } catch (err) {
    console.error("Failed to get opam switch:", err);
  }
  if (currentSwitch !== "4.14.2") {
    vscode2.window.showInformationMessage("Switching to OCaml switch 4.14.2...");
    await runCommand2("opam switch create 4.14.2 || opam switch 4.14.2", options);
    const { stdout: opamEnv } = await execPromise2("opam env", options);
    console.log("[INFO] Updated opam environment:", opamEnv);
  }
  vscode2.window.showInformationMessage("Installing OCaml dependencies...");
  console.log("[INFO] Installing OCaml dependencies...");
  await runCommand2("opam update --yes", options);
  await runCommand2("opam upgrade --yes --verbose", options);
  await runCommand2(
    "opam install ppx_deriving visitors easy_logging zarith yojson core_unix odoc ocamlgraph menhir ocamlformat unionFind -y",
    options
  );
  vscode2.window.showInformationMessage("Building CHARON...");
  await runCommand2("make setup-charon", options);
  vscode2.window.showInformationMessage("Building Aeneas...");
  await runCommand2("make", options);
  await runCommand2("make test", options);
  const binaries = ["./bin/aeneas", "./charon/bin/charon", "./charon/bin/charon-driver"];
  const binaryPaths = {};
  for (const relPath of binaries) {
    const sourcePath = path.join(cloneDir, relPath);
    if (fs.existsSync(sourcePath)) {
      const destName = path.basename(relPath);
      const destPath = path.join(binDir, destName);
      fs.copyFileSync(sourcePath, destPath);
      fs.chmodSync(destPath, 493);
      binaryPaths[destName] = destPath;
      vscode2.window.showInformationMessage(`Copied ${relPath} to ${binDir}`);
      console.log(`[INFO] Copied ${relPath} to ${binDir}`);
    } else {
      vscode2.window.showWarningMessage(`Binary not found: ${relPath}`);
      console.log(`[WARNING] Binary not found: ${relPath}`);
    }
  }
  await context.globalState.update("aeneasBinaries", binaryPaths);
  vscode2.window.showInformationMessage("Aeneas and CHARON setup complete.");
  try {
    fs.rmSync(cloneDir, { recursive: true, force: true });
    vscode2.window.showInformationMessage("Removed cloned Aeneas repository.");
  } catch (err) {
    vscode2.window.showWarningMessage(`Failed to remove Aeneas repository: ${err}`);
  }
}

// src/linux/cli.ts
var vscode3 = __toESM(require("vscode"));
var import_child_process3 = require("child_process");
var import_util3 = require("util");
var execPromise3 = (0, import_util3.promisify)(import_child_process3.exec);
async function commandExists2(command) {
  try {
    await execPromise3(`command -v ${command}`);
    return true;
  } catch {
    return false;
  }
}
async function getRustVersion() {
  const { stdout } = await execPromise3("rustc --version");
  const match = stdout.match(/rustc\s+([\d.]+)/);
  if (!match) {
    throw new Error("Unable to parse rustc version.");
  }
  return match[1];
}
function compareVersions(v1, v2) {
  const parts1 = v1.split(".").map(Number);
  const parts2 = v2.split(".").map(Number);
  for (let i = 0; i < Math.max(parts1.length, parts2.length); i++) {
    const p1 = parts1[i] || 0;
    const p2 = parts2[i] || 0;
    if (p1 > p2) return 1;
    if (p1 < p2) return -1;
  }
  return 0;
}
async function ensureRemCommandLineInstalled() {
  const commandName = "rem-command-line";
  const requiredVersion = "1.84.0";
  const targetToolchain = "nightly-2025-02-08";
  try {
    await execPromise3(`rustup default ${targetToolchain}`);
    vscode3.window.showInformationMessage(`Switched rust toolchain to ${targetToolchain}.`);
    console.log(`[INFO] Switched rust toolchain to ${targetToolchain}.`);
  } catch (error) {
    vscode3.window.showErrorMessage(`Failed to switch to ${targetToolchain}: ${error}`);
    console.log(`[ERROR] Failed to switch to ${targetToolchain}: ${error}`);
    throw error;
  }
  let rustVersion;
  try {
    rustVersion = await getRustVersion();
    if (compareVersions(rustVersion, requiredVersion) < 0) {
      const choice = await vscode3.window.showInformationMessage(
        `Your rustc version is ${rustVersion}. rem-command-line requires rustc ${requiredVersion} or newer. Would you like to update your toolchain?`,
        { modal: true },
        "Yes",
        "No"
      );
      if (choice === "Yes") {
        vscode3.window.showInformationMessage("Updating rustup toolchains...");
        console.log(`[INFO] Updating rustup toolchains...`);
        await execPromise3(`rustup update`);
        rustVersion = await getRustVersion();
        if (compareVersions(rustVersion, requiredVersion) < 0) {
          vscode3.window.showErrorMessage(`Toolchain update did not succeed. Current rustc version is ${rustVersion}.`);
          console.log(`[ERROR] rustc version ${rustVersion} is too old after update.`);
          throw new Error(`rustc version ${rustVersion} is too old after update.`);
        }
      } else {
        vscode3.window.showErrorMessage(`rustc version ${rustVersion} is too old. Please update your toolchain.`);
        console.log(`[ERROR] rustc version ${rustVersion} is too old.`);
        throw new Error(`rustc version ${rustVersion} is too old.`);
      }
    }
  } catch (error) {
    vscode3.window.showErrorMessage(`Error checking rustc version: ${error}`);
    throw error;
  }
  const command_alias = "rem-cli";
  if (await commandExists2(command_alias)) {
    vscode3.window.showInformationMessage(`${commandName} is already installed.`);
    console.log(`[INFO] Found ${commandName}.`);
    return;
  }
  vscode3.window.showInformationMessage(`${commandName} not found. Installing via cargo...`);
  console.log(`[INFO] ${commandName} not found. Installing via cargo...`);
  try {
    await execPromise3(`cargo install rem-command-line --locked`);
    vscode3.window.showInformationMessage(`${commandName} installed successfully.`);
    console.log(`[INFO] ${commandName} installed successfully.`);
  } catch (error) {
    vscode3.window.showErrorMessage(`Failed to install ${commandName}: ${error}`);
    console.log(`[ERROR] Failed to install ${commandName}: ${error}`);
    throw error;
  }
  console.log(`[INFO] ${commandName} setup completed.`);
}

// src/main.ts
async function activate(context) {
  if (vscode4.window.activeTextEditor && vscode4.window.activeTextEditor.document.languageId === "rust") {
    try {
      await setupEnvironment();
      await setupAeneasAndCharon(context);
      await ensureRemCommandLineInstalled();
    } catch (error) {
      vscode4.window.showErrorMessage(`Setup failed: ${error}`);
    }
  }
  const binDirDisplay = vscode4.workspace.getConfiguration("remvscode").get("aeneasBinariesPath", "");
  vscode4.window.showInformationMessage(`Aeneas and Charon binaries are located at: ${binDirDisplay}`);
  let disposable = vscode4.commands.registerCommand("remvscode.refactor", async () => {
    const editor = vscode4.window.activeTextEditor;
    if (!editor) {
      vscode4.window.showErrorMessage("No active editor found!");
      return;
    }
    const document = editor.document;
    const selection = editor.selection;
    const startIndex = document.offsetAt(selection.start);
    const endIndex = document.offsetAt(selection.end);
    const filePath = document.uri.fsPath;
    const newFnName = await vscode4.window.showInputBox({
      prompt: "Enter the new function name",
      placeHolder: "new_function"
    });
    if (!newFnName) {
      vscode4.window.showErrorMessage("A function name is required.");
      return;
    }
    const config = vscode4.workspace.getConfiguration("remvscode");
    const configuredBinDir = config.get("aeneasBinariesPath", "");
    const homeDir = process.env.HOME;
    const binDir = configuredBinDir && configuredBinDir.trim() !== "" ? configuredBinDir.trim() : `${homeDir}/.local/bin`;
    const charonPath = `${binDir}/charon`;
    const aeneasPath = `${binDir}/aeneas`;
    const command = `rem-cli run-short "${filePath}" ${newFnName} ${startIndex} ${endIndex} -c --charon-path ${charonPath} --aeneas-path ${aeneasPath}`;
    console.log(`EXECUTING rem-cli command: ${command}`);
    (0, import_child_process4.exec)(command, (error, stdout, stderr) => {
      if (error) {
        vscode4.window.showErrorMessage(`Error: ${stderr || error.message}`);
        return;
      }
      document.save();
      vscode4.window.showInformationMessage("Refactoring completed successfully!");
    });
  });
  context.subscriptions.push(disposable);
}
function deactivate() {
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  activate,
  deactivate
});
//# sourceMappingURL=main.js.map
