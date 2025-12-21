/**
 * Test Fixtures Utilities
 *
 * Provides utilities for loading and managing test fixtures.
 */

import { join } from 'node:path';

const FIXTURES_ROOT = join(import.meta.dir, '..', 'fixtures');

/**
 * Get the absolute path to a fixture file.
 */
export function fixturePath(relativePath: string): string {
  return join(FIXTURES_ROOT, relativePath);
}

/**
 * Get the file:// URI for a fixture file.
 */
export function fixtureUri(relativePath: string): string {
  return `file://${fixturePath(relativePath)}`;
}

/**
 * Load a fixture file as text.
 */
export async function loadFixture(relativePath: string): Promise<string> {
  const path = fixturePath(relativePath);
  return await Bun.file(path).text();
}

/**
 * Load a fixture file as JSON.
 */
export async function loadFixtureJson<T = unknown>(relativePath: string): Promise<T> {
  const content = await loadFixture(relativePath);
  return JSON.parse(content) as T;
}

/**
 * Check if a fixture file exists.
 */
export async function fixtureExists(relativePath: string): Promise<boolean> {
  const path = fixturePath(relativePath);
  return await Bun.file(path).exists();
}

/**
 * Sample document content for testing.
 */
export const sampleDocuments = {
  empty: '',
  singleLine: 'Hello, World!',
  multiLine: `Line 1
Line 2
Line 3`,
  typescript: `function greet(name: string): string {
  return \`Hello, \${name}!\`;
}

export { greet };`,
  json: `{
  "name": "test",
  "version": "1.0.0"
}`,
  withTabs: `function test() {
\treturn true;
}`,
  longLine: 'a'.repeat(1000),
  unicode: '你好世界 🌍 مرحبا بالعالم',
};

/**
 * Sample position pairs for testing.
 */
export const samplePositions = {
  start: { line: 0, column: 0 },
  middleOfLine: { line: 0, column: 5 },
  endOfLine: { line: 0, column: 13 },
  secondLine: { line: 1, column: 0 },
  lastLine: { line: 2, column: 0 },
};

/**
 * Sample ranges for testing.
 */
export const sampleRanges = {
  firstLine: {
    start: { line: 0, column: 0 },
    end: { line: 0, column: 13 },
  },
  firstWord: {
    start: { line: 0, column: 0 },
    end: { line: 0, column: 5 },
  },
  multiLine: {
    start: { line: 0, column: 5 },
    end: { line: 2, column: 3 },
  },
  entire: (lineCount: number) => ({
    start: { line: 0, column: 0 },
    end: { line: lineCount - 1, column: 0 },
  }),
};
