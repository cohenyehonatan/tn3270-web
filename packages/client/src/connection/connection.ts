/**
 * Terminal Connection Interface
 *
 * Abstraction over the transport layer. Both WebSocketConnection (real)
 * and MockConnection (demo) implement this interface.
 */

export interface TerminalConnection {
  /** Connect to the host */
  connect(): Promise<void>;
  /** Disconnect from the host */
  disconnect(): void;
  /** Send a 3270 data stream record to the host */
  send(data: Uint8Array): void;
  /** Register a handler for incoming data stream records */
  onData(handler: (data: Uint8Array) => void): void;
  /** Register a handler for disconnection */
  onDisconnect(handler: (reason: string) => void): void;
  /** Register a handler for errors */
  onError(handler: (error: Error) => void): void;
  /** Whether we're currently connected */
  readonly connected: boolean;
}
