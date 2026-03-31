/**
 * React hook managing the terminal session lifecycle.
 * Coordinates connection, parser, buffer, keyboard handler, and renderer.
 */

import { useRef, useState, useCallback, useEffect } from 'react';
import type { ScreenSize } from '@tn3270/shared';
import { ScreenBuffer } from '../buffer/screen-buffer.js';
import { DataStreamParser } from '../protocol/stream-parser.js';
import { KeyboardHandler, type KeyboardHandlerCallbacks } from '../keyboard/keyboard-handler.js';
import type { TerminalConnection } from '../connection/connection.js';
import { MockConnection } from '../demo/mock-connection.js';
import type { StatusLineInfo } from '../renderer/canvas-renderer.js';

export interface TerminalSessionState {
  connected: boolean;
  keyboardLocked: boolean;
  insertMode: boolean;
  statusLine: StatusLineInfo;
}

export interface TerminalSession {
  buffer: ScreenBuffer;
  keyboardHandler: KeyboardHandler;
  state: TerminalSessionState;
  connect: (mode: 'demo') => Promise<void>;
  disconnect: () => void;
  /** Increment to trigger re-render */
  renderTick: number;
}

export function useTerminalSession(screenSize: ScreenSize): TerminalSession {
  const bufferRef = useRef(new ScreenBuffer(screenSize));
  const parserRef = useRef(new DataStreamParser());
  const connectionRef = useRef<TerminalConnection | null>(null);
  const [renderTick, setRenderTick] = useState(0);

  const [state, setState] = useState<TerminalSessionState>({
    connected: false,
    keyboardLocked: false,
    insertMode: false,
    statusLine: {
      connected: false,
      connectionStatus: 'Disconnected',
      keyboardLocked: false,
      insertMode: false,
      terminalType: 'IBM-3279-2-E',
    },
  });

  const triggerRender = useCallback(() => {
    setRenderTick((t) => t + 1);
  }, []);

  const callbacks: KeyboardHandlerCallbacks = {
    onSendData: (data: Uint8Array) => {
      connectionRef.current?.send(data);
    },
    onScreenUpdate: () => {
      triggerRender();
    },
    onAlarm: () => {
      // Produce a short beep
      try {
        const ctx = new AudioContext();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.frequency.value = 800;
        gain.gain.value = 0.1;
        osc.start();
        osc.stop(ctx.currentTime + 0.08);
      } catch {
        // Ignore audio errors
      }
    },
    onKeyboardLockChange: (locked: boolean) => {
      setState((s) => ({
        ...s,
        keyboardLocked: locked,
        statusLine: { ...s.statusLine, keyboardLocked: locked },
      }));
    },
    onInsertModeChange: (insert: boolean) => {
      setState((s) => ({
        ...s,
        insertMode: insert,
        statusLine: { ...s.statusLine, insertMode: insert },
      }));
    },
  };

  const keyboardHandlerRef = useRef(new KeyboardHandler(bufferRef.current, callbacks));

  const handleIncomingData = useCallback((data: Uint8Array) => {
    const buffer = bufferRef.current;
    const parser = parserRef.current;
    const result = parser.parse(data, buffer);

    if (result.type === 'write') {
      // Unlock keyboard if WCC says so
      if (result.wcc.keyboardRestore) {
        keyboardHandlerRef.current.keyboardLocked = false;
      }
      if (result.wcc.alarm) {
        callbacks.onAlarm();
      }
    }

    triggerRender();
  }, [triggerRender]);

  const connect = useCallback(async (mode: 'demo') => {
    // For now, only demo mode
    const connection = new MockConnection();
    connectionRef.current = connection;

    connection.onData(handleIncomingData);
    connection.onDisconnect((reason) => {
      setState((s) => ({
        ...s,
        connected: false,
        statusLine: { ...s.statusLine, connected: false, connectionStatus: `Disconnected: ${reason}` },
      }));
    });

    await connection.connect();

    setState((s) => ({
      ...s,
      connected: true,
      statusLine: { ...s.statusLine, connected: true, connectionStatus: 'Demo Mode' },
    }));
  }, [handleIncomingData]);

  const disconnect = useCallback(() => {
    connectionRef.current?.disconnect();
    connectionRef.current = null;
    setState((s) => ({
      ...s,
      connected: false,
      statusLine: { ...s.statusLine, connected: false, connectionStatus: 'Disconnected' },
    }));
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      connectionRef.current?.disconnect();
    };
  }, []);

  return {
    buffer: bufferRef.current,
    keyboardHandler: keyboardHandlerRef.current,
    state,
    connect,
    disconnect,
    renderTick,
  };
}
