/**
 * StatusBar Component (HTML-based fallback)
 *
 * Note: The primary status bar is rendered directly on the canvas by CanvasRenderer.
 * This component is a supplementary UI element for connection controls.
 */

import type { StatusLineInfo } from '../renderer/canvas-renderer.js';

interface StatusBarProps {
  statusLine: StatusLineInfo;
  onConnect: () => void;
  onDisconnect: () => void;
}

export function StatusBar({ statusLine, onConnect, onDisconnect }: StatusBarProps) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        padding: '8px 12px',
        backgroundColor: '#111',
        borderTop: '1px solid #333',
        fontFamily: '"IBM Plex Mono", Consolas, monospace',
        fontSize: '13px',
        color: '#aaa',
      }}
    >
      <span
        style={{
          color: statusLine.connected ? '#33ff33' : '#ff5555',
        }}
      >
        {statusLine.connected ? '\u25cf' : '\u25cb'} {statusLine.connectionStatus}
      </span>

      {!statusLine.connected ? (
        <button
          onClick={onConnect}
          style={{
            padding: '4px 12px',
            backgroundColor: '#1a3a1a',
            color: '#33ff33',
            border: '1px solid #33ff33',
            borderRadius: '3px',
            cursor: 'pointer',
            fontFamily: 'inherit',
            fontSize: '12px',
          }}
        >
          Connect
        </button>
      ) : (
        <button
          onClick={onDisconnect}
          style={{
            padding: '4px 12px',
            backgroundColor: '#3a1a1a',
            color: '#ff5555',
            border: '1px solid #ff5555',
            borderRadius: '3px',
            cursor: 'pointer',
            fontFamily: 'inherit',
            fontSize: '12px',
          }}
        >
          Disconnect
        </button>
      )}

      <span style={{ marginLeft: 'auto' }}>
        {statusLine.keyboardLocked && (
          <span style={{ color: '#ff5555', marginRight: '12px' }}>X SYSTEM</span>
        )}
        {statusLine.insertMode && (
          <span style={{ color: '#ffff55', marginRight: '12px' }}>INSERT</span>
        )}
        {statusLine.terminalType}
      </span>
    </div>
  );
}
