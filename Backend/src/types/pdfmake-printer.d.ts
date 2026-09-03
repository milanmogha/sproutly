/**
 * Types for pdfmake's server-side printer.
 *
 * `@types/pdfmake` only describes the browser build (`createPdf`), but on a
 * server the entry point is the Printer class, which ships untyped. Declaring
 * just the two members we use keeps the document definition itself fully
 * type-checked against the real pdfmake interfaces.
 *
 * Declared against the `src/printer` subpath rather than `pdfmake`, so this
 * sits alongside `@types/pdfmake` instead of colliding with its declaration
 * of the bare module name.
 */
declare module 'pdfmake/src/printer' {
  import type {
    TDocumentDefinitions,
    TFontDictionary,
  } from 'pdfmake/interfaces';

  /** The PDFKit stream pdfmake hands back — written to, then ended. */
  interface PdfKitDocument {
    on(event: 'data', listener: (chunk: Buffer) => void): this;
    on(event: 'end', listener: () => void): this;
    on(event: 'error', listener: (err: Error) => void): this;
    end(): void;
  }

  class PdfPrinter {
    constructor(fonts: TFontDictionary);
    createPdfKitDocument(
      docDefinition: TDocumentDefinitions,
      options?: Record<string, unknown>,
    ): PdfKitDocument;
  }

  export = PdfPrinter;
}
