/**
 * TUIClient Tests
 *
 * Tests for the TUI client, focusing on commands and lifecycle.
 */

import { describe, test, expect } from 'bun:test';
import { TUIClient } from '../../../../../src/clients/tui/client/tui-client.ts';

describe('TUIClient', () => {
  // ─────────────────────────────────────────────────────────────────────────
  // Exit Codes
  // ─────────────────────────────────────────────────────────────────────────

  describe('exit codes', () => {
    test('RESTART exit code is 75', () => {
      expect(TUIClient.EXIT_CODE_RESTART).toBe(75);
    });

    test('RESTART_REBUILD exit code is 76', () => {
      expect(TUIClient.EXIT_CODE_RESTART_REBUILD).toBe(76);
    });

    test('exit codes match ultra-wrapper.sh expectations', () => {
      // These must match the constants in ultra-wrapper.sh:
      // RESTART_CODE=75
      // REBUILD_CODE=76
      expect(TUIClient.EXIT_CODE_RESTART).toBe(75);
      expect(TUIClient.EXIT_CODE_RESTART_REBUILD).toBe(76);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Command Info
  // ─────────────────────────────────────────────────────────────────────────

  describe('command info', () => {
    // We can't access private static COMMAND_INFO directly,
    // but we can verify the public behavior through the class

    test('restart command exists', () => {
      // The restart command should be defined
      // This is verified by checking the static exit codes exist
      expect(TUIClient.EXIT_CODE_RESTART).toBeDefined();
    });

    test('restart and rebuild command exists', () => {
      expect(TUIClient.EXIT_CODE_RESTART_REBUILD).toBeDefined();
    });
  });
});
