import { describe, it, expect, beforeEach } from 'vitest';
import { ScreenBuffer } from '../../src/buffer/screen-buffer.js';
import { encodeFieldAttribute } from '@tn3270/shared';

describe('ScreenBuffer', () => {
  let buffer: ScreenBuffer;

  beforeEach(() => {
    buffer = new ScreenBuffer({ rows: 24, cols: 80 });
  });

  describe('basic operations', () => {
    it('initializes with correct size', () => {
      expect(buffer.size).toBe(1920);
      expect(buffer.rows).toBe(24);
      expect(buffer.cols).toBe(80);
    });

    it('writes and reads characters', () => {
      buffer.setChar(0, 0xc1); // 'A'
      expect(buffer.getCell(0).char).toBe(0xc1);
    });

    it('wraps address at buffer end', () => {
      buffer.currentAddress = 1919;
      buffer.advanceAddress();
      expect(buffer.currentAddress).toBe(0);
    });

    it('handles negative address wrapping', () => {
      expect(buffer.wrapAddress(-1)).toBe(1919);
      expect(buffer.wrapAddress(-80)).toBe(1840);
    });
  });

  describe('field operations', () => {
    it('sets a field attribute', () => {
      buffer.setFieldAttribute(0, encodeFieldAttribute({ protected: true }));
      const cell = buffer.getCell(0);
      expect(cell.isFieldAttribute).toBe(true);
      expect(cell.extended.protected).toBe(true);
    });

    it('finds field start by scanning backwards', () => {
      // Place SF at address 10
      buffer.setFieldAttribute(10, encodeFieldAttribute({ protected: false }));
      // Address 15 is within this field
      expect(buffer.findFieldStart(15)).toBe(10);
    });

    it('finds next field', () => {
      buffer.setFieldAttribute(10, encodeFieldAttribute({}));
      buffer.setFieldAttribute(50, encodeFieldAttribute({}));
      expect(buffer.findNextField(10)).toBe(50);
    });

    it('finds next unprotected field', () => {
      buffer.setFieldAttribute(10, encodeFieldAttribute({ protected: true }));
      buffer.setFieldAttribute(50, encodeFieldAttribute({ protected: false }));
      expect(buffer.findNextUnprotectedField(10)).toBe(50);
    });

    it('wraps field search around buffer end', () => {
      buffer.setFieldAttribute(5, encodeFieldAttribute({}));
      // Searching from address 1900 should wrap and find field at 5
      expect(buffer.findNextField(1900)).toBe(5);
    });

    it('returns -1 for unformatted screen', () => {
      expect(buffer.findFieldStart(100)).toBe(-1);
      expect(buffer.findNextField(0)).toBe(-1);
    });
  });

  describe('MDT tracking', () => {
    it('sets MDT on a field', () => {
      buffer.setFieldAttribute(10, encodeFieldAttribute({ protected: false }));
      buffer.setMDT(15); // position within the field
      expect(buffer.getCell(10).extended.mdt).toBe(true);
    });

    it('resets all MDTs', () => {
      buffer.setFieldAttribute(10, encodeFieldAttribute({ protected: false, mdt: true }));
      buffer.setFieldAttribute(50, encodeFieldAttribute({ protected: false, mdt: true }));
      buffer.resetAllMDT();
      expect(buffer.getCell(10).extended.mdt).toBe(false);
      expect(buffer.getCell(50).extended.mdt).toBe(false);
    });
  });

  describe('field data extraction', () => {
    it('gets field data', () => {
      buffer.setFieldAttribute(10, encodeFieldAttribute({}));
      buffer.setFieldAttribute(15, encodeFieldAttribute({})); // next field at 15
      buffer.setChar(11, 0xc1); // A
      buffer.setChar(12, 0xc2); // B
      buffer.setChar(13, 0xc3); // C
      buffer.setChar(14, 0xc4); // D

      const data = buffer.getFieldData(10);
      expect(data.length).toBe(4);
      expect(data[0]).toBe(0xc1);
      expect(data[1]).toBe(0xc2);
      expect(data[2]).toBe(0xc3);
      expect(data[3]).toBe(0xc4);
    });

    it('gets modified fields', () => {
      buffer.setFieldAttribute(10, encodeFieldAttribute({ protected: false }));
      buffer.setFieldAttribute(20, encodeFieldAttribute({ protected: true }));
      buffer.setFieldAttribute(30, encodeFieldAttribute({ protected: false }));
      // Set MDT on first unprotected field
      buffer.setMDT(12);
      buffer.setChar(11, 0xc1);

      const modified = buffer.getModifiedFields();
      expect(modified.length).toBe(1);
      expect(modified[0].address).toBe(10);
    });
  });

  describe('clear operations', () => {
    it('clears entire buffer', () => {
      buffer.setChar(100, 0xc1);
      buffer.setFieldAttribute(50, encodeFieldAttribute({}));
      buffer.clear();
      expect(buffer.getCell(100).char).toBe(0x00);
      expect(buffer.getCell(50).isFieldAttribute).toBe(false);
    });

    it('clears only unprotected fields', () => {
      buffer.setFieldAttribute(10, encodeFieldAttribute({ protected: true }));
      buffer.setChar(11, 0xc1); // protected content
      buffer.setFieldAttribute(20, encodeFieldAttribute({ protected: false }));
      buffer.setChar(21, 0xc2); // unprotected content

      buffer.clearUnprotected();
      expect(buffer.getCell(11).char).toBe(0xc1); // protected: unchanged
      expect(buffer.getCell(21).char).toBe(0x00); // unprotected: cleared
    });
  });

  describe('keyboard input', () => {
    beforeEach(() => {
      // Set up: protected field at 0, unprotected field at 10 (10 chars), protected at 21
      buffer.setFieldAttribute(0, encodeFieldAttribute({ protected: true }));
      buffer.setFieldAttribute(10, encodeFieldAttribute({ protected: false }));
      buffer.setFieldAttribute(21, encodeFieldAttribute({ protected: true }));
      buffer.cursorAddress = 11; // first position of unprotected field
    });

    it('types a character in unprotected field', () => {
      const ok = buffer.typeChar(0xc1, false); // 'A'
      expect(ok).toBe(true);
      expect(buffer.getCell(11).char).toBe(0xc1);
      expect(buffer.cursorAddress).toBe(12);
    });

    it('rejects typing in protected field', () => {
      buffer.cursorAddress = 1; // protected area
      const ok = buffer.typeChar(0xc1, false);
      expect(ok).toBe(false);
    });

    it('sets MDT when typing', () => {
      buffer.typeChar(0xc1, false);
      expect(buffer.getCell(10).extended.mdt).toBe(true);
    });

    it('deletes character and shifts left', () => {
      buffer.setChar(11, 0xc1); // A
      buffer.setChar(12, 0xc2); // B
      buffer.setChar(13, 0xc3); // C
      buffer.cursorAddress = 11;

      buffer.deleteChar();
      expect(buffer.getCell(11).char).toBe(0xc2); // B shifted left
      expect(buffer.getCell(12).char).toBe(0xc3); // C shifted left
      expect(buffer.getCell(13).char).toBe(0x00); // cleared
    });

    it('erases to end of field', () => {
      buffer.setChar(11, 0xc1);
      buffer.setChar(12, 0xc2);
      buffer.setChar(13, 0xc3);
      buffer.cursorAddress = 12;

      buffer.eraseEOF();
      expect(buffer.getCell(11).char).toBe(0xc1); // before cursor: unchanged
      expect(buffer.getCell(12).char).toBe(0x00); // cursor pos: cleared
      expect(buffer.getCell(13).char).toBe(0x00); // after cursor: cleared
    });

    it('tabs to next unprotected field', () => {
      buffer.setFieldAttribute(30, encodeFieldAttribute({ protected: false }));
      buffer.cursorAddress = 15;
      buffer.tabForward();
      expect(buffer.cursorAddress).toBe(31);
    });
  });

  describe('coordinate conversion', () => {
    it('converts address to row/col', () => {
      const { row, col } = buffer.toRowCol(163);
      expect(row).toBe(2);
      expect(col).toBe(3);
    });

    it('converts row/col to address', () => {
      expect(buffer.toAddress(2, 3)).toBe(163);
    });
  });
});
