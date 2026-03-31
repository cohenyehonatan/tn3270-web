/**
 * TerminalScreen Component
 *
 * Wraps the canvas element and handles keyboard events.
 * Renders the ScreenBuffer using CanvasRenderer on each update.
 */

import { useRef, useEffect, useCallback } from 'react';
import type { ScreenSize } from '@tn3270/shared';
import { CanvasRenderer, type StatusLineInfo } from '../renderer/canvas-renderer.js';
import { ScreenBuffer } from '../buffer/screen-buffer.js';
import { KeyboardHandler } from '../keyboard/keyboard-handler.js';

interface TerminalScreenProps {
  buffer: ScreenBuffer;
  keyboardHandler: KeyboardHandler;
  screenSize: ScreenSize;
  statusLine: StatusLineInfo;
  renderTick: number;
}

export function TerminalScreen({
  buffer,
  keyboardHandler,
  screenSize,
  statusLine,
  renderTick,
}: TerminalScreenProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rendererRef = useRef<CanvasRenderer | null>(null);

  // Initialize renderer when canvas is available
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const renderer = new CanvasRenderer(canvas, screenSize);
    rendererRef.current = renderer;

    return () => {
      renderer.dispose();
      rendererRef.current = null;
    };
  }, [screenSize]);

  // Re-render when renderTick changes
  useEffect(() => {
    const renderer = rendererRef.current;
    if (!renderer) return;
    renderer.render(buffer, statusLine);
  }, [renderTick, buffer, statusLine]);

  // Also set up a cursor blink re-render interval
  useEffect(() => {
    const interval = setInterval(() => {
      const renderer = rendererRef.current;
      if (renderer) {
        renderer.render(buffer, statusLine);
      }
    }, 530);
    return () => clearInterval(interval);
  }, [buffer, statusLine]);

  // Keyboard event handler
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      const consumed = keyboardHandler.handleKeyDown(e.nativeEvent);
      if (consumed) {
        e.preventDefault();
        e.stopPropagation();
      }
    },
    [keyboardHandler],
  );

  // Click to position cursor
  const handleClick = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      const canvas = canvasRef.current;
      const renderer = rendererRef.current;
      if (!canvas || !renderer) return;

      const rect = canvas.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      const addr = renderer.pixelToAddress(x, y);

      if (addr >= 0) {
        buffer.cursorAddress = addr;
        renderer.render(buffer, statusLine);
      }
    },
    [buffer, statusLine],
  );

  return (
    <canvas
      ref={canvasRef}
      tabIndex={0}
      onKeyDown={handleKeyDown}
      onClick={handleClick}
      style={{
        outline: 'none',
        display: 'block',
        cursor: 'text',
      }}
    />
  );
}
