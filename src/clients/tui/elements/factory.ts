/**
 * Element Factory
 *
 * Creates TUI elements by type.
 * Provides a registry pattern for element types and a factory function.
 */

import type { ElementType, ElementConfig } from '../types.ts';
import { BaseElement, type ElementContext } from './base.ts';

// ============================================
// Element Creator Type
// ============================================

/**
 * Function that creates an element instance.
 */
export type ElementCreator = (
  id: string,
  title: string,
  ctx: ElementContext,
  state?: unknown
) => BaseElement;

// ============================================
// Element Registry
// ============================================

/**
 * Registry of element creators by type.
 */
const elementRegistry = new Map<ElementType, ElementCreator>();

/**
 * Register an element creator for a type.
 * @param type Element type to register
 * @param creator Factory function for creating instances
 */
export function registerElement(type: ElementType, creator: ElementCreator): void {
  elementRegistry.set(type, creator);
}

/**
 * Check if an element type is registered.
 * @param type Element type to check
 */
export function isElementRegistered(type: ElementType): boolean {
  return elementRegistry.has(type);
}

/**
 * Get registered element types.
 */
export function getRegisteredTypes(): ElementType[] {
  return Array.from(elementRegistry.keys());
}

/**
 * Unregister an element type.
 * Primarily for testing.
 */
export function unregisterElement(type: ElementType): boolean {
  return elementRegistry.delete(type);
}

/**
 * Clear all registered elements.
 * Primarily for testing.
 */
export function clearRegistry(): void {
  elementRegistry.clear();
}

// ============================================
// Factory Function
// ============================================

/**
 * Create an element by type.
 * @param config Element configuration
 * @param ctx Element context
 * @returns Created element, or null if type not registered
 */
export function createElement(
  config: ElementConfig,
  ctx: ElementContext
): BaseElement | null {
  const creator = elementRegistry.get(config.type);
  if (!creator) {
    return null;
  }

  const element = creator(config.id, config.title, ctx, config.state);
  return element;
}

/**
 * Create an element by type, throwing if not registered.
 * @param config Element configuration
 * @param ctx Element context
 * @returns Created element
 * @throws Error if element type is not registered
 */
export function createElementOrThrow(
  config: ElementConfig,
  ctx: ElementContext
): BaseElement {
  const element = createElement(config, ctx);
  if (!element) {
    throw new Error(`Unknown element type: ${config.type}`);
  }
  return element;
}

// ============================================
// ID Generation
// ============================================

let idCounter = 0;

/**
 * Generate a unique element ID.
 * @param prefix Optional prefix for the ID
 */
export function generateElementId(prefix = 'element'): string {
  return `${prefix}-${++idCounter}`;
}

/**
 * Reset the ID counter.
 * Primarily for testing.
 */
export function resetIdCounter(): void {
  idCounter = 0;
}

// ============================================
// Placeholder Element
// ============================================

/**
 * A placeholder element for unregistered types.
 * Shows a message indicating the element type is not available.
 */
export class PlaceholderElement extends BaseElement {
  private message: string;

  constructor(type: ElementType, id: string, ctx: ElementContext) {
    super(type, id, `Unknown: ${type}`, ctx);
    this.message = `Element type "${type}" is not registered.`;
  }

  render(buffer: import('../rendering/buffer.ts').ScreenBuffer): void {
    const fg = this.ctx.getThemeColor('editor.foreground', '#888888');
    const bg = this.ctx.getThemeColor('editor.background', '#1e1e1e');

    // Render a centered message
    const { width, height } = this.bounds;
    const messageY = Math.floor(height / 2);
    const messageX = Math.max(0, Math.floor((width - this.message.length) / 2));

    buffer.writeString(
      this.bounds.x + messageX,
      this.bounds.y + messageY,
      this.message.slice(0, width),
      fg,
      bg
    );
  }
}

/**
 * Create a placeholder element for an unknown type.
 */
export function createPlaceholder(
  type: ElementType,
  id: string,
  ctx: ElementContext
): PlaceholderElement {
  return new PlaceholderElement(type, id, ctx);
}

/**
 * Create an element, falling back to placeholder if not registered.
 * @param config Element configuration
 * @param ctx Element context
 * @returns Created element or placeholder
 */
export function createElementWithFallback(
  config: ElementConfig,
  ctx: ElementContext
): BaseElement {
  const element = createElement(config, ctx);
  if (element) {
    return element;
  }
  return createPlaceholder(config.type, config.id, ctx);
}
