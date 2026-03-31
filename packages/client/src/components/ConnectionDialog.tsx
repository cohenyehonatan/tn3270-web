/**
 * ConnectionDialog Component
 *
 * Allows the user to configure and connect to a mainframe host,
 * or start a demo session.
 */

import { useState, useCallback } from 'react';

export interface ConnectionParams {
  mode: 'demo' | 'live';
  host: string;
  port: number;
  tls: boolean;
  terminalType: string;
  luName: string;
}

interface ConnectionDialogProps {
  onConnect: (params: ConnectionParams) => void;
  visible: boolean;
}

const inputStyle: React.CSSProperties = {
  padding: '6px 10px',
  backgroundColor: '#1a1a1a',
  color: '#33ff33',
  border: '1px solid #333',
  borderRadius: '3px',
  fontFamily: '"IBM Plex Mono", Consolas, monospace',
  fontSize: '13px',
  width: '100%',
};

const labelStyle: React.CSSProperties = {
  color: '#888',
  fontSize: '12px',
  marginBottom: '4px',
  display: 'block',
};

export function ConnectionDialog({ onConnect, visible }: ConnectionDialogProps) {
  const [host, setHost] = useState('');
  const [port, setPort] = useState('23');
  const [tls, setTls] = useState(false);
  const [terminalType, setTerminalType] = useState('IBM-3279-2-E');
  const [luName, setLuName] = useState('');

  const handleLiveConnect = useCallback(() => {
    if (!host.trim()) return;
    onConnect({
      mode: 'live',
      host: host.trim(),
      port: parseInt(port, 10) || 23,
      tls,
      terminalType,
      luName: luName.trim(),
    });
  }, [host, port, tls, terminalType, luName, onConnect]);

  const handleDemoConnect = useCallback(() => {
    onConnect({
      mode: 'demo',
      host: '',
      port: 0,
      tls: false,
      terminalType: 'IBM-3279-2-E',
      luName: '',
    });
  }, [onConnect]);

  if (!visible) return null;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'rgba(0,0,0,0.85)',
        zIndex: 100,
      }}
    >
      <div
        style={{
          backgroundColor: '#111',
          border: '1px solid #333',
          borderRadius: '6px',
          padding: '24px',
          width: '420px',
          boxShadow: '0 0 30px rgba(51,255,51,0.1)',
        }}
      >
        <h2
          style={{
            color: '#33ff33',
            fontSize: '18px',
            marginBottom: '20px',
            fontFamily: '"IBM Plex Mono", Consolas, monospace',
            fontWeight: 'normal',
          }}
        >
          TN3270 Connection
        </h2>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div>
            <label style={labelStyle}>Host</label>
            <input
              type="text"
              value={host}
              onChange={(e) => setHost(e.target.value)}
              placeholder="mainframe.example.com"
              style={inputStyle}
              onKeyDown={(e) => e.key === 'Enter' && handleLiveConnect()}
            />
          </div>

          <div style={{ display: 'flex', gap: '12px' }}>
            <div style={{ flex: 1 }}>
              <label style={labelStyle}>Port</label>
              <input
                type="text"
                value={port}
                onChange={(e) => setPort(e.target.value)}
                style={inputStyle}
              />
            </div>
            <div style={{ flex: 1 }}>
              <label style={labelStyle}>Terminal Type</label>
              <select
                value={terminalType}
                onChange={(e) => setTerminalType(e.target.value)}
                style={{ ...inputStyle, appearance: 'auto' }}
              >
                <option value="IBM-3279-2-E">3279-2-E (24x80 color)</option>
                <option value="IBM-3278-2-E">3278-2-E (24x80)</option>
                <option value="IBM-3279-3-E">3279-3-E (32x80 color)</option>
                <option value="IBM-3279-4-E">3279-4-E (43x80 color)</option>
                <option value="IBM-3278-5-E">3278-5-E (27x132)</option>
              </select>
            </div>
          </div>

          <div>
            <label style={labelStyle}>LU Name (optional)</label>
            <input
              type="text"
              value={luName}
              onChange={(e) => setLuName(e.target.value)}
              placeholder="Leave blank for any available"
              style={inputStyle}
            />
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <input
              type="checkbox"
              id="tls"
              checked={tls}
              onChange={(e) => setTls(e.target.checked)}
              style={{ accentColor: '#33ff33' }}
            />
            <label htmlFor="tls" style={{ color: '#aaa', fontSize: '13px' }}>
              Use TLS
            </label>
          </div>

          <div style={{ display: 'flex', gap: '12px', marginTop: '8px' }}>
            <button
              onClick={handleLiveConnect}
              disabled={!host.trim()}
              style={{
                flex: 1,
                padding: '8px 16px',
                backgroundColor: host.trim() ? '#1a3a1a' : '#1a1a1a',
                color: host.trim() ? '#33ff33' : '#555',
                border: `1px solid ${host.trim() ? '#33ff33' : '#333'}`,
                borderRadius: '3px',
                cursor: host.trim() ? 'pointer' : 'default',
                fontFamily: 'inherit',
                fontSize: '14px',
              }}
            >
              Connect
            </button>

            <button
              onClick={handleDemoConnect}
              style={{
                flex: 1,
                padding: '8px 16px',
                backgroundColor: '#1a1a2a',
                color: '#5555ff',
                border: '1px solid #5555ff',
                borderRadius: '3px',
                cursor: 'pointer',
                fontFamily: 'inherit',
                fontSize: '14px',
              }}
            >
              Demo Mode
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
