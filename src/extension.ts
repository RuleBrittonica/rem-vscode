import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';

export function activate(context: vscode.ExtensionContext) {
  let disposable = vscode.commands.registerCommand('remvscode.refactor', async () => {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
      return;
    }

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

    // Handle messages from the webview
    panel.webview.onDidReceiveMessage(
      message => {
        switch (message.command) {
          case 'preview':
            // Update the webview with preview information
            panel.webview.postMessage({
              command: 'update',
              data: {
                originalCode: selectedText,
                newCode: selectedText // For now, just showing the original code
              }
            });
            panel.webview.postMessage({ command: 'showConfirmButton' });
            break;
          case 'confirm':
            vscode.window.showInformationMessage(`Confirmed refactoring: ${selectedOption}, from ${originalNameTextField} to ${newNameTextField}`);
            // Call the CLI here
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