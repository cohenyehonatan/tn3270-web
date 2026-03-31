import { describe, it, expect, beforeEach } from 'vitest';
import { DataStreamParser } from '../../src/protocol/stream-parser.js';
import { ScreenBuffer } from '../../src/buffer/screen-buffer.js';
import { DataStreamBuilder, Command, Order, Color3270, Highlight3270 } from '@tn3270/shared';
import { ebcdicToUnicode } from '@tn3270/shared';

describe('DataStreamParser', () => {
  let parser: DataStreamParser;
  let buffer: ScreenBuffer;

  beforeEach(() => {
    parser = new DataStreamParser();
    buffer = new ScreenBuffer({ rows: 24, cols: 80 });
  });

  describe('Write command', () => {
    it('parses Erase/Write with text', () => {
      const stream = new DataStreamBuilder()
        .eraseWrite()
        .wcc({ keyboardRestore: true })
        .sba(0, 0)
        .text('HELLO')
        .build();

      const result = parser.parse(stream, buffer);
      expect(result.type).toBe('write');
      if (result.type === 'write') {
        expect(result.wcc.keyboardRestore).toBe(true);
      }

      // Check that HELLO was written starting at address 0
      expect(ebcdicToUnicode(buffer.getCell(0).char)).toBe('H');
      expect(ebcdicToUnicode(buffer.getCell(1).char)).toBe('E');
      expect(ebcdicToUnicode(buffer.getCell(2).char)).toBe('L');
      expect(ebcdicToUnicode(buffer.getCell(3).char)).toBe('L');
      expect(ebcdicToUnicode(buffer.getCell(4).char)).toBe('O');
    });

    it('parses WCC alarm bit', () => {
      const stream = new DataStreamBuilder()
        .eraseWrite()
        .wcc({ alarm: true })
        .build();

      const result = parser.parse(stream, buffer);
      if (result.type === 'write') {
        expect(result.wcc.alarm).toBe(true);
      }
    });

    it('parses WCC resetMDT bit', () => {
      // Set up a field with MDT
      buffer.setFieldAttribute(10, 0x01); // MDT set
      expect(buffer.getCell(10).extended.mdt).toBe(true);

      const stream = new DataStreamBuilder()
        .write()
        .wcc({ resetMDT: true })
        .build();

      parser.parse(stream, buffer);
      expect(buffer.getCell(10).extended.mdt).toBe(false);
    });
  });

  describe('SF order', () => {
    it('creates a field attribute at current position', () => {
      const stream = new DataStreamBuilder()
        .eraseWrite()
        .wcc({})
        .sba(1, 0)
        .sf({ protected: true })
        .text('LABEL')
        .build();

      parser.parse(stream, buffer);

      const fa = buffer.getCell(80); // row 1, col 0
      expect(fa.isFieldAttribute).toBe(true);
      expect(fa.extended.protected).toBe(true);

      // Text starts at address 81
      expect(ebcdicToUnicode(buffer.getCell(81).char)).toBe('L');
      expect(ebcdicToUnicode(buffer.getCell(82).char)).toBe('A');
    });

    it('creates unprotected input field', () => {
      const stream = new DataStreamBuilder()
        .eraseWrite()
        .wcc({})
        .sba(0, 0)
        .sf({ protected: false, numeric: true })
        .build();

      parser.parse(stream, buffer);

      const fa = buffer.getCell(0);
      expect(fa.isFieldAttribute).toBe(true);
      expect(fa.extended.protected).toBe(false);
      expect(fa.extended.numeric).toBe(true);
    });
  });

  describe('SFE order', () => {
    it('creates a field with extended color', () => {
      const stream = new DataStreamBuilder()
        .eraseWrite()
        .wcc({})
        .sba(0, 0)
        .sfe({ protected: true, color: Color3270.RED })
        .text('ERROR')
        .build();

      parser.parse(stream, buffer);

      const fa = buffer.getCell(0);
      expect(fa.isFieldAttribute).toBe(true);
      expect(fa.extended.protected).toBe(true);
      expect(fa.extended.color).toBe(Color3270.RED);
    });

    it('creates a field with highlighting', () => {
      const stream = new DataStreamBuilder()
        .eraseWrite()
        .wcc({})
        .sba(0, 0)
        .sfe({ protected: true, highlight: Highlight3270.REVERSE })
        .build();

      parser.parse(stream, buffer);
      expect(buffer.getCell(0).extended.highlight).toBe(Highlight3270.REVERSE);
    });
  });

  describe('SA order', () => {
    it('applies color to subsequent characters', () => {
      const stream = new DataStreamBuilder()
        .eraseWrite()
        .wcc({})
        .sba(0, 0)
        .sf({ protected: true })
        .saColor(Color3270.YELLOW)
        .text('AB')
        .build();

      parser.parse(stream, buffer);

      // Characters after SA should have yellow color override
      expect(buffer.getCell(1).extended.color).toBe(Color3270.YELLOW);
      expect(buffer.getCell(2).extended.color).toBe(Color3270.YELLOW);
    });
  });

  describe('RA order', () => {
    it('fills a region with a character', () => {
      const stream = new DataStreamBuilder()
        .eraseWrite()
        .wcc({})
        .sba(0, 0)
        .repeatToAddress(0, 10, 0x60) // EBCDIC '-'
        .build();

      parser.parse(stream, buffer);

      for (let i = 0; i < 10; i++) {
        expect(buffer.getCell(i).char).toBe(0x60);
      }
      // Current address should now be 10
      expect(buffer.currentAddress).toBe(10);
    });
  });

  describe('IC order', () => {
    it('sets cursor position', () => {
      const stream = new DataStreamBuilder()
        .eraseWrite()
        .wcc({})
        .insertCursor(5, 10)
        .build();

      parser.parse(stream, buffer);
      expect(buffer.cursorAddress).toBe(5 * 80 + 10); // row 5, col 10
    });
  });

  describe('EUA order', () => {
    it('erases unprotected positions to target', () => {
      // Set up: unprotected field with data
      buffer.setFieldAttribute(0, 0x00); // unprotected
      buffer.setChar(1, 0xc1); // A
      buffer.setChar(2, 0xc2); // B
      buffer.setChar(3, 0xc3); // C

      const stream = new DataStreamBuilder()
        .write()
        .wcc({})
        .sba(0, 1) // position at the data
        .eua(0, 4)
        .build();

      parser.parse(stream, buffer);

      expect(buffer.getCell(1).char).toBe(0x00); // erased
      expect(buffer.getCell(2).char).toBe(0x00); // erased
      expect(buffer.getCell(3).char).toBe(0x00); // erased
    });
  });

  describe('Erase/Write clears buffer', () => {
    it('clears existing content before writing', () => {
      // Pre-populate buffer
      buffer.setChar(500, 0xc1);
      expect(buffer.getCell(500).char).toBe(0xc1);

      const stream = new DataStreamBuilder()
        .eraseWrite()
        .wcc({})
        .sba(0, 0)
        .text('A')
        .build();

      parser.parse(stream, buffer);

      expect(buffer.getCell(0).char).not.toBe(0x00); // new content
      expect(buffer.getCell(500).char).toBe(0x00); // cleared
    });
  });

  describe('Read commands', () => {
    it('returns read-request for Read Modified', () => {
      const stream = new Uint8Array([Command.READ_MODIFIED]);
      const result = parser.parse(stream, buffer);
      expect(result.type).toBe('read-request');
    });

    it('returns read-request for Read Buffer', () => {
      const stream = new Uint8Array([Command.READ_BUFFER]);
      const result = parser.parse(stream, buffer);
      expect(result.type).toBe('read-request');
    });
  });

  describe('Erase All Unprotected', () => {
    it('clears unprotected fields', () => {
      buffer.setFieldAttribute(0, 0x20); // protected
      buffer.setChar(1, 0xc1);
      buffer.setFieldAttribute(10, 0x00); // unprotected
      buffer.setChar(11, 0xc2);

      const stream = new Uint8Array([Command.ERASE_ALL_UNPROTECTED]);
      parser.parse(stream, buffer);

      expect(buffer.getCell(1).char).toBe(0xc1); // protected: intact
      expect(buffer.getCell(11).char).toBe(0x00); // unprotected: cleared
    });
  });

  describe('complex screen', () => {
    it('parses a login screen with multiple fields', () => {
      const stream = new DataStreamBuilder()
        .eraseWrite()
        .wcc({ keyboardRestore: true, resetMDT: true })
        // Title
        .sba(0, 30)
        .sfe({ protected: true, color: Color3270.WHITE })
        .text('LOGIN SCREEN')
        // Username label
        .sba(5, 10)
        .sfe({ protected: true, color: Color3270.GREEN })
        .text('User ID:')
        // Username input
        .sba(5, 20)
        .sfe({ protected: false, color: Color3270.TURQUOISE })
        .text('        ') // 8 spaces
        // Field stopper
        .sba(5, 29)
        .sf({ protected: true })
        // Password label
        .sba(7, 10)
        .sfe({ protected: true, color: Color3270.GREEN })
        .text('Password:')
        // Password input (hidden)
        .sba(7, 20)
        .sfe({ protected: false, display: 'hidden', color: Color3270.GREEN })
        .text('        ')
        .sba(7, 29)
        .sf({ protected: true })
        // Cursor in username field
        .insertCursor(5, 21)
        .build();

      const result = parser.parse(stream, buffer);
      expect(result.type).toBe('write');

      // Check title
      expect(ebcdicToUnicode(buffer.getCell(31).char)).toBe('L'); // after FA at 30
      expect(ebcdicToUnicode(buffer.getCell(32).char)).toBe('O');

      // Check username field is unprotected
      const userFA = buffer.getCell(5 * 80 + 20);
      expect(userFA.isFieldAttribute).toBe(true);
      expect(userFA.extended.protected).toBe(false);
      expect(userFA.extended.color).toBe(Color3270.TURQUOISE);

      // Check password field is hidden
      const pwFA = buffer.getCell(7 * 80 + 20);
      expect(pwFA.isFieldAttribute).toBe(true);
      expect(pwFA.extended.display).toBe('hidden');

      // Check cursor position (row 5, col 21)
      expect(buffer.cursorAddress).toBe(5 * 80 + 21);

      // Check field count
      const allFields = buffer.getAllFields();
      expect(allFields.length).toBeGreaterThanOrEqual(6);
    });
  });
});
