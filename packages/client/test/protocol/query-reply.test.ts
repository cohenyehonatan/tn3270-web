import { describe, it, expect } from 'vitest';
import { buildQueryReply, isReadPartitionQuery } from '../../src/protocol/query-reply.js';
import { DataStreamParser } from '../../src/protocol/stream-parser.js';
import { ScreenBuffer } from '../../src/buffer/screen-buffer.js';

describe('Query Reply (WSF Read Partition)', () => {
  // The exact bytes TSO full-screen logon sends after a LOGON command:
  // F3 (Write Structured Field) 00 05 (len) 01 (Read Partition) FF (PID) 02 (Query)
  const WSF_READ_PARTITION_QUERY = new Uint8Array([0xf3, 0x00, 0x05, 0x01, 0xff, 0x02]);

  it('detects a Read Partition (Query) structured field', () => {
    expect(isReadPartitionQuery(WSF_READ_PARTITION_QUERY.subarray(1))).toBe(true);
  });

  it('ignores structured fields that are not Read Partition Query', () => {
    // Erase/Reset partition (0x03) — not a query
    expect(isReadPartitionQuery(new Uint8Array([0x00, 0x04, 0x03, 0x00])).valueOf()).toBe(false);
    expect(isReadPartitionQuery(new Uint8Array([])).valueOf()).toBe(false);
  });

  it('builds a Query Reply led by the SF AID (0x88)', () => {
    const qr = buildQueryReply(24, 80);
    expect(qr[0]).toBe(0x88);
    // First structured field is the Summary: len-hi len-lo 81 80 ...
    expect(qr[1]).toBe(0x00);
    expect(qr[3]).toBe(0x81); // Query Reply SFID
    expect(qr[4]).toBe(0x80); // QCODE = Summary
  });

  it('reports a 24x80 usable area and implicit partition', () => {
    const qr = Array.from(buildQueryReply(24, 80));
    // find the Usable Area reply (0x81 0x81) and check width=0x50, height=0x18
    const ua = qr.findIndex((b, i) => b === 0x81 && qr[i + 1] === 0x81);
    expect(ua).toBeGreaterThan(-1);
    expect(qr[ua + 4]).toBe(0x00); // width hi
    expect(qr[ua + 5]).toBe(0x50); // width lo = 80
    expect(qr[ua + 6]).toBe(0x00); // height hi
    expect(qr[ua + 7]).toBe(0x18); // height lo = 24
    // implicit partition present (0x81 0xa6)
    expect(qr.some((b, i) => b === 0x81 && qr[i + 1] === 0xa6)).toBe(true);
  });

  it('advertises the full capability set KICKS BMS needs (not just the minimum)', () => {
    const qr = Array.from(buildQueryReply(24, 80));
    const hasQR = (qcode: number) =>
      qr.some((b, i) => b === 0x81 && qr[i + 1] === qcode);
    // the four that logon needed...
    for (const q of [0x80, 0x81, 0x88, 0xa6]) expect(hasQR(q)).toBe(true);
    // ...plus the ones whose absence made SEND MAP abend APCT
    for (const q of [0x84, 0x85, 0x86, 0x87]) expect(hasQR(q)).toBe(true); // AlphaPart, CharSets, Color, Highlighting
  });

  it('parser answers a Read Partition Query with a response record', () => {
    const parser = new DataStreamParser();
    const buffer = new ScreenBuffer({ rows: 24, cols: 80 });
    const result = parser.parse(WSF_READ_PARTITION_QUERY, buffer);
    expect(result.type).toBe('response');
    if (result.type === 'response') {
      expect(result.data[0]).toBe(0x88);
    }
  });
});
