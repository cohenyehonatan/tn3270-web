/**
 * 3270 Inbound Data Stream Parser
 *
 * Processes host-to-terminal data stream records: commands, WCC, orders, and data bytes.
 * Mutates a ScreenBuffer according to the parsed instructions.
 *
 * Reference: GA23-0059-07, Chapter 4 — 3270 Data Stream Commands and Orders
 */

import {
  Command, CommandSNA, Order, ORDER_CODES,
  ExtendedAttributeType,
} from '@tn3270/shared';
import type { WCC, CellAttributes, ParseResult } from '@tn3270/shared';
import { decodeBufferAddress } from '@tn3270/shared';
import { parseFieldAttribute } from '@tn3270/shared';
import { ScreenBuffer } from '../buffer/screen-buffer.js';

/** Check if a byte is an order code */
function isOrder(byte: number): boolean {
  return ORDER_CODES.has(byte);
}

/** Parse the Write Control Character byte */
function parseWCC(byte: number): WCC {
  // WCC is encoded in a 6-bit format similar to buffer addresses
  // The actual bits we care about:
  //   Bit 0 (0x01): partition characteristic (ignored)
  //   Bit 1 (0x02): keyboard restore
  //   Bit 2 (0x04): reset MDT
  //   Bit 3 (0x08): alarm
  //   Bit 4 (0x10): reserved
  //   Bit 5 (0x20): reset partition (ignored)
  // Note: the WCC byte comes from the host with bits 6-7 set for encoding;
  // we mask them off.
  const raw = byte & 0x3f;
  return {
    keyboardRestore: (raw & 0x02) !== 0,
    resetMDT: (raw & 0x04) !== 0,
    alarm: (raw & 0x08) !== 0,
    resetPartition: (raw & 0x20) !== 0,
  };
}

/** Map SNA command codes to standard command codes */
function normalizeSNACommand(cmd: number): number | null {
  switch (cmd) {
    case CommandSNA.WRITE: return Command.WRITE;
    case CommandSNA.ERASE_WRITE: return Command.ERASE_WRITE;
    case CommandSNA.ERASE_WRITE_ALTERNATE: return Command.ERASE_WRITE_ALTERNATE;
    case CommandSNA.READ_MODIFIED: return Command.READ_MODIFIED;
    case CommandSNA.READ_MODIFIED_ALL: return Command.READ_MODIFIED_ALL;
    case CommandSNA.READ_BUFFER: return Command.READ_BUFFER;
    case CommandSNA.ERASE_ALL_UNPROTECTED: return Command.ERASE_ALL_UNPROTECTED;
    case CommandSNA.WRITE_STRUCTURED_FIELD: return Command.WRITE_STRUCTURED_FIELD;
    default: return null;
  }
}

export class DataStreamParser {
  /**
   * Parse a complete data stream record and apply it to the screen buffer.
   *
   * @param data Raw 3270 data stream bytes (command + WCC + orders/data)
   * @param buffer The screen buffer to mutate
   * @param isSNA If true, interpret command byte as SNA format
   * @returns Parse result indicating what was done
   */
  parse(data: Uint8Array, buffer: ScreenBuffer, isSNA = false): ParseResult {
    if (data.length === 0) {
      return { type: 'error', message: 'Empty data stream' };
    }

    let command = data[0];
    if (isSNA) {
      const normalized = normalizeSNACommand(command);
      if (normalized === null) {
        return { type: 'error', message: `Unknown SNA command: 0x${command.toString(16)}` };
      }
      command = normalized;
    }

    switch (command) {
      case Command.WRITE:
        return this.parseWriteCommand(data, buffer, false);

      case Command.ERASE_WRITE:
        buffer.clear();
        return this.parseWriteCommand(data, buffer, true);

      case Command.ERASE_WRITE_ALTERNATE:
        buffer.clear();
        return this.parseWriteCommand(data, buffer, true);

      case Command.READ_MODIFIED:
      case Command.READ_MODIFIED_ALL:
      case Command.READ_BUFFER:
        return { type: 'read-request', command };

      case Command.ERASE_ALL_UNPROTECTED:
        buffer.clearUnprotected();
        return { type: 'erase-all-unprotected' };

      case Command.WRITE_STRUCTURED_FIELD:
        // WSF is complex and rarely needed for basic emulation
        // For now, skip the structured field data
        return { type: 'write', wcc: { keyboardRestore: true, resetMDT: false, alarm: false, resetPartition: false } };

      default:
        return { type: 'error', message: `Unknown command: 0x${command.toString(16)}` };
    }
  }

  /**
   * Parse a Write or Erase/Write command.
   * Data format: [command] [WCC] [orders and data bytes...]
   */
  private parseWriteCommand(data: Uint8Array, buffer: ScreenBuffer, _erased: boolean): ParseResult {
    if (data.length < 2) {
      return { type: 'error', message: 'Write command too short (missing WCC)' };
    }

    const wcc = parseWCC(data[1]);

    // Apply WCC effects
    if (wcc.resetMDT) {
      buffer.resetAllMDT();
    }

    buffer.resetSA();

    // Process orders and data starting at byte 2
    let pos = 2;
    while (pos < data.length) {
      const byte = data[pos];

      if (isOrder(byte)) {
        pos = this.processOrder(byte, data, pos, buffer);
      } else {
        // Data byte — write character at current buffer address
        buffer.writeChar(byte);
        pos++;
      }
    }

    return { type: 'write', wcc };
  }

  /**
   * Process a single order and return the new position in the data stream.
   */
  private processOrder(order: number, data: Uint8Array, pos: number, buffer: ScreenBuffer): number {
    switch (order) {
      case Order.SBA:
        return this.processSBA(data, pos, buffer);
      case Order.SF:
        return this.processSF(data, pos, buffer);
      case Order.SFE:
        return this.processSFE(data, pos, buffer);
      case Order.SA:
        return this.processSA(data, pos, buffer);
      case Order.MF:
        return this.processMF(data, pos, buffer);
      case Order.IC:
        return this.processIC(pos, buffer);
      case Order.PT:
        return this.processPT(pos, buffer);
      case Order.RA:
        return this.processRA(data, pos, buffer);
      case Order.EUA:
        return this.processEUA(data, pos, buffer);
      case Order.GE:
        return this.processGE(data, pos, buffer);
      default:
        // Unknown order, skip it
        return pos + 1;
    }
  }

  /** SBA: Set Buffer Address — 3 bytes total (order + 2-byte address) */
  private processSBA(data: Uint8Array, pos: number, buffer: ScreenBuffer): number {
    if (pos + 2 >= data.length) return data.length;
    const address = decodeBufferAddress(data[pos + 1], data[pos + 2]);
    buffer.currentAddress = address;
    return pos + 3;
  }

  /** SF: Start Field — 2 bytes total (order + attribute byte) */
  private processSF(data: Uint8Array, pos: number, buffer: ScreenBuffer): number {
    if (pos + 1 >= data.length) return data.length;
    buffer.setFieldAttribute(buffer.currentAddress, data[pos + 1]);
    buffer.advanceAddress();
    return pos + 2;
  }

  /** SFE: Start Field Extended — variable length */
  private processSFE(data: Uint8Array, pos: number, buffer: ScreenBuffer): number {
    if (pos + 1 >= data.length) return data.length;
    const pairCount = data[pos + 1];

    let attrByte = 0;
    const extended: Partial<CellAttributes> = {};

    let offset = pos + 2;
    for (let i = 0; i < pairCount && offset + 1 < data.length; i++) {
      const type = data[offset];
      const value = data[offset + 1];
      offset += 2;

      switch (type) {
        case ExtendedAttributeType.FIELD_ATTRIBUTE:
          attrByte = value;
          break;
        case ExtendedAttributeType.HIGHLIGHT:
          extended.highlight = value;
          break;
        case ExtendedAttributeType.COLOR:
          extended.color = value;
          break;
        case ExtendedAttributeType.CHARSET:
          extended.charset = value;
          break;
        case ExtendedAttributeType.FIELD_OUTLINING:
          extended.outlining = value;
          break;
      }
    }

    buffer.setFieldAttributeExtended(buffer.currentAddress, attrByte, extended);
    buffer.advanceAddress();
    return offset;
  }

  /** SA: Set Attribute — 3 bytes total (order + type + value) */
  private processSA(data: Uint8Array, pos: number, buffer: ScreenBuffer): number {
    if (pos + 2 >= data.length) return data.length;
    const type = data[pos + 1];
    const value = data[pos + 2];

    switch (type) {
      case ExtendedAttributeType.ALL:
        buffer.resetSA();
        break;
      case ExtendedAttributeType.HIGHLIGHT:
        buffer.setSAHighlight(value);
        break;
      case ExtendedAttributeType.COLOR:
        buffer.setSAColor(value);
        break;
      case ExtendedAttributeType.CHARSET:
        buffer.setSACharset(value);
        break;
    }

    return pos + 3;
  }

  /** MF: Modify Field — variable length (like SFE but modifies existing field) */
  private processMF(data: Uint8Array, pos: number, buffer: ScreenBuffer): number {
    if (pos + 1 >= data.length) return data.length;
    const pairCount = data[pos + 1];

    // Find the field attribute at or before current address
    const fieldAddr = buffer.findFieldStart(buffer.currentAddress);
    if (fieldAddr === -1) {
      // No field to modify, skip
      return pos + 2 + pairCount * 2;
    }

    const cell = buffer.getCell(fieldAddr);
    let offset = pos + 2;
    for (let i = 0; i < pairCount && offset + 1 < data.length; i++) {
      const type = data[offset];
      const value = data[offset + 1];
      offset += 2;

      switch (type) {
        case ExtendedAttributeType.FIELD_ATTRIBUTE:
          cell.fieldAttrByte = value;
          const parsed = parseFieldAttribute(value);
          cell.extended.protected = parsed.protected;
          cell.extended.numeric = parsed.numeric;
          cell.extended.display = parsed.display;
          cell.extended.mdt = parsed.mdt;
          break;
        case ExtendedAttributeType.HIGHLIGHT:
          cell.extended.highlight = value;
          break;
        case ExtendedAttributeType.COLOR:
          cell.extended.color = value;
          break;
        case ExtendedAttributeType.CHARSET:
          cell.extended.charset = value;
          break;
        case ExtendedAttributeType.FIELD_OUTLINING:
          cell.extended.outlining = value;
          break;
      }
    }

    return offset;
  }

  /** IC: Insert Cursor — 1 byte (just the order) */
  private processIC(pos: number, buffer: ScreenBuffer): number {
    buffer.cursorAddress = buffer.currentAddress;
    return pos + 1;
  }

  /** PT: Program Tab — 1 byte */
  private processPT(pos: number, buffer: ScreenBuffer): number {
    // Advance to next unprotected field
    const nextField = buffer.findNextUnprotectedField(buffer.currentAddress);
    if (nextField !== -1) {
      buffer.currentAddress = (nextField + 1) % buffer.size;
    }
    return pos + 1;
  }

  /** RA: Repeat to Address — 4 bytes (order + 2-byte address + character) */
  private processRA(data: Uint8Array, pos: number, buffer: ScreenBuffer): number {
    if (pos + 3 >= data.length) return data.length;
    const toAddr = decodeBufferAddress(data[pos + 1], data[pos + 2]);
    const char = data[pos + 3];
    buffer.repeatToAddress(toAddr, char);
    return pos + 4;
  }

  /** EUA: Erase Unprotected to Address — 3 bytes (order + 2-byte address) */
  private processEUA(data: Uint8Array, pos: number, buffer: ScreenBuffer): number {
    if (pos + 2 >= data.length) return data.length;
    const toAddr = decodeBufferAddress(data[pos + 1], data[pos + 2]);
    buffer.eraseUnprotectedToAddress(toAddr);
    return pos + 3;
  }

  /** GE: Graphic Escape — 2 bytes (order + character from alternate charset) */
  private processGE(data: Uint8Array, pos: number, buffer: ScreenBuffer): number {
    if (pos + 1 >= data.length) return data.length;
    // Write the character (we don't support APL charset rendering, just pass through)
    buffer.writeChar(data[pos + 1]);
    return pos + 2;
  }
}
