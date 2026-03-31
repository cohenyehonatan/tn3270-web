/**
 * TN3270 Session
 *
 * Manages a single terminal session: bridges a WebSocket client
 * to a mainframe TN3270 connection via the telnet socket.
 *
 * Lifecycle:
 * 1. Client connects via WebSocket, sends 'connect' message with host/port/etc.
 * 2. Session opens TCP to mainframe, runs telnet negotiation.
 * 3. Once negotiated, relays binary data bidirectionally.
 * 4. Either side can disconnect.
 */

import { WebSocket } from 'ws';
import { TelnetSocket, RecordExtractor } from '../transport/telnet-socket.js';
import { TelnetNegotiator, type NegotiationConfig, type NegotiationResult } from '../telnet/negotiator.js';

export interface SessionConfig {
  host: string;
  port: number;
  tls: boolean;
  terminalType: string;
  luName?: string;
}

export class Session {
  readonly id: string;
  private ws: WebSocket;
  private telnetSocket: TelnetSocket;
  private negotiator: TelnetNegotiator;
  private recordExtractor: RecordExtractor;
  private negotiationComplete = false;
  private negotiationBuffer: Buffer[] = [];

  constructor(id: string, ws: WebSocket) {
    this.id = id;
    this.ws = ws;
    this.telnetSocket = new TelnetSocket();
    this.negotiator = new TelnetNegotiator({ terminalType: 'IBM-3279-2-E' });
    this.recordExtractor = new RecordExtractor();
  }

  /**
   * Start the session: connect to mainframe and begin negotiation.
   */
  async connect(config: SessionConfig): Promise<void> {
    // Configure negotiator
    this.negotiator = new TelnetNegotiator({
      terminalType: config.terminalType,
      luName: config.luName,
      preferTN3270E: true,
    });

    this.negotiator.on('negotiation-complete', (result: NegotiationResult) => {
      this.negotiationComplete = true;
      this.sendControlMessage({
        type: 'session-ready',
        terminalType: result.terminalType,
        luName: result.luName,
        tn3270e: result.tn3270e,
      });

      // Process any data that arrived during late negotiation
      for (const buf of this.negotiationBuffer) {
        this.handlePostNegotiationData(buf);
      }
      this.negotiationBuffer = [];
    });

    // Set up WebSocket → mainframe relay
    this.ws.on('message', (data: Buffer | string, isBinary: boolean) => {
      if (isBinary || Buffer.isBuffer(data)) {
        // Binary message: 3270 data stream from client
        const buf = Buffer.isBuffer(data) ? data : Buffer.from(data);
        this.telnetSocket.sendRecord(new Uint8Array(buf));
      } else {
        // Text message: control message (ignored after connect)
      }
    });

    this.ws.on('close', () => {
      this.telnetSocket.disconnect();
    });

    this.ws.on('error', () => {
      this.telnetSocket.disconnect();
    });

    // Set up mainframe → WebSocket relay
    this.telnetSocket.on('data', (data: Buffer) => {
      if (!this.negotiationComplete) {
        // During negotiation: feed to negotiator
        const { response, dataPassthrough } = this.negotiator.processBytes(data);
        if (response.length > 0) {
          this.telnetSocket.sendRaw(response);
        }
        if (dataPassthrough) {
          this.negotiationBuffer.push(dataPassthrough);
        }

        // Check if negotiation completed during this processing
        // (the negotiator emits 'negotiation-complete' synchronously)
        if (this.negotiationComplete) {
          // If we had passthrough data, it gets processed above
        }
      } else {
        this.handlePostNegotiationData(data);
      }
    });

    this.telnetSocket.on('error', (err: Error) => {
      this.sendControlMessage({
        type: 'error',
        message: `Connection error: ${err.message}`,
      });
    });

    this.telnetSocket.on('close', () => {
      this.sendControlMessage({
        type: 'disconnected',
        reason: 'Host closed connection',
      });
      this.cleanup();
    });

    // Connect to mainframe
    try {
      await this.telnetSocket.connect({
        host: config.host,
        port: config.port,
        useTLS: config.tls,
        rejectUnauthorized: false, // Allow self-signed for mainframes
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.sendControlMessage({
        type: 'error',
        message: `Connection failed: ${message}`,
      });
      throw err;
    }
  }

  /**
   * Handle data after telnet negotiation is complete.
   * Extract EOR-delimited records and forward to WebSocket.
   */
  private handlePostNegotiationData(data: Buffer): void {
    // Feed raw data directly to the record extractor.
    // RecordExtractor handles IAC EOR delimiting and IAC byte-stuffing.
    // Note: do NOT filter through negotiator.processBytes() here — it
    // strips IAC EOR (the record delimiter) and un-escapes IAC IAC,
    // which makes the data unframed for the RecordExtractor.
    const records = this.recordExtractor.feed(data);

    for (const record of records) {
      // Send each complete 3270 record as a binary WebSocket frame
      if (this.ws.readyState === WebSocket.OPEN) {
        this.ws.send(record);
      }
    }
  }

  /** Send a JSON control message to the WebSocket client */
  private sendControlMessage(msg: object): void {
    if (this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(msg));
    }
  }

  /** Clean up resources */
  cleanup(): void {
    this.telnetSocket.disconnect();
    if (this.ws.readyState === WebSocket.OPEN) {
      this.ws.close();
    }
  }

  /** Disconnect the session */
  disconnect(): void {
    this.sendControlMessage({
      type: 'disconnected',
      reason: 'Client disconnected',
    });
    this.cleanup();
  }
}
