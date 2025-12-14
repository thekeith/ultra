/**
 * LSP Providers (Placeholder)
 * 
 * Completion, hover, and other LSP feature providers.
 */

import type { Position, Range } from './client.ts';

export interface CompletionItem {
  label: string;
  kind: string;
  detail?: string;
  documentation?: string;
  insertText?: string;
}

export interface HoverInfo {
  contents: string;
  range?: Range;
}

export class CompletionProvider {
  async provideCompletions(uri: string, position: Position): Promise<CompletionItem[]> {
    // TODO: Implement
    return [];
  }
}

export class HoverProvider {
  async provideHover(uri: string, position: Position): Promise<HoverInfo | null> {
    // TODO: Implement
    return null;
  }
}

export class DefinitionProvider {
  async provideDefinition(uri: string, position: Position): Promise<{ uri: string; range: Range } | null> {
    // TODO: Implement
    return null;
  }
}

export class ReferenceProvider {
  async provideReferences(uri: string, position: Position): Promise<{ uri: string; range: Range }[]> {
    // TODO: Implement
    return [];
  }
}

export const completionProvider = new CompletionProvider();
export const hoverProvider = new HoverProvider();
export const definitionProvider = new DefinitionProvider();
export const referenceProvider = new ReferenceProvider();
