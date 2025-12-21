/**
 * AITerminalChat Tests
 */

import { describe, test, expect, beforeEach } from 'bun:test';
import {
  ClaudeTerminalChat,
  CodexTerminalChat,
  createAITerminalChat,
  createClaudeTerminalChat,
  createCodexTerminalChat,
} from '../../../../../src/clients/tui/elements/ai-terminal-chat.ts';
import { createTestContext, type ElementContext } from '../../../../../src/clients/tui/elements/base.ts';

// ============================================
// ClaudeTerminalChat Tests
// ============================================

describe('ClaudeTerminalChat', () => {
  let chat: ClaudeTerminalChat;
  let ctx: ElementContext;

  beforeEach(() => {
    ctx = createTestContext();
    chat = new ClaudeTerminalChat('claude1', 'Claude', ctx, {
      cwd: '/home/user/project',
    });
    chat.setBounds({ x: 0, y: 0, width: 80, height: 24 });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Provider Info
  // ─────────────────────────────────────────────────────────────────────────

  describe('provider info', () => {
    test('getProvider returns claude-code', () => {
      expect(chat.getProvider()).toBe('claude-code');
    });

    test('getCommand returns claude', () => {
      expect(chat.getCommand()).toBe('claude');
    });

    test('getProviderName returns Claude', () => {
      expect(chat.getProviderName()).toBe('Claude');
    });

    test('getEnv returns empty object', () => {
      expect(chat.getEnv()).toEqual({});
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Session Management
  // ─────────────────────────────────────────────────────────────────────────

  describe('session management', () => {
    test('getSessionId returns null initially', () => {
      expect(chat.getSessionId()).toBeNull();
    });

    test('sessionId from constructor is preserved', () => {
      const chatWithSession = new ClaudeTerminalChat('claude2', 'Claude', ctx, {
        sessionId: 'test-session-123',
        cwd: '/home/user',
      });
      expect(chatWithSession.getSessionId()).toBe('test-session-123');
    });

    test('setSessionId updates session', () => {
      chat.setSessionId('new-session-id');
      expect(chat.getSessionId()).toBe('new-session-id');
    });

    test('getArgs returns empty when no session', () => {
      expect(chat.getArgs()).toEqual([]);
    });

    test('getArgs returns --resume when session exists', () => {
      const chatWithSession = new ClaudeTerminalChat('claude2', 'Claude', ctx, {
        sessionId: 'test-session-456',
        cwd: '/home/user',
      });
      expect(chatWithSession.getArgs()).toEqual(['--resume', 'test-session-456']);
    });

    test('getArgs includes --resume after setSessionId', () => {
      chat.setSessionId('set-session-789');
      expect(chat.getArgs()).toEqual(['--resume', 'set-session-789']);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // State Serialization
  // ─────────────────────────────────────────────────────────────────────────

  describe('state serialization', () => {
    test('getState returns correct state', () => {
      const chatWithSession = new ClaudeTerminalChat('claude2', 'Claude', ctx, {
        sessionId: 'session-789',
        cwd: '/home/test',
      });

      const state = chatWithSession.getState();
      expect(state.provider).toBe('claude-code');
      expect(state.sessionId).toBe('session-789');
      expect(state.cwd).toBe('/home/test');
    });

    test('setState restores sessionId', () => {
      chat.setState({ sessionId: 'new-session-id', cwd: '/new/path' });
      expect(chat.getSessionId()).toBe('new-session-id');
    });

    test('setState restores cwd', () => {
      chat.setState({ sessionId: 'sess', cwd: '/restored/path' });
      const state = chat.getState();
      expect(state.cwd).toBe('/restored/path');
    });

    test('setState handles partial state', () => {
      chat.setState({ sessionId: 'only-session' });
      expect(chat.getSessionId()).toBe('only-session');
    });

    test('setState handles empty object', () => {
      const originalSessionId = chat.getSessionId();
      chat.setState({});
      expect(chat.getSessionId()).toBe(originalSessionId);
    });

    test('setState handles null', () => {
      const originalSessionId = chat.getSessionId();
      chat.setState(null);
      expect(chat.getSessionId()).toBe(originalSessionId);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Lifecycle
  // ─────────────────────────────────────────────────────────────────────────

  describe('lifecycle', () => {
    test('isRunning returns false initially', () => {
      expect(chat.isRunning()).toBe(false);
    });

    test('element type is AgentChat', () => {
      expect(chat.type).toBe('AgentChat');
    });

    test('id is set correctly', () => {
      expect(chat.id).toBe('claude1');
    });

    test('title is set correctly', () => {
      expect(chat.getTitle()).toBe('Claude');
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Bounds
  // ─────────────────────────────────────────────────────────────────────────

  describe('bounds', () => {
    test('getBounds returns set bounds', () => {
      const bounds = chat.getBounds();
      expect(bounds.x).toBe(0);
      expect(bounds.y).toBe(0);
      expect(bounds.width).toBe(80);
      expect(bounds.height).toBe(24);
    });

    test('setBounds updates bounds', () => {
      chat.setBounds({ x: 10, y: 5, width: 100, height: 30 });
      const bounds = chat.getBounds();
      expect(bounds.x).toBe(10);
      expect(bounds.y).toBe(5);
      expect(bounds.width).toBe(100);
      expect(bounds.height).toBe(30);
    });
  });
});

// ============================================
// CodexTerminalChat Tests
// ============================================

describe('CodexTerminalChat', () => {
  let chat: CodexTerminalChat;
  let ctx: ElementContext;

  beforeEach(() => {
    ctx = createTestContext();
    chat = new CodexTerminalChat('codex1', 'Codex', ctx, {
      cwd: '/home/user/project',
    });
    chat.setBounds({ x: 0, y: 0, width: 80, height: 24 });
  });

  describe('provider info', () => {
    test('getProvider returns codex', () => {
      expect(chat.getProvider()).toBe('codex');
    });

    test('getCommand returns codex', () => {
      expect(chat.getCommand()).toBe('codex');
    });

    test('getProviderName returns Codex', () => {
      expect(chat.getProviderName()).toBe('Codex');
    });

    test('getEnv returns empty object', () => {
      expect(chat.getEnv()).toEqual({});
    });
  });

  describe('session management', () => {
    test('getSessionId returns null initially', () => {
      expect(chat.getSessionId()).toBeNull();
    });

    test('codex does not use --resume flag', () => {
      const chatWithSession = new CodexTerminalChat('codex2', 'Codex', ctx, {
        sessionId: 'some-session',
        cwd: '/home/user',
      });
      // Codex doesn't support resume
      expect(chatWithSession.getArgs()).toEqual([]);
    });
  });

  describe('state serialization', () => {
    test('getState returns correct provider', () => {
      const state = chat.getState();
      expect(state.provider).toBe('codex');
    });

    test('getState returns cwd', () => {
      const state = chat.getState();
      expect(state.cwd).toBe('/home/user/project');
    });
  });
});

// ============================================
// Factory Function Tests
// ============================================

describe('factory functions', () => {
  let ctx: ElementContext;

  beforeEach(() => {
    ctx = createTestContext();
  });

  describe('createClaudeTerminalChat', () => {
    test('creates Claude chat instance', () => {
      const chat = createClaudeTerminalChat('chat1', 'Claude', ctx);
      expect(chat).toBeInstanceOf(ClaudeTerminalChat);
      expect(chat.getProvider()).toBe('claude-code');
    });

    test('passes sessionId correctly', () => {
      const chat = createClaudeTerminalChat('chat1', 'Claude', ctx, {
        sessionId: 'test-session',
      });
      expect(chat.getSessionId()).toBe('test-session');
    });

    test('passes cwd correctly', () => {
      const chat = createClaudeTerminalChat('chat1', 'Claude', ctx, {
        cwd: '/custom/path',
      });
      expect(chat.getState().cwd).toBe('/custom/path');
    });

    test('uses default title when empty', () => {
      const chat = createClaudeTerminalChat('chat1', '', ctx);
      expect(chat.getTitle()).toBe('Claude');
    });
  });

  describe('createCodexTerminalChat', () => {
    test('creates Codex chat instance', () => {
      const chat = createCodexTerminalChat('chat1', 'Codex', ctx);
      expect(chat).toBeInstanceOf(CodexTerminalChat);
      expect(chat.getProvider()).toBe('codex');
    });

    test('uses default title when empty', () => {
      const chat = createCodexTerminalChat('chat1', '', ctx);
      expect(chat.getTitle()).toBe('Codex');
    });
  });

  describe('createAITerminalChat', () => {
    test('creates Claude chat by default', () => {
      const chat = createAITerminalChat('chat1', 'AI', ctx);
      expect(chat).toBeInstanceOf(ClaudeTerminalChat);
    });

    test('creates Claude chat when provider is claude-code', () => {
      const chat = createAITerminalChat('chat1', 'AI', ctx, {
        provider: 'claude-code',
      });
      expect(chat).toBeInstanceOf(ClaudeTerminalChat);
    });

    test('creates Codex chat when provider is codex', () => {
      const chat = createAITerminalChat('chat1', 'AI', ctx, {
        provider: 'codex',
      });
      expect(chat).toBeInstanceOf(CodexTerminalChat);
    });

    test('passes sessionId to Claude chat', () => {
      const chat = createAITerminalChat('chat1', 'AI', ctx, {
        provider: 'claude-code',
        sessionId: 'factory-session',
      });
      expect(chat.getSessionId()).toBe('factory-session');
    });

    test('creates Claude for custom provider (fallback)', () => {
      const chat = createAITerminalChat('chat1', 'AI', ctx, {
        provider: 'custom',
      });
      // Custom provider falls back to Claude
      expect(chat).toBeInstanceOf(ClaudeTerminalChat);
    });
  });
});

// ============================================
// Input Handling Tests
// ============================================

describe('input handling', () => {
  let chat: ClaudeTerminalChat;
  let ctx: ElementContext;

  beforeEach(() => {
    ctx = createTestContext();
    chat = new ClaudeTerminalChat('claude1', 'Claude', ctx);
    chat.setBounds({ x: 0, y: 0, width: 80, height: 24 });
  });

  test('handleKey returns false when no PTY connected', () => {
    const handled = chat.handleKey({
      key: 'a',
      ctrl: false,
      alt: false,
      shift: false,
      meta: false,
    });
    expect(handled).toBe(false);
  });

  test('handleMouse returns false for non-scroll events when no PTY', () => {
    const handled = chat.handleMouse({
      type: 'press',
      x: 10,
      y: 10,
      button: 'left',
      ctrl: false,
      alt: false,
      shift: false,
    });
    expect(handled).toBe(false);
  });
});

// ============================================
// Callbacks Tests
// ============================================

describe('callbacks', () => {
  let ctx: ElementContext;

  beforeEach(() => {
    ctx = createTestContext();
  });

  test('onSessionIdCaptured callback is invoked on setSessionId', () => {
    let capturedId: string | null = null;

    const chat = new ClaudeTerminalChat('claude1', 'Claude', ctx, {
      callbacks: {
        onSessionIdCaptured: (id) => {
          capturedId = id;
        },
      },
    });

    chat.setSessionId('callback-session-id');
    expect(capturedId).toBe('callback-session-id');
  });

  test('callback is not invoked when not set', () => {
    const chat = new ClaudeTerminalChat('claude1', 'Claude', ctx);
    // Should not throw when setting session without callback
    chat.setSessionId('no-callback-session');
    expect(chat.getSessionId()).toBe('no-callback-session');
  });
});

// ============================================
// Edge Cases
// ============================================

describe('edge cases', () => {
  let ctx: ElementContext;

  beforeEach(() => {
    ctx = createTestContext();
  });

  test('handles undefined sessionId in constructor', () => {
    const chat = new ClaudeTerminalChat('claude1', 'Claude', ctx, {
      sessionId: undefined,
    });
    expect(chat.getSessionId()).toBeNull();
  });

  test('handles null sessionId in constructor', () => {
    const chat = new ClaudeTerminalChat('claude1', 'Claude', ctx, {
      sessionId: null,
    });
    expect(chat.getSessionId()).toBeNull();
  });

  test('handles empty cwd in constructor', () => {
    const chat = new ClaudeTerminalChat('claude1', 'Claude', ctx, {
      cwd: '',
    });
    // Empty cwd is allowed (will use process.cwd() at runtime)
    const state = chat.getState();
    expect(state.cwd).toBe('');
  });

  test('multiple setSessionId calls update correctly', () => {
    const chat = new ClaudeTerminalChat('claude1', 'Claude', ctx);
    chat.setSessionId('first');
    expect(chat.getSessionId()).toBe('first');
    chat.setSessionId('second');
    expect(chat.getSessionId()).toBe('second');
    chat.setSessionId('third');
    expect(chat.getSessionId()).toBe('third');
  });
});
