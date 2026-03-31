/**
 * Demo ISPF Edit Panel — shows a sample JCL listing
 */

import { DataStreamBuilder, Color3270, Highlight3270 } from '@tn3270/shared';

export function buildIspfEditScreen(userid: string): Uint8Array {
  const b = new DataStreamBuilder();
  const user = userid.toUpperCase().padEnd(8).substring(0, 8);

  b.eraseWrite()
    .wcc({ keyboardRestore: true, resetMDT: true });

  // Header
  b.sba(0, 1)
    .sfe({ protected: true, color: Color3270.GREEN })
    .text('EDIT');

  b.sba(0, 8)
    .sfe({ protected: true, color: Color3270.TURQUOISE })
    .text(`${user}.DEMO.JCL(SAMPLE)`);

  b.sba(0, 50)
    .sfe({ protected: true, color: Color3270.GREEN })
    .text('Columns 00001 00072');

  // Command line
  b.sba(1, 0)
    .sfe({ protected: true, color: Color3270.GREEN })
    .text('Command ===>');

  b.sba(1, 13)
    .sfe({ protected: false, color: Color3270.TURQUOISE });

  b.text('                                                 ');

  b.sba(1, 63)
    .sf({ protected: true });

  b.sba(1, 64)
    .sfe({ protected: true, color: Color3270.GREEN })
    .text('Scroll ===> CSR');

  // Ruler line
  b.sba(2, 0)
    .sfe({ protected: true, color: Color3270.BLUE })
    .text('****** ***************************** Top of Data ******************************');

  // JCL content lines
  const jclLines = [
    '//SAMPLE   JOB (ACCT),\'DEMO JOB\',',
    '//         CLASS=A,MSGCLASS=H,',
    '//         MSGLEVEL=(1,1),NOTIFY=&SYSUID',
    '//*',
    '//* SAMPLE JCL FOR DEMO',
    '//*',
    '//STEP1    EXEC PGM=IEBGENER',
    '//SYSPRINT DD SYSOUT=*',
    '//SYSUT1   DD DSN=SYS1.PARMLIB(IEASYS00),',
    '//            DISP=SHR',
    '//SYSUT2   DD SYSOUT=*',
    '//SYSIN    DD DUMMY',
    '//*',
    '//STEP2    EXEC PGM=IEFBR14',
    '//NEWDS    DD DSN=&SYSUID..DEMO.OUTPUT,',
    '//            DISP=(NEW,CATLG,DELETE),',
    '//            SPACE=(TRK,(5,5)),',
    '//            DCB=(RECFM=FB,LRECL=80,BLKSIZE=0)',
    '//*',
  ];

  let row = 3;
  for (let i = 0; i < jclLines.length && row < 22; i++) {
    // Line number (prefix area — unprotected for line commands)
    const lineNum = String(i + 1).padStart(6, '0');

    b.sba(row, 0)
      .sfe({ protected: false, color: Color3270.GREEN });
    b.text(lineNum);

    b.sba(row, 6)
      .sf({ protected: true });

    // Line content
    b.sba(row, 7)
      .sfe({ protected: true, color: Color3270.TURQUOISE });
    b.text(jclLines[i].padEnd(72));

    row++;
  }

  // Bottom of data
  b.sba(row, 0)
    .sfe({ protected: true, color: Color3270.BLUE })
    .text('****** **************************** Bottom of Data ****************************');

  // PF key bar
  b.sba(22, 0)
    .sfe({ protected: true, color: Color3270.BLUE })
    .text('F1=Help   F2=Split  F3=Exit   F5=Rfind  F6=Rchange F7=Up');

  b.sba(23, 0)
    .sfe({ protected: true, color: Color3270.BLUE })
    .text('F8=Down   F10=Left  F11=Right F12=Cancel');

  // Cursor
  b.insertCursor(1, 14);

  return b.build();
}
