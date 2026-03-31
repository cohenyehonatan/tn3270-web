/**
 * IBM 3270 Data Stream Constants
 * Reference: GA23-0059-07 — 3270 Data Stream Programmer's Reference
 */

// --- 3270 Data Stream Commands (host → terminal) ---

export const Command = {
  /** Write data starting at current buffer address */
  WRITE: 0xf1,
  /** Erase buffer, then write */
  ERASE_WRITE: 0xf5,
  /** Switch to alternate screen size, erase, then write */
  ERASE_WRITE_ALTERNATE: 0x7e,
  /** Request modified fields from terminal */
  READ_MODIFIED: 0xf6,
  /** Request all modified fields */
  READ_MODIFIED_ALL: 0x6e,
  /** Request entire buffer contents */
  READ_BUFFER: 0xf2,
  /** Erase all unprotected fields */
  ERASE_ALL_UNPROTECTED: 0x6f,
  /** Write Structured Field */
  WRITE_STRUCTURED_FIELD: 0xf3,
} as const;

// SNA variants (used when in TN3270E mode with SNA headers)
export const CommandSNA = {
  WRITE: 0x01,
  ERASE_WRITE: 0x05,
  ERASE_WRITE_ALTERNATE: 0x0d,
  READ_MODIFIED: 0x06,
  READ_MODIFIED_ALL: 0x0e,
  READ_BUFFER: 0x02,
  ERASE_ALL_UNPROTECTED: 0x0f,
  WRITE_STRUCTURED_FIELD: 0x11,
} as const;

// --- Order Codes ---

export const Order = {
  /** Start Field: defines a field attribute at current position */
  SF: 0x1d,
  /** Start Field Extended: field attribute with extended attributes */
  SFE: 0x29,
  /** Set Buffer Address: reposition buffer write pointer */
  SBA: 0x11,
  /** Set Attribute: set running character attribute (no field boundary) */
  SA: 0x28,
  /** Modify Field: modify attributes of existing field */
  MF: 0x2c,
  /** Insert Cursor: set cursor position to current address */
  IC: 0x13,
  /** Program Tab: advance to next unprotected field */
  PT: 0x05,
  /** Repeat to Address: fill from current to target with a character */
  RA: 0x3c,
  /** Erase Unprotected to Address: clear unprotected positions to target */
  EUA: 0x12,
  /** Graphic Escape: next byte is from an alternate character set */
  GE: 0x08,
} as const;

/** Set of all order code values for quick lookup */
export const ORDER_CODES: ReadonlySet<number> = new Set(Object.values(Order));

// --- AID (Attention Identifier) Bytes ---

export const AID = {
  NO_AID: 0x60,
  ENTER: 0x7d,
  CLEAR: 0x6d,
  PA1: 0x6c,
  PA2: 0x6e,
  PA3: 0x6b,
  PF1: 0xf1,
  PF2: 0xf2,
  PF3: 0xf3,
  PF4: 0xf4,
  PF5: 0xf5,
  PF6: 0xf6,
  PF7: 0xf7,
  PF8: 0xf8,
  PF9: 0xf9,
  PF10: 0x7a,
  PF11: 0x7b,
  PF12: 0x7c,
  PF13: 0xc1,
  PF14: 0xc2,
  PF15: 0xc3,
  PF16: 0xc4,
  PF17: 0xc5,
  PF18: 0xc6,
  PF19: 0xc7,
  PF20: 0xc8,
  PF21: 0xc9,
  PF22: 0x4a,
  PF23: 0x4b,
  PF24: 0x4c,
  /** Structured field AID (for Read Partition) */
  SF_AID: 0x88,
} as const;

/** AID keys that are "short read" — only send AID + cursor, no field data */
export const SHORT_READ_AIDS: ReadonlySet<number> = new Set([
  AID.CLEAR,
  AID.PA1,
  AID.PA2,
  AID.PA3,
]);

// --- Extended Attribute Types (for SFE, SA, MF) ---

export const ExtendedAttributeType = {
  /** Reset all character attributes to default */
  ALL: 0x00,
  /** 3270 field attribute (same encoding as SF byte) */
  FIELD_ATTRIBUTE: 0xc0,
  /** Extended highlighting */
  HIGHLIGHT: 0x41,
  /** Foreground color */
  COLOR: 0x42,
  /** Character set */
  CHARSET: 0x43,
  /** Field outlining */
  FIELD_OUTLINING: 0xc5,
  /** Transparency */
  TRANSPARENCY: 0x46,
} as const;

// --- Extended Color Values ---

export const Color3270 = {
  DEFAULT: 0x00,
  BLUE: 0xf1,
  RED: 0xf2,
  PINK: 0xf3,
  GREEN: 0xf4,
  TURQUOISE: 0xf5,
  YELLOW: 0xf6,
  WHITE: 0xf7,
} as const;

// --- Extended Highlighting Values ---

export const Highlight3270 = {
  DEFAULT: 0x00,
  BLINK: 0xf1,
  REVERSE: 0xf2,
  UNDERSCORE: 0xf4,
} as const;

// --- Field Outlining Values ---

export const FieldOutlining = {
  DEFAULT: 0x00,
  UNDERLINE: 0x01,
  RIGHT_LINE: 0x02,
  OVERLINE: 0x04,
  LEFT_LINE: 0x08,
  BOX: 0x0f,
} as const;

// --- Field Attribute Bit Masks ---
// The field attribute byte from SF order encodes protection, display, etc.

export const FieldAttrMask = {
  /** Bits 0-1: field type */
  PROTECTED: 0x20,
  NUMERIC: 0x10,
  /** Bits 2-3: display */
  DISPLAY_MASK: 0x0c,
  DISPLAY_NOT_PEN_DETECTABLE: 0x00,
  DISPLAY_PEN_DETECTABLE: 0x04,
  DISPLAY_INTENSIFIED: 0x08,
  DISPLAY_HIDDEN: 0x0c,
  /** Bit 5: modified data tag */
  MDT: 0x01,
} as const;

// --- Screen Sizes ---

export interface ScreenSize {
  rows: number;
  cols: number;
}

export const SCREEN_MODELS: Record<string, ScreenSize> = {
  'IBM-3278-2': { rows: 24, cols: 80 },
  'IBM-3278-2-E': { rows: 24, cols: 80 },
  'IBM-3278-3': { rows: 32, cols: 80 },
  'IBM-3278-3-E': { rows: 32, cols: 80 },
  'IBM-3278-4': { rows: 43, cols: 80 },
  'IBM-3278-4-E': { rows: 43, cols: 80 },
  'IBM-3278-5': { rows: 27, cols: 132 },
  'IBM-3278-5-E': { rows: 27, cols: 132 },
  'IBM-3279-2': { rows: 24, cols: 80 },
  'IBM-3279-2-E': { rows: 24, cols: 80 },
  'IBM-3279-3': { rows: 32, cols: 80 },
  'IBM-3279-3-E': { rows: 32, cols: 80 },
};

// --- Telnet Constants ---

export const Telnet = {
  IAC: 0xff,
  DO: 0xfd,
  DONT: 0xfe,
  WILL: 0xfb,
  WONT: 0xfc,
  SB: 0xfa,
  SE: 0xf0,
  EOR: 0xef,

  // Telnet options
  OPT_BINARY: 0x00,
  OPT_TERMINAL_TYPE: 0x18,
  OPT_EOR: 0x19,
  OPT_TN3270E: 0x28,
} as const;

// --- TN3270E Constants ---

export const TN3270E = {
  // Data types
  DATA_3270: 0x00,
  DATA_SCS: 0x01,
  DATA_RESPONSE: 0x02,
  DATA_BIND_IMAGE: 0x03,
  DATA_UNBIND: 0x04,
  DATA_NVT: 0x05,
  DATA_REQUEST: 0x06,
  DATA_SSCP_LU: 0x07,

  // Request flags
  ERR_COND_CLEARED: 0x00,

  // Response flags
  NO_RESPONSE: 0x00,
  ERROR_RESPONSE: 0x01,
  ALWAYS_RESPONSE: 0x02,
  POSITIVE_RESPONSE: 0x00,
  NEGATIVE_RESPONSE: 0x01,

  // Sub-negotiation commands
  SEND: 0x08,
  IS: 0x04,
  REJECT: 0x03,
  REQUEST: 0x07,
  CONNECT: 0x01,
  DEVICE_TYPE: 0x02,
  FUNCTIONS: 0x03,
} as const;
