/**
 * 3270 Query Reply builder.
 *
 * A host (e.g. TSO full-screen logon) issues Write Structured Field →
 * Read Partition (Query); the terminal must answer with an inbound
 * structured-field record (AID 0x88) carrying Query Reply structured
 * fields that describe its capabilities. Without this, the host stalls
 * before painting its first formatted panel (the password prompt).
 *
 * We send a minimal-but-sufficient reply for a 24×80 (model-2) screen:
 * Summary, Usable Area, Reply Modes, and Implicit Partitions. Lengths
 * are computed from the body so they can never drift.
 */

import { AID } from '@tn3270/shared';

/** One Query Reply structured field: [len-hi][len-lo] 0x81 <qcode> <data...> */
function qr(qcode: number, data: number[]): number[] {
  const body = [0x81, qcode, ...data];
  const len = body.length + 2; // include the 2 length bytes
  return [(len >> 8) & 0xff, len & 0xff, ...body];
}

/**
 * Build the inbound Query Reply record for `rows`×`cols` (default 24×80).
 * Returned bytes are the raw 3270 inbound stream (AID + query replies);
 * the connection layer adds any TN3270E framing.
 */
export function buildQueryReply(rows = 24, cols = 80): Uint8Array {
  const w = [(cols >> 8) & 0xff, cols & 0xff];
  const h = [(rows >> 8) & 0xff, rows & 0xff];
  const bufsz = rows * cols;

  const summary = qr(0x80, [0x80, 0x81, 0x88, 0xa6]); // which QRs follow

  // Usable Area: flags, flags, W, H, units, Xr(4), Yr(4), AW, AH, BUFSZ
  const usableArea = qr(0x81, [
    0x01, 0x00,
    ...w, ...h,
    0x00, // units = inches
    0x00, 0x0a, 0x02, 0xe5, // Xr
    0x00, 0x02, 0x00, 0x6f, // Yr
    0x09, 0x0c, // AW, AH
    (bufsz >> 8) & 0xff, bufsz & 0xff,
  ]);

  // Reply Modes: field (00), extended field (01), character (02)
  const replyModes = qr(0x88, [0x00, 0x01, 0x02]);

  // Implicit Partition: flags(2), SDP len(0x0b), SDP id(01), reserved(00),
  // default W,H and alternate W,H
  const implicitPartition = qr(0xa6, [
    0x00, 0x00, 0x0b, 0x01, 0x00,
    ...w, ...h,
    ...w, ...h,
  ]);

  return new Uint8Array([
    AID.SF_AID,
    ...summary,
    ...usableArea,
    ...replyModes,
    ...implicitPartition,
  ]);
}

/**
 * Given the body of a Write Structured Field command (bytes after the 0xF3
 * command byte), return true if it contains a Read Partition (0x01) request
 * of type Query (0x02) or Query List (0x03).
 */
export function isReadPartitionQuery(sfData: Uint8Array): boolean {
  let pos = 0;
  while (pos + 2 <= sfData.length) {
    const sfLen = (sfData[pos] << 8) | sfData[pos + 1];
    if (sfLen < 3) break; // malformed / end
    const sfid = sfData[pos + 2];
    if (sfid === 0x01) {
      // Read Partition: [len][len][01][PID][type]
      const type = sfData[pos + 4];
      if (type === 0x02 || type === 0x03) return true;
    }
    pos += sfLen;
  }
  return false;
}
