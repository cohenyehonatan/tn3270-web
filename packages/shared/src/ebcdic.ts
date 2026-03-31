/**
 * EBCDIC ↔ Unicode Translation Tables
 * Based on IBM Code Page 037 (US/Canada EBCDIC)
 */

// EBCDIC → Unicode lookup (256 entries)
// Unmapped positions map to U+0000 (null)
const ebcdicToUnicodeTable: number[] = new Array(256).fill(0x0000);

// Control characters and specials
ebcdicToUnicodeTable[0x40] = 0x0020; // space
ebcdicToUnicodeTable[0x4a] = 0x00a2; // ¢
ebcdicToUnicodeTable[0x4b] = 0x002e; // .
ebcdicToUnicodeTable[0x4c] = 0x003c; // <
ebcdicToUnicodeTable[0x4d] = 0x0028; // (
ebcdicToUnicodeTable[0x4e] = 0x002b; // +
ebcdicToUnicodeTable[0x4f] = 0x007c; // |
ebcdicToUnicodeTable[0x50] = 0x0026; // &
ebcdicToUnicodeTable[0x5a] = 0x0021; // !
ebcdicToUnicodeTable[0x5b] = 0x0024; // $
ebcdicToUnicodeTable[0x5c] = 0x002a; // *
ebcdicToUnicodeTable[0x5d] = 0x0029; // )
ebcdicToUnicodeTable[0x5e] = 0x003b; // ;
ebcdicToUnicodeTable[0x5f] = 0x00ac; // ¬
ebcdicToUnicodeTable[0x60] = 0x002d; // -
ebcdicToUnicodeTable[0x61] = 0x002f; // /
ebcdicToUnicodeTable[0x6a] = 0x00a6; // ¦
ebcdicToUnicodeTable[0x6b] = 0x002c; // ,
ebcdicToUnicodeTable[0x6c] = 0x0025; // %
ebcdicToUnicodeTable[0x6d] = 0x005f; // _
ebcdicToUnicodeTable[0x6e] = 0x003e; // >
ebcdicToUnicodeTable[0x6f] = 0x003f; // ?
ebcdicToUnicodeTable[0x79] = 0x0060; // `
ebcdicToUnicodeTable[0x7a] = 0x003a; // :
ebcdicToUnicodeTable[0x7b] = 0x0023; // #
ebcdicToUnicodeTable[0x7c] = 0x0040; // @
ebcdicToUnicodeTable[0x7d] = 0x0027; // '
ebcdicToUnicodeTable[0x7e] = 0x003d; // =
ebcdicToUnicodeTable[0x7f] = 0x0022; // "

// Lowercase a-i (0x81-0x89)
ebcdicToUnicodeTable[0x81] = 0x0061; // a
ebcdicToUnicodeTable[0x82] = 0x0062; // b
ebcdicToUnicodeTable[0x83] = 0x0063; // c
ebcdicToUnicodeTable[0x84] = 0x0064; // d
ebcdicToUnicodeTable[0x85] = 0x0065; // e
ebcdicToUnicodeTable[0x86] = 0x0066; // f
ebcdicToUnicodeTable[0x87] = 0x0067; // g
ebcdicToUnicodeTable[0x88] = 0x0068; // h
ebcdicToUnicodeTable[0x89] = 0x0069; // i

// Lowercase j-r (0x91-0x99)
ebcdicToUnicodeTable[0x91] = 0x006a; // j
ebcdicToUnicodeTable[0x92] = 0x006b; // k
ebcdicToUnicodeTable[0x93] = 0x006c; // l
ebcdicToUnicodeTable[0x94] = 0x006d; // m
ebcdicToUnicodeTable[0x95] = 0x006e; // n
ebcdicToUnicodeTable[0x96] = 0x006f; // o
ebcdicToUnicodeTable[0x97] = 0x0070; // p
ebcdicToUnicodeTable[0x98] = 0x0071; // q
ebcdicToUnicodeTable[0x99] = 0x0072; // r

// Lowercase s-z (0xa2-0xa9)
ebcdicToUnicodeTable[0xa2] = 0x0073; // s
ebcdicToUnicodeTable[0xa3] = 0x0074; // t
ebcdicToUnicodeTable[0xa4] = 0x0075; // u
ebcdicToUnicodeTable[0xa5] = 0x0076; // v
ebcdicToUnicodeTable[0xa6] = 0x0077; // w
ebcdicToUnicodeTable[0xa7] = 0x0078; // x
ebcdicToUnicodeTable[0xa8] = 0x0079; // y
ebcdicToUnicodeTable[0xa9] = 0x007a; // z

// Uppercase A-I (0xC1-0xC9)
ebcdicToUnicodeTable[0xc1] = 0x0041; // A
ebcdicToUnicodeTable[0xc2] = 0x0042; // B
ebcdicToUnicodeTable[0xc3] = 0x0043; // C
ebcdicToUnicodeTable[0xc4] = 0x0044; // D
ebcdicToUnicodeTable[0xc5] = 0x0045; // E
ebcdicToUnicodeTable[0xc6] = 0x0046; // F
ebcdicToUnicodeTable[0xc7] = 0x0047; // G
ebcdicToUnicodeTable[0xc8] = 0x0048; // H
ebcdicToUnicodeTable[0xc9] = 0x0049; // I

// Uppercase J-R (0xD1-0xD9)
ebcdicToUnicodeTable[0xd1] = 0x004a; // J
ebcdicToUnicodeTable[0xd2] = 0x004b; // K
ebcdicToUnicodeTable[0xd3] = 0x004c; // L
ebcdicToUnicodeTable[0xd4] = 0x004d; // M
ebcdicToUnicodeTable[0xd5] = 0x004e; // N
ebcdicToUnicodeTable[0xd6] = 0x004f; // O
ebcdicToUnicodeTable[0xd7] = 0x0050; // P
ebcdicToUnicodeTable[0xd8] = 0x0051; // Q
ebcdicToUnicodeTable[0xd9] = 0x0052; // R

// Uppercase S-Z (0xE2-0xE9)
ebcdicToUnicodeTable[0xe2] = 0x0053; // S
ebcdicToUnicodeTable[0xe3] = 0x0054; // T
ebcdicToUnicodeTable[0xe4] = 0x0055; // U
ebcdicToUnicodeTable[0xe5] = 0x0056; // V
ebcdicToUnicodeTable[0xe6] = 0x0057; // W
ebcdicToUnicodeTable[0xe7] = 0x0058; // X
ebcdicToUnicodeTable[0xe8] = 0x0059; // Y
ebcdicToUnicodeTable[0xe9] = 0x005a; // Z

// Digits 0-9 (0xF0-0xF9)
ebcdicToUnicodeTable[0xf0] = 0x0030; // 0
ebcdicToUnicodeTable[0xf1] = 0x0031; // 1
ebcdicToUnicodeTable[0xf2] = 0x0032; // 2
ebcdicToUnicodeTable[0xf3] = 0x0033; // 3
ebcdicToUnicodeTable[0xf4] = 0x0034; // 4
ebcdicToUnicodeTable[0xf5] = 0x0035; // 5
ebcdicToUnicodeTable[0xf6] = 0x0036; // 6
ebcdicToUnicodeTable[0xf7] = 0x0037; // 7
ebcdicToUnicodeTable[0xf8] = 0x0038; // 8
ebcdicToUnicodeTable[0xf9] = 0x0039; // 9

// Additional special characters
ebcdicToUnicodeTable[0xad] = 0x005b; // [
ebcdicToUnicodeTable[0xbd] = 0x005d; // ]
ebcdicToUnicodeTable[0xc0] = 0x007b; // {
ebcdicToUnicodeTable[0xd0] = 0x007d; // }
ebcdicToUnicodeTable[0xe0] = 0x005c; // backslash
ebcdicToUnicodeTable[0xa1] = 0x007e; // ~
ebcdicToUnicodeTable[0xb0] = 0x005e; // ^

// Special 3270 characters
ebcdicToUnicodeTable[0x1c] = 0x001c; // DUP (rendered as *)
ebcdicToUnicodeTable[0x1e] = 0x001e; // FM (Field Mark, rendered as ;)

/** Read-only EBCDIC → Unicode table */
export const EBCDIC_TO_UNICODE: readonly number[] = Object.freeze(ebcdicToUnicodeTable);

// Build reverse table (Unicode → EBCDIC)
const unicodeToEbcdicMap = new Map<number, number>();
for (let i = 0; i < 256; i++) {
  const unicode = ebcdicToUnicodeTable[i];
  if (unicode !== 0x0000) {
    unicodeToEbcdicMap.set(unicode, i);
  }
}

/**
 * Convert a single EBCDIC byte to a Unicode character.
 * Returns empty string for null/unmapped values.
 */
export function ebcdicToUnicode(ebcdic: number): string {
  const codePoint = EBCDIC_TO_UNICODE[ebcdic & 0xff];
  return codePoint === 0x0000 ? '' : String.fromCodePoint(codePoint);
}

/**
 * Convert a single Unicode character to an EBCDIC byte.
 * Returns 0x40 (EBCDIC space) for unmapped characters.
 */
export function unicodeToEbcdic(char: string): number {
  if (char.length === 0) return 0x00;
  const codePoint = char.codePointAt(0)!;
  return unicodeToEbcdicMap.get(codePoint) ?? 0x40;
}

/**
 * Convert an ASCII/Unicode string to EBCDIC byte array.
 */
export function stringToEbcdic(str: string): Uint8Array {
  const result = new Uint8Array(str.length);
  for (let i = 0; i < str.length; i++) {
    result[i] = unicodeToEbcdic(str[i]);
  }
  return result;
}

/**
 * Convert an EBCDIC byte array to a Unicode string.
 */
export function ebcdicToString(data: Uint8Array, start = 0, length?: number): string {
  const end = length !== undefined ? start + length : data.length;
  let result = '';
  for (let i = start; i < end; i++) {
    result += ebcdicToUnicode(data[i]);
  }
  return result;
}
