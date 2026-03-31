/**
 * Fluent builder for constructing 3270 data streams.
 * Used by demo mode and tests to create valid data stream byte sequences.
 */

import { Command, Order, ExtendedAttributeType, Color3270, Highlight3270 } from './constants.js';
import { encodeBufferAddress, rowColToAddress } from './address.js';
import { encodeFieldAttribute } from './field-attribute.js';
import { stringToEbcdic } from './ebcdic.js';
import type { CellAttributes, DisplayMode } from './types.js';

export interface SFOptions {
  protected?: boolean;
  numeric?: boolean;
  display?: DisplayMode;
  mdt?: boolean;
}

export interface SFEOptions extends SFOptions {
  color?: number;
  highlight?: number;
  outlining?: number;
}

export interface WCCOptions {
  resetMDT?: boolean;
  alarm?: boolean;
  keyboardRestore?: boolean;
}

export class DataStreamBuilder {
  private bytes: number[] = [];
  private cols = 80;

  /** Set the screen width for row/col address encoding */
  setColumns(cols: number): this {
    this.cols = cols;
    return this;
  }

  /** Write command (0xF1) */
  write(): this {
    this.bytes.push(Command.WRITE);
    return this;
  }

  /** Erase/Write command (0xF5) */
  eraseWrite(): this {
    this.bytes.push(Command.ERASE_WRITE);
    return this;
  }

  /** Erase/Write Alternate command (0x7E) */
  eraseWriteAlternate(): this {
    this.bytes.push(Command.ERASE_WRITE_ALTERNATE);
    return this;
  }

  /** Write Control Character */
  wcc(options: WCCOptions = {}): this {
    let wcc = 0;
    if (options.keyboardRestore) wcc |= 0x02;
    if (options.resetMDT) wcc |= 0x04;  // Bit 5 in IBM numbering
    if (options.alarm) wcc |= 0x08;      // Bit 4 in IBM numbering
    // Encode as 6-bit (same encoding as buffer addresses for the WCC byte)
    this.bytes.push(wcc | 0x40); // Set bit 1 of high nibble to make it a valid SBA-encoded byte
    return this;
  }

  /** Set Buffer Address order using row/col */
  sba(row: number, col: number): this {
    const addr = rowColToAddress(row, col, this.cols);
    return this.sbaAddress(addr);
  }

  /** Set Buffer Address order using raw address */
  sbaAddress(address: number): this {
    this.bytes.push(Order.SBA);
    const [b1, b2] = encodeBufferAddress(address);
    this.bytes.push(b1, b2);
    return this;
  }

  /** Start Field order */
  sf(options: SFOptions = {}): this {
    this.bytes.push(Order.SF);
    this.bytes.push(encodeFieldAttribute(options));
    return this;
  }

  /** Start Field Extended order */
  sfe(options: SFEOptions = {}): this {
    this.bytes.push(Order.SFE);

    // Count attribute pairs
    const pairs: [number, number][] = [];

    // Always include the basic field attribute
    pairs.push([ExtendedAttributeType.FIELD_ATTRIBUTE, encodeFieldAttribute(options)]);

    if (options.color !== undefined && options.color !== 0x00) {
      pairs.push([ExtendedAttributeType.COLOR, options.color]);
    }
    if (options.highlight !== undefined && options.highlight !== 0x00) {
      pairs.push([ExtendedAttributeType.HIGHLIGHT, options.highlight]);
    }
    if (options.outlining !== undefined && options.outlining !== 0x00) {
      pairs.push([ExtendedAttributeType.FIELD_OUTLINING, options.outlining]);
    }

    this.bytes.push(pairs.length);
    for (const [type, value] of pairs) {
      this.bytes.push(type, value);
    }
    return this;
  }

  /** Set Attribute order (no field boundary) */
  sa(type: number, value: number): this {
    this.bytes.push(Order.SA);
    this.bytes.push(type, value);
    return this;
  }

  /** Set foreground color via SA */
  saColor(color: number): this {
    return this.sa(ExtendedAttributeType.COLOR, color);
  }

  /** Set highlighting via SA */
  saHighlight(highlight: number): this {
    return this.sa(ExtendedAttributeType.HIGHLIGHT, highlight);
  }

  /** Insert Cursor order at row/col */
  insertCursor(row: number, col: number): this {
    const addr = rowColToAddress(row, col, this.cols);
    return this.insertCursorAddress(addr);
  }

  /** Insert Cursor order at raw address */
  insertCursorAddress(address: number): this {
    this.bytes.push(Order.SBA);
    const [b1, b2] = encodeBufferAddress(address);
    this.bytes.push(b1, b2);
    this.bytes.push(Order.IC);
    return this;
  }

  /** Repeat to Address order: fill from current pos to target with char */
  repeatToAddress(row: number, col: number, ebcdicChar: number): this {
    const addr = rowColToAddress(row, col, this.cols);
    this.bytes.push(Order.RA);
    const [b1, b2] = encodeBufferAddress(addr);
    this.bytes.push(b1, b2);
    this.bytes.push(ebcdicChar);
    return this;
  }

  /** Erase Unprotected to Address */
  eua(row: number, col: number): this {
    const addr = rowColToAddress(row, col, this.cols);
    this.bytes.push(Order.EUA);
    const [b1, b2] = encodeBufferAddress(addr);
    this.bytes.push(b1, b2);
    return this;
  }

  /** Program Tab order */
  pt(): this {
    this.bytes.push(Order.PT);
    return this;
  }

  /** Write text (ASCII string converted to EBCDIC) */
  text(str: string): this {
    const ebcdic = stringToEbcdic(str);
    for (let i = 0; i < ebcdic.length; i++) {
      this.bytes.push(ebcdic[i]);
    }
    return this;
  }

  /** Write raw EBCDIC bytes */
  rawBytes(...bytes: number[]): this {
    this.bytes.push(...bytes);
    return this;
  }

  /** Build the final data stream as a Uint8Array */
  build(): Uint8Array {
    return new Uint8Array(this.bytes);
  }

  /** Get the current byte count */
  get length(): number {
    return this.bytes.length;
  }
}
