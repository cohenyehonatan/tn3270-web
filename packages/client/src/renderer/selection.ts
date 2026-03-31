/**
 * Text Selection Manager
 *
 * Handles mouse-based text selection on the terminal canvas.
 * Tracks selection start/end addresses and provides methods
 * to extract selected text and render selection highlighting.
 */

import { ebcdicToUnicode } from '@tn3270/shared';
import { ScreenBuffer } from '../buffer/screen-buffer.js';

export interface SelectionRange {
  start: number; // buffer address
  end: number;   // buffer address (inclusive)
}

export class SelectionManager {
  private _selection: SelectionRange | null = null;
  private _selecting = false;
  private cols: number;

  constructor(cols: number) {
    this.cols = cols;
  }

  get selection(): SelectionRange | null {
    return this._selection;
  }

  get isSelecting(): boolean {
    return this._selecting;
  }

  /** Start a new selection at the given address */
  startSelection(addr: number): void {
    this._selecting = true;
    this._selection = { start: addr, end: addr };
  }

  /** Extend the current selection to the given address */
  extendSelection(addr: number): void {
    if (!this._selecting || !this._selection) return;
    this._selection.end = addr;
  }

  /** Finish the current selection */
  endSelection(): void {
    this._selecting = false;
    // If start === end, clear (it was just a click, not a drag)
    if (this._selection && this._selection.start === this._selection.end) {
      this._selection = null;
    }
  }

  /** Clear the selection */
  clearSelection(): void {
    this._selection = null;
    this._selecting = false;
  }

  /** Get the normalized selection (start <= end) */
  getNormalized(): SelectionRange | null {
    if (!this._selection) return null;
    const start = Math.min(this._selection.start, this._selection.end);
    const end = Math.max(this._selection.start, this._selection.end);
    return { start, end };
  }

  /** Check if a given address is within the selection */
  isSelected(addr: number): boolean {
    const norm = this.getNormalized();
    if (!norm) return false;
    return addr >= norm.start && addr <= norm.end;
  }

  /**
   * Extract selected text from the buffer as a string.
   * Inserts newlines at row boundaries.
   */
  getSelectedText(buffer: ScreenBuffer): string {
    const norm = this.getNormalized();
    if (!norm) return '';

    let text = '';
    let lastRow = -1;

    for (let addr = norm.start; addr <= norm.end; addr++) {
      const { row } = buffer.toRowCol(addr);
      if (lastRow !== -1 && row !== lastRow) {
        // Trim trailing spaces from the previous row
        text = text.replace(/ +$/, '');
        text += '\n';
      }
      lastRow = row;

      const cell = buffer.getCell(addr);
      if (cell.isFieldAttribute) {
        text += ' ';
      } else {
        const attrs = buffer.getEffectiveAttributes(addr);
        if (attrs.display === 'hidden' || attrs.display === 'nondisplay') {
          text += ' ';
        } else {
          const char = ebcdicToUnicode(cell.char);
          text += char || ' ';
        }
      }
    }

    // Trim trailing spaces on last line
    text = text.replace(/ +$/, '');

    return text;
  }

  /**
   * Render selection highlighting on the canvas.
   */
  renderSelection(
    ctx: CanvasRenderingContext2D,
    cellWidth: number,
    cellHeight: number,
    cols: number,
    highlightColor = 'rgba(51, 120, 255, 0.35)',
  ): void {
    const norm = this.getNormalized();
    if (!norm) return;

    ctx.fillStyle = highlightColor;

    for (let addr = norm.start; addr <= norm.end; addr++) {
      const row = Math.floor(addr / cols);
      const col = addr % cols;
      ctx.fillRect(col * cellWidth, row * cellHeight, cellWidth, cellHeight);
    }
  }
}
