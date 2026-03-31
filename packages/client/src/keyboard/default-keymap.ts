/**
 * Default PC → 3270 Key Mappings
 */

import { AID } from '@tn3270/shared';
import type { TerminalAction } from './actions.js';

export interface KeyMapping {
  /** KeyboardEvent.key value */
  key: string;
  /** KeyboardEvent.code value (for physical key matching) */
  code?: string;
  ctrl?: boolean;
  alt?: boolean;
  shift?: boolean;
  meta?: boolean;
  action: TerminalAction;
}

export const DEFAULT_KEYMAP: KeyMapping[] = [
  // --- AID keys ---
  { key: 'Enter', action: { type: 'aid', aid: AID.ENTER } },
  { key: 'Escape', action: { type: 'aid', aid: AID.CLEAR } },

  // PF1-PF12
  { key: 'F1', action: { type: 'aid', aid: AID.PF1 } },
  { key: 'F2', action: { type: 'aid', aid: AID.PF2 } },
  { key: 'F3', action: { type: 'aid', aid: AID.PF3 } },
  { key: 'F4', action: { type: 'aid', aid: AID.PF4 } },
  { key: 'F5', action: { type: 'aid', aid: AID.PF5 } },
  { key: 'F6', action: { type: 'aid', aid: AID.PF6 } },
  { key: 'F7', action: { type: 'aid', aid: AID.PF7 } },
  { key: 'F8', action: { type: 'aid', aid: AID.PF8 } },
  { key: 'F9', action: { type: 'aid', aid: AID.PF9 } },
  { key: 'F10', action: { type: 'aid', aid: AID.PF10 } },
  { key: 'F11', action: { type: 'aid', aid: AID.PF11 } },
  { key: 'F12', action: { type: 'aid', aid: AID.PF12 } },

  // PF13-PF24 (Shift+F1-F12)
  { key: 'F1', shift: true, action: { type: 'aid', aid: AID.PF13 } },
  { key: 'F2', shift: true, action: { type: 'aid', aid: AID.PF14 } },
  { key: 'F3', shift: true, action: { type: 'aid', aid: AID.PF15 } },
  { key: 'F4', shift: true, action: { type: 'aid', aid: AID.PF16 } },
  { key: 'F5', shift: true, action: { type: 'aid', aid: AID.PF17 } },
  { key: 'F6', shift: true, action: { type: 'aid', aid: AID.PF18 } },
  { key: 'F7', shift: true, action: { type: 'aid', aid: AID.PF19 } },
  { key: 'F8', shift: true, action: { type: 'aid', aid: AID.PF20 } },
  { key: 'F9', shift: true, action: { type: 'aid', aid: AID.PF21 } },
  { key: 'F10', shift: true, action: { type: 'aid', aid: AID.PF22 } },
  { key: 'F11', shift: true, action: { type: 'aid', aid: AID.PF23 } },
  { key: 'F12', shift: true, action: { type: 'aid', aid: AID.PF24 } },

  // PA keys (Alt+1/2/3)
  { key: '1', alt: true, action: { type: 'aid', aid: AID.PA1 } },
  { key: '2', alt: true, action: { type: 'aid', aid: AID.PA2 } },
  { key: '3', alt: true, action: { type: 'aid', aid: AID.PA3 } },

  // --- Navigation ---
  { key: 'Tab', action: { type: 'tab' } },
  { key: 'Tab', shift: true, action: { type: 'backtab' } },
  { key: 'ArrowUp', action: { type: 'cursorUp' } },
  { key: 'ArrowDown', action: { type: 'cursorDown' } },
  { key: 'ArrowLeft', action: { type: 'cursorLeft' } },
  { key: 'ArrowRight', action: { type: 'cursorRight' } },
  { key: 'Home', action: { type: 'home' } },

  // --- Editing ---
  { key: 'Delete', action: { type: 'delete' } },
  { key: 'Backspace', action: { type: 'backspace' } },
  { key: 'End', action: { type: 'eraseEOF' } },
  { key: 'Insert', action: { type: 'insertToggle' } },

  // Ctrl+A as reset (unlock keyboard)
  { key: 'a', ctrl: true, action: { type: 'reset' } },
];
