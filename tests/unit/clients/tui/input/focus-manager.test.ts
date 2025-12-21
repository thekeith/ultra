/**
 * FocusManager Tests
 */

import { describe, test, expect, beforeEach } from 'bun:test';
import {
  FocusManager,
  createFocusManager,
  type FocusResolver,
  type FocusChangeCallback,
} from '../../../../../src/clients/tui/input/focus-manager.ts';
import { BaseElement, createTestContext } from '../../../../../src/clients/tui/elements/base.ts';
import type { ScreenBuffer } from '../../../../../src/clients/tui/rendering/buffer.ts';
import type { KeyEvent } from '../../../../../src/clients/tui/types.ts';

// ============================================
// Test Implementation
// ============================================

class MockElement extends BaseElement {
  public focusCount = 0;
  public blurCount = 0;

  constructor(id: string) {
    super('DocumentEditor', id, `Element ${id}`, createTestContext());
  }

  render(_buffer: ScreenBuffer): void {}

  onFocus(): void {
    super.onFocus();
    this.focusCount++;
  }

  onBlur(): void {
    super.onBlur();
    this.blurCount++;
  }
}

class MockResolver implements FocusResolver {
  public panes: Map<string, MockElement[]> = new Map();

  addPane(paneId: string, elements: MockElement[]): void {
    this.panes.set(paneId, elements);
  }

  getPaneIds(): string[] {
    return Array.from(this.panes.keys());
  }

  getElement(elementId: string): BaseElement | null {
    for (const elements of this.panes.values()) {
      const found = elements.find((e) => e.id === elementId);
      if (found) return found;
    }
    return null;
  }

  findPaneForElement(elementId: string): string | null {
    for (const [paneId, elements] of this.panes) {
      if (elements.some((e) => e.id === elementId)) {
        return paneId;
      }
    }
    return null;
  }

  getActiveElementInPane(paneId: string): BaseElement | null {
    const elements = this.panes.get(paneId);
    return elements?.[0] ?? null;
  }

  getElementsInPane(paneId: string): BaseElement[] {
    return this.panes.get(paneId) ?? [];
  }
}

// ============================================
// Tests
// ============================================

describe('FocusManager', () => {
  let focusManager: FocusManager;
  let resolver: MockResolver;
  let element1: MockElement;
  let element2: MockElement;
  let element3: MockElement;

  beforeEach(() => {
    focusManager = new FocusManager();
    resolver = new MockResolver();

    element1 = new MockElement('elem-1');
    element2 = new MockElement('elem-2');
    element3 = new MockElement('elem-3');

    resolver.addPane('pane-1', [element1, element2]);
    resolver.addPane('pane-2', [element3]);

    focusManager.setResolver(resolver);
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Configuration
  // ─────────────────────────────────────────────────────────────────────────

  describe('configuration', () => {
    test('setResolver sets the resolver', () => {
      const fm = new FocusManager();
      fm.setResolver(resolver);
      // Can focus elements now
      expect(fm.focusPane('pane-1')).toBe(true);
    });

    test('clearResolver removes the resolver', () => {
      focusManager.clearResolver();
      expect(focusManager.focusPane('pane-1')).toBe(false);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Focus Management
  // ─────────────────────────────────────────────────────────────────────────

  describe('focusPane', () => {
    test('focuses first element in pane', () => {
      focusManager.focusPane('pane-1');
      expect(focusManager.getFocusedPaneId()).toBe('pane-1');
      expect(focusManager.getFocusedElementId()).toBe('elem-1');
      expect(element1.focusCount).toBe(1);
    });

    test('blurs previous element when focusing new pane', () => {
      focusManager.focusPane('pane-1');
      focusManager.focusPane('pane-2');

      expect(element1.blurCount).toBe(1);
      expect(element3.focusCount).toBe(1);
    });

    test('returns false without resolver', () => {
      focusManager.clearResolver();
      expect(focusManager.focusPane('pane-1')).toBe(false);
    });

    test('handles empty pane', () => {
      resolver.addPane('empty-pane', []);
      expect(focusManager.focusPane('empty-pane')).toBe(true);
      expect(focusManager.getFocusedPaneId()).toBe('empty-pane');
      expect(focusManager.getFocusedElementId()).toBe('');
    });
  });

  describe('focusElement', () => {
    test('focuses specific element', () => {
      focusManager.focusElement('elem-2');
      expect(focusManager.getFocusedElementId()).toBe('elem-2');
      expect(focusManager.getFocusedPaneId()).toBe('pane-1');
      expect(element2.focusCount).toBe(1);
    });

    test('blurs previous element', () => {
      focusManager.focusElement('elem-1');
      focusManager.focusElement('elem-2');

      expect(element1.blurCount).toBe(1);
      expect(element2.focusCount).toBe(1);
    });

    test('returns false for unknown element', () => {
      expect(focusManager.focusElement('unknown')).toBe(false);
    });

    test('returns true if already focused', () => {
      focusManager.focusElement('elem-1');
      expect(focusManager.focusElement('elem-1')).toBe(true);
      // Should not trigger additional focus
      expect(element1.focusCount).toBe(1);
    });

    test('returns false without resolver', () => {
      focusManager.clearResolver();
      expect(focusManager.focusElement('elem-1')).toBe(false);
    });
  });

  describe('setFocus', () => {
    test('sets focus state directly', () => {
      focusManager.setFocus('pane-1', 'elem-2');
      expect(focusManager.getFocusedPaneId()).toBe('pane-1');
      expect(focusManager.getFocusedElementId()).toBe('elem-2');
    });

    test('does not trigger lifecycle', () => {
      focusManager.setFocus('pane-1', 'elem-1');
      expect(element1.focusCount).toBe(0);
    });
  });

  describe('clearFocus', () => {
    test('clears all focus', () => {
      focusManager.focusElement('elem-1');
      focusManager.clearFocus();

      expect(focusManager.getFocusedPaneId()).toBe('');
      expect(focusManager.getFocusedElementId()).toBe('');
      expect(element1.blurCount).toBe(1);
    });

    test('does nothing if nothing focused', () => {
      focusManager.clearFocus();
      expect(focusManager.hasFocus()).toBe(false);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Focus Queries
  // ─────────────────────────────────────────────────────────────────────────

  describe('focus queries', () => {
    test('getFocusedElement returns focused element', () => {
      focusManager.focusElement('elem-1');
      expect(focusManager.getFocusedElement()).toBe(element1);
    });

    test('getFocusedElement returns null if nothing focused', () => {
      expect(focusManager.getFocusedElement()).toBeNull();
    });

    test('hasFocus returns true when focused', () => {
      focusManager.focusElement('elem-1');
      expect(focusManager.hasFocus()).toBe(true);
    });

    test('hasFocus returns false when not focused', () => {
      expect(focusManager.hasFocus()).toBe(false);
    });

    test('isElementFocused checks specific element', () => {
      focusManager.focusElement('elem-1');
      expect(focusManager.isElementFocused('elem-1')).toBe(true);
      expect(focusManager.isElementFocused('elem-2')).toBe(false);
    });

    test('isPaneFocused checks specific pane', () => {
      focusManager.focusPane('pane-1');
      expect(focusManager.isPaneFocused('pane-1')).toBe(true);
      expect(focusManager.isPaneFocused('pane-2')).toBe(false);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Navigation Mode
  // ─────────────────────────────────────────────────────────────────────────

  describe('navigation mode', () => {
    test('isInNavigationMode returns false by default', () => {
      expect(focusManager.isInNavigationMode()).toBe(false);
    });

    test('enterNavigationMode enters navigation mode', () => {
      focusManager.enterNavigationMode();
      expect(focusManager.isInNavigationMode()).toBe(true);
    });

    test('exitNavigationMode exits navigation mode', () => {
      focusManager.enterNavigationMode();
      focusManager.exitNavigationMode();
      expect(focusManager.isInNavigationMode()).toBe(false);
    });

    test('toggleNavigationMode toggles', () => {
      focusManager.toggleNavigationMode();
      expect(focusManager.isInNavigationMode()).toBe(true);
      focusManager.toggleNavigationMode();
      expect(focusManager.isInNavigationMode()).toBe(false);
    });
  });

  describe('handleNavigationInput', () => {
    beforeEach(() => {
      focusManager.focusPane('pane-1');
      focusManager.enterNavigationMode();
    });

    test('returns false if not in navigation mode', () => {
      focusManager.exitNavigationMode();
      const event: KeyEvent = { key: 'ArrowRight', ctrl: false, alt: false, shift: false, meta: false };
      expect(focusManager.handleNavigationInput(event)).toBe(false);
    });

    test('Escape exits navigation mode', () => {
      const event: KeyEvent = { key: 'Escape', ctrl: false, alt: false, shift: false, meta: false };
      expect(focusManager.handleNavigationInput(event)).toBe(true);
      expect(focusManager.isInNavigationMode()).toBe(false);
    });

    test('Enter exits navigation mode', () => {
      const event: KeyEvent = { key: 'Enter', ctrl: false, alt: false, shift: false, meta: false };
      expect(focusManager.handleNavigationInput(event)).toBe(true);
      expect(focusManager.isInNavigationMode()).toBe(false);
    });

    test('ArrowRight focuses next pane', () => {
      const event: KeyEvent = { key: 'ArrowRight', ctrl: false, alt: false, shift: false, meta: false };
      expect(focusManager.handleNavigationInput(event)).toBe(true);
      expect(focusManager.getFocusedPaneId()).toBe('pane-2');
    });

    test('l focuses next pane (vim binding)', () => {
      const event: KeyEvent = { key: 'l', ctrl: false, alt: false, shift: false, meta: false };
      expect(focusManager.handleNavigationInput(event)).toBe(true);
      expect(focusManager.getFocusedPaneId()).toBe('pane-2');
    });

    test('ArrowLeft focuses previous pane', () => {
      focusManager.focusPane('pane-2');
      const event: KeyEvent = { key: 'ArrowLeft', ctrl: false, alt: false, shift: false, meta: false };
      expect(focusManager.handleNavigationInput(event)).toBe(true);
      expect(focusManager.getFocusedPaneId()).toBe('pane-1');
    });

    test('h focuses previous pane (vim binding)', () => {
      focusManager.focusPane('pane-2');
      const event: KeyEvent = { key: 'h', ctrl: false, alt: false, shift: false, meta: false };
      expect(focusManager.handleNavigationInput(event)).toBe(true);
      expect(focusManager.getFocusedPaneId()).toBe('pane-1');
    });

    test('ArrowRight wraps to first pane at end', () => {
      focusManager.focusPane('pane-2');
      const event: KeyEvent = { key: 'ArrowRight', ctrl: false, alt: false, shift: false, meta: false };
      expect(focusManager.handleNavigationInput(event)).toBe(true);
      expect(focusManager.getFocusedPaneId()).toBe('pane-1');
    });

    test('ArrowLeft wraps to last pane at start', () => {
      const event: KeyEvent = { key: 'ArrowLeft', ctrl: false, alt: false, shift: false, meta: false };
      expect(focusManager.handleNavigationInput(event)).toBe(true);
      expect(focusManager.getFocusedPaneId()).toBe('pane-2');
    });

    test('number keys select pane directly', () => {
      const event: KeyEvent = { key: '2', ctrl: false, alt: false, shift: false, meta: false };
      expect(focusManager.handleNavigationInput(event)).toBe(true);
      expect(focusManager.getFocusedPaneId()).toBe('pane-2');
      expect(focusManager.isInNavigationMode()).toBe(false);
    });

    test('number keys out of range do nothing', () => {
      const event: KeyEvent = { key: '9', ctrl: false, alt: false, shift: false, meta: false };
      expect(focusManager.handleNavigationInput(event)).toBe(true);
      expect(focusManager.getFocusedPaneId()).toBe('pane-1'); // Unchanged
    });

    test('unhandled keys return false', () => {
      const event: KeyEvent = { key: 'x', ctrl: false, alt: false, shift: false, meta: false };
      expect(focusManager.handleNavigationInput(event)).toBe(false);
    });

    test('mouse events return false', () => {
      expect(
        focusManager.handleNavigationInput({
          type: 'press',
          button: 'left',
          x: 0,
          y: 0,
          ctrl: false,
          alt: false,
          shift: false,
        })
      ).toBe(false);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Focus Navigation
  // ─────────────────────────────────────────────────────────────────────────

  describe('focus navigation', () => {
    test('focusNextElement focuses next element in pane', () => {
      focusManager.focusElement('elem-1');
      expect(focusManager.focusNextElement()).toBe(true);
      expect(focusManager.getFocusedElementId()).toBe('elem-2');
    });

    test('focusNextElement wraps to first element', () => {
      focusManager.focusElement('elem-2');
      expect(focusManager.focusNextElement()).toBe(true);
      expect(focusManager.getFocusedElementId()).toBe('elem-1');
    });

    test('focusPreviousElement focuses previous element', () => {
      focusManager.focusElement('elem-2');
      expect(focusManager.focusPreviousElement()).toBe(true);
      expect(focusManager.getFocusedElementId()).toBe('elem-1');
    });

    test('focusPreviousElement wraps to last element', () => {
      focusManager.focusElement('elem-1');
      expect(focusManager.focusPreviousElement()).toBe(true);
      expect(focusManager.getFocusedElementId()).toBe('elem-2');
    });

    test('focusNextPane focuses next pane', () => {
      focusManager.focusPane('pane-1');
      expect(focusManager.focusNextPane()).toBe(true);
      expect(focusManager.getFocusedPaneId()).toBe('pane-2');
    });

    test('focusNextPane wraps to first pane', () => {
      focusManager.focusPane('pane-2');
      expect(focusManager.focusNextPane()).toBe(true);
      expect(focusManager.getFocusedPaneId()).toBe('pane-1');
    });

    test('focusPreviousPane focuses previous pane', () => {
      focusManager.focusPane('pane-2');
      expect(focusManager.focusPreviousPane()).toBe(true);
      expect(focusManager.getFocusedPaneId()).toBe('pane-1');
    });

    test('focusPreviousPane wraps to last pane', () => {
      focusManager.focusPane('pane-1');
      expect(focusManager.focusPreviousPane()).toBe(true);
      expect(focusManager.getFocusedPaneId()).toBe('pane-2');
    });

    test('returns false without resolver', () => {
      focusManager.clearResolver();
      expect(focusManager.focusNextElement()).toBe(false);
      expect(focusManager.focusPreviousElement()).toBe(false);
      expect(focusManager.focusNextPane()).toBe(false);
      expect(focusManager.focusPreviousPane()).toBe(false);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Listeners
  // ─────────────────────────────────────────────────────────────────────────

  describe('listeners', () => {
    test('onFocusChange notifies on focus change', () => {
      const events: Array<{
        prevElem: string | null;
        nextElem: string | null;
        prevPane: string | null;
        nextPane: string | null;
      }> = [];

      focusManager.onFocusChange((prevElem, nextElem, prevPane, nextPane) => {
        events.push({ prevElem, nextElem, prevPane, nextPane });
      });

      focusManager.focusElement('elem-1');
      focusManager.focusElement('elem-3');

      expect(events).toHaveLength(2);
      expect(events[0]).toEqual({
        prevElem: '',
        nextElem: 'elem-1',
        prevPane: '',
        nextPane: 'pane-1',
      });
      expect(events[1]).toEqual({
        prevElem: 'elem-1',
        nextElem: 'elem-3',
        prevPane: 'pane-1',
        nextPane: 'pane-2',
      });
    });

    test('unsubscribe removes listener', () => {
      let callCount = 0;
      const unsubscribe = focusManager.onFocusChange(() => {
        callCount++;
      });

      focusManager.focusElement('elem-1');
      expect(callCount).toBe(1);

      unsubscribe();
      focusManager.focusElement('elem-2');
      expect(callCount).toBe(1);
    });

    test('notifies on clearFocus', () => {
      let lastEvent: { prevElem: string | null; nextElem: string | null } | null = null;

      focusManager.focusElement('elem-1');
      focusManager.onFocusChange((prevElem, nextElem) => {
        lastEvent = { prevElem, nextElem };
      });

      focusManager.clearFocus();
      expect(lastEvent).toEqual({ prevElem: 'elem-1', nextElem: null });
    });
  });
});

// ============================================
// Factory Function Tests
// ============================================

describe('createFocusManager', () => {
  test('creates a new FocusManager instance', () => {
    const fm = createFocusManager();
    expect(fm).toBeInstanceOf(FocusManager);
  });
});
