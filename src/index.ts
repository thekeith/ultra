#!/usr/bin/env bun
/**
 * Ultra - Terminal Code Editor
 * 
 * Entry point for the application.
 */

import { app } from './app.ts';

// Get file path from command line arguments
const args = process.argv.slice(2);
const filePath = args[0];

// Handle graceful shutdown
process.on('SIGINT', () => {
  app.stop();
});

process.on('SIGTERM', () => {
  app.stop();
});

// Start the application
app.start(filePath).catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
