/**
 * Demo Host — State Machine
 *
 * Simulates a mainframe host for demo/offline mode.
 * Receives AID key presses + modified fields, returns the next screen.
 */

import { AID, Order } from '@tn3270/shared';
import { decodeBufferAddress, ebcdicToString, DataStreamBuilder, Color3270 } from '@tn3270/shared';
import { buildLoginScreen } from './screens/login-screen.js';
import { buildIspfPrimaryMenu } from './screens/ispf-primary.js';
import { buildIspfEditScreen } from './screens/ispf-edit.js';

type DemoScreen = 'login' | 'ispf-primary' | 'ispf-edit' | 'logoff';

interface ParsedResponse {
  aid: number;
  cursorAddress: number;
  fields: Map<number, string>;
}

export class DemoHost {
  private currentScreen: DemoScreen = 'login';
  private userid = '';

  /** Get the initial screen to display */
  getInitialScreen(): Uint8Array {
    return buildLoginScreen();
  }

  /**
   * Handle an inbound response from the terminal (AID + fields).
   * Returns the next screen data stream, or null if no response.
   */
  handleResponse(data: Uint8Array): Uint8Array | null {
    const parsed = this.parseResponse(data);

    switch (this.currentScreen) {
      case 'login':
        return this.handleLogin(parsed);
      case 'ispf-primary':
        return this.handleIspfPrimary(parsed);
      case 'ispf-edit':
        return this.handleIspfEdit(parsed);
      case 'logoff':
        return null;
      default:
        return null;
    }
  }

  /** Parse a terminal response (AID + cursor + SBA/data pairs) */
  private parseResponse(data: Uint8Array): ParsedResponse {
    const aid = data[0];
    const cursorAddress = data.length >= 3
      ? decodeBufferAddress(data[1], data[2])
      : 0;

    const fields = new Map<number, string>();
    let pos = 3;

    while (pos < data.length) {
      if (data[pos] === Order.SBA && pos + 2 < data.length) {
        const fieldAddr = decodeBufferAddress(data[pos + 1], data[pos + 2]);
        pos += 3;

        // Read data bytes until next SBA or end
        const fieldData: number[] = [];
        while (pos < data.length && data[pos] !== Order.SBA) {
          fieldData.push(data[pos]);
          pos++;
        }

        fields.set(fieldAddr, ebcdicToString(new Uint8Array(fieldData)));
      } else {
        pos++;
      }
    }

    return { aid, cursorAddress, fields };
  }

  private handleLogin(parsed: ParsedResponse): Uint8Array {
    if (parsed.aid === AID.PF3) {
      this.currentScreen = 'logoff';
      return this.buildLogoffScreen();
    }

    if (parsed.aid === AID.ENTER) {
      // Extract userid from the field at row 9, col 31 (address 751)
      // The fields map uses the field start address
      this.userid = '';
      for (const [, value] of parsed.fields) {
        if (value.trim().length > 0 && this.userid === '') {
          this.userid = value.trim();
          break;
        }
      }

      if (!this.userid) {
        this.userid = 'DEMO';
      }

      this.currentScreen = 'ispf-primary';
      return buildIspfPrimaryMenu(this.userid);
    }

    // For any other AID, just redisplay
    return buildLoginScreen();
  }

  private handleIspfPrimary(parsed: ParsedResponse): Uint8Array {
    if (parsed.aid === AID.PF3) {
      this.currentScreen = 'login';
      return buildLoginScreen();
    }

    if (parsed.aid === AID.ENTER) {
      // Check the option field value
      let option = '';
      for (const [, value] of parsed.fields) {
        option = value.trim();
        break;
      }

      switch (option) {
        case '2':
          this.currentScreen = 'ispf-edit';
          return buildIspfEditScreen(this.userid);
        case 'X':
        case 'x':
          this.currentScreen = 'login';
          return this.buildLogoffScreen();
        default:
          // Unimplemented option — show message and redisplay
          return this.buildMessageScreen(
            `Option "${option || '(none)'}" is not implemented in demo mode.`,
            'ispf-primary',
          );
      }
    }

    return buildIspfPrimaryMenu(this.userid);
  }

  private handleIspfEdit(parsed: ParsedResponse): Uint8Array {
    if (parsed.aid === AID.PF3) {
      this.currentScreen = 'ispf-primary';
      return buildIspfPrimaryMenu(this.userid);
    }

    // For demo, just redisplay the edit screen
    return buildIspfEditScreen(this.userid);
  }

  private buildLogoffScreen(): Uint8Array {
    const b = new DataStreamBuilder();
    b.eraseWrite()
      .wcc({ keyboardRestore: true, resetMDT: true });

    b.sba(10, 25)
      .sfe({ protected: true, color: Color3270.WHITE })
      .text('Session ended. Thank you.');

    b.sba(12, 20)
      .sfe({ protected: true, color: Color3270.GREEN })
      .text('Press ENTER to start a new session.');

    b.sba(12, 55)
      .sf({ protected: false });
    b.text(' ');
    b.sba(12, 57)
      .sf({ protected: true });

    b.insertCursor(12, 56);

    // Reset state so next Enter goes to login
    this.currentScreen = 'login';

    return b.build();
  }

  private buildMessageScreen(message: string, returnTo: DemoScreen): Uint8Array {
    const b = new DataStreamBuilder();
    b.eraseWrite()
      .wcc({ keyboardRestore: true, resetMDT: true, alarm: true });

    b.sba(10, Math.max(0, Math.floor((80 - message.length) / 2)))
      .sfe({ protected: true, color: Color3270.YELLOW })
      .text(message);

    b.sba(12, 28)
      .sfe({ protected: true, color: Color3270.GREEN })
      .text('Press ENTER to continue.');

    b.sba(12, 53)
      .sf({ protected: false });
    b.text(' ');
    b.sba(12, 55)
      .sf({ protected: true });

    b.insertCursor(12, 54);

    this.currentScreen = returnTo;

    return b.build();
  }
}
