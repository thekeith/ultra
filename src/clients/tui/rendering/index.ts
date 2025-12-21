/**
 * TUI Rendering
 *
 * Screen buffer and renderer for terminal output.
 */

export { ScreenBuffer, createScreenBuffer } from './buffer.ts';
export {
  Renderer,
  createRenderer,
  createTestRenderer,
  type RendererOptions,
} from './renderer.ts';
