#!/usr/bin/env bun
/**
 * TypeScript Language Server Wrapper
 * 
 * This wraps a patched version of typescript-language-server for bundling with Ultra.
 * The patched CLI has the package.json read replaced with a hardcoded version.
 */

// Import the patched CLI that doesn't read package.json
import './tsserver-cli.mjs';
