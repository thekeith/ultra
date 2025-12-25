# Claude Issues - Cursor Position in AITerminalChat

## Problem Summary

The cursor is not visible in the correct position for Claude Code and Gemini CLI in the `AITerminalChat` element. Codex works correctly.

## Affected Files

- `src/clients/tui/elements/ai-terminal-chat.ts` - Cursor rendering logic (lines ~392-403)
- `src/terminal/screen-buffer.ts` - ANSI parser and cursor tracking

## What We Know

### Debug Log Analysis

From analyzing `debug.log`, we observed:

1. **Cursor position alternates rapidly** between two positions:
   - Content position (e.g., `x=21, y=54` or `x=135, y=54`)
   - Bottom-left position (e.g., `x=0, y=56`)

2. **DECTCEM (cursor visibility) is always OFF** for Claude/Gemini:
   ```
   cursor: x=0, y=56, visible=false, provider=claude-code, shouldDraw=false
   cursor: x=135, y=54, visible=false, provider=claude-code, shouldDraw=false
   ```

3. **setCursor repeatedly sets column to 1**:
   ```
   setCursor: (49,1) -> internal (48,0) [was (48,0)]
   setCursor: (46,1) -> internal (45,0) [was (45,0)]
   ```

### Technology Stack

Both Claude Code and Gemini CLI use **ink** (React-based TUI framework):
- Claude Code: TypeScript + ink
- Gemini CLI: Uses `npm:@jrichman/ink@6.4.6` (custom fork)

Ink manages its own rendering cycle and cursor positioning. It hides the terminal cursor (DECTCEM off) and draws its own cursor using styled characters.

## Status: BACKLOG

This issue is deferred for now. Cursor works correctly for Codex; Claude/Gemini have their own cursor rendering via ink that we cannot easily intercept.

## What We Tried

1. **Idle detection** - Wait 50ms after last PTY data before showing cursor
   - Result: Cursor flickered in bottom-left corner
   - Problem: Cursor position ends up at (0, bottom) after ink's redraw cycle

2. **Respecting DECTCEM** - Only show cursor when `cursorVisible=true`
   - Result: Cursor never shown
   - Problem: Claude/Gemini NEVER set cursor visible

3. **Finding end of content** - Scan last row for content and put cursor there
   - Result: Wrong position
   - Problem: Input field isn't always on the last content row

4. **Using PTY cursor position directly** - Just render at `cursor.x, cursor.y`
   - Result: Cursor at bottom of buffer
   - Problem: PTY cursor position doesn't represent input location

5. **Skip cursor overlay for ink providers (`usesInkCursor()`)** - Don't draw our cursor overlay for Claude/Gemini, let ink's own cursor be visible
   - Result: Still doesn't work
   - Problem: Ink's cursor rendering may not be visible through our terminal emulation layer, or there's an issue with how we're rendering ink's styled cursor characters

## Root Cause Analysis

Ink-based TUI applications like Claude Code and Gemini CLI:

1. **Hide the terminal cursor** (DECTCEM off) during their entire operation
2. **Manage their own cursor display** using styled characters (inverse text, block chars)
3. **Move the terminal cursor around for drawing** but don't leave it at the input position
4. **Redraw the entire screen** on each update cycle

The terminal cursor position we track is an artifact of ink's rendering, not the logical input position. Ink probably uses sequences like:
- Position cursor at start of row
- Draw content (cursor advances)
- Position cursor elsewhere for next draw operation
- The "input cursor" is drawn as a styled character, not the terminal cursor

## Potential Solutions

1. **Detect ink's cursor character** - Look for inverse-styled characters or block characters (█, ▌, etc.) in the buffer and don't overlay our cursor

2. **Track cursor position during specific events** - The cursor might be positioned correctly right after user input is echoed, not during output

3. **Use a heuristic for the input row** - Claude/Gemini typically show an input prompt. Detect the prompt pattern and position cursor after it

4. **Don't show cursor for ink-based tools** - Accept that ink handles its own cursor and don't draw ours

5. **Parse ink's output more intelligently** - Understand ink's rendering model and extract the logical cursor position

## Code References

Current cursor rendering in `ai-terminal-chat.ts` (line ~403):
```typescript
// Draw cursor overlay only for providers that don't manage their own cursor.
// Ink-based apps (Claude/Gemini) hide the terminal cursor and draw their own
// caret as styled characters - we skip our overlay to avoid conflicts.
if (!this.usesInkCursor() && this.focused && viewOffset === 0 &&
    cursor.y < height && cursor.x < contentWidth) {
  const cursorCell = buffer.get(x + cursor.x, y + cursor.y);
  buffer.set(x + cursor.x, y + cursor.y, {
    char: cursorCell?.char ?? ' ',
    fg: defaultBg,
    bg: cursorBg,
  });
}
```

Provider overrides:
- `ClaudeTerminalChat.usesInkCursor()` returns `true` (line ~623)
- `GeminiTerminalChat.usesInkCursor()` returns `true` (line ~839)
- `CodexTerminalChat` uses default `false` - cursor overlay shown

## Why Codex Works

Codex likely doesn't use ink or uses a simpler terminal interface that:
- Keeps the terminal cursor at the input position
- Doesn't hide the cursor (or shows it when waiting for input)
- Uses standard readline-style input handling

## Future Investigation Ideas

1. **Inspect ink's actual cursor character** - Run Claude/Gemini in a real terminal, capture the output, and identify exactly what character/styling ink uses for its cursor (likely inverse space or block char)

2. **Check if we're stripping cursor styling** - Our ANSI parser might not be preserving the SGR attributes that make ink's cursor visible (inverse video, specific colors)

3. **Terminal emulator comparison** - Test Claude/Gemini in iTerm2, Alacritty, etc. and compare their terminal capabilities to what we support

4. **Ink source code analysis** - Look at ink's cursor rendering to understand exactly what escape sequences it emits

5. **Alternative approach** - Instead of trying to show a cursor, consider if the UX is acceptable without one for Claude/Gemini (users type blind but see characters appear)
