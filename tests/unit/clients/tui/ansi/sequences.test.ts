/**
 * ANSI Sequences Tests
 */

import { describe, test, expect } from 'bun:test';
import {
  CSI,
  OSC,
  BEL,
  cursorUp,
  cursorDown,
  cursorForward,
  cursorBack,
  cursorNextLine,
  cursorPrevLine,
  cursorToColumn,
  cursorTo,
  cursorToZero,
  cursorHome,
  cursorSave,
  cursorRestore,
  cursorHide,
  cursorShow,
  cursorStyle,
  clearScreen,
  clearLine,
  clearScreenAndHome,
  scrollUp,
  scrollDown,
  setScrollRegion,
  resetScrollRegion,
  alternateScreenOn,
  alternateScreenOff,
  lineWrapOn,
  lineWrapOff,
  mouseTrackingOn,
  mouseTrackingOff,
  mouseButtonTrackingOn,
  mouseButtonTrackingOff,
  mouseSgrModeOn,
  mouseSgrModeOff,
  mouseFullOn,
  mouseFullOff,
  bracketedPasteOn,
  bracketedPasteOff,
  setTitle,
  bell,
  softReset,
  focusTrackingOn,
  focusTrackingOff,
} from '../../../../../src/clients/tui/ansi/sequences.ts';

describe('ANSI Sequences', () => {
  // ─────────────────────────────────────────────────────────────────────────
  // Constants
  // ─────────────────────────────────────────────────────────────────────────

  describe('constants', () => {
    test('CSI is escape + bracket', () => {
      expect(CSI).toBe('\x1b[');
    });

    test('OSC is escape + bracket', () => {
      expect(OSC).toBe('\x1b]');
    });

    test('BEL is bell character', () => {
      expect(BEL).toBe('\x07');
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Cursor Movement
  // ─────────────────────────────────────────────────────────────────────────

  describe('cursor movement', () => {
    test('cursorUp moves up n rows', () => {
      expect(cursorUp()).toBe('\x1b[1A');
      expect(cursorUp(5)).toBe('\x1b[5A');
    });

    test('cursorDown moves down n rows', () => {
      expect(cursorDown()).toBe('\x1b[1B');
      expect(cursorDown(3)).toBe('\x1b[3B');
    });

    test('cursorForward moves right n columns', () => {
      expect(cursorForward()).toBe('\x1b[1C');
      expect(cursorForward(10)).toBe('\x1b[10C');
    });

    test('cursorBack moves left n columns', () => {
      expect(cursorBack()).toBe('\x1b[1D');
      expect(cursorBack(7)).toBe('\x1b[7D');
    });

    test('cursorNextLine moves to beginning of next line', () => {
      expect(cursorNextLine()).toBe('\x1b[1E');
      expect(cursorNextLine(2)).toBe('\x1b[2E');
    });

    test('cursorPrevLine moves to beginning of previous line', () => {
      expect(cursorPrevLine()).toBe('\x1b[1F');
      expect(cursorPrevLine(4)).toBe('\x1b[4F');
    });

    test('cursorToColumn moves to column n', () => {
      expect(cursorToColumn(1)).toBe('\x1b[1G');
      expect(cursorToColumn(80)).toBe('\x1b[80G');
    });

    test('cursorTo positions cursor (1-indexed)', () => {
      expect(cursorTo(1, 1)).toBe('\x1b[1;1H');
      expect(cursorTo(10, 20)).toBe('\x1b[10;20H');
    });

    test('cursorToZero positions cursor (0-indexed)', () => {
      expect(cursorToZero(0, 0)).toBe('\x1b[1;1H');
      expect(cursorToZero(9, 19)).toBe('\x1b[10;20H');
    });

    test('cursorHome moves to top-left', () => {
      expect(cursorHome()).toBe('\x1b[H');
    });

    test('cursorSave saves position', () => {
      expect(cursorSave()).toBe('\x1b[s');
    });

    test('cursorRestore restores position', () => {
      expect(cursorRestore()).toBe('\x1b[u');
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Cursor Visibility
  // ─────────────────────────────────────────────────────────────────────────

  describe('cursor visibility', () => {
    test('cursorHide hides cursor', () => {
      expect(cursorHide()).toBe('\x1b[?25l');
    });

    test('cursorShow shows cursor', () => {
      expect(cursorShow()).toBe('\x1b[?25h');
    });

    test('cursorStyle sets cursor style', () => {
      expect(cursorStyle(0)).toBe('\x1b[0 q'); // Default
      expect(cursorStyle(1)).toBe('\x1b[1 q'); // Blinking block
      expect(cursorStyle(2)).toBe('\x1b[2 q'); // Steady block
      expect(cursorStyle(5)).toBe('\x1b[5 q'); // Blinking bar
      expect(cursorStyle(6)).toBe('\x1b[6 q'); // Steady bar
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Screen Clearing
  // ─────────────────────────────────────────────────────────────────────────

  describe('screen clearing', () => {
    test('clearScreen with different modes', () => {
      expect(clearScreen(0)).toBe('\x1b[0J'); // Cursor to end
      expect(clearScreen(1)).toBe('\x1b[1J'); // Start to cursor
      expect(clearScreen(2)).toBe('\x1b[2J'); // Entire screen
      expect(clearScreen(3)).toBe('\x1b[3J'); // Screen + scrollback
      expect(clearScreen()).toBe('\x1b[2J'); // Default: entire screen
    });

    test('clearLine with different modes', () => {
      expect(clearLine(0)).toBe('\x1b[0K'); // Cursor to end
      expect(clearLine(1)).toBe('\x1b[1K'); // Start to cursor
      expect(clearLine(2)).toBe('\x1b[2K'); // Entire line
      expect(clearLine()).toBe('\x1b[2K'); // Default: entire line
    });

    test('clearScreenAndHome clears and moves home', () => {
      expect(clearScreenAndHome()).toBe('\x1b[2J\x1b[H');
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Scrolling
  // ─────────────────────────────────────────────────────────────────────────

  describe('scrolling', () => {
    test('scrollUp scrolls up n lines', () => {
      expect(scrollUp()).toBe('\x1b[1S');
      expect(scrollUp(5)).toBe('\x1b[5S');
    });

    test('scrollDown scrolls down n lines', () => {
      expect(scrollDown()).toBe('\x1b[1T');
      expect(scrollDown(3)).toBe('\x1b[3T');
    });

    test('setScrollRegion sets scrolling region', () => {
      expect(setScrollRegion(1, 24)).toBe('\x1b[1;24r');
      expect(setScrollRegion(5, 20)).toBe('\x1b[5;20r');
    });

    test('resetScrollRegion resets region', () => {
      expect(resetScrollRegion()).toBe('\x1b[r');
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Screen Modes
  // ─────────────────────────────────────────────────────────────────────────

  describe('screen modes', () => {
    test('alternateScreenOn enables alternate buffer', () => {
      expect(alternateScreenOn()).toBe('\x1b[?1049h');
    });

    test('alternateScreenOff disables alternate buffer', () => {
      expect(alternateScreenOff()).toBe('\x1b[?1049l');
    });

    test('lineWrapOn enables line wrapping', () => {
      expect(lineWrapOn()).toBe('\x1b[?7h');
    });

    test('lineWrapOff disables line wrapping', () => {
      expect(lineWrapOff()).toBe('\x1b[?7l');
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Mouse Tracking
  // ─────────────────────────────────────────────────────────────────────────

  describe('mouse tracking', () => {
    test('mouseTrackingOn/Off for basic tracking', () => {
      expect(mouseTrackingOn()).toBe('\x1b[?1000h');
      expect(mouseTrackingOff()).toBe('\x1b[?1000l');
    });

    test('mouseButtonTrackingOn/Off for button events', () => {
      expect(mouseButtonTrackingOn()).toBe('\x1b[?1002h');
      expect(mouseButtonTrackingOff()).toBe('\x1b[?1002l');
    });

    test('mouseSgrModeOn/Off for extended coordinates', () => {
      expect(mouseSgrModeOn()).toBe('\x1b[?1006h');
      expect(mouseSgrModeOff()).toBe('\x1b[?1006l');
    });

    test('mouseFullOn/Off combines button tracking and SGR', () => {
      expect(mouseFullOn()).toBe('\x1b[?1002h\x1b[?1006h');
      expect(mouseFullOff()).toBe('\x1b[?1002l\x1b[?1006l');
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Bracketed Paste
  // ─────────────────────────────────────────────────────────────────────────

  describe('bracketed paste', () => {
    test('bracketedPasteOn enables bracketed paste', () => {
      expect(bracketedPasteOn()).toBe('\x1b[?2004h');
    });

    test('bracketedPasteOff disables bracketed paste', () => {
      expect(bracketedPasteOff()).toBe('\x1b[?2004l');
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Window/Terminal
  // ─────────────────────────────────────────────────────────────────────────

  describe('window/terminal', () => {
    test('setTitle sets window title', () => {
      expect(setTitle('My Editor')).toBe('\x1b]0;My Editor\x07');
      expect(setTitle('Test')).toBe('\x1b]0;Test\x07');
    });

    test('bell rings the bell', () => {
      expect(bell()).toBe('\x07');
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Utility Sequences
  // ─────────────────────────────────────────────────────────────────────────

  describe('utility sequences', () => {
    test('softReset performs soft reset', () => {
      expect(softReset()).toBe('\x1b[!p');
    });

    test('focusTrackingOn/Off for focus events', () => {
      expect(focusTrackingOn()).toBe('\x1b[?1004h');
      expect(focusTrackingOff()).toBe('\x1b[?1004l');
    });
  });
});
