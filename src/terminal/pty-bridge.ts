#!/usr/bin/env bun
/**
 * PTY Bridge Script
 *
 * This script runs in a child bun process and provides PTY functionality
 * via IPC (stdin/stdout JSON messages). This is necessary because bundled
 * Bun binaries cannot load native modules like node-pty directly.
 *
 * Protocol:
 * - Each message is a JSON object on a single line
 * - Requests: { id, method, params }
 * - Responses: { id, result } or { id, error }
 * - Events: { event, data }
 */

import { createRequire } from 'node:module';
import * as path from 'path';
import * as os from 'os';
import * as readline from 'readline';

// Load node-pty from ~/.ultra
const ultraHome = path.join(os.homedir(), '.ultra');
const req = createRequire(path.join(ultraHome, 'package.json'));

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let pty: any;
try {
  pty = req('node-pty');
} catch (e) {
  console.error(JSON.stringify({ event: 'error', data: `Failed to load node-pty: ${e}` }));
  process.exit(1);
}

// Active PTY process
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let term: any = null;

// Send a message to the parent process
function send(msg: object): void {
  process.stdout.write(JSON.stringify(msg) + '\n');
}

// Handle incoming messages
function handleMessage(msg: { id?: number; method: string; params?: Record<string, unknown> }): void {
  const { id, method, params } = msg;

  try {
    switch (method) {
      case 'spawn': {
        if (term) {
          send({ id, error: 'PTY already spawned' });
          return;
        }

        const shell = (params?.shell as string) ?? process.env.SHELL ?? '/bin/zsh';
        const args = (params?.args as string[]) ?? [];
        const cwd = (params?.cwd as string) ?? process.cwd();
        const env = (params?.env as Record<string, string>) ?? {};
        const cols = (params?.cols as number) ?? 80;
        const rows = (params?.rows as number) ?? 24;

        term = pty.spawn(shell, args, {
          name: 'xterm-256color',
          cols,
          rows,
          cwd,
          env: { ...process.env, ...env },
        });

        // Forward data events
        term.onData((data: string) => {
          send({ event: 'data', data });
        });

        // Forward exit events
        term.onExit(({ exitCode }: { exitCode: number }) => {
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
        term.write(params?.data as string);
        if (id !== undefined) send({ id, result: true });
        break;
      }

      case 'resize': {
        if (!term) {
          send({ id, error: 'No PTY spawned' });
          return;
        }
        const cols = params?.cols as number;
        const rows = params?.rows as number;
        term.resize(cols, rows);
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
        send({ id, error: `Unknown method: ${method}` });
    }
  } catch (e) {
    send({ id, error: String(e) });
  }
}

// Set up line reader for incoming messages
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
    send({ event: 'error', data: `Invalid message: ${e}` });
  }
});

rl.on('close', () => {
  if (term) {
    term.kill();
  }
  process.exit(0);
});

// Signal that we're ready
send({ event: 'ready' });
