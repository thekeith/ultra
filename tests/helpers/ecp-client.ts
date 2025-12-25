/**
 * Test ECP Client
 *
 * A testing utility that wraps ECPServer for testing ECP
 * services. Collects notifications for assertions.
 */

import { tmpdir } from 'os';
import { mkdir } from 'fs/promises';
import { ECPServer, type ECPServerOptions } from '../../src/ecp/server.ts';
import type { ECPResponse, ECPNotification } from '../../src/ecp/types.ts';
import type { LocalSessionService } from '../../src/services/session/local.ts';

/**
 * Options for creating a TestECPClient.
 */
export interface TestECPClientOptions extends ECPServerOptions {
  /** Whether to capture notifications */
  captureNotifications?: boolean;
}

/**
 * Test ECP Client for integration testing.
 *
 * @example
 * ```typescript
 * const client = new TestECPClient();
 *
 * // Open a document
 * const { documentId } = await client.request('document/open', {
 *   uri: 'memory://test.txt',
 *   content: 'hello'
 * });
 *
 * // Insert text
 * await client.request('document/insert', {
 *   documentId,
 *   position: { line: 0, column: 5 },
 *   text: ' world'
 * });
 *
 * // Verify content
 * const { content } = await client.request('document/content', { documentId });
 * expect(content).toBe('hello world');
 *
 * await client.shutdown();
 * ```
 */
export class TestECPClient {
  private server: ECPServer;
  private notifications: ECPNotification[] = [];
  private captureNotifications: boolean;

  constructor(options: TestECPClientOptions = {}) {
    this.captureNotifications = options.captureNotifications ?? true;

    // Create ECP server
    this.server = new ECPServer({
      workspaceRoot: options.workspaceRoot,
    });

    // Capture notifications
    if (this.captureNotifications) {
      this.server.onNotification((method, params) => {
        this.notifications.push({
          jsonrpc: '2.0',
          method,
          params,
        });
      });
    }
  }

  /**
   * Initialize async services (call before using session methods).
   * Sets up temp directories for session persistence during tests.
   */
  async initSession(): Promise<void> {
    await this.server.initialize();

    // Configure temp session paths for testing
    const testSessionDir = `${tmpdir()}/ultra-test-sessions-${Date.now()}`;
    await mkdir(testSessionDir, { recursive: true });
    await mkdir(`${testSessionDir}/workspace`, { recursive: true });
    await mkdir(`${testSessionDir}/named`, { recursive: true });

    const sessionService = this.server.getService<LocalSessionService>('session');
    sessionService.setSessionPaths({
      sessionsDir: testSessionDir,
      workspaceSessionsDir: `${testSessionDir}/workspace`,
      namedSessionsDir: `${testSessionDir}/named`,
      lastSessionFile: `${testSessionDir}/last-session.json`,
    });
  }

  /**
   * Send a request and get the result.
   * Throws an error if the request fails.
   */
  async request<T = unknown>(method: string, params?: unknown): Promise<T> {
    return this.server.request<T>(method, params);
  }

  /**
   * Send a request and get the full response (including errors).
   */
  async requestRaw<T = unknown>(method: string, params?: unknown): Promise<ECPResponse> {
    return this.server.requestRaw(method, params);
  }

  /**
   * Send a notification (no response expected).
   */
  notify(method: string, params?: unknown): void {
    // Notifications are fire-and-forget
    // For testing, we might want to handle them differently
  }

  /**
   * Get collected notifications.
   */
  getNotifications(methodPattern?: string | RegExp): ECPNotification[] {
    if (!methodPattern) {
      return [...this.notifications];
    }

    if (typeof methodPattern === 'string') {
      return this.notifications.filter((n) => n.method === methodPattern);
    }

    return this.notifications.filter((n) => methodPattern.test(n.method));
  }

  /**
   * Wait for a notification matching the pattern.
   */
  async waitForNotification(
    methodPattern: string | RegExp,
    timeout = 5000
  ): Promise<ECPNotification> {
    const startTime = Date.now();

    while (Date.now() - startTime < timeout) {
      const matching = this.getNotifications(methodPattern);
      if (matching.length > 0) {
        return matching[matching.length - 1];
      }
      await new Promise((resolve) => setTimeout(resolve, 10));
    }

    throw new Error(`Timeout waiting for notification: ${methodPattern}`);
  }

  /**
   * Clear collected notifications.
   */
  clearNotifications(): void {
    this.notifications = [];
  }

  /**
   * Get a service directly (for unit testing).
   */
  getService<T>(name: 'document' | 'file' | 'git' | 'session' | 'lsp' | 'syntax' | 'terminal'): T {
    return this.server.getService<T>(name);
  }

  /**
   * Shutdown the client and clean up resources.
   */
  async shutdown(): Promise<void> {
    await this.server.shutdown();
    this.notifications = [];
  }
}

/**
 * Create a TestECPClient for a test.
 * Convenience function that handles cleanup.
 */
export function createTestClient(options?: TestECPClientOptions): TestECPClient {
  return new TestECPClient(options);
}
