/**
 * Canvas-based 3270 Screen Renderer
 *
 * Renders the ScreenBuffer to an HTML canvas element with proper monospace
 * character alignment, 3270 colors, highlighting effects, and cursor.
 */

import type { ScreenSize } from '@tn3270/shared';
import { Highlight3270 } from '@tn3270/shared';
import { ebcdicToUnicode } from '@tn3270/shared';
import { deriveBaseColor } from '@tn3270/shared';
import { ScreenBuffer } from '../buffer/screen-buffer.js';
import { resolveColor, type ColorTheme, DEFAULT_THEME } from './colors.js';

export interface RendererOptions {
  /** Font family (must be monospace) */
  fontFamily?: string;
  /** Font size in pixels */
  fontSize?: number;
  /** Color theme */
  theme?: ColorTheme;
  /** Cursor style */
  cursorStyle?: 'block' | 'underline';
}

const DEFAULT_OPTIONS: Required<RendererOptions> = {
  fontFamily: '"IBM Plex Mono", "Consolas", "Menlo", monospace',
  fontSize: 16,
  theme: DEFAULT_THEME,
  cursorStyle: 'block',
};

export class CanvasRenderer {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private cellWidth = 0;
  private cellHeight = 0;
  private cellAscent = 0;
  private screenSize: ScreenSize;
  private options: Required<RendererOptions>;
  private cursorVisible = true;
  private cursorBlinkTimer: number | null = null;
  private dpr: number;

  constructor(canvas: HTMLCanvasElement, screenSize: ScreenSize, options?: RendererOptions) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d')!;
    this.screenSize = screenSize;
    this.options = { ...DEFAULT_OPTIONS, ...options };
    this.dpr = window.devicePixelRatio || 1;
    this.measureFont();
    this.resizeCanvas();
    this.startCursorBlink();
  }

  /** Measure character cell dimensions using the configured font */
  private measureFont(): void {
    this.ctx.font = `${this.options.fontSize}px ${this.options.fontFamily}`;
    const metrics = this.ctx.measureText('M');
    this.cellWidth = Math.ceil(metrics.width);
    // Use font metrics for height; fall back to fontSize * 1.2
    this.cellHeight = Math.ceil(this.options.fontSize * 1.25);
    this.cellAscent = Math.ceil(this.options.fontSize * 1.0);
  }

  /** Resize canvas to fit the screen buffer */
  private resizeCanvas(): void {
    const width = this.screenSize.cols * this.cellWidth;
    const height = (this.screenSize.rows + 1) * this.cellHeight; // +1 for status bar

    // Set display size
    this.canvas.style.width = `${width}px`;
    this.canvas.style.height = `${height}px`;

    // Set actual pixel size for HiDPI
    this.canvas.width = Math.floor(width * this.dpr);
    this.canvas.height = Math.floor(height * this.dpr);
    this.ctx.scale(this.dpr, this.dpr);

    // Re-set font after resize (canvas reset clears it)
    this.ctx.font = `${this.options.fontSize}px ${this.options.fontFamily}`;
    this.ctx.textBaseline = 'top';
  }

  /** Get the canvas dimensions */
  getCanvasSize(): { width: number; height: number } {
    return {
      width: this.screenSize.cols * this.cellWidth,
      height: (this.screenSize.rows + 1) * this.cellHeight,
    };
  }

  /** Update theme */
  setTheme(theme: ColorTheme): void {
    this.options.theme = theme;
  }

  /** Update font size */
  setFontSize(size: number): void {
    this.options.fontSize = size;
    this.measureFont();
    this.resizeCanvas();
  }

  // --- Cursor blink ---

  private startCursorBlink(): void {
    if (this.cursorBlinkTimer !== null) return;
    this.cursorBlinkTimer = window.setInterval(() => {
      this.cursorVisible = !this.cursorVisible;
    }, 530);
  }

  stopCursorBlink(): void {
    if (this.cursorBlinkTimer !== null) {
      clearInterval(this.cursorBlinkTimer);
      this.cursorBlinkTimer = null;
    }
  }

  // --- Full render ---

  /**
   * Render the entire screen buffer to the canvas.
   */
  render(buffer: ScreenBuffer, statusLine?: StatusLineInfo): void {
    const theme = this.options.theme;
    const ctx = this.ctx;

    // Clear entire canvas
    ctx.fillStyle = theme.background;
    ctx.fillRect(0, 0, this.canvas.width / this.dpr, this.canvas.height / this.dpr);

    // Set font
    ctx.font = `${this.options.fontSize}px ${this.options.fontFamily}`;
    ctx.textBaseline = 'top';

    // Render each cell
    for (let addr = 0; addr < buffer.size; addr++) {
      this.renderCell(addr, buffer, theme, ctx);
    }

    // Render cursor
    this.renderCursor(buffer.cursorAddress, buffer, theme, ctx);

    // Render status bar
    if (statusLine) {
      this.renderStatusBar(statusLine, buffer, theme, ctx);
    }

    buffer.clearDirty();
  }

  /**
   * Render only dirty cells (incremental update).
   */
  renderDirty(buffer: ScreenBuffer, statusLine?: StatusLineInfo): void {
    if (buffer.isFullDirty) {
      this.render(buffer, statusLine);
      return;
    }

    const theme = this.options.theme;
    const ctx = this.ctx;
    ctx.font = `${this.options.fontSize}px ${this.options.fontFamily}`;
    ctx.textBaseline = 'top';

    for (const addr of buffer.dirtyAddresses) {
      // Clear cell background
      const { row, col } = buffer.toRowCol(addr);
      const x = col * this.cellWidth;
      const y = row * this.cellHeight;
      ctx.fillStyle = theme.background;
      ctx.fillRect(x, y, this.cellWidth, this.cellHeight);

      this.renderCell(addr, buffer, theme, ctx);
    }

    // Always re-render cursor (it may have moved)
    this.renderCursor(buffer.cursorAddress, buffer, theme, ctx);

    if (statusLine) {
      this.renderStatusBar(statusLine, buffer, theme, ctx);
    }

    buffer.clearDirty();
  }

  /** Render a single cell */
  private renderCell(
    addr: number,
    buffer: ScreenBuffer,
    theme: ColorTheme,
    ctx: CanvasRenderingContext2D,
  ): void {
    const cell = buffer.getCell(addr);

    // Field attribute positions are displayed as blank
    if (cell.isFieldAttribute) return;

    const attrs = buffer.getEffectiveAttributes(addr);

    // Hidden / nondisplay fields are not rendered
    if (attrs.display === 'hidden' || attrs.display === 'nondisplay') return;

    const { row, col } = buffer.toRowCol(addr);
    const x = col * this.cellWidth;
    const y = row * this.cellHeight;

    // Determine effective color
    let fgColor: string;
    if (attrs.color !== 0x00) {
      fgColor = resolveColor(attrs.color, theme);
    } else {
      // Derive base color from field attributes
      fgColor = resolveColor(deriveBaseColor(attrs), theme);
    }
    let bgColor = theme.background;

    // Apply highlighting
    if (attrs.highlight === Highlight3270.REVERSE) {
      // Swap fg/bg
      const temp = fgColor;
      fgColor = bgColor;
      bgColor = temp;
    }

    // Draw background (only if not default)
    if (bgColor !== theme.background) {
      ctx.fillStyle = bgColor;
      ctx.fillRect(x, y, this.cellWidth, this.cellHeight);
    }

    // Draw character
    const char = ebcdicToUnicode(cell.char);
    if (char && char !== '\x00') {
      ctx.fillStyle = fgColor;
      ctx.fillText(char, x, y + (this.cellHeight - this.cellAscent) / 2);
    }

    // Underscore highlighting
    if (attrs.highlight === Highlight3270.UNDERSCORE) {
      ctx.fillStyle = fgColor;
      ctx.fillRect(x, y + this.cellHeight - 2, this.cellWidth, 1);
    }

    // Intensified: slightly brighter (apply to text already drawn via composite)
    // We handle this through the color derivation above (intensified fields get white/red)
  }

  /** Render the cursor */
  private renderCursor(
    addr: number,
    buffer: ScreenBuffer,
    theme: ColorTheme,
    ctx: CanvasRenderingContext2D,
  ): void {
    if (!this.cursorVisible) return;

    const { row, col } = buffer.toRowCol(addr);
    const x = col * this.cellWidth;
    const y = row * this.cellHeight;

    ctx.fillStyle = theme.cursor;

    if (this.options.cursorStyle === 'block') {
      ctx.globalAlpha = 0.7;
      ctx.fillRect(x, y, this.cellWidth, this.cellHeight);
      ctx.globalAlpha = 1.0;

      // Re-draw character inverted on top of cursor block
      const cell = buffer.getCell(addr);
      const char = ebcdicToUnicode(cell.char);
      if (char && char !== '\x00') {
        ctx.fillStyle = theme.background;
        ctx.fillText(char, x, y + (this.cellHeight - this.cellAscent) / 2);
      }
    } else {
      // Underline cursor
      ctx.fillRect(x, y + this.cellHeight - 3, this.cellWidth, 3);
    }
  }

  /** Render the OIA status bar */
  private renderStatusBar(
    info: StatusLineInfo,
    buffer: ScreenBuffer,
    theme: ColorTheme,
    ctx: CanvasRenderingContext2D,
  ): void {
    const y = this.screenSize.rows * this.cellHeight;
    const width = this.screenSize.cols * this.cellWidth;

    // Background
    ctx.fillStyle = theme.statusBackground;
    ctx.fillRect(0, y, width, this.cellHeight);

    // Draw separator line
    ctx.fillStyle = theme.statusText;
    ctx.fillRect(0, y, width, 1);

    ctx.font = `${this.options.fontSize - 2}px ${this.options.fontFamily}`;
    ctx.fillStyle = theme.statusText;
    const textY = y + 4;

    // Connection status
    const statusIcon = info.connected ? '\u25cf' : '\u25cb'; // ● or ○
    ctx.fillText(`${statusIcon} ${info.connectionStatus}`, 4, textY);

    // Keyboard lock indicator
    if (info.keyboardLocked) {
      ctx.fillText('X SYSTEM', 200, textY);
    }

    // Insert mode
    if (info.insertMode) {
      ctx.fillText('^', 340, textY);
    }

    // Cursor position
    const { row, col } = buffer.toRowCol(buffer.cursorAddress);
    const posStr = `${String(row + 1).padStart(3, '0')}/${String(col + 1).padStart(3, '0')}`;
    ctx.fillText(posStr, width - 80, textY);

    // Terminal type
    if (info.terminalType) {
      ctx.fillText(info.terminalType, width - 240, textY);
    }

    // Reset font
    ctx.font = `${this.options.fontSize}px ${this.options.fontFamily}`;
  }

  /**
   * Convert pixel coordinates to a buffer address.
   * Useful for mouse click handling.
   */
  pixelToAddress(pixelX: number, pixelY: number): number {
    const col = Math.floor(pixelX / this.cellWidth);
    const row = Math.floor(pixelY / this.cellHeight);
    if (row >= this.screenSize.rows || col >= this.screenSize.cols) return -1;
    return row * this.screenSize.cols + col;
  }

  dispose(): void {
    this.stopCursorBlink();
  }
}

export interface StatusLineInfo {
  connected: boolean;
  connectionStatus: string;
  keyboardLocked: boolean;
  insertMode: boolean;
  terminalType?: string;
}
