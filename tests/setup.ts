/**
 * Global Test Setup
 *
 * This file is loaded before all tests via bunfig.toml preload.
 */

import { beforeAll, afterAll } from 'bun:test';
import { cleanupAllTempWorkspaces } from './helpers/temp-workspace.ts';

// Global setup
beforeAll(() => {
  // Set test environment
  process.env.ULTRA_TEST = 'true';

  // Disable debug logging during tests (unless DEBUG_TESTS is set)
  if (!process.env.DEBUG_TESTS) {
    process.env.ULTRA_DEBUG = 'false';
  }
});

// Global cleanup
afterAll(async () => {
  await cleanupAllTempWorkspaces();
});
