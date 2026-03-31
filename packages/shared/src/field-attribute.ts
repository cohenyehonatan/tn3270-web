/**
 * Field Attribute Byte Parsing
 *
 * The field attribute byte (from SF order) is a single byte that encodes
 * protection, numeric, display mode, and MDT bits.
 *
 * Bit layout (IBM numbering, bit 0 = MSB):
 *   Bits 0-1: reserved
 *   Bit 2: protected
 *   Bit 3: numeric
 *   Bits 4-5: display
 *   Bit 6: reserved
 *   Bit 7: MDT (modified data tag)
 */

import { FieldAttrMask } from './constants.js';
import type { CellAttributes, DisplayMode } from './types.js';
import { defaultCellAttributes } from './types.js';

/**
 * Parse a field attribute byte into structured attributes.
 */
export function parseFieldAttribute(attrByte: number): CellAttributes {
  const attrs = defaultCellAttributes();

  attrs.protected = (attrByte & FieldAttrMask.PROTECTED) !== 0;
  attrs.numeric = (attrByte & FieldAttrMask.NUMERIC) !== 0;
  attrs.mdt = (attrByte & FieldAttrMask.MDT) !== 0;

  const displayBits = attrByte & FieldAttrMask.DISPLAY_MASK;
  switch (displayBits) {
    case FieldAttrMask.DISPLAY_NOT_PEN_DETECTABLE:
      attrs.display = 'normal';
      break;
    case FieldAttrMask.DISPLAY_PEN_DETECTABLE:
      attrs.display = 'normal'; // pen detectable treated as normal display
      break;
    case FieldAttrMask.DISPLAY_INTENSIFIED:
      attrs.display = 'intensified';
      break;
    case FieldAttrMask.DISPLAY_HIDDEN:
      attrs.display = 'hidden';
      break;
  }

  return attrs;
}

/**
 * Encode structured attributes back into a field attribute byte.
 */
export function encodeFieldAttribute(attrs: Partial<CellAttributes>): number {
  let byte = 0;

  if (attrs.protected) byte |= FieldAttrMask.PROTECTED;
  if (attrs.numeric) byte |= FieldAttrMask.NUMERIC;
  if (attrs.mdt) byte |= FieldAttrMask.MDT;

  switch (attrs.display) {
    case 'normal':
      byte |= FieldAttrMask.DISPLAY_NOT_PEN_DETECTABLE;
      break;
    case 'intensified':
      byte |= FieldAttrMask.DISPLAY_INTENSIFIED;
      break;
    case 'hidden':
    case 'nondisplay':
      byte |= FieldAttrMask.DISPLAY_HIDDEN;
      break;
  }

  return byte;
}

/**
 * Derive the default base color from field attributes (when no extended color is set).
 * This follows the standard 3279 color mapping.
 */
export function deriveBaseColor(attrs: CellAttributes): number {
  if (attrs.protected) {
    return attrs.display === 'intensified' ? 0xf7 : 0xf4; // white : green
  } else {
    return attrs.display === 'intensified' ? 0xf2 : 0xf5; // red : turquoise
  }
}
