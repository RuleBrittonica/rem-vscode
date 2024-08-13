import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { generateNewCode } from './codeGeneration'; // Import the function

export function activate(context: vscode.ExtensionContext) {
  let disposable = vscode.commands.registerCommand('remvscode.refactor', async () => {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
      return;
    }

    const document = editor.document;
    const selection = editor.selection;

    // Get the start and end line numbers of the selection
    const startLine = selection.start.line;
    const endLine = selection.end.line;

    // Get the range for the entire selection area
    const startRange = document.lineAt(startLine).range.start;
    const endRange = document.lineAt(endLine).range.end;

    // Expand selection to cover the entire range from start of the first selected line to end of the last selected line
    const expandedSelection = new vscode.Selection(startRange, endRange);
    editor.selection = expandedSelection;

    // Get the expanded selected text
    const selectedText = editor.document.getText(editor.selection);

    // Display a dropdown menu with the options to refactor
    const options = [
      'Variable',
      'Function (fn)',
      'Struct',
      'Trait',
      'Implementation (impl)',
    ];
    const selectedOption = await vscode.window.showQuickPick(options, {
      placeHolder: 'Select an option to begin refactoring'
    });

    if (!selectedOption) {
      return; // User canceled the dropdown
    }

    // Get the prompt and placeholder text for the original name
    const { promptText: originalPrompt, placeholderText: originalPlaceholder } = getPandP_original(selectedOption);

    // Text field for name of the field to be refactored
    const originalNameTextField = await vscode.window.showInputBox({
      prompt: originalPrompt,
      placeHolder: originalPlaceholder,
    });

    if (!originalNameTextField) {
      return; // User canceled the input
    }

    // Get the prompt and placeholder text for the new name
    const { promptText: newPrompt, placeholderText: newPlaceholder } = getPandP_new(selectedOption);

    // Text field for the new name of the field to be refactored
    const newNameTextField = await vscode.window.showInputBox({
      prompt: newPrompt,
      placeHolder: newPlaceholder,
    });

    if (!newNameTextField) {
      return; // User canceled the input
    }

    // Create a webview panel to display the preview
    const panel = vscode.window.createWebviewPanel(
      'refactorPreview',
      'Refactor Preview',
      vscode.ViewColumn.One,
      {
        enableScripts: true,
        localResourceRoots: [
          vscode.Uri.file(path.join(context.extensionPath, 'src', 'css')),
          vscode.Uri.file(path.join(context.extensionPath, 'src', 'html'))
        ]
      }
    );

    // Get the path to the preview.html file
    const previewHtmlPath = vscode.Uri.file(path.join(context.extensionPath, 'src', 'html', 'preview.html'));
    const previewHtmlContent = fs.readFileSync(previewHtmlPath.fsPath, 'utf8');

    // Update the webview content
    panel.webview.html = getWebviewContent(previewHtmlContent, {
      selectedOption,
      originalNameTextField,
      newNameTextField,
      selectedText,
      cssUri: panel.webview.asWebviewUri(vscode.Uri.file(path.join(context.extensionPath, 'src', 'css', 'styles.css'))).toString()
    });

    // Immediately send the 'initialise' command to the webview
    panel.webview.postMessage({
      command: 'initialise',
      data: {
        originalCode: selectedText,
        option: selectedOption,
        originalName: originalNameTextField,
        newName: newNameTextField
      }
    });

    // Handle messages from the webview
    panel.webview.onDidReceiveMessage(
      message => {
        switch (message.command) {
          case 'initialise':
            // TODO Might need to add stuff here
            break;
          case 'preview':
            const newCode = generateNewCode(selectedText); // Generate the new code using the CLI
            panel.webview.postMessage({
              command: 'preview',
              data: {
                originalCode: selectedText,
                newCode: newCode // Send the generated new code
              }
            });
            panel.webview.postMessage({ command: 'showConfirmButton' });
            break;
          case 'confirm':
            vscode.window.showInformationMessage(`Confirmed refactoring: ${selectedOption}, from ${originalNameTextField} to ${newNameTextField}`);
            break;
          case 'close':
            panel.dispose(); // Close the webview panel
            break;
        }
      },
      undefined,
      context.subscriptions
    );
  });

  context.subscriptions.push(disposable);
}

function getWebviewContent(previewHtmlContent: string, context: {
    selectedOption: string,
    originalNameTextField: string,
    newNameTextField: string,
    selectedText: string,
    cssUri: string
  }): string {
  return previewHtmlContent
    .replace('{{selectedOption}}', context.selectedOption)
    .replace('{{originalName}}', context.originalNameTextField)
    .replace('{{newName}}', context.newNameTextField)
    .replace('{{selectedText}}', context.selectedText)
    .replace('{{cssUri}}', context.cssUri);
}

function getPandP_original(option: string) {
  // Define prompts and placeholders based on the option
  return {
    promptText: `Enter the original name for the ${option}:`,
    placeholderText: `Original ${option} Name`
  };
}

function getPandP_new(option: string) {
  // Define prompts and placeholders based on the option
  return {
    promptText: `Enter the new name for the ${option}:`,
    placeholderText: `New ${option} Name`
  };
}
