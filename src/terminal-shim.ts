/**
 * Terminal-kit shim for Bun bundling
 * 
 * Pre-imports terminal config files that terminal-kit loads dynamically
 * so they get included in the bundle.
 */

// Pre-import all terminal configs that might be needed
// These use dynamic require() which Bun's bundler can't resolve
import 'terminal-kit/lib/termconfig/xterm.generic.js';
import 'terminal-kit/lib/termconfig/xterm.js';
import 'terminal-kit/lib/termconfig/xterm-256color.generic.js';
import 'terminal-kit/lib/termconfig/xterm-256color.js';
import 'terminal-kit/lib/termconfig/xterm-truecolor.generic.js';
import 'terminal-kit/lib/termconfig/xterm-truecolor.js';
import 'terminal-kit/lib/termconfig/linux.js';
import 'terminal-kit/lib/termconfig/konsole.js';
import 'terminal-kit/lib/termconfig/konsole-256color.js';
import 'terminal-kit/lib/termconfig/gnome.js';
import 'terminal-kit/lib/termconfig/gnome-256color.js';
import 'terminal-kit/lib/termconfig/kitty.js';
import 'terminal-kit/lib/termconfig/osx-256color.js';
import 'terminal-kit/lib/termconfig/rxvt.js';
import 'terminal-kit/lib/termconfig/rxvt-256color.js';
import 'terminal-kit/lib/termconfig/eterm.js';
import 'terminal-kit/lib/termconfig/eterm-256color.js';
import 'terminal-kit/lib/termconfig/xfce.js';
import 'terminal-kit/lib/termconfig/termux.js';
import 'terminal-kit/lib/termconfig/atomic-terminal.js';

// Re-export terminal-kit
export * from 'terminal-kit';
export { default } from 'terminal-kit';
