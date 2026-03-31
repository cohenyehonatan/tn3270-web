/**
 * Demo ISPF 3.4 — Data Set List Utility
 */

import { DataStreamBuilder, Color3270, Highlight3270 } from '@tn3270/shared';

export function buildIspfDslistScreen(userid: string): Uint8Array {
  const b = new DataStreamBuilder();
  const user = userid.toUpperCase().padEnd(8).substring(0, 8).trim();

  b.eraseWrite()
    .wcc({ keyboardRestore: true, resetMDT: true });

  // Header
  b.sba(0, 1)
    .sfe({ protected: true, color: Color3270.GREEN })
    .text('Menu  RefList  RefMode  Utilities  Help');

  b.sba(1, 0)
    .sfe({ protected: true, color: Color3270.BLUE })
    .repeatToAddress(1, 80, 0x60);

  b.sba(1, 25)
    .sfe({ protected: true, color: Color3270.WHITE, highlight: Highlight3270.REVERSE })
    .text(' DSLIST - Data Sets Matching ');

  b.sba(1, 54)
    .sfe({ protected: true, color: Color3270.TURQUOISE })
    .text(`${user}.*`);

  // Command line
  b.sba(2, 0)
    .sfe({ protected: true, color: Color3270.GREEN })
    .text('Command ===>');

  b.sba(2, 13)
    .sfe({ protected: false, color: Color3270.TURQUOISE });
  b.text('                                                    ');
  b.sba(2, 65)
    .sf({ protected: true });

  b.sba(2, 66)
    .sfe({ protected: true, color: Color3270.GREEN })
    .text('Scroll ===> CSR');

  // Column headers
  b.sba(3, 0)
    .sfe({ protected: true, color: Color3270.WHITE })
    .text('Command  Name                                     Tracks %Used XT  Device');

  b.sba(4, 0)
    .sfe({ protected: true, color: Color3270.BLUE })
    .repeatToAddress(4, 80, 0x60);

  // Dataset entries
  const datasets = [
    { name: `${user}.CLIST`, tracks: 15, used: 80, xt: 1, vol: '3390' },
    { name: `${user}.DEMO.JCL`, tracks: 5, used: 40, xt: 1, vol: '3390' },
    { name: `${user}.DEMO.OUTPUT`, tracks: 10, used: 0, xt: 1, vol: '3390' },
    { name: `${user}.ISPF.ISPPROF`, tracks: 3, used: 100, xt: 1, vol: '3390' },
    { name: `${user}.LOAD`, tracks: 50, used: 62, xt: 3, vol: '3390' },
    { name: `${user}.REXX.EXEC`, tracks: 10, used: 33, xt: 1, vol: '3390' },
    { name: `${user}.SOURCE.COBOL`, tracks: 30, used: 55, xt: 2, vol: '3390' },
    { name: `${user}.SOURCE.COPYLIB`, tracks: 15, used: 27, xt: 1, vol: '3390' },
    { name: `${user}.SOURCE.PLI`, tracks: 20, used: 45, xt: 1, vol: '3390' },
    { name: `${user}.SPFLOG1.LIST`, tracks: 45, used: 90, xt: 5, vol: '3390' },
    { name: `${user}.SYSTSPRT`, tracks: 2, used: 50, xt: 1, vol: '3390' },
    { name: `${user}.TEST.DATA`, tracks: 8, used: 12, xt: 1, vol: '3390' },
  ];

  let row = 5;
  for (const ds of datasets) {
    if (row >= 21) break;

    // Command prefix (unprotected, 8 chars)
    b.sba(row, 0)
      .sfe({ protected: false, color: Color3270.TURQUOISE });
    b.text('        ');
    b.sba(row, 8)
      .sf({ protected: true });

    // Dataset name
    b.sba(row, 9)
      .sfe({ protected: true, color: Color3270.GREEN })
      .text(ds.name.padEnd(44));

    // Tracks
    b.sfe({ protected: true, color: Color3270.TURQUOISE })
      .text(String(ds.tracks).padStart(6));

    // %Used
    b.text(String(ds.used).padStart(5));

    // Extents
    b.text(String(ds.xt).padStart(4));

    // Device
    b.text(`  ${ds.vol}`);

    row++;
  }

  // Bottom indicator
  b.sba(21, 0)
    .sfe({ protected: true, color: Color3270.BLUE })
    .text('***************************** End of Data Set list *****************************');

  // PF keys
  b.sba(22, 0)
    .sfe({ protected: true, color: Color3270.BLUE })
    .text('F1=Help   F2=Split  F3=Exit   F5=Rfind  F7=Up     F8=Down');

  b.sba(23, 0)
    .sfe({ protected: true, color: Color3270.BLUE })
    .text('F9=Swap   F10=Left  F11=Right F12=Cancel');

  // Cursor
  b.insertCursor(2, 14);

  return b.build();
}
