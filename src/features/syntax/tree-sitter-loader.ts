/**
 * Tree-sitter Grammar Loader (Placeholder)
 * 
 * Loads Tree-sitter WASM grammars for syntax highlighting.
 */

export interface Grammar {
  languageId: string;
  parser: unknown;  // Will be Tree-sitter parser
}

export class TreeSitterLoader {
  private grammars: Map<string, Grammar> = new Map();
  private loadingPromises: Map<string, Promise<Grammar | null>> = new Map();

  async loadGrammar(languageId: string): Promise<Grammar | null> {
    // Check if already loaded
    const existing = this.grammars.get(languageId);
    if (existing) return existing;

    // Check if currently loading
    const loading = this.loadingPromises.get(languageId);
    if (loading) return loading;

    // TODO: Implement actual Tree-sitter grammar loading
    // const promise = this.doLoadGrammar(languageId);
    // this.loadingPromises.set(languageId, promise);
    // return promise;

    return null;
  }

  getGrammar(languageId: string): Grammar | null {
    return this.grammars.get(languageId) || null;
  }

  isLoaded(languageId: string): boolean {
    return this.grammars.has(languageId);
  }

  getSupportedLanguages(): string[] {
    return [
      'typescript',
      'javascript',
      'json',
      'markdown',
      'python',
      'rust',
      'ruby',
      'go',
      'c',
      'cpp',
      'html',
      'css'
    ];
  }
}

export const treeSitterLoader = new TreeSitterLoader();

export default treeSitterLoader;
