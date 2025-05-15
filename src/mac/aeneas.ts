import * as vscode from 'vscode';
import { exec } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs';
import * as path from 'path';

const execPromise = promisify(exec);

async function runCommand(cmd: string, options = {}): Promise<void> {
  try {
    const { stdout, stderr } = await execPromise(cmd, options);
    console.log(stdout);
    if (stderr) {console.error(stderr);}
  } catch (err) {
    throw new Error(`Command failed: ${cmd}\n${err}`);
  }
}

function binariesExist(binDir: string): boolean {
  const expectedBinaries = ['aeneas', 'charon', 'charon-driver'];
  return expectedBinaries.every(bin => fs.existsSync(path.join(binDir, bin)));
}

export async function setupAeneasAndCharon(context: vscode.ExtensionContext): Promise<void> {
  if (process.platform !== 'darwin') {
    vscode.window.showErrorMessage('Aeneas setup currently supports macOS only.');
    return;
  }

  const config = vscode.workspace.getConfiguration('remvscode');
  const configuredBinDir = config.get<string>('aeneasBinariesPath', '');

  const homeDir = process.env.HOME;
  if (!homeDir) {throw new Error('$HOME is not defined.');}
  const defaultBinDir = path.join(homeDir, '.local', 'bin');
  const binDir = configuredBinDir.trim() || defaultBinDir;

  if (binariesExist(binDir)) {
    vscode.window.showInformationMessage('Aeneas and CHARON binaries already exist.');
    await context.globalState.update('aeneasBinaries', {
      aeneas: path.join(binDir, 'aeneas'),
      charon: path.join(binDir, 'charon'),
      'charon-driver': path.join(binDir, 'charon-driver'),
    });
    return;
  }

  if (!fs.existsSync(binDir)) {fs.mkdirSync(binDir, { recursive: true });}

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

  const opts = { cwd: cloneDir };

  // 1. OCaml switch
  let currentSwitch = '';
  try {
    const { stdout } = await execPromise('opam switch show', opts);
    currentSwitch = stdout.trim();
  } catch {}
  if (currentSwitch !== '4.14.2') {
    vscode.window.showInformationMessage('Switching to OCaml 4.14.2...');
    await runCommand('opam switch create 4.14.2 || opam switch 4.14.2', opts);
    const { stdout: envOut } = await execPromise('opam env', opts);
    console.log('[INFO] opam env:', envOut);
  }

  // 2. Dependencies
  vscode.window.showInformationMessage('Installing OCaml dependencies...');
  await runCommand('opam update --yes', opts);
  await runCommand('opam upgrade --yes --verbose', opts);
  await runCommand(
    'opam install ppx_deriving visitors easy_logging zarith yojson core_unix odoc ocamlgraph menhir ocamlformat unionFind -y',
    opts
  );

  // 3. Build CHARON
  vscode.window.showInformationMessage('Building CHARON...');
  await runCommand('make setup-charon', opts);

  // 4. Build Aeneas
  vscode.window.showInformationMessage('Building Aeneas...');
  await runCommand('make', opts);
  await runCommand('make test', opts);

  // 5. Copy binaries
  const bins = ['./bin/aeneas', './charon/bin/charon', './charon/bin/charon-driver'];
  const paths: Record<string,string> = {};
  for (const rel of bins) {
    const src = path.join(cloneDir, rel);
    if (fs.existsSync(src)) {
      const name = path.basename(rel);
      const dest = path.join(binDir, name);
      fs.copyFileSync(src, dest);
      fs.chmodSync(dest, 0o755);
      paths[name] = dest;
      vscode.window.showInformationMessage(`Copied ${name} → ${binDir}`);
    } else {
      vscode.window.showWarningMessage(`Missing binary: ${rel}`);
    }
  }
  await context.globalState.update('aeneasBinaries', paths);

  // 6. Clean up
  try {
    fs.rmSync(cloneDir, { recursive: true, force: true });
    vscode.window.showInformationMessage('Removed Aeneas clone.');
  } catch (err) {
    vscode.window.showWarningMessage(`Could not remove clone: ${err}`);
  }
}
