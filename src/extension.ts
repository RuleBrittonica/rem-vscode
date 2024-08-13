import * as vscode from 'vscode';

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

    // Process the refactoring using the selected option and inputs
    vscode.window.showInformationMessage(`Selected Option: ${selectedOption}, Original Name: ${originalNameTextField}, New Name: ${newNameTextField}`);

    // Call the CLI for REM :D
  });

  context.subscriptions.push(disposable);
}

export function deactivate() {}

// Function to get prompt and placeholder text for the original name
function getPandP_original(selectedOption: string): { promptText: string, placeholderText: string } {
  let promptText = '';
  let placeholderText = '';

  switch (selectedOption) {
    case 'Variable':
      promptText = 'Enter the name of the variable to be refactored';
      placeholderText = 'Variable name';
      break;
    case 'Function (fn)':
      promptText = 'Enter the name of the function to be refactored';
      placeholderText = 'Function name';
      break;
    case 'Struct':
      promptText = 'Enter the name of the struct to be refactored';
      placeholderText = 'Struct name';
      break;
    case 'Trait':
      promptText = 'Enter the name of the trait to be refactored';
      placeholderText = 'Trait name';
      break;
    case 'Implementation (impl)':
      promptText = 'Enter the name of the impl to be refactored';
      placeholderText = 'Implementation name';
      break;
    default:
      promptText = 'Enter the name of the item to be refactored';
      placeholderText = 'Item name';
  }

  return { promptText, placeholderText };
}

// Function to get prompt and placeholder text for the new name
function getPandP_new(selectedOption: string): { promptText: string, placeholderText: string } {
  let promptText = '';
  let placeholderText = '';

  switch (selectedOption) {
    case 'Variable':
      promptText = 'Enter the new name for the variable';
      placeholderText = 'New variable name';
      break;
    case 'Function (fn)':
      promptText = 'Enter the new name for the function';
      placeholderText = 'New function name';
      break;
    case 'Struct':
      promptText = 'Enter the new name for the struct';
      placeholderText = 'New struct name';
      break;
    case 'Trait':
      promptText = 'Enter the new name for the trait';
      placeholderText = 'New trait name';
      break;
    case 'Implementation (impl)':
      promptText = 'Enter the new name for the implementation';
      placeholderText = 'New implementation name';
      break;
    default:
      promptText = 'Enter the new name for the item';
      placeholderText = 'New item name';
  }

  return { promptText, placeholderText };
}