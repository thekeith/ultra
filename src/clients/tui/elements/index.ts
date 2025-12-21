/**
 * TUI Elements
 *
 * Base classes and factory for TUI content elements.
 */

export {
  BaseElement,
  type ElementContext,
  createTestContext,
} from './base.ts';

export {
  type ElementCreator,
  registerElement,
  isElementRegistered,
  getRegisteredTypes,
  unregisterElement,
  clearRegistry,
  createElement,
  createElementOrThrow,
  generateElementId,
  resetIdCounter,
  PlaceholderElement,
  createPlaceholder,
  createElementWithFallback,
} from './factory.ts';
