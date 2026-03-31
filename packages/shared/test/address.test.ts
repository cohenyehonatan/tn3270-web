import { describe, it, expect } from 'vitest';
import {
  decodeBufferAddress,
  encodeBufferAddress,
  addressToRowCol,
  rowColToAddress,
} from '../src/address.js';

describe('Buffer Address Encoding', () => {
  describe('12-bit encoding', () => {
    it('encodes address 0', () => {
      const [b1, b2] = encodeBufferAddress(0);
      expect(decodeBufferAddress(b1, b2)).toBe(0);
    });

    it('encodes address 1', () => {
      const [b1, b2] = encodeBufferAddress(1);
      expect(decodeBufferAddress(b1, b2)).toBe(1);
    });

    it('round-trips all addresses for 24x80 screen', () => {
      for (let addr = 0; addr < 1920; addr++) {
        const [b1, b2] = encodeBufferAddress(addr);
        expect(decodeBufferAddress(b1, b2)).toBe(addr);
      }
    });

    it('encodes known address values', () => {
      // Address 0 → 0x40, 0x40 (both encode to 0)
      const [b1, b2] = encodeBufferAddress(0);
      expect(b1).toBe(0x40);
      expect(b2).toBe(0x40);

      // Address 80 (start of row 1) → high=1, low=16 in 6-bit
      const [b1a, b2a] = encodeBufferAddress(80);
      expect(decodeBufferAddress(b1a, b2a)).toBe(80);
    });
  });

  describe('14-bit encoding', () => {
    it('encodes large addresses', () => {
      // 27x132 = 3564 positions, needs 14-bit
      const [b1, b2] = encodeBufferAddress(3000, true);
      expect(decodeBufferAddress(b1, b2)).toBe(3000);
    });

    it('round-trips addresses for 27x132 screen', () => {
      for (let addr = 0; addr < 3564; addr += 100) {
        const [b1, b2] = encodeBufferAddress(addr, true);
        expect(decodeBufferAddress(b1, b2)).toBe(addr);
      }
    });
  });

  describe('addressToRowCol / rowColToAddress', () => {
    it('converts address 0 to row 0, col 0', () => {
      const { row, col } = addressToRowCol(0, 80);
      expect(row).toBe(0);
      expect(col).toBe(0);
    });

    it('converts address 80 to row 1, col 0', () => {
      const { row, col } = addressToRowCol(80, 80);
      expect(row).toBe(1);
      expect(col).toBe(0);
    });

    it('converts address 1919 to row 23, col 79', () => {
      const { row, col } = addressToRowCol(1919, 80);
      expect(row).toBe(23);
      expect(col).toBe(79);
    });

    it('round-trips row/col', () => {
      for (let row = 0; row < 24; row++) {
        for (let col = 0; col < 80; col++) {
          const addr = rowColToAddress(row, col, 80);
          const result = addressToRowCol(addr, 80);
          expect(result.row).toBe(row);
          expect(result.col).toBe(col);
        }
      }
    });
  });
});
