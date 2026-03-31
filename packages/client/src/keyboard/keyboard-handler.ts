/**
 * 3270 Keyboard Handler
 *
 * Maps browser KeyboardEvents to 3270 terminal actions using a configurable keymap.
 * Handles AID key processing, character input, and cursor navigation.
 */

import { unicodeToEbcdic } from '@tn3270/shared';
import { ScreenBuffer } from '../buffer/screen-buffer.js';
import { buildReadModifiedResponse } from '../protocol/stream-generator.js';
import type { TerminalAction } from './actions.js';
import { DEFAULT_KEYMAP, type KeyMapping } from './default-keymap.js';

export interface KeyboardHandlerCallbacks {
  /** Called when an AID key generates an outbound data stream */
  onSendData: (data: Uint8Array) => void;
  /** Called when the screen needs re-rendering */
  onScreenUpdate: () => void;
  /** Called when the terminal should produce an audible alert (error beep) */
  onAlarm: () => void;
  /** Called when keyboard lock state changes */
  onKeyboardLockChange: (locked: boolean) => void;
  /** Called when insert mode changes */
  onInsertModeChange: (insert: boolean) => void;
}

export class KeyboardHandler {
  private keymap: KeyMapping[];
  private buffer: ScreenBuffer;
  private callbacks: KeyboardHandlerCallbacks;
  private _keyboardLocked = false;
  private _insertMode = false;

  constructor(buffer: ScreenBuffer, callbacks: KeyboardHandlerCallbacks, keymap?: KeyMapping[]) {
    this.buffer = buffer;
    this.callbacks = callbacks;
    this.keymap = keymap ?? DEFAULT_KEYMAP;
  }

  get keyboardLocked(): boolean {
    return this._keyboardLocked;
  }

  set keyboardLocked(locked: boolean) {
    this._keyboardLocked = locked;
    this.callbacks.onKeyboardLockChange(locked);
  }

  get insertMode(): boolean {
    return this._insertMode;
  }

  /** Update the screen buffer reference (e.g. after screen size change) */
  setBuffer(buffer: ScreenBuffer): void {
    this.buffer = buffer;
  }

  /**
   * Handle a browser keyboard event.
   * Returns true if the event was consumed (should preventDefault).
   */
  handleKeyDown(event: KeyboardEvent): boolean {
    // Try to match against keymap (most specific first)
    const action = this.matchKeymap(event);

    if (action) {
      this.executeAction(action);
      return true;
    }

    // If it's a single printable character and no modifier keys (except shift)
    if (event.key.length === 1 && !event.ctrlKey && !event.altKey && !event.metaKey) {
      this.executeAction({ type: 'character', char: event.key });
      return true;
    }

    return false;
  }

  /** Match a keyboard event against the keymap */
  private matchKeymap(event: KeyboardEvent): TerminalAction | null {
    // Try more specific matches first (with modifiers)
    for (const mapping of this.keymap) {
      if (this.matchesMapping(event, mapping)) {
        return mapping.action;
      }
    }
    return null;
  }

  private matchesMapping(event: KeyboardEvent, mapping: KeyMapping): boolean {
    // Check key match
    if (event.key !== mapping.key) return false;

    // Check code if specified
    if (mapping.code && event.code !== mapping.code) return false;

    // Check modifiers — mapping.shift etc. default to false if undefined
    const wantCtrl = mapping.ctrl ?? false;
    const wantAlt = mapping.alt ?? false;
    const wantShift = mapping.shift ?? false;
    const wantMeta = mapping.meta ?? false;

    if (event.ctrlKey !== wantCtrl) return false;
    if (event.altKey !== wantAlt) return false;
    if (event.shiftKey !== wantShift) return false;
    if (event.metaKey !== wantMeta) return false;

    return true;
  }

  /** Execute a terminal action */
  private executeAction(action: TerminalAction): void {
    switch (action.type) {
      case 'aid':
        this.handleAID(action.aid);
        break;

      case 'character':
        this.handleCharacter(action.char);
        break;

      case 'tab':
        if (this._keyboardLocked) { this.errorBeep(); return; }
        this.buffer.tabForward();
        this.callbacks.onScreenUpdate();
        break;

      case 'backtab':
        if (this._keyboardLocked) { this.errorBeep(); return; }
        this.buffer.tabBackward();
        this.callbacks.onScreenUpdate();
        break;

      case 'cursorUp':
        if (this._keyboardLocked) { this.errorBeep(); return; }
        this.moveCursor(0, -1);
        break;

      case 'cursorDown':
        if (this._keyboardLocked) { this.errorBeep(); return; }
        this.moveCursor(0, 1);
        break;

      case 'cursorLeft':
        if (this._keyboardLocked) { this.errorBeep(); return; }
        this.moveCursor(-1, 0);
        break;

      case 'cursorRight':
        if (this._keyboardLocked) { this.errorBeep(); return; }
        this.moveCursor(1, 0);
        break;

      case 'home':
        if (this._keyboardLocked) { this.errorBeep(); return; }
        this.buffer.home();
        this.callbacks.onScreenUpdate();
        break;

      case 'delete':
        if (this._keyboardLocked) { this.errorBeep(); return; }
        if (!this.buffer.deleteChar()) {
          this.errorBeep();
        } else {
          this.callbacks.onScreenUpdate();
        }
        break;

      case 'backspace':
        if (this._keyboardLocked) { this.errorBeep(); return; }
        this.handleBackspace();
        break;

      case 'eraseEOF':
        if (this._keyboardLocked) { this.errorBeep(); return; }
        if (!this.buffer.eraseEOF()) {
          this.errorBeep();
        } else {
          this.callbacks.onScreenUpdate();
        }
        break;

      case 'eraseInput':
        if (this._keyboardLocked) { this.errorBeep(); return; }
        this.buffer.clearUnprotected();
        this.callbacks.onScreenUpdate();
        break;

      case 'insertToggle':
        this._insertMode = !this._insertMode;
        this.callbacks.onInsertModeChange(this._insertMode);
        this.callbacks.onScreenUpdate();
        break;

      case 'reset':
        this.keyboardLocked = false;
        this.callbacks.onScreenUpdate();
        break;

      case 'newLine':
        if (this._keyboardLocked) { this.errorBeep(); return; }
        this.handleNewLine();
        break;

      case 'fieldMark':
      case 'dup':
        // Rarely used, skip for now
        this.errorBeep();
        break;
    }
  }

  /** Handle an AID key press */
  private handleAID(aid: number): void {
    if (this._keyboardLocked) {
      this.errorBeep();
      return;
    }

    // Lock keyboard
    this.keyboardLocked = true;

    // Build and send Read Modified response
    const response = buildReadModifiedResponse(this.buffer, aid);
    this.callbacks.onSendData(response);
  }

  /** Handle a printable character */
  private handleCharacter(char: string): void {
    if (this._keyboardLocked) {
      this.errorBeep();
      return;
    }

    const ebcdicByte = unicodeToEbcdic(char);
    if (!this.buffer.typeChar(ebcdicByte, this._insertMode)) {
      this.errorBeep();
      return;
    }
    this.callbacks.onScreenUpdate();
  }

  /** Handle backspace: move left then delete */
  private handleBackspace(): void {
    const { cursorAddress } = this.buffer;
    const prevAddr = (cursorAddress - 1 + this.buffer.size) % this.buffer.size;
    const prevCell = this.buffer.getCell(prevAddr);

    if (prevCell.isFieldAttribute) {
      this.errorBeep();
      return;
    }

    // Check if previous position is in an unprotected field
    if (this.buffer.isProtected(prevAddr)) {
      this.errorBeep();
      return;
    }

    this.buffer.cursorAddress = prevAddr;
    if (!this.buffer.deleteChar()) {
      this.errorBeep();
    }
    this.callbacks.onScreenUpdate();
  }

  /** Move cursor by column/row delta */
  private moveCursor(dCol: number, dRow: number): void {
    const { row, col } = this.buffer.toRowCol(this.buffer.cursorAddress);
    let newRow = row + dRow;
    let newCol = col + dCol;

    // Wrap
    if (newCol < 0) {
      newCol = this.buffer.cols - 1;
      newRow--;
    } else if (newCol >= this.buffer.cols) {
      newCol = 0;
      newRow++;
    }
    if (newRow < 0) newRow = this.buffer.rows - 1;
    if (newRow >= this.buffer.rows) newRow = 0;

    this.buffer.cursorAddress = this.buffer.toAddress(newRow, newCol);
    this.callbacks.onScreenUpdate();
  }

  /** Handle new line: move to first unprotected field of next row */
  private handleNewLine(): void {
    const { row } = this.buffer.toRowCol(this.buffer.cursorAddress);
    const nextRow = (row + 1) % this.buffer.rows;
    const startAddr = this.buffer.toAddress(nextRow, 0);

    // Find next unprotected field from start of next row
    const fieldAddr = this.buffer.findNextUnprotectedField(startAddr - 1);
    if (fieldAddr !== -1) {
      this.buffer.cursorAddress = (fieldAddr + 1) % this.buffer.size;
    } else {
      this.buffer.cursorAddress = startAddr;
    }
    this.callbacks.onScreenUpdate();
  }

  private errorBeep(): void {
    this.callbacks.onAlarm();
  }
}
