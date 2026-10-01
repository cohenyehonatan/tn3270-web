/**
 * 3270 Query Reply builder.
 *
 * A host (e.g. TSO full-screen logon, and KICKS/CICS BMS) issues Write
 * Structured Field -> Read Partition (Query); the terminal must answer with an
 * inbound structured-field record (AID 0x88) carrying Query Reply structured
 * fields that describe its capabilities. The host stores these in its terminal
 * table and uses them to decide how to format screens.
 *
 * A *minimal* reply (Summary + Usable Area + Reply Modes + Implicit Partition)
 * is enough to get past TSO logon, but NOT enough for KICKS BMS: when an
 * application transaction does SEND MAP, KICKS resolves the mapset/device
 * variant from the reported capabilities, and an under-specified terminal makes
 * that resolution fail -> the transaction abends APCT ("program/map not
 * loadable"). The cure is to report a full, conventional capability set.
 *
 * These bytes are the exact Query Reply that x3270/s3270 sends for a model-2
 * (24x80) 3279 — captured from an s3270 `-trace` against the same host, which
 * drives this app correctly. Advertising the same ten replies (Summary, Usable
 * Area, Alphanumeric Partitions, Character Sets, Color, Highlighting, Reply
 * Modes, DDM, RPQ Names, Implicit Partition) makes KICKS treat the browser
 * terminal identically to s3270, so BMS maps load and SEND MAP works.
 */

import { AID } from '@tn3270/shared';

// AID 0x88 + the ten Query Reply structured fields, for a 24x80 model-2 3279.
const MODEL2_QUERY_REPLY: number[] = [
  0x88,
  // Summary: which query replies follow
  0x00, 0x0e, 0x81, 0x80, 0x80, 0x81, 0x84, 0x85, 0x86, 0x87, 0x88, 0x95, 0xa1, 0xa6,
  // Usable Area: 80x24, cell geometry, buffer size 0x0780
  0x00, 0x17, 0x81, 0x81, 0x01, 0x00, 0x00, 0x50, 0x00, 0x18, 0x01, 0x00, 0x0a, 0x02, 0xe5,
  0x00, 0x02, 0x00, 0x6f, 0x09, 0x0c, 0x07, 0x80,
  // Alphanumeric Partitions
  0x00, 0x08, 0x81, 0x84, 0x00, 0x07, 0x80, 0x00,
  // Character Sets
  0x00, 0x1b, 0x81, 0x85, 0x82, 0x00, 0x09, 0x0c, 0x00, 0x00, 0x00, 0x00, 0x07, 0x00, 0x10,
  0x00, 0x02, 0xb9, 0x00, 0x25, 0x01, 0x00, 0xf1, 0x03, 0xc3, 0x01, 0x36,
  // Color (16 pairs)
  0x00, 0x26, 0x81, 0x86, 0x00, 0x10, 0x00, 0xf4, 0xf1, 0xf1, 0xf2, 0xf2, 0xf3, 0xf3, 0xf4,
  0xf4, 0xf5, 0xf5, 0xf6, 0xf6, 0xf7, 0xf7, 0xf8, 0xf8, 0xf9, 0xf9, 0xfa, 0xfa, 0xfb, 0xfb,
  0xfc, 0xfc, 0xfd, 0xfd, 0xfe, 0xfe, 0xff, 0xff, 0xff, 0xff,
  // Highlighting
  0x00, 0x0f, 0x81, 0x87, 0x05, 0x00, 0xf0, 0xf1, 0xf1, 0xf2, 0xf2, 0xf4, 0xf4, 0xf8, 0xf8,
  // Reply Modes: field / extended field / character
  0x00, 0x07, 0x81, 0x88, 0x00, 0x01, 0x02,
  // Distributed Data Management
  0x00, 0x0c, 0x81, 0x95, 0x00, 0x00, 0x40, 0x00, 0x40, 0x00, 0x01, 0x01,
  // RPQ Names
  0x00, 0x12, 0x81, 0xa1, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x06, 0xa7, 0xf3,
  0xf2, 0xf7, 0xf0,
  // Implicit Partition: default + alternate 80x24
  0x00, 0x11, 0x81, 0xa6, 0x00, 0x00, 0x0b, 0x01, 0x00, 0x00, 0x50, 0x00, 0x18, 0x00, 0x50,
  0x00, 0x18,
];

/**
 * Build the inbound Query Reply record. Returns the raw 3270 inbound stream
 * (AID + query replies); the connection layer adds any telnet framing.
 *
 * The reply is the conventional model-2 (24x80) capability set. The `rows`/
 * `cols` params are accepted for API symmetry; this app runs a fixed 24x80
 * 3279-2 screen, which is what the reply describes.
 */
export function buildQueryReply(_rows = 24, _cols = 80): Uint8Array {
  void AID; // AID.SF_AID (0x88) is the leading byte of MODEL2_QUERY_REPLY
  return new Uint8Array(MODEL2_QUERY_REPLY);
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
