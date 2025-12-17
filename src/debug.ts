/**
 * Debug logging utility
 *
 * Centralized debug logging that only writes when enabled.
 * Also sends messages to debug console if registered.
 */

import { appendFileSync } from 'fs';

let debugEnabled = false;
let debugConsoleCallback: ((timestamp: string, message: string) => void) | null = null;

export function setDebugEnabled(enabled: boolean): void {
  debugEnabled = enabled;
}

export function isDebugEnabled(): boolean {
  return debugEnabled;
}

/**
 * Register a callback to receive debug messages (for debug console)
 */
export function setDebugConsoleCallback(callback: (timestamp: string, message: string) => void | null): void {
  debugConsoleCallback = callback;
}

export function debugLog(msg: string): void {
  if (debugEnabled) {
    const timestamp = new Date().toISOString();
    appendFileSync('debug.log', `[${timestamp}] ${msg}\n`);

    // Also send to debug console if registered
    if (debugConsoleCallback) {
      debugConsoleCallback(timestamp, msg);
    }
  }
}
