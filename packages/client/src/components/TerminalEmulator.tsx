/**
 * TerminalEmulator — Top-level Component
 *
 * Orchestrates the terminal session, screen, status bar, connection dialog,
 * and display settings (theme, font size).
 */

import { useCallback, useState } from 'react';
import { useTerminalSession } from '../hooks/useTerminalSession.js';
import { TerminalScreen } from './TerminalScreen.js';
import { StatusBar } from './StatusBar.js';
import { ConnectionDialog, type ConnectionParams } from './ConnectionDialog.js';
import { GREEN_ON_BLACK, AMBER_ON_BLACK, WHITE_ON_BLACK, type ColorTheme } from '../renderer/colors.js';
import { loadSettings, saveSettings } from '../config/settings.js';

const DEFAULT_SCREEN_SIZE = { rows: 24, cols: 80 };

const THEMES: Record<string, ColorTheme> = {
  green: GREEN_ON_BLACK,
  amber: AMBER_ON_BLACK,
  white: WHITE_ON_BLACK,
};

export function TerminalEmulator() {
  const session = useTerminalSession(DEFAULT_SCREEN_SIZE);
  const [showDialog, setShowDialog] = useState(true);

  // Load saved settings
  const savedSettings = loadSettings();
  const [themeName, setThemeName] = useState(savedSettings.theme);
  const [fontSize, setFontSize] = useState(savedSettings.fontSize);

  const handleConnect = useCallback(async (params: ConnectionParams) => {
    setShowDialog(false);
    try {
      await session.connect(params);
    } catch (err) {
      console.error('Connection failed:', err);
      setShowDialog(true);
    }
  }, [session.connect]);

  const handleDisconnect = useCallback(() => {
    session.disconnect();
    setShowDialog(true);
  }, [session.disconnect]);

  const handleShowDialog = useCallback(() => {
    setShowDialog(true);
  }, []);

  const handleThemeChange = useCallback((name: string) => {
    setThemeName(name);
    saveSettings({ ...loadSettings(), theme: name });
  }, []);

  const handleFontSizeChange = useCallback((size: number) => {
    setFontSize(size);
    saveSettings({ ...loadSettings(), fontSize: size });
  }, []);

  const theme = THEMES[themeName] ?? GREEN_ON_BLACK;

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
          boxShadow: `0 0 20px ${theme.cursor}15`,
        }}
      >
        <TerminalScreen
          buffer={session.buffer}
          keyboardHandler={session.keyboardHandler}
          screenSize={DEFAULT_SCREEN_SIZE}
          statusLine={session.state.statusLine}
          renderTick={session.renderTick}
          theme={theme}
          fontSize={fontSize}
        />
        <StatusBar
          statusLine={session.state.statusLine}
          onConnect={handleShowDialog}
          onDisconnect={handleDisconnect}
          onThemeChange={handleThemeChange}
          onFontSizeChange={handleFontSizeChange}
          currentTheme={themeName}
          currentFontSize={fontSize}
        />
      </div>

      <ConnectionDialog
        onConnect={handleConnect}
        visible={showDialog}
      />
    </div>
  );
}
