/**
 * StatusBar Component
 *
 * Connection controls, keyboard status, and display settings (theme, font size).
 */

import { useState, useCallback } from 'react';
import type { StatusLineInfo } from '../renderer/canvas-renderer.js';

interface StatusBarProps {
  statusLine: StatusLineInfo;
  onConnect: () => void;
  onDisconnect: () => void;
  onThemeChange?: (theme: string) => void;
  onFontSizeChange?: (size: number) => void;
  currentTheme?: string;
  currentFontSize?: number;
}

const btnStyle: React.CSSProperties = {
  padding: '4px 12px',
  borderRadius: '3px',
  cursor: 'pointer',
  fontFamily: '"IBM Plex Mono", Consolas, monospace',
  fontSize: '12px',
  border: '1px solid',
};

export function StatusBar({
  statusLine,
  onConnect,
  onDisconnect,
  onThemeChange,
  onFontSizeChange,
  currentTheme = 'green',
  currentFontSize = 16,
}: StatusBarProps) {
  const [showSettings, setShowSettings] = useState(false);

  const toggleSettings = useCallback(() => {
    setShowSettings((s) => !s);
  }, []);

  return (
    <div style={{ position: 'relative' }}>
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
        <span style={{ color: statusLine.connected ? '#33ff33' : '#ff5555' }}>
          {statusLine.connected ? '\u25cf' : '\u25cb'} {statusLine.connectionStatus}
        </span>

        {!statusLine.connected ? (
          <button
            onClick={onConnect}
            style={{ ...btnStyle, backgroundColor: '#1a3a1a', color: '#33ff33', borderColor: '#33ff33' }}
          >
            Connect
          </button>
        ) : (
          <button
            onClick={onDisconnect}
            style={{ ...btnStyle, backgroundColor: '#3a1a1a', color: '#ff5555', borderColor: '#ff5555' }}
          >
            Disconnect
          </button>
        )}

        <button
          onClick={toggleSettings}
          style={{
            ...btnStyle,
            backgroundColor: showSettings ? '#2a2a2a' : 'transparent',
            color: '#888',
            borderColor: '#555',
          }}
          title="Display settings"
        >
          Settings
        </button>

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

      {/* Settings panel */}
      {showSettings && (
        <div
          style={{
            position: 'absolute',
            bottom: '100%',
            left: 0,
            right: 0,
            backgroundColor: '#1a1a1a',
            borderTop: '1px solid #333',
            padding: '10px 12px',
            display: 'flex',
            alignItems: 'center',
            gap: '16px',
            fontFamily: '"IBM Plex Mono", Consolas, monospace',
            fontSize: '12px',
            color: '#aaa',
          }}
        >
          <span style={{ color: '#888' }}>Theme:</span>
          {(['green', 'amber', 'white'] as const).map((t) => (
            <button
              key={t}
              onClick={() => onThemeChange?.(t)}
              style={{
                ...btnStyle,
                fontSize: '11px',
                padding: '2px 8px',
                backgroundColor: currentTheme === t ? '#333' : 'transparent',
                color: t === 'green' ? '#33ff33' : t === 'amber' ? '#ffaa00' : '#ccc',
                borderColor: currentTheme === t ? (t === 'green' ? '#33ff33' : t === 'amber' ? '#ffaa00' : '#ccc') : '#555',
              }}
            >
              {t.charAt(0).toUpperCase() + t.slice(1)}
            </button>
          ))}

          <span style={{ color: '#888', marginLeft: '8px' }}>Font:</span>
          <button
            onClick={() => onFontSizeChange?.(Math.max(10, currentFontSize - 1))}
            style={{ ...btnStyle, fontSize: '11px', padding: '2px 6px', color: '#aaa', borderColor: '#555', backgroundColor: 'transparent' }}
          >
            -
          </button>
          <span style={{ color: '#33ff33', minWidth: '30px', textAlign: 'center' }}>{currentFontSize}px</span>
          <button
            onClick={() => onFontSizeChange?.(Math.min(28, currentFontSize + 1))}
            style={{ ...btnStyle, fontSize: '11px', padding: '2px 6px', color: '#aaa', borderColor: '#555', backgroundColor: 'transparent' }}
          >
            +
          </button>
        </div>
      )}
    </div>
  );
}
