import PdfPrinter = require('pdfmake/src/printer');
import type {
  Content,
  TDocumentDefinitions,
  TableCell,
} from 'pdfmake/interfaces';
import { amountInWords } from '../../../common/utils/amount-in-words.util';
import type { FeeReceiptData } from './fee-receipt.model';

/**
 * The 14 PDF standard fonts are built into the viewer, so nothing has to be
 * embedded and no .ttf ships with the server.
 *
 * The trade-off is WinAnsi encoding, which has no ₹ glyph — so amounts print
 * as bare figures, exactly as the school's own receipt does ("36700.00", and
 * the rupee named in words underneath).
 */
const printer = new PdfPrinter({
  Helvetica: {
    normal: 'Helvetica',
    bold: 'Helvetica-Bold',
    italics: 'Helvetica-Oblique',
    bolditalics: 'Helvetica-BoldOblique',
  },
});

const BORDER = '#000000';
/** Every table shares one hairline grid, as on the original. */
const GRID = {
  hLineWidth: () => 0.7,
  vLineWidth: () => 0.7,
  hLineColor: () => BORDER,
  vLineColor: () => BORDER,
  paddingTop: () => 3,
  paddingBottom: () => 3,
};

const money = (n: number) => n.toFixed(2);

function date(d: Date | null): string {
  if (!d) return '';
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  return `${dd}-${mm}-${d.getFullYear()}`;
}

function dateTime(d: Date): string {
  const months = [
    'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
    'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
  ];
  const hh = String(d.getHours()).padStart(2, '0');
  const mi = String(d.getMinutes()).padStart(2, '0');
  return `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()} ${hh}:${mi}`;
}

/** The school's letterhead. Missing lines are dropped, never left as labels. */
function header(data: FeeReceiptData): Content {
  const { school } = data;
  const lines: Content[] = [];

  if (school.trustName) {
    lines.push({ text: school.trustName, fontSize: 8.5, alignment: 'center' });
  }
  lines.push({
    text: school.name,
    fontSize: 16,
    bold: true,
    alignment: 'center',
    margin: [0, 1, 0, 2],
  });
  if (school.address) {
    lines.push({ text: school.address, fontSize: 8.5, alignment: 'center' });
  }

  const contact = [
    school.contactPhone ? `Contact No : ${school.contactPhone}` : null,
    school.contactEmail ? `Email : ${school.contactEmail}` : null,
  ].filter(Boolean);
  if (contact.length) {
    lines.push({
      text: contact.join('    '),
      fontSize: 8.5,
      alignment: 'center',
    });
  }

  const registration = [
    school.website ? `Website : ${school.website}` : null,
    school.affiliationNumber
      ? `Affiliation No.: ${school.affiliationNumber}`
      : null,
  ].filter(Boolean);
  if (registration.length) {
    lines.push({
      text: registration.join('    '),
      fontSize: 8.5,
      alignment: 'center',
    });
  }

  return {
    table: {
      widths: ['*'],
      body: [[{ stack: lines, margin: [4, 6, 4, 6] }]],
    },
    layout: GRID,
  };
}

/** Title band: `FEE RECEIPT[2026-27]`. */
function titleBand(data: FeeReceiptData): Content {
  const label = data.kind === 'receipt' ? 'FEE RECEIPT' : 'FEE INVOICE';
  return {
    table: {
      widths: ['*'],
      body: [
        [
          {
            text: `${label}[${data.academicYear}]`,
            bold: true,
            fontSize: 10,
            alignment: 'center',
          },
        ],
      ],
    },
    layout: GRID,
  };
}

/**
 * The two-column meta grid.
 *
 * Drawn as one four-column table — label, value, label, value — so the colons
 * line up down the page the way they do on the original.
 */
function metaGrid(data: FeeReceiptData): Content {
  const numberLabel = data.kind === 'receipt' ? 'Receipt No.' : 'Invoice No.';
  const rows: [string, string, string, string][] = [
    [numberLabel, data.documentNumber, 'Date', date(data.date)],
    [
      'Name of the Student',
      data.student.name,
      data.student.guardianLabel,
      data.student.guardianName ?? '',
    ],
    [
      'Class & Section',
      data.student.className ?? '',
      'Admission No.',
      data.student.admissionNumber ?? '',
    ],
  ];

  return {
    table: {
      widths: [110, '*', 95, '*'],
      body: rows.map(([l1, v1, l2, v2]) => [
        { text: l1, fontSize: 8.5 },
        { text: `: ${v1}`, fontSize: 8.5 },
        { text: l2, fontSize: 8.5 },
        { text: `: ${v2}`, fontSize: 8.5 },
      ]),
    },
    layout: { ...GRID, vLineWidth: (i: number) => (i === 2 ? 0 : 0.7) },
  };
}

/** Line items, with the TOTAL row the school's own receipt carries. */
function itemsTable(data: FeeReceiptData): Content {
  const head = ['S.No.', 'Description', 'Due', 'Concession', 'Paid Amount', 'Balance'];
  const body: TableCell[][] = [
    head.map((text, i) => ({
      text,
      bold: true,
      fontSize: 8.5,
      alignment: i >= 2 ? 'right' : 'left',
    })),
  ];

  data.lines.forEach((line, i) => {
    body.push([
      { text: String(i + 1), fontSize: 8.5 },
      { text: line.description, fontSize: 8.5 },
      { text: money(line.due), fontSize: 8.5, alignment: 'right' },
      { text: money(line.concession), fontSize: 8.5, alignment: 'right' },
      { text: money(line.paid), fontSize: 8.5, alignment: 'right' },
      { text: money(line.balance), fontSize: 8.5, alignment: 'right' },
    ]);
  });

  const t = data.totals;
  body.push([
    { text: '', fontSize: 8.5 },
    { text: 'TOTAL', bold: true, fontSize: 8.5 },
    { text: money(t.due), bold: true, fontSize: 8.5, alignment: 'right' },
    { text: money(t.concession), bold: true, fontSize: 8.5, alignment: 'right' },
    { text: money(t.paid), bold: true, fontSize: 8.5, alignment: 'right' },
    { text: money(t.balance), bold: true, fontSize: 8.5, alignment: 'right' },
  ]);

  return {
    table: { headerRows: 1, widths: [28, '*', 60, 55, 62, 55], body },
    layout: GRID,
  };
}

/**
 * Pay Mode Information.
 *
 * Present even on an unpaid invoice, as a single "no payments" row: the reader
 * should be able to tell an unpaid invoice from a receipt whose payment table
 * failed to render.
 */
function payModeTable(data: FeeReceiptData): Content {
  const head = ['S.No.', 'Pay Mode', 'Bank', 'Number', 'Date', 'Amount'];
  const body: TableCell[][] = [
    [
      {
        text: 'Pay Mode Information',
        colSpan: 6,
        bold: true,
        fontSize: 9,
        alignment: 'center',
      },
      {}, {}, {}, {}, {},
    ],
    head.map((text, i) => ({
      text,
      bold: true,
      fontSize: 8.5,
      alignment: i === 5 ? 'right' : 'left',
    })),
  ];

  if (data.payments.length === 0) {
    body.push([
      {
        text: 'No payments recorded against this invoice.',
        colSpan: 6,
        fontSize: 8.5,
        italics: true,
        alignment: 'center',
      },
      {}, {}, {}, {}, {},
    ]);
  } else {
    data.payments.forEach((p, i) => {
      body.push([
        { text: String(i + 1), fontSize: 8.5 },
        { text: p.mode, fontSize: 8.5 },
        { text: p.bank ?? '', fontSize: 8.5 },
        { text: p.number ?? '', fontSize: 8.5 },
        { text: date(p.date), fontSize: 8.5 },
        { text: money(p.amount), fontSize: 8.5, alignment: 'right' },
      ]);
    });
  }

  return {
    table: { widths: [28, 70, 90, '*', 60, 62], body },
    layout: GRID,
  };
}

/** Remarks, the amount in words, and the generated-at stamp. */
function footer(data: FeeReceiptData): Content {
  // Words follow whichever figure the document is *about*: what was paid on a
  // receipt, what is owed on an invoice.
  const headline =
    data.kind === 'receipt' ? data.totals.paid : data.totals.due;

  return {
    stack: [
      {
        table: {
          widths: ['*'],
          body: [
            [
              {
                text: `Remarks : Computer Generated ${
                  data.kind === 'receipt' ? 'Receipt' : 'Invoice'
                }, Need No Signature`,
                fontSize: 8.5,
              },
            ],
          ],
        },
        layout: GRID,
      },
      {
        table: {
          widths: ['*', 160],
          body: [
            [
              {
                text: `Total in words : ${amountInWords(headline)}`,
                fontSize: 8.5,
              },
              {
                text: `Total: ${money(headline)}`,
                fontSize: 8.5,
                bold: true,
                alignment: 'center',
              },
            ],
          ],
        },
        layout: GRID,
      },
      {
        table: {
          widths: ['*', 150],
          body: [
            [
              { text: 'NOTE :', fontSize: 8.5, margin: [0, 0, 0, 10] },
              {
                text: dateTime(data.generatedAt),
                fontSize: 8.5,
                alignment: 'right',
              },
            ],
          ],
        },
        layout: GRID,
      },
    ],
  };
}

export function buildFeeReceiptDefinition(
  data: FeeReceiptData,
): TDocumentDefinitions {
  return {
    pageSize: 'A4',
    pageMargins: [24, 24, 24, 24],
    defaultStyle: { font: 'Helvetica', fontSize: 9, lineHeight: 1.15 },
    content: [
      // Matches the "Parent Copy" marker on the school's own receipt.
      {
        text: 'Parent Copy',
        fontSize: 8,
        alignment: 'right',
        margin: [0, 0, 0, 2],
      },
      header(data),
      titleBand(data),
      metaGrid(data),
      itemsTable(data),
      payModeTable(data),
      footer(data),
    ],
  };
}

/** Renders the receipt and resolves the finished PDF bytes. */
export function renderFeeReceipt(data: FeeReceiptData): Promise<Buffer> {
  const doc = printer.createPdfKitDocument(buildFeeReceiptDefinition(data));
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    doc.on('data', (chunk: Buffer) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);
    doc.end();
  });
}
