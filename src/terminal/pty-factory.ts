/**
 * PTY Backend Factory
 *
 * Creates PTY backend instances, selecting the appropriate implementation
 * based on availability and runtime context.
 *
 * Priority:
 * 1. In bundled binary: IPC backend (communicates with pty-bridge.ts)
 * 2. In development: node-pty or bun-pty directly
 */

import type { PTYBackend, PTYBackendOptions } from './pty-backend.ts';
import { debugLog } from '../debug.ts';
import { isBundledBinary, getBridgePath, isPtyInstalled } from './pty-loader.ts';

// Backend availability flags
let nodePtyAvailable: boolean | null = null;
let bunPtyAvailable: boolean | null = null;

/**
 * Check if node-pty is available (development mode only).
 */
async function checkNodePty(): Promise<boolean> {
  if (nodePtyAvailable !== null) return nodePtyAvailable;

  try {
    // Dynamic import to avoid bundling issues
    await import('node-pty');
    nodePtyAvailable = true;
    debugLog('[PTYFactory] node-pty is available');
  } catch {
    nodePtyAvailable = false;
    debugLog('[PTYFactory] node-pty not available');
  }
  return nodePtyAvailable;
}

/**
 * Check if bun-pty is available (development mode only).
 */
async function checkBunPty(): Promise<boolean> {
  if (bunPtyAvailable !== null) return bunPtyAvailable;

  try {
    // Try to import bun-pty
    await import('bun-pty');
    bunPtyAvailable = true;
    debugLog('[PTYFactory] bun-pty is available');
  } catch (error) {
    bunPtyAvailable = false;
    debugLog(`[PTYFactory] bun-pty not available: ${error}`);
  }
  return bunPtyAvailable;
}

/**
 * Create a PTY backend using the best available implementation.
 *
 * In bundled binary mode, uses IPC backend to communicate with pty-bridge.ts.
 * In development mode, uses node-pty or bun-pty directly.
 *
 * @throws Error if no PTY backend is available
 */
export async function createPtyBackend(options: PTYBackendOptions = {}): Promise<PTYBackend> {
  // In bundled binary mode, use IPC backend
  if (isBundledBinary()) {
    if (!isPtyInstalled()) {
      throw new Error(
        'PTY not available. Run Ultra from its installation directory first, ' +
          'or reinstall to set up PTY support.'
      );
    }

    try {
      const { createIpcPtyBackend } = await import('./backends/ipc-pty.ts');
      const bridgePath = getBridgePath();
      debugLog(`[PTYFactory] Using IPC backend with bridge: ${bridgePath}`);
      return createIpcPtyBackend(options, bridgePath);
    } catch (error) {
      debugLog(`[PTYFactory] Failed to create IPC backend: ${error}`);
      throw new Error(`Failed to create IPC PTY backend: ${error}`);
    }
  }

  // Development mode: try node-pty first, then bun-pty
  if (await checkNodePty()) {
    try {
      const { createNodePtyBackend } = await import('./backends/node-pty.ts');
      debugLog('[PTYFactory] Using node-pty backend');
      return createNodePtyBackend(options);
    } catch (error) {
      debugLog(`[PTYFactory] Failed to create node-pty backend: ${error}`);
    }
  }

  // Fall back to bun-pty
  if (await checkBunPty()) {
    try {
      const { createBunPtyBackend } = await import('./backends/bun-pty.ts');
      debugLog('[PTYFactory] Using bun-pty backend');
      return createBunPtyBackend(options);
    } catch (error) {
      debugLog(`[PTYFactory] Failed to create bun-pty backend: ${error}`);
    }
  }

  throw new Error('No PTY backend available. Install node-pty or bun-pty.');
}

/**
 * Synchronously create a PTY backend using bun-pty.
 * Use this when you know bun-pty is available (e.g., development mode).
 *
 * @throws Error if bun-pty is not available
 */
export function createPtyBackendSync(options: PTYBackendOptions = {}): PTYBackend {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { createBunPtyBackend } = require('./backends/bun-pty.ts');
  return createBunPtyBackend(options);
}

/**
 * Get info about available PTY backends.
 */
export async function getPtyBackendInfo(): Promise<{
  nodePty: boolean;
  bunPty: boolean;
  preferred: 'node-pty' | 'bun-pty' | 'none';
}> {
  const nodePty = await checkNodePty();
  const bunPty = await checkBunPty();

  let preferred: 'node-pty' | 'bun-pty' | 'none' = 'none';
  if (nodePty) preferred = 'node-pty';
  else if (bunPty) preferred = 'bun-pty';

  return { nodePty, bunPty, preferred };
}
