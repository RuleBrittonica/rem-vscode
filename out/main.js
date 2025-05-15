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
exports.activate = activate;
exports.deactivate = deactivate;
const vscode = __importStar(require("vscode"));
const child_process_1 = require("child_process");
const setup_1 = require("./linux/setup");
const aeneas_1 = require("./linux/aeneas");
const cli_1 = require("./linux/cli");
async function activate(context) {
    // Run environment setup on extension activation. This won't do anything once
    // the environment is set up, but it's a good practice to ensure the environment
    // is ready when the extension is activated.
    if (vscode.window.activeTextEditor &&
        vscode.window.activeTextEditor.document.languageId === 'rust') {
        try {
            await (0, setup_1.setupEnvironment)();
            await (0, aeneas_1.setupAeneasAndCharon)(context);
            await (0, cli_1.ensureRemCommandLineInstalled)();
        }
        catch (error) {
            vscode.window.showErrorMessage(`Setup failed: ${error}`);
        }
    }
    // Have a message that displays the paths to the binaries
    const binDirDisplay = vscode.workspace.getConfiguration('remvscode').get('aeneasBinariesPath', '');
    vscode.window.showInformationMessage(`Aeneas and Charon binaries are located at: ${binDirDisplay}`);
    let disposable = vscode.commands.registerCommand('remvscode.refactor', async () => {
        // Get the active editor
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
            vscode.window.showErrorMessage('No active editor found!');
            return;
        }
        const document = editor.document;
        const selection = editor.selection;
        // Determine the start and end indices based on the selection
        const startIndex = document.offsetAt(selection.start);
        const endIndex = document.offsetAt(selection.end);
        // Get the full file path
        const filePath = document.uri.fsPath;
        // Prompt the user for the new function name
        const newFnName = await vscode.window.showInputBox({
            prompt: 'Enter the new function name',
            placeHolder: 'new_function'
        });
        if (!newFnName) {
            vscode.window.showErrorMessage('A function name is required.');
            return;
        }
        // Get the configuration
        const config = vscode.workspace.getConfiguration('remvscode');
        const configuredBinDir = config.get('aeneasBinariesPath', '');
        // Use the configured directory if present, otherwise default to $HOME/.local/bin.
        const homeDir = process.env.HOME;
        const binDir = (configuredBinDir && configuredBinDir.trim() !== '')
            ? configuredBinDir.trim()
            : `${homeDir}/.local/bin`;
        // Build full paths to the charon and aeneas binaries.
        const charonPath = `${binDir}/charon`;
        const aeneasPath = `${binDir}/aeneas`;
        // Build the CLI command string.
        const command = `rem-cli run-short "${filePath}" ${newFnName} ${startIndex} ${endIndex} -c --charon-path ${charonPath} --aeneas-path ${aeneasPath}`;
        console.log(`EXECUTING rem-cli command: ${command}`);
        // Execute the CLI command
        (0, child_process_1.exec)(command, (error, stdout, stderr) => {
            if (error) {
                vscode.window.showErrorMessage(`Error: ${stderr || error.message}`);
                return;
            }
            // Optionally save the document after refactoring
            document.save();
            vscode.window.showInformationMessage('Refactoring completed successfully!');
        });
    });
    context.subscriptions.push(disposable);
}
function deactivate() { }
//# sourceMappingURL=main.js.map