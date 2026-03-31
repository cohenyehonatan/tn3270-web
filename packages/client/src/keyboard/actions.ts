/**
 * 3270 Terminal Actions
 *
 * Defines the actions that keyboard input can produce.
 */

export type TerminalAction =
  | { type: 'aid'; aid: number }
  | { type: 'character'; char: string }
  | { type: 'tab' }
  | { type: 'backtab' }
  | { type: 'delete' }
  | { type: 'backspace' }
  | { type: 'eraseEOF' }
  | { type: 'eraseInput' }
  | { type: 'insertToggle' }
  | { type: 'home' }
  | { type: 'cursorUp' }
  | { type: 'cursorDown' }
  | { type: 'cursorLeft' }
  | { type: 'cursorRight' }
  | { type: 'newLine' }
  | { type: 'reset' }
  | { type: 'fieldMark' }
  | { type: 'dup' };
