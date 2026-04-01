/**
 * Telnet Option Negotiation State Machine
 *
 * Handles the telnet option negotiation sequence required to establish
 * a TN3270 or TN3270E session. The negotiation follows RFC 2355 (TN3270E)
 * and RFC 1576 (basic TN3270).
 *
 * Negotiation flow:
 * 1. Server sends DO/WILL for various options
 * 2. We respond with WILL/DO or WONT/DONT
 * 3. For TN3270E: sub-negotiation for device type and functions
 * 4. For basic TN3270: TERMINAL-TYPE sub-negotiation
 * 5. Once complete, switch to data stream mode
 */

import { Telnet, TN3270E } from '@tn3270/shared';
import { EventEmitter } from 'events';

export interface NegotiationConfig {
  terminalType: string;
  luName?: string;
  /** Whether to attempt TN3270E negotiation */
  preferTN3270E?: boolean;
}

export interface NegotiationResult {
  /** Whether TN3270E was negotiated */
  tn3270e: boolean;
  /** Negotiated terminal type */
  terminalType: string;
  /** Assigned LU name (TN3270E only) */
  luName?: string;
  /** Negotiated TN3270E functions */
  functions?: number[];
}

type NegotiationState =
  | 'initial'
  | 'negotiating'
  | 'tn3270e-device-type'
  | 'tn3270e-functions'
  | 'terminal-type'
  | 'complete';

export class TelnetNegotiator extends EventEmitter {
  private config: NegotiationConfig;
  private state: NegotiationState = 'initial';
  private outBuffer: number[] = [];

  // Track option states
  private optionState = {
    binary: false,
    eor: false,
    terminalType: false,
    tn3270e: false,
  };

  private tn3270eMode = false;
  private terminalTypeExchanged = false;
  private negotiatedTermType = '';
  private negotiatedLU = '';

  // Sub-negotiation accumulator
  private subNegBuffer: number[] = [];
  private inSubNeg = false;

  constructor(config: NegotiationConfig) {
    super();
    this.config = config;
    this.negotiatedTermType = config.terminalType;
  }

  /**
   * Process incoming telnet bytes during negotiation.
   * Returns bytes to send back, and any 3270 data that slipped through.
   */
  processBytes(data: Buffer): { response: Buffer; dataPassthrough: Buffer | null } {
    const responses: number[] = [];
    const passthrough: number[] = [];
    let i = 0;

    while (i < data.length) {
      if (this.inSubNeg) {
        // Accumulate sub-negotiation data
        if (data[i] === Telnet.IAC) {
          if (i + 1 < data.length && data[i + 1] === Telnet.SE) {
            // End of sub-negotiation
            this.inSubNeg = false;
            const subResponse = this.handleSubNegotiation(Buffer.from(this.subNegBuffer));
            if (subResponse.length > 0) {
              responses.push(...subResponse);
            }
            this.subNegBuffer = [];
            i += 2;
            continue;
          } else if (i + 1 < data.length && data[i + 1] === Telnet.IAC) {
            // Escaped IAC in sub-negotiation
            this.subNegBuffer.push(Telnet.IAC);
            i += 2;
            continue;
          }
        }
        this.subNegBuffer.push(data[i]);
        i++;
        continue;
      }

      if (data[i] === Telnet.IAC) {
        if (i + 1 >= data.length) break; // Incomplete, need more data

        const cmd = data[i + 1];
        switch (cmd) {
          case Telnet.DO: {
            if (i + 2 >= data.length) { i = data.length; break; }
            const opt = data[i + 2];
            const resp = this.handleDO(opt);
            responses.push(...resp);
            i += 3;
            break;
          }
          case Telnet.WILL: {
            if (i + 2 >= data.length) { i = data.length; break; }
            const opt = data[i + 2];
            const resp = this.handleWILL(opt);
            responses.push(...resp);
            i += 3;
            break;
          }
          case Telnet.DONT: {
            if (i + 2 >= data.length) { i = data.length; break; }
            const opt = data[i + 2];
            this.handleDONT(opt);
            i += 3;
            break;
          }
          case Telnet.WONT: {
            if (i + 2 >= data.length) { i = data.length; break; }
            const opt = data[i + 2];
            this.handleWONT(opt);
            i += 3;
            break;
          }
          case Telnet.SB: {
            // Start sub-negotiation
            this.inSubNeg = true;
            this.subNegBuffer = [];
            i += 2;
            break;
          }
          case Telnet.IAC: {
            // Escaped IAC in data stream
            passthrough.push(Telnet.IAC);
            i += 2;
            break;
          }
          case Telnet.EOR: {
            // End of record marker — this means we're in data mode
            // The passthrough data up to this point is a complete 3270 record
            i += 2;
            break;
          }
          default:
            i += 2;
            break;
        }
      } else {
        // Non-IAC byte during negotiation — could be data passthrough
        if (this.state === 'complete') {
          passthrough.push(data[i]);
        }
        i++;
      }
    }

    return {
      response: Buffer.from(responses),
      dataPassthrough: passthrough.length > 0 ? Buffer.from(passthrough) : null,
    };
  }

  /** Handle DO command from server */
  private handleDO(option: number): number[] {
    switch (option) {
      case Telnet.OPT_BINARY:
        this.optionState.binary = true;
        return [Telnet.IAC, Telnet.WILL, Telnet.OPT_BINARY];

      case Telnet.OPT_EOR:
        this.optionState.eor = true;
        return [Telnet.IAC, Telnet.WILL, Telnet.OPT_EOR];

      case Telnet.OPT_TERMINAL_TYPE:
        this.optionState.terminalType = true;
        if (!this.tn3270eMode) {
          this.state = 'terminal-type';
        }
        return [Telnet.IAC, Telnet.WILL, Telnet.OPT_TERMINAL_TYPE];

      case Telnet.OPT_TN3270E:
        if (this.config.preferTN3270E !== false) {
          this.optionState.tn3270e = true;
          this.state = 'tn3270e-device-type';
          return [Telnet.IAC, Telnet.WILL, Telnet.OPT_TN3270E];
        }
        return [Telnet.IAC, Telnet.WONT, Telnet.OPT_TN3270E];

      default:
        // Refuse unknown options
        return [Telnet.IAC, Telnet.WONT, option];
    }
  }

  /** Handle WILL command from server */
  private handleWILL(option: number): number[] {
    switch (option) {
      case Telnet.OPT_BINARY:
        this.optionState.binary = true;
        return [Telnet.IAC, Telnet.DO, Telnet.OPT_BINARY];

      case Telnet.OPT_EOR:
        this.optionState.eor = true;
        return [Telnet.IAC, Telnet.DO, Telnet.OPT_EOR];

      case Telnet.OPT_TN3270E:
        if (this.config.preferTN3270E !== false) {
          this.optionState.tn3270e = true;
          return [Telnet.IAC, Telnet.DO, Telnet.OPT_TN3270E];
        }
        return [Telnet.IAC, Telnet.DONT, Telnet.OPT_TN3270E];

      default:
        return [Telnet.IAC, Telnet.DONT, option];
    }
  }

  /** Handle DONT command from server */
  private handleDONT(option: number): void {
    switch (option) {
      case Telnet.OPT_TN3270E:
        this.optionState.tn3270e = false;
        this.tn3270eMode = false;
        // Fall back to basic TN3270
        this.state = 'terminal-type';
        break;
    }
  }

  /** Handle WONT command from server */
  private handleWONT(option: number): void {
    switch (option) {
      case Telnet.OPT_TN3270E:
        this.optionState.tn3270e = false;
        this.tn3270eMode = false;
        this.state = 'terminal-type';
        break;
    }
  }

  /** Handle sub-negotiation data */
  private handleSubNegotiation(data: Buffer): number[] {
    if (data.length === 0) return [];

    const option = data[0];

    switch (option) {
      case Telnet.OPT_TERMINAL_TYPE:
        return this.handleTerminalTypeSub(data);

      case Telnet.OPT_TN3270E:
        return this.handleTN3270ESub(data);

      default:
        return [];
    }
  }

  /** Handle TERMINAL-TYPE sub-negotiation */
  private handleTerminalTypeSub(data: Buffer): number[] {
    // Server sends: TERMINAL-TYPE SEND (RFC 1091: SEND = 0x01)
    if (data.length >= 2 && data[1] === Telnet.TERMINAL_TYPE_SEND) {
      // Respond with: TERMINAL-TYPE IS <terminal-type>
      const termType = Buffer.from(this.config.terminalType, 'ascii');
      const response = [
        Telnet.IAC, Telnet.SB, Telnet.OPT_TERMINAL_TYPE,
        Telnet.TERMINAL_TYPE_IS,
        ...termType,
        Telnet.IAC, Telnet.SE,
      ];

      this.terminalTypeExchanged = true;
      this.checkNegotiationComplete();
      return response;
    }
    return [];
  }

  /** Handle TN3270E sub-negotiation */
  private handleTN3270ESub(data: Buffer): number[] {
    if (data.length < 2) return [];

    const subCommand = data[1];

    switch (subCommand) {
      case TN3270E.SEND: {
        // Server requests something
        if (data.length >= 3 && data[2] === TN3270E.DEVICE_TYPE) {
          // Send DEVICE-TYPE REQUEST <termtype> [CONNECT <luname>]
          const termType = Buffer.from(this.config.terminalType, 'ascii');
          const response = [
            Telnet.IAC, Telnet.SB, Telnet.OPT_TN3270E,
            TN3270E.DEVICE_TYPE, TN3270E.REQUEST,
            ...termType,
          ];

          if (this.config.luName) {
            response.push(TN3270E.CONNECT);
            response.push(...Buffer.from(this.config.luName, 'ascii'));
          }

          response.push(Telnet.IAC, Telnet.SE);
          this.state = 'tn3270e-device-type';
          return response;
        }
        return [];
      }

      case TN3270E.DEVICE_TYPE: {
        // Server responds to our device-type request
        if (data.length >= 3 && data[2] === TN3270E.IS) {
          // Parse: DEVICE-TYPE IS <termtype> CONNECT <luname>
          let pos = 3;
          const termTypeBytes: number[] = [];
          while (pos < data.length && data[pos] !== TN3270E.CONNECT) {
            termTypeBytes.push(data[pos]);
            pos++;
          }
          this.negotiatedTermType = Buffer.from(termTypeBytes).toString('ascii');

          if (pos < data.length && data[pos] === TN3270E.CONNECT) {
            pos++;
            this.negotiatedLU = data.subarray(pos).toString('ascii');
          }

          this.state = 'tn3270e-functions';
          // Server should send FUNCTIONS next
        } else if (data.length >= 3 && data[2] === TN3270E.REJECT) {
          // Device type rejected, fall back
          this.tn3270eMode = false;
          this.state = 'terminal-type';
        }
        return [];
      }

      case TN3270E.FUNCTIONS: {
        // Server sends FUNCTIONS REQUEST <list>
        if (data.length >= 3 && data[2] === TN3270E.REQUEST) {
          // Accept all offered functions by echoing them back
          const functions = Array.from(data.subarray(3));
          const response = [
            Telnet.IAC, Telnet.SB, Telnet.OPT_TN3270E,
            TN3270E.FUNCTIONS, TN3270E.IS,
            ...functions,
            Telnet.IAC, Telnet.SE,
          ];

          this.tn3270eMode = true;
          this.state = 'complete';
          this.emit('negotiation-complete', this.getResult());
          return response;
        } else if (data.length >= 3 && data[2] === TN3270E.IS) {
          // Server confirmed functions
          this.tn3270eMode = true;
          this.state = 'complete';
          this.emit('negotiation-complete', this.getResult());
        }
        return [];
      }

      default:
        return [];
    }
  }

  /** Check if basic TN3270 negotiation is complete */
  private checkNegotiationComplete(): void {
    if (this.tn3270eMode) return;

    if (
      this.optionState.binary &&
      this.optionState.eor &&
      this.terminalTypeExchanged
    ) {
      this.state = 'complete';
      this.emit('negotiation-complete', this.getResult());
    }
  }

  getResult(): NegotiationResult {
    return {
      tn3270e: this.tn3270eMode,
      terminalType: this.negotiatedTermType || this.config.terminalType,
      luName: this.negotiatedLU || undefined,
    };
  }

  get isComplete(): boolean {
    return this.state === 'complete';
  }

  get isTN3270E(): boolean {
    return this.tn3270eMode;
  }
}
