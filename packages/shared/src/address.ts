/**
 * 3270 Buffer Address Encoding/Decoding
 *
 * The 3270 uses three address formats depending on buffer size:
 * - 12-bit: 6-bit encoded in each byte (for buffers ≤ 4096, e.g. 24x80 = 1920)
 * - 14-bit: high byte has top 2 bits = 00, low byte is raw (for larger buffers)
 * - 16-bit: both bytes are raw (TN3270E extended addressing)
 */

/**
 * The 6-bit encoding table used for 12-bit SBA addresses.
 * Maps 6-bit values (0-63) to EBCDIC-like bytes.
 */
const SBA_ENCODE_TABLE: readonly number[] = [
  0x40, 0xc1, 0xc2, 0xc3, 0xc4, 0xc5, 0xc6, 0xc7, // 0-7
  0xc8, 0xc9, 0x4a, 0x4b, 0x4c, 0x4d, 0x4e, 0x4f, // 8-15
  0x50, 0xd1, 0xd2, 0xd3, 0xd4, 0xd5, 0xd6, 0xd7, // 16-23
  0xd8, 0xd9, 0x5a, 0x5b, 0x5c, 0x5d, 0x5e, 0x5f, // 24-31
  0x60, 0x61, 0xe2, 0xe3, 0xe4, 0xe5, 0xe6, 0xe7, // 32-39
  0xe8, 0xe9, 0x6a, 0x6b, 0x6c, 0x6d, 0x6e, 0x6f, // 40-47
  0xf0, 0xf1, 0xf2, 0xf3, 0xf4, 0xf5, 0xf6, 0xf7, // 48-55
  0xf8, 0xf9, 0x7a, 0x7b, 0x7c, 0x7d, 0x7e, 0x7f, // 56-63
];

/** Reverse lookup: EBCDIC byte → 6-bit value */
const SBA_DECODE_TABLE: number[] = new Array(256).fill(-1);
for (let i = 0; i < SBA_ENCODE_TABLE.length; i++) {
  SBA_DECODE_TABLE[SBA_ENCODE_TABLE[i]] = i;
}

/**
 * Decode a 2-byte buffer address from the data stream.
 * Automatically detects 12-bit vs 14-bit encoding.
 */
export function decodeBufferAddress(b1: number, b2: number): number {
  // If the top 2 bits of b1 are both 0, this is 14-bit addressing
  if ((b1 & 0xc0) === 0x00) {
    return ((b1 & 0x3f) << 8) | b2;
  }
  // Otherwise, 12-bit (6-bit encoded)
  const high = SBA_DECODE_TABLE[b1];
  const low = SBA_DECODE_TABLE[b2];
  if (high === -1 || low === -1) {
    return 0; // invalid address, default to 0
  }
  return (high << 6) | low;
}

/**
 * Encode a buffer address to 2 bytes.
 * Uses 12-bit encoding if address fits (≤ 4095), otherwise 14-bit.
 */
export function encodeBufferAddress(address: number, use14Bit = false): [number, number] {
  if (use14Bit || address > 4095) {
    return [(address >> 8) & 0x3f, address & 0xff];
  }
  // 12-bit encoding
  const high = (address >> 6) & 0x3f;
  const low = address & 0x3f;
  return [SBA_ENCODE_TABLE[high], SBA_ENCODE_TABLE[low]];
}

/**
 * Convert a buffer address to row/col coordinates.
 */
export function addressToRowCol(address: number, cols: number): { row: number; col: number } {
  return {
    row: Math.floor(address / cols),
    col: address % cols,
  };
}

/**
 * Convert row/col coordinates to a buffer address.
 */
export function rowColToAddress(row: number, col: number, cols: number): number {
  return row * cols + col;
}
