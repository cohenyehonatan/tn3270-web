import type { ScreenSize } from './constants.js';

/** Parsed Write Control Character */
export interface WCC {
  /** Reset MDT bits in all fields */
  resetMDT: boolean;
  /** Sound audible alarm */
  alarm: boolean;
  /** Unlock keyboard */
  keyboardRestore: boolean;
  /** Reset partition characteristics (not implemented) */
  resetPartition: boolean;
}

/** Display mode derived from field attribute bits */
export type DisplayMode = 'normal' | 'intensified' | 'hidden' | 'nondisplay';

/** Attributes for a single buffer cell */
export interface CellAttributes {
  /** Field is protected (read-only) */
  protected: boolean;
  /** Numeric-only input field */
  numeric: boolean;
  /** Display mode */
  display: DisplayMode;
  /** Modified Data Tag — set when field is modified by operator */
  mdt: boolean;
  /** Extended foreground color (0x00 = default) */
  color: number;
  /** Extended highlighting (0x00 = default) */
  highlight: number;
  /** Character set (0x00 = default) */
  charset: number;
  /** Field outlining */
  outlining: number;
}

/** A single position in the screen buffer */
export interface BufferCell {
  /** Character value (Unicode code point after EBCDIC translation) */
  char: number;
  /** True if this position holds a field attribute (displayed as blank) */
  isFieldAttribute: boolean;
  /** Raw field attribute byte (valid only when isFieldAttribute is true) */
  fieldAttrByte: number;
  /** Resolved attributes for this cell */
  extended: CellAttributes;
}

/** Descriptor for a field in the screen buffer */
export interface FieldDescriptor {
  /** Buffer address of the SF byte */
  attributeAddress: number;
  /** Buffer address of the first data position (attributeAddress + 1) */
  startAddress: number;
  /** Number of data positions in the field */
  length: number;
  /** Parsed attributes */
  attrs: CellAttributes;
}

/** A modified field to include in a Read Modified response */
export interface ModifiedField {
  /** Buffer address of the field attribute */
  address: number;
  /** Field data as EBCDIC bytes */
  data: Uint8Array;
}

/** Result of parsing a 3270 data stream record */
export type ParseResult =
  | { type: 'write'; wcc: WCC }
  | { type: 'read-request'; command: number }
  | { type: 'erase-all-unprotected' }
  | { type: 'error'; message: string };

/** Connection configuration */
export interface ConnectionConfig {
  host: string;
  port: number;
  tls: boolean;
  terminalType: string;
  luName?: string;
  screenSize: ScreenSize;
}

/** Default cell attributes */
export function defaultCellAttributes(): CellAttributes {
  return {
    protected: false,
    numeric: false,
    display: 'normal',
    mdt: false,
    color: 0x00,
    highlight: 0x00,
    charset: 0x00,
    outlining: 0x00,
  };
}

/** Create an empty buffer cell */
export function emptyBufferCell(): BufferCell {
  return {
    char: 0x00,
    isFieldAttribute: false,
    fieldAttrByte: 0x00,
    extended: defaultCellAttributes(),
  };
}
