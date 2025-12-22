/**
 * PTY Loader
 *
 * Ensures node-pty is installed in ~/.ultra/node_modules for use by
 * the PTY bridge when running as a bundled binary.
 */

import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';
import { debugLog } from '../debug.ts';

export const ULTRA_HOME = path.join(os.homedir(), '.ultra');
export const NODE_MODULES = path.join(ULTRA_HOME, 'node_modules');

/**
 * Check if node-pty is installed in ~/.ultra
 */
export function isPtyInstalled(): boolean {
  const ptyPath = path.join(NODE_MODULES, 'node-pty');
  return fs.existsSync(ptyPath);
}

/**
 * Check if we're running in a bundled binary context.
 * In bundled binaries, import.meta.dir is /$bunfs/root
 */
export function isBundledBinary(): boolean {
  return import.meta.dir.startsWith('/$bunfs');
}

/**
 * Get the path to the PTY bridge script.
 * In development, it's in the source tree (run with bun).
 * In bundled mode, we write it to ~/.ultra as .mjs for Node.js.
 */
export function getBridgePath(): string {
  if (!isBundledBinary()) {
    // Development mode - use source file directly with bun
    return path.join(import.meta.dir, 'pty-bridge.ts');
  }

  // Bundled mode - use bridge in ~/.ultra (Node.js compatible .mjs)
  return path.join(ULTRA_HOME, 'pty-bridge.mjs');
}

/**
 * Check if we should use Node.js for the bridge.
 * In bundled mode, we use Node.js because Bun's tty.ReadStream doesn't
 * properly emit data events from PTY file descriptors.
 */
export function shouldUseNode(): boolean {
  return isBundledBinary();
}

/**
 * Ensure the PTY bridge script exists in ~/.ultra for bundled mode.
 */
export async function ensureBridgeScript(): Promise<void> {
  if (!isBundledBinary()) {
    return; // Not needed in development
  }

  const bridgePath = path.join(ULTRA_HOME, 'pty-bridge.mjs');

  // Always update the bridge script to ensure it's current
  // This is Node.js ESM format (.mjs) because Bun's tty.ReadStream doesn't work with PTY
  const bridgeScript = `#!/usr/bin/env node
/**
 * PTY Bridge Script (auto-generated)
 *
 * This script runs in a child Node.js process and provides PTY functionality
 * via IPC (stdin/stdout JSON messages).
 *
 * Note: We use Node.js instead of Bun because Bun's tty.ReadStream doesn't
 * properly emit data events from PTY file descriptors.
 */

import { createRequire } from 'node:module';
import * as path from 'path';
import * as os from 'os';
import * as readline from 'readline';

const ultraHome = path.join(os.homedir(), '.ultra');
const req = createRequire(path.join(ultraHome, 'package.json'));

let pty;
try {
  pty = req('node-pty');
} catch (e) {
  console.error(JSON.stringify({ event: 'error', data: \`Failed to load node-pty: \${e}\` }));
  process.exit(1);
}

let term = null;

function send(msg) {
  process.stdout.write(JSON.stringify(msg) + '\\n');
}

function handleMessage(msg) {
  const { id, method, params } = msg;

  try {
    switch (method) {
      case 'spawn': {
        if (term) {
          send({ id, error: 'PTY already spawned' });
          return;
        }

        const shell = params?.shell ?? process.env.SHELL ?? '/bin/zsh';
        const args = params?.args ?? [];
        const cwd = params?.cwd ?? process.cwd();
        const env = params?.env ?? {};
        const cols = params?.cols ?? 80;
        const rows = params?.rows ?? 24;

        term = pty.spawn(shell, args, {
          name: 'xterm-256color',
          cols,
          rows,
          cwd,
          env: { ...process.env, ...env },
        });

        term.onData((data) => {
          send({ event: 'data', data });
        });

        term.onExit(({ exitCode }) => {
          send({ event: 'exit', data: exitCode });
          term = null;
        });

        send({ id, result: { pid: term.pid } });
        break;
      }

      case 'write': {
        if (!term) {
          send({ id, error: 'No PTY spawned' });
          return;
        }
        term.write(params?.data);
        if (id !== undefined) send({ id, result: true });
        break;
      }

      case 'resize': {
        if (!term) {
          send({ id, error: 'No PTY spawned' });
          return;
        }
        term.resize(params?.cols, params?.rows);
        if (id !== undefined) send({ id, result: true });
        break;
      }

      case 'kill': {
        if (term) {
          term.kill();
          term = null;
        }
        if (id !== undefined) send({ id, result: true });
        break;
      }

      case 'ping': {
        send({ id, result: 'pong' });
        break;
      }

      default:
        send({ id, error: \`Unknown method: \${method}\` });
    }
  } catch (e) {
    send({ id, error: String(e) });
  }
}

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
  terminal: false,
});

rl.on('line', (line) => {
  try {
    const msg = JSON.parse(line);
    handleMessage(msg);
  } catch (e) {
    send({ event: 'error', data: \`Invalid message: \${e}\` });
  }
});

rl.on('close', () => {
  if (term) {
    term.kill();
  }
  process.exit(0);
});

send({ event: 'ready' });
`;

  await Bun.write(bridgePath, bridgeScript);
  debugLog(`[PTYLoader] Bridge script written to ${bridgePath}`);
}

/**
 * Install node-pty to ~/.ultra/node_modules
 * Returns true if successful, false otherwise.
 */
export async function installPty(): Promise<boolean> {
  debugLog('[PTYLoader] Installing node-pty to ~/.ultra ...');

  // Ensure ~/.ultra exists
  fs.mkdirSync(ULTRA_HOME, { recursive: true });

  // Create package.json if it doesn't exist
  const pkgPath = path.join(ULTRA_HOME, 'package.json');
  if (!fs.existsSync(pkgPath)) {
    fs.writeFileSync(
      pkgPath,
      JSON.stringify(
        {
          name: 'ultra-runtime',
          private: true,
          dependencies: {},
        },
        null,
        2
      )
    );
  }

  // Install node-pty using bun
  const proc = Bun.spawn(['bun', 'add', 'node-pty'], {
    cwd: ULTRA_HOME,
    stdout: 'pipe',
    stderr: 'pipe',
  });

  const exitCode = await proc.exited;

  if (exitCode === 0) {
    debugLog('[PTYLoader] node-pty installed successfully');

    // Fix spawn-helper permissions (bun doesn't set them correctly)
    const spawnHelperPath = path.join(
      NODE_MODULES,
      'node-pty',
      'prebuilds',
      `darwin-${process.arch}`,
      'spawn-helper'
    );
    if (fs.existsSync(spawnHelperPath)) {
      fs.chmodSync(spawnHelperPath, 0o755);
      debugLog('[PTYLoader] Fixed spawn-helper permissions');
    }

    return true;
  } else {
    const stderr = await new Response(proc.stderr).text();
    debugLog(`[PTYLoader] Failed to install node-pty: ${stderr}`);
    return false;
  }
}

/**
 * Ensure PTY support is available.
 * In bundled mode, installs node-pty to ~/.ultra if needed.
 * Returns true if PTY is ready to use.
 */
export async function ensurePtyAvailable(): Promise<boolean> {
  // In development mode, PTY should be available directly
  if (!isBundledBinary()) {
    return true;
  }

  // Check if node-pty is already installed
  if (isPtyInstalled()) {
    await ensureBridgeScript();
    return true;
  }

  // Install node-pty
  const installed = await installPty();
  if (installed) {
    await ensureBridgeScript();
  }
  return installed;
}
