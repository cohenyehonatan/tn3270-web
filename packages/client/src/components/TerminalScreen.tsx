/**
 * TerminalScreen Component
 *
 * Wraps the canvas element and handles keyboard events, mouse selection,
 * and copy/paste. Renders the ScreenBuffer using CanvasRenderer on each update.
 */

import { useRef, useEffect, useCallback } from 'react';
import type { ScreenSize } from '@tn3270/shared';
import { unicodeToEbcdic } from '@tn3270/shared';
import { CanvasRenderer, type StatusLineInfo } from '../renderer/canvas-renderer.js';
import { SelectionManager } from '../renderer/selection.js';
import type { ColorTheme } from '../renderer/colors.js';
import { ScreenBuffer } from '../buffer/screen-buffer.js';
import { KeyboardHandler } from '../keyboard/keyboard-handler.js';

interface TerminalScreenProps {
  buffer: ScreenBuffer;
  keyboardHandler: KeyboardHandler;
  screenSize: ScreenSize;
  statusLine: StatusLineInfo;
  renderTick: number;
  theme?: ColorTheme;
  fontSize?: number;
}

export function TerminalScreen({
  buffer,
  keyboardHandler,
  screenSize,
  statusLine,
  renderTick,
  theme,
  fontSize,
}: TerminalScreenProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rendererRef = useRef<CanvasRenderer | null>(null);
  const selectionRef = useRef(new SelectionManager(screenSize.cols));

  // Effect 1: renderer lifecycle
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const renderer = new CanvasRenderer(canvas, screenSize, { theme, fontSize });
    rendererRef.current = renderer;
    return () => {
      renderer.dispose();
      rendererRef.current = null;
    };
  }, [screenSize, theme, fontSize]);

  // Effect 2: copy handler (separate concern)
  useEffect(() => {
    const handleCopy = (e: ClipboardEvent) => {
      const text = selectionRef.current.getSelectedText(buffer);
      if (!text) return;
      e.preventDefault();
      e.clipboardData?.setData('text/plain', text);
    };
    document.addEventListener('copy', handleCopy);
    return () => document.removeEventListener('copy', handleCopy);
  }, [buffer]); // re-registers only when buffer changes

  // Full render helper
  const doRender = useCallback(() => {
    const renderer = rendererRef.current;
    if (!renderer) return;
    renderer.render(buffer, statusLine);
    // Overlay selection
    const canvas = canvasRef.current;
    if (canvas) {
      const ctx = canvas.getContext('2d');
      if (ctx) {
        const dpr = window.devicePixelRatio || 1;
        ctx.save();
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        selectionRef.current.renderSelection(
          ctx,
          renderer.getCanvasSize().width / screenSize.cols,
          renderer.getCanvasSize().height / (screenSize.rows + 1),
          screenSize.cols,
        );
        ctx.restore();
      }
    }
  }, [buffer, statusLine, screenSize]);

  // Re-render when renderTick changes
  useEffect(() => {
    doRender();
  }, [renderTick, doRender]);

  // Cursor blink interval
  useEffect(() => {
    const interval = setInterval(doRender, 530);
    return () => clearInterval(interval);
  }, [doRender]);

  // --- Keyboard ---

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      // Ctrl+C or Cmd+C with selection = copy
      const isCopy = (e.ctrlKey || e.metaKey) && e.key === 'c';
      if (isCopy && selectionRef.current.selection) {
        const text = selectionRef.current.getSelectedText(buffer);
        navigator.clipboard.writeText(text);
        selectionRef.current.clearSelection();
        doRender();
        e.preventDefault();
        return;
      }

      // Ctrl+V or Cmd+V = paste
      const isPaste = (e.ctrlKey || e.metaKey) && e.key === 'v';
      if (isPaste) {
        navigator.clipboard.readText().then((text) => {
          for (const char of text) {
            if (char === '\n' || char === '\r') continue;
            const ebcdic = unicodeToEbcdic(char);
            buffer.typeChar(ebcdic, false);
          }
          doRender();
        });
        e.preventDefault();
        return;
      }

      // Clear selection on any other keypress (ignore bare modifier keys)
      const isModifierOnly = ['Meta', 'Control', 'Alt', 'Shift'].includes(e.key);
      if (selectionRef.current.selection && !isModifierOnly) {
        selectionRef.current.clearSelection();
        doRender();
      }

      const consumed = keyboardHandler.handleKeyDown(e.nativeEvent);
      if (consumed) {
        e.preventDefault();
        e.stopPropagation();
      }
    },
    [keyboardHandler, buffer, doRender],
  );

  // --- Mouse selection ---

  const getAddrFromMouse = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>): number => {
      const canvas = canvasRef.current;
      const renderer = rendererRef.current;
      if (!canvas || !renderer) return -1;
      const rect = canvas.getBoundingClientRect();
      return renderer.pixelToAddress(e.clientX - rect.left, e.clientY - rect.top);
    },
    [],
  );

  const handleMouseDown = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      if (e.button !== 0) return; // left button only
      const addr = getAddrFromMouse(e);
      if (addr < 0) return;

      selectionRef.current.startSelection(addr);
      doRender();
    },
    [getAddrFromMouse, doRender],
  );

  const handleMouseMove = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      if (!selectionRef.current.isSelecting) return;
      const addr = getAddrFromMouse(e);
      if (addr < 0) return;

      selectionRef.current.extendSelection(addr);
      doRender();
    },
    [getAddrFromMouse, doRender],
  );

  const handleMouseUp = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      if (!selectionRef.current.isSelecting) return;

      selectionRef.current.endSelection();

      // If no selection was made (just a click), position cursor
      if (!selectionRef.current.selection) {
        const addr = getAddrFromMouse(e);
        if (addr >= 0) {
          buffer.cursorAddress = addr;
        }
      }

      doRender();
    },
    [getAddrFromMouse, buffer, doRender],
  );

  return (
    <canvas
      ref={canvasRef}
      tabIndex={0}
      onKeyDown={handleKeyDown}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      style={{
        outline: 'none',
        display: 'block',
        cursor: 'text',
      }}
    />
  );
}
