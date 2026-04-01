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

  private log(step: string, details?: string): void {
    const suffix = details ? ` ${details}` : '';
    console.log(`[session:${this.id}] ${step}${suffix}`);
  }

  private hexPreview(buf: Buffer, maxBytes = 24): string {
    const slice = buf.subarray(0, Math.min(buf.length, maxBytes));
    const hex = Array.from(slice, (b) => b.toString(16).padStart(2, '0')).join(' ');
    const more = buf.length > maxBytes ? ' ...' : '';
    return `${hex}${more}`;
  }

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
    this.log('1/8 configure-session', `host=${config.host} port=${config.port} tls=${config.tls} term=${config.terminalType}${config.luName ? ` lu=${config.luName}` : ''}`);

    // Configure negotiator
    this.negotiator = new TelnetNegotiator({
      terminalType: config.terminalType,
      luName: config.luName,
      preferTN3270E: true,
    });

    this.negotiator.on('negotiation-complete', (result: NegotiationResult) => {
      this.negotiationComplete = true;
      this.log('6/8 negotiation-complete', `mode=${result.tn3270e ? 'TN3270E' : 'TN3270'} term=${result.terminalType}${result.luName ? ` lu=${result.luName}` : ''}`);
      this.sendControlMessage({
        type: 'session-ready',
        terminalType: result.terminalType,
        luName: result.luName,
        tn3270e: result.tn3270e,
      });
      this.log('7/8 session-ready-sent');

      // Process any data that arrived during late negotiation
      if (this.negotiationBuffer.length > 0) {
        this.log('7/8 draining-negotiation-buffer', `chunks=${this.negotiationBuffer.length}`);
      }
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
        this.log('8/8 client->host record', `bytes=${buf.length}`);
        this.telnetSocket.sendRecord(new Uint8Array(buf));
      } else {
        // Text message: control message (ignored after connect)
        this.log('client-control-message-ignored');
      }
    });

    this.ws.on('close', () => {
      this.log('websocket-close');
      this.telnetSocket.disconnect();
    });

    this.ws.on('error', () => {
      this.log('websocket-error');
      this.telnetSocket.disconnect();
    });

    this.telnetSocket.on('connect', () => {
      this.log('2/8 host-socket-connected');
    });

    // Set up mainframe → WebSocket relay
    this.telnetSocket.on('data', (data: Buffer) => {
      if (!this.negotiationComplete) {
        this.log('3/8 host->proxy bytes', `phase=negotiation bytes=${data.length} preview=${this.hexPreview(data)}`);
        // During negotiation: feed to negotiator
        const { response, dataPassthrough } = this.negotiator.processBytes(data);
        if (response.length > 0) {
          this.log('4/8 proxy->host telnet-response', `bytes=${response.length} preview=${this.hexPreview(response)}`);
          this.telnetSocket.sendRaw(response);
        }
        if (dataPassthrough) {
          this.log('5/8 passthrough-buffered', `bytes=${dataPassthrough.length}`);
          this.negotiationBuffer.push(dataPassthrough);
        }

        // Check if negotiation completed during this processing
        // (the negotiator emits 'negotiation-complete' synchronously)
        if (this.negotiationComplete) {
          // If we had passthrough data, it gets processed above
        }
      } else {
        this.log('8/8 host->proxy bytes', `phase=data bytes=${data.length}`);
        this.handlePostNegotiationData(data);
      }
    });

    this.telnetSocket.on('error', (err: Error) => {
      this.log('host-socket-error', err.message);
      this.sendControlMessage({
        type: 'error',
        message: `Connection error: ${err.message}`,
      });
    });

    this.telnetSocket.on('close', () => {
      this.log('host-socket-close');
      this.sendControlMessage({
        type: 'disconnected',
        reason: 'Host closed connection',
      });
      this.cleanup();
    });

    // Connect to mainframe
    try {
      this.log('1/8 connect-host-begin');
      await this.telnetSocket.connect({
        host: config.host,
        port: config.port,
        useTLS: config.tls,
        rejectUnauthorized: false, // Allow self-signed for mainframes
      });
      this.log('2/8 connect-host-established');
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.log('connect-host-failed', message);
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
    if (records.length > 0) {
      this.log('8/8 records-extracted', `count=${records.length} firstBytes=${records[0].length}`);
    }

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
    this.log('cleanup');
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
