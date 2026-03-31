/**
 * TerminalEmulator — Top-level Component
 *
 * Orchestrates the terminal session, screen, and status bar.
 */

import { useCallback, useEffect } from 'react';
import { useTerminalSession } from '../hooks/useTerminalSession.js';
import { TerminalScreen } from './TerminalScreen.js';
import { StatusBar } from './StatusBar.js';

const DEFAULT_SCREEN_SIZE = { rows: 24, cols: 80 };

export function TerminalEmulator() {
  const session = useTerminalSession(DEFAULT_SCREEN_SIZE);

  const handleConnect = useCallback(() => {
    session.connect('demo');
  }, [session.connect]);

  const handleDisconnect = useCallback(() => {
    session.disconnect();
  }, [session.disconnect]);

  // Auto-connect to demo mode on mount
  useEffect(() => {
    session.connect('demo');
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        backgroundColor: '#000',
        height: '100vh',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <div
        style={{
          border: '1px solid #333',
          borderRadius: '4px',
          overflow: 'hidden',
          boxShadow: '0 0 20px rgba(51, 255, 51, 0.1)',
        }}
      >
        <TerminalScreen
          buffer={session.buffer}
          keyboardHandler={session.keyboardHandler}
          screenSize={DEFAULT_SCREEN_SIZE}
          statusLine={session.state.statusLine}
          renderTick={session.renderTick}
        />
        <StatusBar
          statusLine={session.state.statusLine}
          onConnect={handleConnect}
          onDisconnect={handleDisconnect}
        />
      </div>
    </div>
  );
}
