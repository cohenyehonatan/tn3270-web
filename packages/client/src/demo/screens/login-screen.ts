/**
 * Demo TSO Login Screen
 */

import { DataStreamBuilder, Color3270, Highlight3270 } from '@tn3270/shared';

export function buildLoginScreen(): Uint8Array {
  const b = new DataStreamBuilder();

  b.eraseWrite()
    .wcc({ keyboardRestore: true, resetMDT: true });

  // Top border
  b.sba(0, 0)
    .sfe({ protected: true, color: Color3270.BLUE })
    .repeatToAddress(0, 80, 0x60); // line of dashes

  // Title
  b.sba(1, 26)
    .sfe({ protected: true, color: Color3270.WHITE, highlight: Highlight3270.REVERSE })
    .text('  z/OS DEMO SYSTEM (TN3270)  ');

  // Subtitle
  b.sba(3, 22)
    .sfe({ protected: true, color: Color3270.TURQUOISE })
    .text('Welcome to the 3270 Web Emulator Demo');

  // System info
  b.sba(5, 15)
    .sfe({ protected: true, color: Color3270.GREEN })
    .text('System:   DEMO.MAINFRAME.LOCAL');

  b.sba(6, 15)
    .sfe({ protected: true, color: Color3270.GREEN })
    .text('VTAM:     DEMO3270');

  // Username
  b.sba(9, 15)
    .sfe({ protected: true, color: Color3270.GREEN })
    .text('Userid   ===>');

  b.sba(9, 30)
    .sfe({ protected: false, color: Color3270.TURQUOISE });

  // 8-char input field padded with spaces
  b.text('        ');

  // Field stopper
  b.sba(9, 39)
    .sf({ protected: true });

  // Password
  b.sba(11, 15)
    .sfe({ protected: true, color: Color3270.GREEN })
    .text('Password ===>');

  b.sba(11, 30)
    .sfe({ protected: false, display: 'hidden', color: Color3270.GREEN });

  b.text('        ');

  b.sba(11, 39)
    .sf({ protected: true });

  // Procedure
  b.sba(13, 15)
    .sfe({ protected: true, color: Color3270.GREEN })
    .text('Procedure ===>');

  b.sba(13, 31)
    .sfe({ protected: false, color: Color3270.TURQUOISE });

  b.text('ISPFPROC');

  b.sba(13, 40)
    .sf({ protected: true });

  // Instructions
  b.sba(16, 15)
    .sfe({ protected: true, color: Color3270.YELLOW })
    .text('Enter USERID and PASSWORD, then press ENTER');

  // Bottom info
  b.sba(20, 15)
    .sfe({ protected: true, color: Color3270.BLUE })
    .text('This is a demo system. Any userid/password is accepted.');

  // PF key bar
  b.sba(23, 0)
    .sfe({ protected: true, color: Color3270.BLUE })
    .text('PF3=Logoff                                                         PF1=Help');

  // Cursor in userid field
  b.insertCursor(9, 31);

  return b.build();
}
