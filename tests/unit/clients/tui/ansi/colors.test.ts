/**
 * ANSI Colors Tests
 */

import { describe, test, expect } from 'bun:test';
import {
  NAMED_COLORS,
  hexToRgb,
  rgbToHex,
  parseColor,
  resetColor,
  defaultFg,
  defaultBg,
  fg24bit,
  bg24bit,
  fgRgb,
  bgRgb,
  fgColor,
  bgColor,
  fg256,
  bg256,
  lighten,
  darken,
  mix,
  luminance,
  contrastRatio,
  isDark,
  isLight,
  type RGB,
} from '../../../../../src/clients/tui/ansi/colors.ts';

describe('ANSI Colors', () => {
  // ─────────────────────────────────────────────────────────────────────────
  // Named Colors
  // ─────────────────────────────────────────────────────────────────────────

  describe('NAMED_COLORS', () => {
    test('includes standard colors', () => {
      expect(NAMED_COLORS.black).toEqual({ r: 0, g: 0, b: 0 });
      expect(NAMED_COLORS.white).toBeDefined();
      expect(NAMED_COLORS.red).toBeDefined();
      expect(NAMED_COLORS.green).toBeDefined();
      expect(NAMED_COLORS.blue).toBeDefined();
    });

    test('includes bright colors', () => {
      expect(NAMED_COLORS.brightWhite).toEqual({ r: 255, g: 255, b: 255 });
      expect(NAMED_COLORS.brightRed).toBeDefined();
    });

    test('includes aliases', () => {
      expect(NAMED_COLORS.gray).toBeDefined();
      expect(NAMED_COLORS.grey).toEqual(NAMED_COLORS.gray);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Color Parsing
  // ─────────────────────────────────────────────────────────────────────────

  describe('hexToRgb', () => {
    test('parses 6-digit hex colors', () => {
      expect(hexToRgb('#000000')).toEqual({ r: 0, g: 0, b: 0 });
      expect(hexToRgb('#ffffff')).toEqual({ r: 255, g: 255, b: 255 });
      expect(hexToRgb('#FF0000')).toEqual({ r: 255, g: 0, b: 0 });
      expect(hexToRgb('#00ff00')).toEqual({ r: 0, g: 255, b: 0 });
      expect(hexToRgb('#0000FF')).toEqual({ r: 0, g: 0, b: 255 });
      expect(hexToRgb('#1e1e1e')).toEqual({ r: 30, g: 30, b: 30 });
    });

    test('parses 3-digit hex colors', () => {
      expect(hexToRgb('#000')).toEqual({ r: 0, g: 0, b: 0 });
      expect(hexToRgb('#fff')).toEqual({ r: 255, g: 255, b: 255 });
      expect(hexToRgb('#f00')).toEqual({ r: 255, g: 0, b: 0 });
      expect(hexToRgb('#0f0')).toEqual({ r: 0, g: 255, b: 0 });
      expect(hexToRgb('#00f')).toEqual({ r: 0, g: 0, b: 255 });
    });

    test('returns null for invalid hex', () => {
      expect(hexToRgb('000000')).toBeNull(); // Missing #
      expect(hexToRgb('#00')).toBeNull(); // Too short
      expect(hexToRgb('#0000')).toBeNull(); // Wrong length
      expect(hexToRgb('#gggggg')).toBeNull(); // Invalid chars
      expect(hexToRgb('')).toBeNull();
    });
  });

  describe('rgbToHex', () => {
    test('converts RGB to hex', () => {
      expect(rgbToHex({ r: 0, g: 0, b: 0 })).toBe('#000000');
      expect(rgbToHex({ r: 255, g: 255, b: 255 })).toBe('#ffffff');
      expect(rgbToHex({ r: 255, g: 0, b: 0 })).toBe('#ff0000');
      expect(rgbToHex({ r: 30, g: 30, b: 30 })).toBe('#1e1e1e');
    });

    test('clamps out-of-range values', () => {
      expect(rgbToHex({ r: -10, g: 300, b: 128 })).toBe('#00ff80');
    });

    test('rounds fractional values', () => {
      expect(rgbToHex({ r: 127.5, g: 127.5, b: 127.5 })).toBe('#808080');
    });
  });

  describe('parseColor', () => {
    test('parses hex colors', () => {
      expect(parseColor('#ff0000')).toEqual({ r: 255, g: 0, b: 0 });
      expect(parseColor('#abc')).toEqual({ r: 170, g: 187, b: 204 });
    });

    test('parses named colors', () => {
      expect(parseColor('red')).toEqual(NAMED_COLORS.red);
      expect(parseColor('blue')).toEqual(NAMED_COLORS.blue);
      expect(parseColor('GREEN')).toEqual(NAMED_COLORS.green); // Case insensitive
    });

    test('returns null for default', () => {
      expect(parseColor('default')).toBeNull();
    });

    test('returns null for unknown colors', () => {
      expect(parseColor('unknowncolor')).toBeNull();
      expect(parseColor('invalid')).toBeNull();
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // ANSI Color Sequences
  // ─────────────────────────────────────────────────────────────────────────

  describe('ANSI sequences', () => {
    test('resetColor resets all attributes', () => {
      expect(resetColor()).toBe('\x1b[0m');
    });

    test('defaultFg sets default foreground', () => {
      expect(defaultFg()).toBe('\x1b[39m');
    });

    test('defaultBg sets default background', () => {
      expect(defaultBg()).toBe('\x1b[49m');
    });

    test('fg24bit sets 24-bit foreground', () => {
      expect(fg24bit(255, 0, 0)).toBe('\x1b[38;2;255;0;0m');
      expect(fg24bit(0, 128, 255)).toBe('\x1b[38;2;0;128;255m');
    });

    test('bg24bit sets 24-bit background', () => {
      expect(bg24bit(0, 0, 0)).toBe('\x1b[48;2;0;0;0m');
      expect(bg24bit(30, 30, 30)).toBe('\x1b[48;2;30;30;30m');
    });

    test('fgRgb converts RGB to foreground', () => {
      expect(fgRgb({ r: 100, g: 150, b: 200 })).toBe('\x1b[38;2;100;150;200m');
    });

    test('bgRgb converts RGB to background', () => {
      expect(bgRgb({ r: 50, g: 60, b: 70 })).toBe('\x1b[48;2;50;60;70m');
    });

    test('fgColor handles color strings', () => {
      expect(fgColor('#ff0000')).toBe('\x1b[38;2;255;0;0m');
      expect(fgColor('red')).toBe(`\x1b[38;2;${NAMED_COLORS.red.r};${NAMED_COLORS.red.g};${NAMED_COLORS.red.b}m`);
      expect(fgColor('default')).toBe('\x1b[39m');
      expect(fgColor('invalid')).toBe('\x1b[39m');
    });

    test('bgColor handles color strings', () => {
      expect(bgColor('#000000')).toBe('\x1b[48;2;0;0;0m');
      expect(bgColor('black')).toBe('\x1b[48;2;0;0;0m');
      expect(bgColor('default')).toBe('\x1b[49m');
      expect(bgColor('invalid')).toBe('\x1b[49m');
    });

    test('fg256 sets 256-color foreground', () => {
      expect(fg256(0)).toBe('\x1b[38;5;0m');
      expect(fg256(196)).toBe('\x1b[38;5;196m');
      expect(fg256(255)).toBe('\x1b[38;5;255m');
    });

    test('bg256 sets 256-color background', () => {
      expect(bg256(0)).toBe('\x1b[48;5;0m');
      expect(bg256(232)).toBe('\x1b[48;5;232m');
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Color Manipulation
  // ─────────────────────────────────────────────────────────────────────────

  describe('lighten', () => {
    test('lightens a color', () => {
      const black: RGB = { r: 0, g: 0, b: 0 };
      const lightened = lighten(black, 0.5);
      expect(lightened.r).toBeCloseTo(127.5);
      expect(lightened.g).toBeCloseTo(127.5);
      expect(lightened.b).toBeCloseTo(127.5);
    });

    test('lighten 100% produces white', () => {
      const color: RGB = { r: 100, g: 50, b: 25 };
      const lightened = lighten(color, 1);
      expect(lightened.r).toBe(255);
      expect(lightened.g).toBe(255);
      expect(lightened.b).toBe(255);
    });

    test('lighten 0% returns original', () => {
      const color: RGB = { r: 100, g: 50, b: 25 };
      const lightened = lighten(color, 0);
      expect(lightened).toEqual(color);
    });
  });

  describe('darken', () => {
    test('darkens a color', () => {
      const white: RGB = { r: 255, g: 255, b: 255 };
      const darkened = darken(white, 0.5);
      expect(darkened.r).toBeCloseTo(127.5);
      expect(darkened.g).toBeCloseTo(127.5);
      expect(darkened.b).toBeCloseTo(127.5);
    });

    test('darken 100% produces black', () => {
      const color: RGB = { r: 100, g: 200, b: 150 };
      const darkened = darken(color, 1);
      expect(darkened.r).toBe(0);
      expect(darkened.g).toBe(0);
      expect(darkened.b).toBe(0);
    });

    test('darken 0% returns original', () => {
      const color: RGB = { r: 100, g: 50, b: 25 };
      const darkened = darken(color, 0);
      expect(darkened).toEqual(color);
    });
  });

  describe('mix', () => {
    test('mixes two colors at 50%', () => {
      const black: RGB = { r: 0, g: 0, b: 0 };
      const white: RGB = { r: 255, g: 255, b: 255 };
      const mixed = mix(black, white, 0.5);
      expect(mixed.r).toBeCloseTo(127.5);
      expect(mixed.g).toBeCloseTo(127.5);
      expect(mixed.b).toBeCloseTo(127.5);
    });

    test('mix at 0% returns first color', () => {
      const red: RGB = { r: 255, g: 0, b: 0 };
      const blue: RGB = { r: 0, g: 0, b: 255 };
      const mixed = mix(red, blue, 0);
      expect(mixed).toEqual(red);
    });

    test('mix at 100% returns second color', () => {
      const red: RGB = { r: 255, g: 0, b: 0 };
      const blue: RGB = { r: 0, g: 0, b: 255 };
      const mixed = mix(red, blue, 1);
      expect(mixed).toEqual(blue);
    });
  });

  describe('luminance', () => {
    test('black has 0 luminance', () => {
      expect(luminance({ r: 0, g: 0, b: 0 })).toBeCloseTo(0);
    });

    test('white has 1 luminance', () => {
      expect(luminance({ r: 255, g: 255, b: 255 })).toBeCloseTo(1);
    });

    test('green has higher luminance than red/blue', () => {
      const redLum = luminance({ r: 255, g: 0, b: 0 });
      const greenLum = luminance({ r: 0, g: 255, b: 0 });
      const blueLum = luminance({ r: 0, g: 0, b: 255 });
      expect(greenLum).toBeGreaterThan(redLum);
      expect(greenLum).toBeGreaterThan(blueLum);
    });
  });

  describe('contrastRatio', () => {
    test('black/white has highest contrast', () => {
      const black: RGB = { r: 0, g: 0, b: 0 };
      const white: RGB = { r: 255, g: 255, b: 255 };
      const ratio = contrastRatio(black, white);
      expect(ratio).toBeCloseTo(21, 0);
    });

    test('same colors have contrast ratio of 1', () => {
      const color: RGB = { r: 128, g: 128, b: 128 };
      expect(contrastRatio(color, color)).toBe(1);
    });

    test('contrast ratio is symmetric', () => {
      const a: RGB = { r: 100, g: 50, b: 200 };
      const b: RGB = { r: 200, g: 150, b: 50 };
      expect(contrastRatio(a, b)).toBe(contrastRatio(b, a));
    });
  });

  describe('isDark / isLight', () => {
    test('black is dark', () => {
      expect(isDark({ r: 0, g: 0, b: 0 })).toBe(true);
      expect(isLight({ r: 0, g: 0, b: 0 })).toBe(false);
    });

    test('white is light', () => {
      expect(isDark({ r: 255, g: 255, b: 255 })).toBe(false);
      expect(isLight({ r: 255, g: 255, b: 255 })).toBe(true);
    });

    test('dark gray is dark', () => {
      expect(isDark({ r: 50, g: 50, b: 50 })).toBe(true);
    });

    test('light gray is light', () => {
      expect(isLight({ r: 200, g: 200, b: 200 })).toBe(true);
    });
  });
});
