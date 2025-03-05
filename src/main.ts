import * as vscode from 'vscode';
import { exec } from 'child_process';
import { setupEnvironment } from './setup';
import { setupAeneasAndCharon } from './aeneas';
import { ensureRemCommandLineInstalled } from './cli';


export async function activate(context: vscode.ExtensionContext) {
  // Run environment setup on extension activation. This won't do anything once
  // the environment is set up, but it's a good practice to ensure the environment
  // is ready when the extension is activated.
  if (vscode.window.activeTextEditor &&
      vscode.window.activeTextEditor.document.languageId === 'rust') {
        try {
          await setupEnvironment();
        } catch (error) {
          vscode.window.showErrorMessage(`Environment setup failed: ${error}`);
        }
        try {
          await setupAeneasAndCharon(context);
        } catch (error) {
          vscode.window.showErrorMessage(`Aeneas and Charon setup failed: ${error}`);
        }
        try {
          await ensureRemCommandLineInstalled();
        } catch (error) {
          vscode.window.showErrorMessage(`rem-command-line installation failed: ${error}`);
        }
  }

  // Have a message that displays the paths to the binaries
  const binDirDisplay = vscode.workspace.getConfiguration('remvscode').get<string>('aeneasBinariesPath', '');
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
    const configuredBinDir = config.get<string>('aeneasBinariesPath', '');

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
    exec(command, (error, stdout, stderr) => {
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

export function deactivate() {}