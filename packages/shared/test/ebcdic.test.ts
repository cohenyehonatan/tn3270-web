import { describe, it, expect } from 'vitest';
import {
  ebcdicToUnicode,
  unicodeToEbcdic,
  stringToEbcdic,
  ebcdicToString,
} from '../src/ebcdic.js';

describe('EBCDIC Translation', () => {
  describe('ebcdicToUnicode', () => {
    it('translates uppercase letters', () => {
      expect(ebcdicToUnicode(0xc1)).toBe('A');
      expect(ebcdicToUnicode(0xc9)).toBe('I');
      expect(ebcdicToUnicode(0xd1)).toBe('J');
      expect(ebcdicToUnicode(0xd9)).toBe('R');
      expect(ebcdicToUnicode(0xe2)).toBe('S');
      expect(ebcdicToUnicode(0xe9)).toBe('Z');
    });

    it('translates lowercase letters', () => {
      expect(ebcdicToUnicode(0x81)).toBe('a');
      expect(ebcdicToUnicode(0x89)).toBe('i');
      expect(ebcdicToUnicode(0x91)).toBe('j');
      expect(ebcdicToUnicode(0x99)).toBe('r');
      expect(ebcdicToUnicode(0xa2)).toBe('s');
      expect(ebcdicToUnicode(0xa9)).toBe('z');
    });

    it('translates digits', () => {
      for (let i = 0; i <= 9; i++) {
        expect(ebcdicToUnicode(0xf0 + i)).toBe(String(i));
      }
    });

    it('translates space', () => {
      expect(ebcdicToUnicode(0x40)).toBe(' ');
    });

    it('translates special characters', () => {
      expect(ebcdicToUnicode(0x4b)).toBe('.');
      expect(ebcdicToUnicode(0x4c)).toBe('<');
      expect(ebcdicToUnicode(0x4d)).toBe('(');
      expect(ebcdicToUnicode(0x4e)).toBe('+');
      expect(ebcdicToUnicode(0x50)).toBe('&');
      expect(ebcdicToUnicode(0x5c)).toBe('*');
      expect(ebcdicToUnicode(0x5d)).toBe(')');
      expect(ebcdicToUnicode(0x60)).toBe('-');
      expect(ebcdicToUnicode(0x61)).toBe('/');
      expect(ebcdicToUnicode(0x6b)).toBe(',');
      expect(ebcdicToUnicode(0x7d)).toBe("'");
      expect(ebcdicToUnicode(0x7e)).toBe('=');
    });

    it('returns empty string for null/unmapped', () => {
      expect(ebcdicToUnicode(0x00)).toBe('');
      expect(ebcdicToUnicode(0x01)).toBe('');
    });
  });

  describe('unicodeToEbcdic', () => {
    it('round-trips uppercase letters', () => {
      for (let code = 0x41; code <= 0x5a; code++) {
        const char = String.fromCharCode(code);
        const ebcdic = unicodeToEbcdic(char);
        expect(ebcdicToUnicode(ebcdic)).toBe(char);
      }
    });

    it('round-trips lowercase letters', () => {
      for (let code = 0x61; code <= 0x7a; code++) {
        const char = String.fromCharCode(code);
        const ebcdic = unicodeToEbcdic(char);
        expect(ebcdicToUnicode(ebcdic)).toBe(char);
      }
    });

    it('round-trips digits', () => {
      for (let i = 0; i <= 9; i++) {
        const char = String(i);
        const ebcdic = unicodeToEbcdic(char);
        expect(ebcdicToUnicode(ebcdic)).toBe(char);
      }
    });

    it('returns 0x40 for unmapped characters', () => {
      expect(unicodeToEbcdic('€')).toBe(0x40);
    });
  });

  describe('stringToEbcdic / ebcdicToString', () => {
    it('round-trips ASCII strings', () => {
      const input = 'HELLO WORLD 123';
      const ebcdic = stringToEbcdic(input);
      expect(ebcdicToString(ebcdic)).toBe(input);
    });

    it('round-trips mixed case', () => {
      const input = 'Hello World';
      const ebcdic = stringToEbcdic(input);
      expect(ebcdicToString(ebcdic)).toBe(input);
    });

    it('handles special characters', () => {
      const input = 'A=B+C*D/E';
      const ebcdic = stringToEbcdic(input);
      expect(ebcdicToString(ebcdic)).toBe(input);
    });

    it('handles partial reads with start/length', () => {
      const input = 'ABCDEF';
      const ebcdic = stringToEbcdic(input);
      expect(ebcdicToString(ebcdic, 2, 3)).toBe('CDE');
    });
  });
});
