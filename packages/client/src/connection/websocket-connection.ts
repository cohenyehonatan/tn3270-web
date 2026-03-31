/**
 * WebSocket Connection
 *
 * Implements TerminalConnection for real mainframe connectivity.
 * Connects to the proxy server via WebSocket, sends connect config,
 * then relays binary 3270 data stream records.
 */

import type { TerminalConnection } from './connection.js';

export interface WebSocketConnectionConfig {
  /** Proxy WebSocket URL (e.g. ws://localhost:3271/tn3270) */
  proxyUrl: string;
  /** Mainframe hostname */
  host: string;
  /** Mainframe port (default 23) */
  port: number;
  /** Use TLS to mainframe */
  tls: boolean;
  /** Terminal type to negotiate */
  terminalType: string;
  /** LU name (optional) */
  luName?: string;
}

export class WebSocketConnection implements TerminalConnection {
  private config: WebSocketConnectionConfig;
  private ws: WebSocket | null = null;
  private dataHandler: ((data: Uint8Array) => void) | null = null;
  private disconnectHandler: ((reason: string) => void) | null = null;
  private errorHandler: ((error: Error) => void) | null = null;
  private _connected = false;
  private sessionReady = false;

  constructor(config: WebSocketConnectionConfig) {
    this.config = config;
  }

  get connected(): boolean {
    return this._connected && this.sessionReady;
  }

  async connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.ws = new WebSocket(this.config.proxyUrl);
      this.ws.binaryType = 'arraybuffer';

      this.ws.onopen = () => {
        this._connected = true;

        // Send connection config
        this.ws!.send(JSON.stringify({
          type: 'connect',
          host: this.config.host,
          port: this.config.port,
          tls: this.config.tls,
          terminalType: this.config.terminalType,
          luName: this.config.luName,
        }));
      };

      this.ws.onmessage = (event: MessageEvent) => {
        if (typeof event.data === 'string') {
          // JSON control message
          try {
            const msg = JSON.parse(event.data);
            this.handleControlMessage(msg, resolve, reject);
          } catch {
            // Ignore invalid JSON
          }
        } else if (event.data instanceof ArrayBuffer) {
          // Binary data: 3270 record
          if (this.sessionReady) {
            this.dataHandler?.(new Uint8Array(event.data));
          }
        }
      };

      this.ws.onerror = () => {
        const err = new Error('WebSocket connection error');
        this.errorHandler?.(err);
        if (!this._connected) reject(err);
      };

      this.ws.onclose = () => {
        const wasConnected = this._connected;
        this._connected = false;
        this.sessionReady = false;
        if (wasConnected) {
          this.disconnectHandler?.('Connection closed');
        } else {
          reject(new Error('WebSocket closed before connection established'));
        }
      };
    });
  }

  private handleControlMessage(
    msg: { type: string; message?: string; [key: string]: unknown },
    resolve: () => void,
    reject: (err: Error) => void,
  ): void {
    switch (msg.type) {
      case 'session-ready':
        this.sessionReady = true;
        resolve();
        break;

      case 'error':
        const err = new Error(msg.message ?? 'Unknown error');
        this.errorHandler?.(err);
        if (!this.sessionReady) reject(err);
        break;

      case 'disconnected':
        this._connected = false;
        this.sessionReady = false;
        this.disconnectHandler?.(msg.message ?? 'Disconnected');
        break;
    }
  }

  disconnect(): void {
    this.sessionReady = false;
    this._connected = false;
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }

  send(data: Uint8Array): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN || !this.sessionReady) return;
    this.ws.send(data);
  }

  onData(handler: (data: Uint8Array) => void): void {
    this.dataHandler = handler;
  }

  onDisconnect(handler: (reason: string) => void): void {
    this.disconnectHandler = handler;
  }

  onError(handler: (error: Error) => void): void {
    this.errorHandler = handler;
  }
}
