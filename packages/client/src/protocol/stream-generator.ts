/**
 * 3270 Outbound Data Stream Generator
 *
 * Builds terminal-to-host responses: Read Modified, Read Modified All, Read Buffer.
 */

import { AID, Order, SHORT_READ_AIDS, Command } from '@tn3270/shared';
import { encodeBufferAddress } from '@tn3270/shared';
import { ScreenBuffer } from '../buffer/screen-buffer.js';

/**
 * Build a Read Modified response.
 *
 * Format: [AID] [cursor-address-2bytes] [SBA field-addr data...]...
 * For short-read AIDs (Clear, PA keys): just [AID] [cursor-address]
 */
export function buildReadModifiedResponse(
  buffer: ScreenBuffer,
  aid: number,
): Uint8Array {
  const bytes: number[] = [];

  // AID byte
  bytes.push(aid);

  // Cursor address (always included)
  const [cb1, cb2] = encodeBufferAddress(buffer.cursorAddress);
  bytes.push(cb1, cb2);

  // Short-read AIDs don't include field data
  if (SHORT_READ_AIDS.has(aid)) {
    return new Uint8Array(bytes);
  }

  // For each modified unprotected field, include SBA + data
  const modifiedFields = buffer.getModifiedFields();
  for (const field of modifiedFields) {
    // SBA order + field start address (position after the field attribute)
    const fieldStart = (field.address + 1) % buffer.size;
    bytes.push(Order.SBA);
    const [fb1, fb2] = encodeBufferAddress(fieldStart);
    bytes.push(fb1, fb2);

    // Field data — trim trailing nulls
    let trimmedLength = field.data.length;
    while (trimmedLength > 0 && (field.data[trimmedLength - 1] === 0x00 || field.data[trimmedLength - 1] === 0x40)) {
      trimmedLength--;
    }
    for (let i = 0; i < trimmedLength; i++) {
      bytes.push(field.data[i]);
    }
  }

  return new Uint8Array(bytes);
}

/**
 * Build a Read Buffer response.
 * Returns the entire buffer contents including field attributes.
 *
 * Format: [AID] [cursor-address] [buffer-contents...]
 */
export function buildReadBufferResponse(
  buffer: ScreenBuffer,
  aid: number,
): Uint8Array {
  const bytes: number[] = [];

  bytes.push(aid);
  const [cb1, cb2] = encodeBufferAddress(buffer.cursorAddress);
  bytes.push(cb1, cb2);

  // Dump entire buffer
  for (let i = 0; i < buffer.size; i++) {
    const cell = buffer.getCell(i);
    if (cell.isFieldAttribute) {
      bytes.push(Order.SF);
      bytes.push(cell.fieldAttrByte);
    } else {
      bytes.push(cell.char);
    }
  }

  return new Uint8Array(bytes);
}
