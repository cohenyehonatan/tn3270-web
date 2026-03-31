/**
 * Demo CICS Sign-on Screen
 */

import { DataStreamBuilder, Color3270, Highlight3270 } from '@tn3270/shared';

export function buildCicsSignonScreen(): Uint8Array {
  const b = new DataStreamBuilder();

  b.eraseWrite()
    .wcc({ keyboardRestore: true, resetMDT: true });

  // CICS header
  b.sba(0, 0)
    .sfe({ protected: true, color: Color3270.BLUE })
    .repeatToAddress(0, 80, 0x60);

  b.sba(1, 25)
    .sfe({ protected: true, color: Color3270.WHITE, highlight: Highlight3270.REVERSE })
    .text('   CICS DEMO REGION   ');

  b.sba(3, 20)
    .sfe({ protected: true, color: Color3270.TURQUOISE })
    .text('CICS Transaction Server V5.6');

  b.sba(4, 20)
    .sfe({ protected: true, color: Color3270.GREEN })
    .text('Applid: CICSDEMO   Sysid: CD01');

  // Sign-on form
  b.sba(7, 15)
    .sfe({ protected: true, color: Color3270.GREEN })
    .text('Sign on to CICS');

  b.sba(9, 15)
    .sfe({ protected: true, color: Color3270.GREEN })
    .text('Type your userid and password, then press ENTER.');

  b.sba(11, 15)
    .sfe({ protected: true, color: Color3270.GREEN })
    .text('Userid    :');

  b.sba(11, 27)
    .sfe({ protected: false, color: Color3270.TURQUOISE });
  b.text('        ');
  b.sba(11, 36)
    .sf({ protected: true });

  b.sba(13, 15)
    .sfe({ protected: true, color: Color3270.GREEN })
    .text('Password  :');

  b.sba(13, 27)
    .sfe({ protected: false, display: 'hidden', color: Color3270.GREEN });
  b.text('        ');
  b.sba(13, 36)
    .sf({ protected: true });

  b.sba(15, 15)
    .sfe({ protected: true, color: Color3270.GREEN })
    .text('Language  :');

  b.sba(15, 27)
    .sfe({ protected: false, color: Color3270.TURQUOISE });
  b.text('E       ');
  b.sba(15, 36)
    .sf({ protected: true });

  b.sba(15, 38)
    .sfe({ protected: true, color: Color3270.TURQUOISE })
    .text('(E=English)');

  b.sba(17, 15)
    .sfe({ protected: true, color: Color3270.GREEN })
    .text('New Password :');

  b.sba(17, 30)
    .sfe({ protected: false, display: 'hidden', color: Color3270.GREEN });
  b.text('        ');
  b.sba(17, 39)
    .sf({ protected: true });

  // Status area
  b.sba(20, 15)
    .sfe({ protected: true, color: Color3270.YELLOW })
    .text('DFHCE3549 Sign-on is complete.');

  // Bottom
  b.sba(23, 0)
    .sfe({ protected: true, color: Color3270.BLUE })
    .text('PF3=Logoff');

  // Cursor
  b.insertCursor(11, 28);

  return b.build();
}

export function buildCicsMenuScreen(userid: string): Uint8Array {
  const b = new DataStreamBuilder();
  const user = userid.toUpperCase().padEnd(8).substring(0, 8);

  b.eraseWrite()
    .wcc({ keyboardRestore: true, resetMDT: true });

  b.sba(0, 0)
    .sfe({ protected: true, color: Color3270.WHITE, highlight: Highlight3270.REVERSE })
    .text(` CICS DEMO REGION                                       ${user}  CD01 `);

  b.sba(2, 5)
    .sfe({ protected: true, color: Color3270.TURQUOISE })
    .text('Enter Transaction:');

  b.sba(2, 24)
    .sfe({ protected: false, color: Color3270.GREEN });
  b.text('    ');
  b.sba(2, 29)
    .sf({ protected: true });

  b.sba(4, 5)
    .sfe({ protected: true, color: Color3270.GREEN })
    .text('Available Transactions:');

  const transactions = [
    ['CEDA', 'Resource Definition'],
    ['CEMT', 'Master Terminal'],
    ['CEDF', 'Execution Diagnostic Facility'],
    ['CEBR', 'Temporary Storage Browse'],
    ['CESN', 'Sign On'],
    ['CESF', 'Sign Off'],
    ['CECI', 'Command-level Interpreter'],
    ['CMAC', 'Messages About Codes'],
  ];

  let row = 6;
  for (const [txn, desc] of transactions) {
    b.sba(row, 8)
      .sfe({ protected: true, color: Color3270.WHITE })
      .text(txn);

    b.sba(row, 14)
      .sfe({ protected: true, color: Color3270.TURQUOISE })
      .text(`- ${desc}`);

    row++;
  }

  b.sba(16, 5)
    .sfe({ protected: true, color: Color3270.YELLOW })
    .text('This is a demo. Transactions are simulated.');

  b.sba(23, 0)
    .sfe({ protected: true, color: Color3270.BLUE })
    .text('PF3=Sign Off');

  b.insertCursor(2, 25);

  return b.build();
}
