import { execSync } from 'child_process';
import * as os from 'os';

function commandExists(cmd: string): boolean {
  try {
    if (os.platform() === 'win32') {
      execSync(`where ${cmd}`, { stdio: 'ignore' });
    } else {
      execSync(`which ${cmd}`, { stdio: 'ignore' });
    }
    return true;
  } catch {
    return false;
  }
}

/**
 * Throws an Error whose .message is a comma-separated list of missing tools.
 */
export async function checkAll(): Promise<void> {
  const tools = ['rustup', 'opam', 'coqc', 'aeneas', 'charon', 'rem-cli'];
  const missing = tools.filter(t => !commandExists(t));
  if (missing.length > 0) {
    throw new Error(missing.join(', '));
  }
}