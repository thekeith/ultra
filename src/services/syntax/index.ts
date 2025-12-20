/**
 * Syntax Service
 *
 * Public exports for the Syntax Service module.
 */

// Types
export type {
  HighlightToken,
  HighlightResult,
  SyntaxSession,
  SyntaxMetrics,
  SyntaxTheme,
  Unsubscribe,
} from './types.ts';

export {
  SYNTAX_THEMES,
  LANGUAGE_MAP,
  EXTENSION_TO_LANGUAGE,
} from './types.ts';

// Errors
export { SyntaxError, SyntaxErrorCode } from './errors.ts';

// Interface
export type { SyntaxService } from './interface.ts';

// Implementation
export { LocalSyntaxService, localSyntaxService } from './service.ts';

// ECP Adapter
export { SyntaxServiceAdapter, SyntaxECPErrorCodes } from './adapter.ts';
