import { describe, it, expect } from 'vitest';
import { TelnetNegotiator } from '../../src/telnet/negotiator.js';
import { RecordExtractor } from '../../src/transport/telnet-socket.js';
import { Telnet, TN3270E } from '@tn3270/shared';

describe('TelnetNegotiator', () => {
  it('responds WILL to DO BINARY', () => {
    const neg = new TelnetNegotiator({ terminalType: 'IBM-3279-2-E' });
    const { response } = neg.processBytes(
      Buffer.from([Telnet.IAC, Telnet.DO, Telnet.OPT_BINARY]),
    );
    expect(response).toEqual(
      Buffer.from([Telnet.IAC, Telnet.WILL, Telnet.OPT_BINARY]),
    );
  });

  it('responds WILL to DO EOR', () => {
    const neg = new TelnetNegotiator({ terminalType: 'IBM-3279-2-E' });
    const { response } = neg.processBytes(
      Buffer.from([Telnet.IAC, Telnet.DO, Telnet.OPT_EOR]),
    );
    expect(response).toEqual(
      Buffer.from([Telnet.IAC, Telnet.WILL, Telnet.OPT_EOR]),
    );
  });

  it('responds WILL to DO TERMINAL-TYPE', () => {
    const neg = new TelnetNegotiator({ terminalType: 'IBM-3279-2-E' });
    const { response } = neg.processBytes(
      Buffer.from([Telnet.IAC, Telnet.DO, Telnet.OPT_TERMINAL_TYPE]),
    );
    expect(response).toEqual(
      Buffer.from([Telnet.IAC, Telnet.WILL, Telnet.OPT_TERMINAL_TYPE]),
    );
  });

  it('responds WONT to unknown DO options', () => {
    const neg = new TelnetNegotiator({ terminalType: 'IBM-3279-2-E' });
    const { response } = neg.processBytes(
      Buffer.from([Telnet.IAC, Telnet.DO, 0x99]),
    );
    expect(response).toEqual(
      Buffer.from([Telnet.IAC, Telnet.WONT, 0x99]),
    );
  });

  it('handles TERMINAL-TYPE sub-negotiation', () => {
    const neg = new TelnetNegotiator({ terminalType: 'IBM-3279-2-E' });

    // First accept the option
    neg.processBytes(Buffer.from([Telnet.IAC, Telnet.DO, Telnet.OPT_TERMINAL_TYPE]));

    // Server sends TERMINAL-TYPE SEND
    const { response } = neg.processBytes(Buffer.from([
      Telnet.IAC, Telnet.SB, Telnet.OPT_TERMINAL_TYPE,
      TN3270E.SEND,
      Telnet.IAC, Telnet.SE,
    ]));

    // Should respond with TERMINAL-TYPE IS IBM-3279-2-E
    const expected = Buffer.from([
      Telnet.IAC, Telnet.SB, Telnet.OPT_TERMINAL_TYPE,
      0x00, // IS
      ...Buffer.from('IBM-3279-2-E', 'ascii'),
      Telnet.IAC, Telnet.SE,
    ]);
    expect(response).toEqual(expected);
  });

  it('processes multiple commands in one buffer', () => {
    const neg = new TelnetNegotiator({ terminalType: 'IBM-3279-2-E' });
    const { response } = neg.processBytes(Buffer.from([
      Telnet.IAC, Telnet.DO, Telnet.OPT_BINARY,
      Telnet.IAC, Telnet.DO, Telnet.OPT_EOR,
      Telnet.IAC, Telnet.DO, Telnet.OPT_TERMINAL_TYPE,
    ]));

    // Should contain three WILL responses
    expect(response.length).toBe(9); // 3 bytes × 3 responses
    expect(response[1]).toBe(Telnet.WILL);
    expect(response[4]).toBe(Telnet.WILL);
    expect(response[7]).toBe(Telnet.WILL);
  });

  it('completes negotiation after BINARY + EOR + TERMINAL-TYPE', () => {
    const neg = new TelnetNegotiator({ terminalType: 'IBM-3279-2-E' });

    let completed = false;
    let negotiationResult: { terminalType: string; tn3270e: boolean } | null = null;

    neg.on('negotiation-complete', (result) => {
      completed = true;
      negotiationResult = result;
    });

    // Accept options
    neg.processBytes(Buffer.from([
      Telnet.IAC, Telnet.DO, Telnet.OPT_BINARY,
      Telnet.IAC, Telnet.DO, Telnet.OPT_EOR,
      Telnet.IAC, Telnet.DO, Telnet.OPT_TERMINAL_TYPE,
    ]));

    // Terminal type sub-negotiation
    neg.processBytes(Buffer.from([
      Telnet.IAC, Telnet.SB, Telnet.OPT_TERMINAL_TYPE,
      TN3270E.SEND,
      Telnet.IAC, Telnet.SE,
    ]));

    expect(completed).toBe(true);
    expect(negotiationResult!.terminalType).toBe('IBM-3279-2-E');
    expect(negotiationResult!.tn3270e).toBe(false);
  });
});

describe('RecordExtractor', () => {
  it('extracts a single record delimited by IAC EOR', () => {
    const ext = new RecordExtractor();
    const records = ext.feed(Buffer.from([
      0xf5, 0x42, 0x11, 0x40, 0x40, // EW + WCC + SBA
      Telnet.IAC, Telnet.EOR,
    ]));

    expect(records.length).toBe(1);
    expect(records[0]).toEqual(new Uint8Array([0xf5, 0x42, 0x11, 0x40, 0x40]));
  });

  it('extracts multiple records from one buffer', () => {
    const ext = new RecordExtractor();
    const records = ext.feed(Buffer.from([
      0xf5, 0x42, Telnet.IAC, Telnet.EOR,
      0xf1, 0x42, Telnet.IAC, Telnet.EOR,
    ]));

    expect(records.length).toBe(2);
    expect(records[0]).toEqual(new Uint8Array([0xf5, 0x42]));
    expect(records[1]).toEqual(new Uint8Array([0xf1, 0x42]));
  });

  it('accumulates partial records across feeds', () => {
    const ext = new RecordExtractor();

    const r1 = ext.feed(Buffer.from([0xf5, 0x42]));
    expect(r1.length).toBe(0); // No complete record yet

    const r2 = ext.feed(Buffer.from([0x11, 0x40, Telnet.IAC, Telnet.EOR]));
    expect(r2.length).toBe(1);
    expect(r2[0]).toEqual(new Uint8Array([0xf5, 0x42, 0x11, 0x40]));
  });

  it('unescapes doubled IAC bytes', () => {
    const ext = new RecordExtractor();
    const records = ext.feed(Buffer.from([
      0xf5, Telnet.IAC, Telnet.IAC, 0x42, // 0xFF in data is escaped as FF FF
      Telnet.IAC, Telnet.EOR,
    ]));

    expect(records.length).toBe(1);
    expect(records[0]).toEqual(new Uint8Array([0xf5, 0xff, 0x42]));
  });

  it('handles empty records', () => {
    const ext = new RecordExtractor();
    const records = ext.feed(Buffer.from([Telnet.IAC, Telnet.EOR]));
    expect(records.length).toBe(0); // Empty record is discarded
  });
});
