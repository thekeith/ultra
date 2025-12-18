/**
 * Type declarations for Ultra
 */

// Allow importing .md files as text
declare module '*.md' {
  const content: string;
  export default content;
}

// Allow importing .json files
declare module '*.json' {
  const value: unknown;
  export default value;
}
