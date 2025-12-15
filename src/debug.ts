/**
 * Debug logging utility
 * 
 * Centralized debug logging that only writes when enabled.
 */

import { appendFileSync } from 'fs';

let debugEnabled = false;

export function setDebugEnabled(enabled: boolean): void {
  debugEnabled = enabled;
}

export function isDebugEnabled(): boolean {
  return debugEnabled;
}

export function debugLog(msg: string): void {
  if (debugEnabled) {
    appendFileSync('debug.log', `[${new Date().toISOString()}] ${msg}\n`);
  }
}
