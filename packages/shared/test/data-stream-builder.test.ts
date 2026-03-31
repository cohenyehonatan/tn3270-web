import { describe, it, expect } from 'vitest';
import { DataStreamBuilder } from '../src/data-stream-builder.js';
import { Command, Order, ExtendedAttributeType, Color3270, Highlight3270 } from '../src/constants.js';

describe('DataStreamBuilder', () => {
  it('builds an Erase/Write with WCC', () => {
    const stream = new DataStreamBuilder()
      .eraseWrite()
      .wcc({ keyboardRestore: true, resetMDT: true })
      .build();

    expect(stream[0]).toBe(Command.ERASE_WRITE);
    // WCC with keyboard restore (0x02) + reset MDT (0x04) + 0x40 base = 0x46
    expect(stream[1]).toBe(0x46);
  });

  it('builds SBA + text', () => {
    const stream = new DataStreamBuilder()
      .eraseWrite()
      .wcc({})
      .sba(0, 0)
      .text('A')
      .build();

    expect(stream[0]).toBe(Command.ERASE_WRITE);
    expect(stream[2]).toBe(Order.SBA);
    // Address 0 encoded as 0x40, 0x40
    expect(stream[3]).toBe(0x40);
    expect(stream[4]).toBe(0x40);
    // 'A' in EBCDIC = 0xC1
    expect(stream[5]).toBe(0xc1);
  });

  it('builds SF with protected field', () => {
    const stream = new DataStreamBuilder()
      .eraseWrite()
      .wcc({})
      .sf({ protected: true })
      .build();

    expect(stream[2]).toBe(Order.SF);
    // Protected bit = 0x20
    expect(stream[3] & 0x20).toBe(0x20);
  });

  it('builds SFE with color', () => {
    const stream = new DataStreamBuilder()
      .eraseWrite()
      .wcc({})
      .sfe({ protected: true, color: Color3270.RED })
      .build();

    expect(stream[2]).toBe(Order.SFE);
    // 2 pairs: field attribute + color
    expect(stream[3]).toBe(2);
    // First pair: field attribute type
    expect(stream[4]).toBe(ExtendedAttributeType.FIELD_ATTRIBUTE);
    // Second pair: color type + RED value
    expect(stream[6]).toBe(ExtendedAttributeType.COLOR);
    expect(stream[7]).toBe(Color3270.RED);
  });

  it('builds RA order', () => {
    const stream = new DataStreamBuilder()
      .eraseWrite()
      .wcc({})
      .sba(0, 0)
      .repeatToAddress(0, 80, 0x40) // repeat space to col 80 (address 80)
      .build();

    // Find RA order
    expect(stream[5]).toBe(Order.RA);
    // Target address for row 0, col 80 = address 80
    // Character to repeat
    expect(stream[8]).toBe(0x40); // EBCDIC space
  });

  it('builds SA color order', () => {
    const stream = new DataStreamBuilder()
      .eraseWrite()
      .wcc({})
      .saColor(Color3270.YELLOW)
      .build();

    expect(stream[2]).toBe(Order.SA);
    expect(stream[3]).toBe(ExtendedAttributeType.COLOR);
    expect(stream[4]).toBe(Color3270.YELLOW);
  });

  it('builds IC at specific position', () => {
    const stream = new DataStreamBuilder()
      .eraseWrite()
      .wcc({})
      .insertCursor(5, 10)
      .build();

    // insertCursor emits SBA + IC
    expect(stream[2]).toBe(Order.SBA);
    expect(stream[5]).toBe(Order.IC);
  });
});
