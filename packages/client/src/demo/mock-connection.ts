/**
 * Mock Connection for Demo Mode
 *
 * Implements TerminalConnection using DemoHost to simulate a mainframe.
 * Runs entirely in-browser with no server dependency.
 */

import type { TerminalConnection } from '../connection/connection.js';
import { DemoHost } from './demo-host.js';

export class MockConnection implements TerminalConnection {
  private demoHost = new DemoHost();
  private dataHandler: ((data: Uint8Array) => void) | null = null;
  private disconnectHandler: ((reason: string) => void) | null = null;
  private _connected = false;

  get connected(): boolean {
    return this._connected;
  }

  async connect(): Promise<void> {
    this._connected = true;

    // Send initial screen after a small delay (simulates network)
    setTimeout(() => {
      const initialScreen = this.demoHost.getInitialScreen();
      this.dataHandler?.(initialScreen);
    }, 100);
  }

  disconnect(): void {
    this._connected = false;
    this.disconnectHandler?.('User disconnected');
  }

  send(data: Uint8Array): void {
    if (!this._connected) return;

    // Simulate host processing delay
    setTimeout(() => {
      const response = this.demoHost.handleResponse(data);
      if (response) {
        this.dataHandler?.(response);
      }
    }, 50);
  }

  onData(handler: (data: Uint8Array) => void): void {
    this.dataHandler = handler;
  }

  onDisconnect(handler: (reason: string) => void): void {
    this.disconnectHandler = handler;
  }

  onError(_handler: (error: Error) => void): void {
    // Mock connection doesn't produce errors
  }
}
