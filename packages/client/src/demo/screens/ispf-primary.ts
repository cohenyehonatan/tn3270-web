/**
 * Demo ISPF Primary Option Menu
 */

import { DataStreamBuilder, Color3270, Highlight3270 } from '@tn3270/shared';

export function buildIspfPrimaryMenu(userid: string): Uint8Array {
  const b = new DataStreamBuilder();
  const user = userid.toUpperCase().padEnd(8).substring(0, 8);

  b.eraseWrite()
    .wcc({ keyboardRestore: true, resetMDT: true });

  // Title bar
  b.sba(0, 1)
    .sfe({ protected: true, color: Color3270.WHITE })
    .text('Menu');

  b.sba(0, 14)
    .sfe({ protected: true, color: Color3270.WHITE })
    .text('Utilities');

  b.sba(0, 30)
    .sfe({ protected: true, color: Color3270.WHITE })
    .text('Compilers');

  b.sba(0, 50)
    .sfe({ protected: true, color: Color3270.WHITE })
    .text('Help');

  // Separator
  b.sba(1, 0)
    .sfe({ protected: true, color: Color3270.BLUE })
    .repeatToAddress(1, 80, 0x60); // dashes

  // Panel title
  b.sba(1, 25)
    .sfe({ protected: true, color: Color3270.WHITE, highlight: Highlight3270.REVERSE })
    .text(' ISPF Primary Option Menu ');

  // Option input
  b.sba(2, 1)
    .sfe({ protected: true, color: Color3270.GREEN })
    .text('Option ===>');

  b.sba(2, 13)
    .sfe({ protected: false, color: Color3270.TURQUOISE });

  b.text('          ');

  b.sba(2, 24)
    .sf({ protected: true });

  // User ID on right
  b.sba(2, 62)
    .sfe({ protected: true, color: Color3270.GREEN })
    .text(`Userid - ${user}`);

  // Blank line
  // Options list
  const options = [
    ['0', 'Settings', 'Terminal and user parameters'],
    ['1', 'View', 'Display source data or listings'],
    ['2', 'Edit', 'Create or change source data'],
    ['3', 'Utilities', 'Perform utility functions'],
    ['4', 'Foreground', 'Interactive language processing'],
    ['5', 'Batch', 'Submit job for language processing'],
    ['6', 'Command', 'Enter TSO or Workstation commands'],
    ['7', 'Dialog Test', 'Perform dialog testing'],
    ['8', 'LM Utility', 'Library administrator utility'],
    ['9', 'IBM Products', 'IBM program development products'],
    ['10', 'SCLM', 'SW Configuration and Library Manager'],
    ['11', 'Workplace', 'ISPF Object/Action Workplace'],
  ];

  let row = 4;
  for (const [num, name, desc] of options) {
    b.sba(row, 4)
      .sfe({ protected: true, color: Color3270.WHITE })
      .text(num.padEnd(4));

    b.sfe({ protected: true, color: Color3270.TURQUOISE })
      .text(name.padEnd(14));

    b.sfe({ protected: true, color: Color3270.GREEN })
      .text(desc);

    row++;
  }

  // More options
  row += 1;
  b.sba(row, 4)
    .sfe({ protected: true, color: Color3270.GREEN })
    .text('Enter X to Terminate using log/list defaults');

  // PF key bar
  b.sba(22, 0)
    .sfe({ protected: true, color: Color3270.BLUE })
    .text('F1=Help   F2=Split  F3=Exit   F7=Backward  F8=Forward  F9=Swap');

  b.sba(23, 0)
    .sfe({ protected: true, color: Color3270.BLUE })
    .text('F10=Actions F12=Cancel');

  // Cursor
  b.insertCursor(2, 14);

  return b.build();
}
