/**
 * 3270 Screen Buffer
 *
 * The screen buffer models the 3270 terminal's display memory as a flat array
 * of cells. Each cell holds a character and attributes. Fields are defined
 * implicitly by Start Field (SF) attribute bytes placed in the buffer.
 *
 * A field extends from the position after its SF byte to the position before
 * the next SF byte (wrapping around the buffer end).
 */

import type { ScreenSize } from '@tn3270/shared';
import type { BufferCell, CellAttributes, FieldDescriptor, ModifiedField } from '@tn3270/shared';
import { defaultCellAttributes, emptyBufferCell } from '@tn3270/shared';
import { parseFieldAttribute } from '@tn3270/shared';
import { addressToRowCol, rowColToAddress } from '@tn3270/shared';

export class ScreenBuffer {
  readonly rows: number;
  readonly cols: number;
  readonly size: number;

  private cells: BufferCell[];
  private _cursorAddress = 0;
  private _currentAddress = 0; // write pointer used by parser
  private _dirty = new Set<number>();
  private _fullDirty = false;

  // Running SA (Set Attribute) state, reset by parser between write commands
  private _saColor = 0x00;
  private _saHighlight = 0x00;
  private _saCharset = 0x00;

  constructor(screenSize: ScreenSize) {
    this.rows = screenSize.rows;
    this.cols = screenSize.cols;
    this.size = this.rows * this.cols;
    this.cells = new Array(this.size);
    for (let i = 0; i < this.size; i++) {
      this.cells[i] = emptyBufferCell();
    }
  }

  // --- Address management ---

  get cursorAddress(): number {
    return this._cursorAddress;
  }

  set cursorAddress(addr: number) {
    const old = this._cursorAddress;
    this._cursorAddress = this.wrapAddress(addr);
    this._dirty.add(old);
    this._dirty.add(this._cursorAddress);
  }

  get currentAddress(): number {
    return this._currentAddress;
  }

  set currentAddress(addr: number) {
    this._currentAddress = this.wrapAddress(addr);
  }

  /** Advance the write pointer by 1, wrapping at buffer end */
  advanceAddress(): void {
    this._currentAddress = (this._currentAddress + 1) % this.size;
  }

  /** Wrap an address to be within buffer bounds */
  wrapAddress(addr: number): number {
    return ((addr % this.size) + this.size) % this.size;
  }

  toRowCol(addr: number): { row: number; col: number } {
    return addressToRowCol(addr, this.cols);
  }

  toAddress(row: number, col: number): number {
    return rowColToAddress(row, col, this.cols);
  }

  // --- Cell operations ---

  getCell(addr: number): BufferCell {
    return this.cells[this.wrapAddress(addr)];
  }

  /** Write a character at the given address */
  setChar(addr: number, char: number): void {
    const wrapped = this.wrapAddress(addr);
    const cell = this.cells[wrapped];
    cell.char = char;
    cell.isFieldAttribute = false;
    // Apply running SA overrides
    cell.extended.color = this._saColor;
    cell.extended.highlight = this._saHighlight;
    cell.extended.charset = this._saCharset;
    this._dirty.add(wrapped);
  }

  /** Write a character at the current address and advance */
  writeChar(char: number): void {
    this.setChar(this._currentAddress, char);
    this.advanceAddress();
  }

  /** Place a field attribute (SF) at the given address */
  setFieldAttribute(addr: number, attrByte: number): void {
    const wrapped = this.wrapAddress(addr);
    const cell = this.cells[wrapped];
    cell.isFieldAttribute = true;
    cell.fieldAttrByte = attrByte;
    cell.char = 0x00; // FA positions display as blank
    // Parse the basic attributes into the cell
    const parsed = parseFieldAttribute(attrByte);
    cell.extended = {
      ...parsed,
      color: this._saColor,
      highlight: this._saHighlight,
      charset: this._saCharset,
      outlining: 0x00,
    };
    this._dirty.add(wrapped);
  }

  /** Place a field attribute with extended attributes (SFE) at the given address */
  setFieldAttributeExtended(addr: number, attrByte: number, extended: Partial<CellAttributes>): void {
    const wrapped = this.wrapAddress(addr);
    const cell = this.cells[wrapped];
    cell.isFieldAttribute = true;
    cell.fieldAttrByte = attrByte;
    cell.char = 0x00;
    const parsed = parseFieldAttribute(attrByte);
    cell.extended = {
      ...parsed,
      color: extended.color ?? 0x00,
      highlight: extended.highlight ?? 0x00,
      charset: extended.charset ?? 0x00,
      outlining: extended.outlining ?? 0x00,
    };
    this._dirty.add(wrapped);
  }

  // --- SA (Set Attribute) state ---

  setSAColor(color: number): void {
    this._saColor = color;
  }

  setSAHighlight(highlight: number): void {
    this._saHighlight = highlight;
  }

  setSACharset(charset: number): void {
    this._saCharset = charset;
  }

  resetSA(): void {
    this._saColor = 0x00;
    this._saHighlight = 0x00;
    this._saCharset = 0x00;
  }

  // --- Field scanning ---

  /**
   * Find the field attribute (SF) that governs the given address.
   * Scans backwards from addr, wrapping around the buffer.
   * Returns -1 if no field attributes exist (unformatted screen).
   */
  findFieldStart(addr: number): number {
    const start = this.wrapAddress(addr);
    let pos = start;
    for (let i = 0; i < this.size; i++) {
      if (this.cells[pos].isFieldAttribute) {
        return pos;
      }
      pos = (pos - 1 + this.size) % this.size;
    }
    return -1; // unformatted screen
  }

  /**
   * Find the next field attribute after the given address.
   * Returns -1 if none found.
   */
  findNextField(addr: number): number {
    let pos = (this.wrapAddress(addr) + 1) % this.size;
    for (let i = 0; i < this.size; i++) {
      if (this.cells[pos].isFieldAttribute) {
        return pos;
      }
      pos = (pos + 1) % this.size;
    }
    return -1;
  }

  /**
   * Find the next unprotected field after the given address.
   * Returns -1 if none found.
   */
  findNextUnprotectedField(addr: number): number {
    const startField = this.findNextField(addr);
    if (startField === -1) return -1;

    let pos = startField;
    for (let i = 0; i < this.size; i++) {
      if (this.cells[pos].isFieldAttribute && !this.cells[pos].extended.protected) {
        return pos;
      }
      pos = this.findNextField(pos);
      if (pos === -1 || pos === startField) break;
    }
    return -1;
  }

  /**
   * Get the effective attributes for a cell at the given address.
   * This finds the governing field and returns its attributes,
   * with any SA overrides that were applied to the specific cell.
   */
  getEffectiveAttributes(addr: number): CellAttributes {
    const wrapped = this.wrapAddress(addr);
    const cell = this.cells[wrapped];

    // If this cell IS a field attribute, return its own attributes
    if (cell.isFieldAttribute) {
      return { ...cell.extended };
    }

    // Find the governing field
    const fieldAddr = this.findFieldStart(wrapped);
    if (fieldAddr === -1) {
      // Unformatted screen — return cell's own attributes or defaults
      return cell.extended.color !== 0x00 || cell.extended.highlight !== 0x00
        ? { ...cell.extended }
        : defaultCellAttributes();
    }

    const fieldCell = this.cells[fieldAddr];
    // Merge: field attributes are the base, cell SA overrides take priority if non-default
    return {
      protected: fieldCell.extended.protected,
      numeric: fieldCell.extended.numeric,
      display: fieldCell.extended.display,
      mdt: fieldCell.extended.mdt,
      color: cell.extended.color !== 0x00 ? cell.extended.color : fieldCell.extended.color,
      highlight: cell.extended.highlight !== 0x00 ? cell.extended.highlight : fieldCell.extended.highlight,
      charset: cell.extended.charset !== 0x00 ? cell.extended.charset : fieldCell.extended.charset,
      outlining: fieldCell.extended.outlining,
    };
  }

  /**
   * Check if the given address is in a protected field.
   */
  isProtected(addr: number): boolean {
    const fieldAddr = this.findFieldStart(addr);
    if (fieldAddr === -1) return false; // unformatted = unprotected
    return this.cells[fieldAddr].extended.protected;
  }

  /**
   * Check if the given address is in a numeric-only field.
   */
  isNumeric(addr: number): boolean {
    const fieldAddr = this.findFieldStart(addr);
    if (fieldAddr === -1) return false;
    return this.cells[fieldAddr].extended.numeric;
  }

  /**
   * Set the MDT flag on the field containing the given address.
   */
  setMDT(addr: number): void {
    const fieldAddr = this.findFieldStart(addr);
    if (fieldAddr === -1) return;
    this.cells[fieldAddr].extended.mdt = true;
    this.cells[fieldAddr].fieldAttrByte |= 0x01; // MDT is bit 7
  }

  /**
   * Reset all MDT flags in the buffer.
   */
  resetAllMDT(): void {
    for (let i = 0; i < this.size; i++) {
      if (this.cells[i].isFieldAttribute) {
        this.cells[i].extended.mdt = false;
        this.cells[i].fieldAttrByte &= ~0x01;
      }
    }
  }

  // --- Field data extraction (for Read Modified responses) ---

  /**
   * Get the data content of a field (positions from fieldAddr+1 to next SF).
   * Returns EBCDIC character codes.
   */
  getFieldData(fieldAddr: number): Uint8Array {
    const data: number[] = [];
    let pos = (fieldAddr + 1) % this.size;
    for (let i = 0; i < this.size; i++) {
      if (this.cells[pos].isFieldAttribute) break;
      data.push(this.cells[pos].char);
      pos = (pos + 1) % this.size;
    }
    return new Uint8Array(data);
  }

  /**
   * Get all modified fields (MDT set, unprotected) for Read Modified response.
   * Returns field addresses and their data.
   */
  getModifiedFields(): ModifiedField[] {
    const fields: ModifiedField[] = [];
    for (let i = 0; i < this.size; i++) {
      const cell = this.cells[i];
      if (cell.isFieldAttribute && cell.extended.mdt && !cell.extended.protected) {
        fields.push({
          address: i,
          data: this.getFieldData(i),
        });
      }
    }
    return fields;
  }

  /**
   * Get ALL fields for Read Modified All response.
   */
  getAllFields(): FieldDescriptor[] {
    const fields: FieldDescriptor[] = [];
    for (let i = 0; i < this.size; i++) {
      const cell = this.cells[i];
      if (cell.isFieldAttribute) {
        const startAddr = (i + 1) % this.size;
        const nextField = this.findNextField(i);
        const length = nextField === -1 ? 0 :
          nextField > i ? nextField - i - 1 :
          (this.size - i - 1) + nextField;
        fields.push({
          attributeAddress: i,
          startAddress: startAddr,
          length,
          attrs: { ...cell.extended },
        });
      }
    }
    return fields;
  }

  // --- Bulk operations ---

  /** Clear entire buffer */
  clear(): void {
    for (let i = 0; i < this.size; i++) {
      this.cells[i] = emptyBufferCell();
    }
    this._currentAddress = 0;
    this._cursorAddress = 0;
    this.resetSA();
    this._fullDirty = true;
  }

  /** Clear all unprotected fields (Erase All Unprotected) */
  clearUnprotected(): void {
    for (let i = 0; i < this.size; i++) {
      const cell = this.cells[i];
      if (cell.isFieldAttribute) {
        if (!cell.extended.protected) {
          cell.extended.mdt = false;
          cell.fieldAttrByte &= ~0x01;
        }
        continue;
      }
      const fieldAddr = this.findFieldStart(i);
      if (fieldAddr === -1 || !this.cells[fieldAddr].extended.protected) {
        cell.char = 0x00;
        this._dirty.add(i);
      }
    }
    // Position cursor at first unprotected field
    const firstUnprot = this.findNextUnprotectedField(0);
    if (firstUnprot !== -1) {
      this._cursorAddress = (firstUnprot + 1) % this.size;
    } else {
      this._cursorAddress = 0;
    }
    this._dirty.add(this._cursorAddress);
  }

  /**
   * Erase unprotected positions from current address to target address.
   */
  eraseUnprotectedToAddress(toAddr: number): void {
    const target = this.wrapAddress(toAddr);
    let pos = this._currentAddress;

    while (pos !== target) {
      const cell = this.cells[pos];
      if (!cell.isFieldAttribute) {
        const fieldAddr = this.findFieldStart(pos);
        if (fieldAddr === -1 || !this.cells[fieldAddr].extended.protected) {
          cell.char = 0x00;
          this._dirty.add(pos);
        }
      }
      pos = (pos + 1) % this.size;
    }
    this._currentAddress = target;
  }

  /**
   * Repeat a character from current address to target address.
   */
  repeatToAddress(toAddr: number, char: number): void {
    const target = this.wrapAddress(toAddr);
    let pos = this._currentAddress;

    while (pos !== target) {
      const cell = this.cells[pos];
      if (!cell.isFieldAttribute) {
        cell.char = char;
        cell.extended.color = this._saColor;
        cell.extended.highlight = this._saHighlight;
        cell.extended.charset = this._saCharset;
        this._dirty.add(pos);
      }
      pos = (pos + 1) % this.size;
    }
    this._currentAddress = target;
  }

  // --- Dirty tracking ---

  get dirtyAddresses(): ReadonlySet<number> {
    return this._dirty;
  }

  get isFullDirty(): boolean {
    return this._fullDirty;
  }

  markFullDirty(): void {
    this._fullDirty = true;
  }

  clearDirty(): void {
    this._dirty.clear();
    this._fullDirty = false;
  }

  // --- Keyboard input helpers ---

  /**
   * Type a character at the cursor position in an unprotected field.
   * Returns true if the character was accepted, false if rejected.
   */
  typeChar(char: number, insertMode: boolean): boolean {
    // Check if cursor is in a protected field
    if (this.isProtected(this._cursorAddress)) return false;

    // Check if cursor is on a field attribute
    if (this.cells[this._cursorAddress].isFieldAttribute) return false;

    if (insertMode) {
      // Shift characters right within the field
      if (!this.insertShiftRight(this._cursorAddress)) return false;
    }

    this.cells[this._cursorAddress].char = char;
    this._dirty.add(this._cursorAddress);
    this.setMDT(this._cursorAddress);

    // Advance cursor
    const nextPos = (this._cursorAddress + 1) % this.size;
    if (this.cells[nextPos].isFieldAttribute) {
      // End of field — move to next unprotected field
      const nextField = this.findNextUnprotectedField(nextPos);
      if (nextField !== -1) {
        this.cursorAddress = (nextField + 1) % this.size;
      }
    } else {
      this.cursorAddress = nextPos;
    }
    return true;
  }

  /**
   * Shift characters right by 1 within the current field (for insert mode).
   * Returns false if the field is full (last character is not null/space).
   */
  private insertShiftRight(addr: number): boolean {
    // Find end of field
    let endPos = addr;
    let pos = (addr + 1) % this.size;
    while (!this.cells[pos].isFieldAttribute && pos !== addr) {
      endPos = pos;
      pos = (pos + 1) % this.size;
    }

    // Check if last position is empty
    const lastChar = this.cells[endPos].char;
    if (lastChar !== 0x00 && lastChar !== 0x40) { // not null or space
      return false; // field overflow
    }

    // Shift right
    let src = (endPos - 1 + this.size) % this.size;
    let dst = endPos;
    while (dst !== addr) {
      this.cells[dst].char = this.cells[src].char;
      this._dirty.add(dst);
      dst = src;
      src = (src - 1 + this.size) % this.size;
    }
    return true;
  }

  /**
   * Delete character at cursor, shifting field contents left.
   */
  deleteChar(): boolean {
    if (this.isProtected(this._cursorAddress)) return false;
    if (this.cells[this._cursorAddress].isFieldAttribute) return false;

    let pos = this._cursorAddress;
    let next = (pos + 1) % this.size;
    while (!this.cells[next].isFieldAttribute) {
      this.cells[pos].char = this.cells[next].char;
      this._dirty.add(pos);
      pos = next;
      next = (next + 1) % this.size;
    }
    this.cells[pos].char = 0x00;
    this._dirty.add(pos);
    this.setMDT(this._cursorAddress);
    return true;
  }

  /**
   * Erase from cursor to end of field.
   */
  eraseEOF(): boolean {
    if (this.isProtected(this._cursorAddress)) return false;
    if (this.cells[this._cursorAddress].isFieldAttribute) return false;

    let pos = this._cursorAddress;
    while (!this.cells[pos].isFieldAttribute) {
      this.cells[pos].char = 0x00;
      this._dirty.add(pos);
      pos = (pos + 1) % this.size;
    }
    this.setMDT(this._cursorAddress);
    return true;
  }

  /**
   * Move cursor to the first position of the next unprotected field.
   */
  tabForward(): void {
    const nextField = this.findNextUnprotectedField(this._cursorAddress);
    if (nextField !== -1) {
      this.cursorAddress = (nextField + 1) % this.size;
    }
  }

  /**
   * Move cursor to the first position of the previous unprotected field.
   */
  tabBackward(): void {
    // Scan backwards for an unprotected field
    let pos = (this._cursorAddress - 1 + this.size) % this.size;
    for (let i = 0; i < this.size; i++) {
      if (this.cells[pos].isFieldAttribute && !this.cells[pos].extended.protected) {
        this.cursorAddress = (pos + 1) % this.size;
        return;
      }
      pos = (pos - 1 + this.size) % this.size;
    }
  }

  /**
   * Move cursor to row 0, col 0.
   */
  home(): void {
    const firstField = this.findNextUnprotectedField(this.size - 1);
    if (firstField !== -1) {
      this.cursorAddress = (firstField + 1) % this.size;
    } else {
      this.cursorAddress = 0;
    }
  }
}
