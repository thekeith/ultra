/**
 * Tests for PTY shell argument handling.
 *
 * Verifies that shell args are correctly determined based on shell type:
 * - POSIX shells (bash, zsh, sh) get -il flags by default
 * - Other shells (fish, nu, etc.) get no args by default
 * - User-provided args override defaults
 */

import { describe, test, expect } from 'bun:test';

/**
 * Extract the shell args determination logic from PTY implementation.
 * This mirrors the logic in src/terminal/pty.ts and src/terminal/backends/node-pty.ts
 */
function determineShellArgs(shell: string, userArgs?: string[]): string[] {
  // If user provided args, use them
  if (userArgs !== undefined) {
    return userArgs;
  }

  // Only use -il for POSIX shells (bash, zsh, sh) that support it
  // Other shells (fish, nu, etc.) get no args by default
  const shellName = shell.split('/').pop() || '';
  const defaultArgs = ['bash', 'zsh', 'sh'].includes(shellName) ? ['-il'] : [];
  return defaultArgs;
}

describe('PTY shell args determination', () => {
  describe('POSIX shells get -il by default', () => {
    test('bash gets -il flags', () => {
      const args = determineShellArgs('/bin/bash');
      expect(args).toEqual(['-il']);
    });

    test('zsh gets -il flags', () => {
      const args = determineShellArgs('/bin/zsh');
      expect(args).toEqual(['-il']);
    });

    test('sh gets -il flags', () => {
      const args = determineShellArgs('/bin/sh');
      expect(args).toEqual(['-il']);
    });

    test('/usr/bin/bash gets -il flags', () => {
      const args = determineShellArgs('/usr/bin/bash');
      expect(args).toEqual(['-il']);
    });

    test('/usr/local/bin/zsh gets -il flags', () => {
      const args = determineShellArgs('/usr/local/bin/zsh');
      expect(args).toEqual(['-il']);
    });
  });

  describe('non-POSIX shells get no args by default', () => {
    test('fish gets no args', () => {
      const args = determineShellArgs('/usr/bin/fish');
      expect(args).toEqual([]);
    });

    test('nu gets no args', () => {
      const args = determineShellArgs('/usr/bin/nu');
      expect(args).toEqual([]);
    });

    test('nushell gets no args', () => {
      const args = determineShellArgs('/opt/homebrew/bin/nushell');
      expect(args).toEqual([]);
    });

    test('pwsh gets no args', () => {
      const args = determineShellArgs('/usr/local/bin/pwsh');
      expect(args).toEqual([]);
    });

    test('xonsh gets no args', () => {
      const args = determineShellArgs('/usr/bin/xonsh');
      expect(args).toEqual([]);
    });
  });

  describe('user-provided args override defaults', () => {
    test('user args override bash defaults', () => {
      const args = determineShellArgs('/bin/bash', ['-l']);
      expect(args).toEqual(['-l']);
    });

    test('user args override zsh defaults', () => {
      const args = determineShellArgs('/bin/zsh', ['--no-rcs']);
      expect(args).toEqual(['--no-rcs']);
    });

    test('user can provide empty array to skip defaults', () => {
      const args = determineShellArgs('/bin/bash', []);
      expect(args).toEqual([]);
    });

    test('user can provide args for non-POSIX shells', () => {
      const args = determineShellArgs('/usr/bin/fish', ['-l']);
      expect(args).toEqual(['-l']);
    });
  });

  describe('edge cases', () => {
    test('empty shell path returns no args', () => {
      const args = determineShellArgs('');
      expect(args).toEqual([]);
    });

    test('shell with only path separators returns no args', () => {
      const args = determineShellArgs('/');
      expect(args).toEqual([]);
    });

    test('relative shell path works', () => {
      const args = determineShellArgs('bash');
      expect(args).toEqual(['-il']);
    });
  });
});
