import { describe, it, expect } from 'vitest';
import { buildReadModifiedResponse } from '../../src/protocol/stream-generator.js';
import { ScreenBuffer } from '../../src/buffer/screen-buffer.js';
import { AID, Order } from '@tn3270/shared';

describe('buildReadModifiedResponse — unformatted buffer', () => {
  // EBCDIC for "SGON"
  const SGON = [0xe2, 0xc7, 0xd6, 0xd5];

  it('sends AID + cursor + typed data on an unformatted screen (no fields)', () => {
    // KICKS command/ready screen: unformatted, user typed a transid at the top.
    const buffer = new ScreenBuffer({ rows: 24, cols: 80 });
    SGON.forEach((c, i) => buffer.setChar(i, c));
    buffer.cursorAddress = 4;

    const out = Array.from(buildReadModifiedResponse(buffer, AID.ENTER));
    expect(out[0]).toBe(AID.ENTER);
    // no SBA orders on an unformatted read
    expect(out.includes(Order.SBA)).toBe(false);
    // the transid data must be present (this is the bug fix: it used to be absent)
    expect(out.slice(3)).toEqual(SGON);
  });

  it('still walks modified fields on a formatted screen', () => {
    const buffer = new ScreenBuffer({ rows: 24, cols: 80 });
    // a formatted screen: one unprotected field at addr 0, type into it
    buffer.setFieldAttribute(0, 0x40); // unprotected
    buffer.cursorAddress = 1;
    SGON.forEach((c, i) => buffer.typeChar(c, false));

    const out = Array.from(buildReadModifiedResponse(buffer, AID.ENTER));
    expect(out[0]).toBe(AID.ENTER);
    // formatted read uses SBA + field data
    expect(out.includes(Order.SBA)).toBe(true);
    for (const c of SGON) expect(out.includes(c)).toBe(true);
  });
});
