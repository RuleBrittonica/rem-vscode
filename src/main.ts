import * as vscode from 'vscode';
import { checkAll } from './check/checkEnv';

const INSTALL_BASE = 'https://github.com/RuleBrittonica/rem-vscode/scripts'

export async function activate(context: vscode.ExtensionContext) {
  // Only run on a rust file!
  if (!(vscode.window.activeTextEditor?.document.languageId === 'rust')) {
    return;
  }

  // 1) Check dependencies
  try {
    await checkAll();
  } catch (err: unknown) {
    const missingMsg = err instanceof Error ? err.message : String(err);
    const platformKey =
    process.platform === 'win32' ? 'windows'
      : process.platform === 'darwin' ? 'mac'
      : 'linux';

    const url = `${INSTALL_BASE}/${platformKey}/`;
    const choice = await vscode.window.showErrorMessage(
      `Missing dependencies: ${missingMsg}`,
      'Open install guide'
    );
    if (choice === 'Open install guide') {
      vscode.env.openExternal(vscode.Uri.parse(url));
    }

    return;
  }

  // 2) Inform user where the binaries live
  const binDir = vscode.workspace
    .getConfiguration('remvscode')
    .get<string>('aeneasBinariesPath')
    || defaultBinPath();
  vscode.window.showInformationMessage(
    `All dependencies found. Binaries at ${binDir}`
  );

  // 3) Register the command
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

// fallback for default ~/.local/bin on *nix, ~/bin on Windows
function defaultBinPath(): string {
  if (process.platform === 'win32') {
    return `${process.env.USERPROFILE}\\bin`;
  } else {
    return `${process.env.HOME}/.local/bin`;
  }
}