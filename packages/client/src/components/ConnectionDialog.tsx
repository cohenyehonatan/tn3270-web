/**
 * ConnectionDialog Component
 *
 * Allows the user to configure and connect to a mainframe host,
 * load saved profiles, or start a demo session.
 */

import { useState, useCallback, useEffect } from 'react';
import {
  loadProfiles,
  addProfile,
  deleteProfile,
  type ConnectionProfile,
} from '../config/profiles.js';

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

const smallBtnStyle: React.CSSProperties = {
  padding: '2px 8px',
  backgroundColor: 'transparent',
  border: '1px solid #555',
  borderRadius: '3px',
  cursor: 'pointer',
  fontFamily: '"IBM Plex Mono", Consolas, monospace',
  fontSize: '11px',
};

export function ConnectionDialog({ onConnect, visible }: ConnectionDialogProps) {
  const [host, setHost] = useState('');
  const [port, setPort] = useState('23');
  const [tls, setTls] = useState(false);
  const [terminalType, setTerminalType] = useState('IBM-3279-2-E');
  const [luName, setLuName] = useState('');
  const [profiles, setProfiles] = useState<ConnectionProfile[]>([]);

  useEffect(() => {
    if (visible) {
      setProfiles(loadProfiles());
    }
  }, [visible]);

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

  const handleSaveProfile = useCallback(() => {
    if (!host.trim()) return;
    const name = `${host.trim()}:${port}`;
    const profile = addProfile({
      name,
      host: host.trim(),
      port: parseInt(port, 10) || 23,
      tls,
      terminalType,
      luName: luName.trim(),
    });
    setProfiles((p) => [...p, profile]);
  }, [host, port, tls, terminalType, luName]);

  const handleLoadProfile = useCallback((profile: ConnectionProfile) => {
    setHost(profile.host);
    setPort(String(profile.port));
    setTls(profile.tls);
    setTerminalType(profile.terminalType);
    setLuName(profile.luName);
  }, []);

  const handleDeleteProfile = useCallback((id: string) => {
    deleteProfile(id);
    setProfiles((p) => p.filter((pr) => pr.id !== id));
  }, []);

  const handleConnectProfile = useCallback((profile: ConnectionProfile) => {
    onConnect({
      mode: 'live',
      host: profile.host,
      port: profile.port,
      tls: profile.tls,
      terminalType: profile.terminalType,
      luName: profile.luName,
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
          width: '480px',
          maxHeight: '90vh',
          overflowY: 'auto',
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

        {/* Saved profiles */}
        {profiles.length > 0 && (
          <div style={{ marginBottom: '16px' }}>
            <label style={{ ...labelStyle, marginBottom: '8px' }}>Saved Profiles</label>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              {profiles.map((p) => (
                <div
                  key={p.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    padding: '6px 8px',
                    backgroundColor: '#1a1a1a',
                    borderRadius: '3px',
                    border: '1px solid #2a2a2a',
                  }}
                >
                  <span
                    style={{
                      flex: 1,
                      color: '#33ff33',
                      fontSize: '13px',
                      fontFamily: '"IBM Plex Mono", Consolas, monospace',
                      cursor: 'pointer',
                    }}
                    onClick={() => handleConnectProfile(p)}
                    title="Click to connect"
                  >
                    {p.name}
                    {p.tls && <span style={{ color: '#ffff55', marginLeft: '6px' }}>TLS</span>}
                  </span>
                  <button
                    onClick={() => handleLoadProfile(p)}
                    style={{ ...smallBtnStyle, color: '#55ffff' }}
                    title="Load into form"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => handleDeleteProfile(p.id)}
                    style={{ ...smallBtnStyle, color: '#ff5555' }}
                    title="Delete profile"
                  >
                    Del
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

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

            {host.trim() && (
              <button
                onClick={handleSaveProfile}
                style={{
                  ...smallBtnStyle,
                  color: '#55ffff',
                  marginLeft: 'auto',
                }}
              >
                Save Profile
              </button>
            )}
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
