/**
 * Telnet Socket Wrapper
 *
 * Wraps a raw TCP/TLS socket with telnet-aware framing:
 * - IAC byte escaping (0xFF → 0xFF 0xFF in data)
 * - EOR record delimiting (IAC EOR marks end of 3270 record)
 * - Accumulates partial reads into complete records
 * - Separates telnet negotiation bytes from data stream bytes
 */

import * as net from 'net';
import * as tls from 'tls';
import { Telnet } from '@tn3270/shared';
import { EventEmitter } from 'events';

export interface TelnetSocketOptions {
  host: string;
  port: number;
  useTLS?: boolean;
  /** Accept self-signed certificates (for development/testing) */
  rejectUnauthorized?: boolean;
}

export class TelnetSocket extends EventEmitter {
  private socket: net.Socket | tls.TLSSocket | null = null;
  private receiveBuffer = Buffer.alloc(0);
  private _connected = false;

  get connected(): boolean {
    return this._connected;
  }

  /**
   * Connect to the mainframe host.
   */
  async connect(options: TelnetSocketOptions): Promise<void> {
    return new Promise((resolve, reject) => {
      const onConnect = () => {
        this._connected = true;
        this.emit('connect');
        resolve();
      };

      if (options.useTLS) {
        this.socket = tls.connect({
          host: options.host,
          port: options.port,
          rejectUnauthorized: options.rejectUnauthorized ?? true,
        }, onConnect);
      } else {
        this.socket = net.connect({
          host: options.host,
          port: options.port,
        }, onConnect);
      }

      this.socket.on('data', (data: Buffer) => {
        this.onRawData(data);
      });

      this.socket.on('error', (err: Error) => {
        this.emit('error', err);
        if (!this._connected) reject(err);
      });

      this.socket.on('close', () => {
        this._connected = false;
        this.emit('close');
      });

      this.socket.on('end', () => {
        this._connected = false;
        this.emit('close');
      });
    });
  }

  /**
   * Process raw bytes from the TCP socket.
   * Separates telnet negotiation commands from data stream records.
   * Emits 'negotiation' for IAC sequences and 'record' for complete
   * EOR-delimited data records.
   */
  private onRawData(data: Buffer): void {
    // Append to receive buffer
    this.receiveBuffer = Buffer.concat([this.receiveBuffer, data]);
    this.processBuffer();
  }

  private processBuffer(): void {
    // We need to emit raw bytes for the negotiator to process.
    // During negotiation, everything goes to the negotiator.
    // After negotiation, we extract EOR-delimited records.
    //
    // Rather than trying to split here, we emit all raw bytes
    // and let the session layer coordinate with the negotiator.
    if (this.receiveBuffer.length > 0) {
      const buf = this.receiveBuffer;
      this.receiveBuffer = Buffer.alloc(0);
      this.emit('data', buf);
    }
  }

  /**
   * Send a raw 3270 data stream record to the host.
   * Escapes any 0xFF bytes and appends IAC EOR.
   */
  sendRecord(record: Uint8Array): void {
    if (!this.socket || !this._connected) return;

    // Escape IAC bytes and append IAC EOR
    const escaped: number[] = [];
    for (let i = 0; i < record.length; i++) {
      escaped.push(record[i]);
      if (record[i] === Telnet.IAC) {
        escaped.push(Telnet.IAC); // double the IAC
      }
    }
    escaped.push(Telnet.IAC, Telnet.EOR);

    this.socket.write(Buffer.from(escaped));
  }

  /**
   * Send raw bytes (for telnet negotiation responses).
   */
  sendRaw(data: Buffer): void {
    if (!this.socket || !this._connected) return;
    this.socket.write(data);
  }

  /**
   * Disconnect from the host.
   */
  disconnect(): void {
    if (this.socket) {
      this._connected = false;
      this.socket.destroy();
      this.socket = null;
    }
  }
}

/**
 * Extract EOR-delimited 3270 data records from a byte stream.
 *
 * This function processes bytes that have already had telnet negotiation
 * commands removed. It accumulates data until IAC EOR is found, then
 * returns complete records.
 *
 * Also un-escapes doubled IAC bytes (0xFF 0xFF → 0xFF).
 */
export class RecordExtractor {
  private buffer: number[] = [];
  private prevWasIAC = false;

  /**
   * Feed bytes into the extractor.
   * Returns any complete records found.
   */
  feed(data: Buffer): Uint8Array[] {
    const records: Uint8Array[] = [];

    for (let i = 0; i < data.length; i++) {
      const byte = data[i];

      if (this.prevWasIAC) {
        this.prevWasIAC = false;

        if (byte === Telnet.EOR) {
          // Complete record
          if (this.buffer.length > 0) {
            records.push(new Uint8Array(this.buffer));
            this.buffer = [];
          }
        } else if (byte === Telnet.IAC) {
          // Escaped IAC — emit single 0xFF
          this.buffer.push(Telnet.IAC);
        } else {
          // Some other IAC command in data mode — shouldn't happen
          // but pass through for robustness
          this.buffer.push(Telnet.IAC);
          this.buffer.push(byte);
        }
      } else if (byte === Telnet.IAC) {
        this.prevWasIAC = true;
      } else {
        this.buffer.push(byte);
      }
    }

    return records;
  }

  /** Reset the extractor state */
  reset(): void {
    this.buffer = [];
    this.prevWasIAC = false;
  }
}
