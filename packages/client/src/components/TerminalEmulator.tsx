/**
 * TerminalEmulator — Top-level Component
 *
 * Orchestrates the terminal session, screen, status bar, and connection dialog.
 */

import { useCallback, useState } from 'react';
import { useTerminalSession } from '../hooks/useTerminalSession.js';
import { TerminalScreen } from './TerminalScreen.js';
import { StatusBar } from './StatusBar.js';
import { ConnectionDialog, type ConnectionParams } from './ConnectionDialog.js';

const DEFAULT_SCREEN_SIZE = { rows: 24, cols: 80 };

export function TerminalEmulator() {
  const session = useTerminalSession(DEFAULT_SCREEN_SIZE);
  const [showDialog, setShowDialog] = useState(true);

  const handleConnect = useCallback(async (params: ConnectionParams) => {
    try {
      await session.connect(params);
      setShowDialog(false);
    } catch (err) {
      // Connection error — dialog stays open, error shown in status
      console.error('Connection failed:', err);
    }
  }, [session.connect]);

  const handleDisconnect = useCallback(() => {
    session.disconnect();
    setShowDialog(true);
  }, [session.disconnect]);

  const handleShowDialog = useCallback(() => {
    setShowDialog(true);
  }, []);

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
          onConnect={handleShowDialog}
          onDisconnect={handleDisconnect}
        />
      </div>

      <ConnectionDialog
        onConnect={handleConnect}
        visible={showDialog && !session.state.connected}
      />
    </div>
  );
}
