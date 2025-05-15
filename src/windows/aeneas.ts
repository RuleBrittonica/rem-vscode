import * as vscode from 'vscode';
import { exec } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs';
import * as path from 'path';

const execPromise = promisify(exec);

/**
 * Helper: Runs a shell command and logs its output.
 */
async function runCommand(cmd: string, options = {}): Promise<void> {
  try {
    const { stdout, stderr } = await execPromise(cmd, options);
    console.log(stdout);
    if (stderr) {
      console.error(stderr);
    }
  } catch (err) {
    throw new Error(`Command failed: ${cmd}\n${err}`);
  }
}

/**
 * Checks if the expected binaries exist in the provided folder.
 */
function binariesExist(binDir: string): boolean {
  const expectedBinaries = ['aeneas.exe', 'charon.exe', 'charon-driver.exe'];
  return expectedBinaries.every(bin => fs.existsSync(path.join(binDir, bin)));
}

export async function setupAeneasAndCharon(context: vscode.ExtensionContext): Promise<void> {
  if (process.platform !== 'win32') {
    vscode.window.showErrorMessage('Aeneas setup currently supports Windows only.');
    return;
  }

  const config = vscode.workspace.getConfiguration('remvscode');
  const configuredBinDir = config.get<string>('aeneasBinariesPath', '');

  const homeDir = process.env.USERPROFILE;
  if (!homeDir) {
    throw new Error('%USERPROFILE% is not defined.');
  }
  const defaultBinDir = path.join(homeDir, 'bin');
  const binDir = configuredBinDir.trim() !== '' ? configuredBinDir : defaultBinDir;

  if (binariesExist(binDir)) {
    vscode.window.showInformationMessage('Aeneas and CHARON binaries already exist.');
    await context.globalState.update('aeneasBinaries', {
      aeneas: path.join(binDir, 'aeneas.exe'),
      charon: path.join(binDir, 'charon.exe'),
      'charon-driver': path.join(binDir, 'charon-driver.exe'),
    });
    return;
  }

  if (!fs.existsSync(binDir)) {
    fs.mkdirSync(binDir, { recursive: true });
  }

  const extRoot = context.extensionPath;
  const repoUrl = 'https://github.com/RuleBrittonica/aeneas.git';
  const cloneDir = path.join(extRoot, 'aeneas');

  if (!fs.existsSync(cloneDir)) {
    vscode.window.showInformationMessage('Cloning Aeneas repository...');
    await runCommand(`git clone ${repoUrl} ${cloneDir}`);
  } else {
    vscode.window.showInformationMessage('Updating Aeneas repository...');
    await runCommand(`git -C ${cloneDir} pull`);
  }

  const options = { cwd: cloneDir };

  // 1. OCaml switch
  let currentSwitch = '';
  try {
    const { stdout } = await execPromise('opam switch show', options);
    currentSwitch = stdout.trim();
  } catch { /* ignore */ }
  if (currentSwitch !== '4.14.2') {
    vscode.window.showInformationMessage('Switching to OCaml 4.14.2...');
    await runCommand('opam switch create 4.14.2 || opam switch 4.14.2', options);
    const { stdout: opamEnv } = await execPromise('opam env', options);
    console.log('[INFO] opam env:', opamEnv);
  }

  // 2. Dependencies
  vscode.window.showInformationMessage('Installing OCaml dependencies...');
  await runCommand('opam update --yes', options);
  await runCommand('opam upgrade --yes --verbose', options);
  await runCommand(
    'opam install ppx_deriving visitors easy_logging zarith yojson core_unix odoc ocamlgraph menhir ocamlformat unionFind -y',
    options
  );

  // 3. Build CHARON
  vscode.window.showInformationMessage('Building CHARON...');
  await runCommand('make setup-charon', options);

  // 4. Build Aeneas
  vscode.window.showInformationMessage('Building Aeneas...');
  await runCommand('make', options);
  await runCommand('make test', options);

  // 5. Copy binaries
  const binaries = [
    './bin/aeneas.exe',
    './charon/bin/charon.exe',
    './charon/bin/charon-driver.exe',
  ];
  const binaryPaths: Record<string,string> = {};
  for (const rel of binaries) {
    const src = path.join(cloneDir, rel);
    if (fs.existsSync(src)) {
      const name = path.basename(rel);
      const dest = path.join(binDir, name);
      fs.copyFileSync(src, dest);
      binaryPaths[name.replace('.exe','')] = dest;
      vscode.window.showInformationMessage(`Copied ${name} → ${binDir}`);
    } else {
      vscode.window.showWarningMessage(`Missing binary: ${rel}`);
    }
  }
  await context.globalState.update('aeneasBinaries', binaryPaths);

  // 6. Clean up
  try {
    fs.rmSync(cloneDir, { recursive: true, force: true });
    vscode.window.showInformationMessage('Removed Aeneas clone.');
  } catch (err) {
    vscode.window.showWarningMessage(`Could not remove clone: ${err}`);
  }
}
