declare module 'pdf-parse/lib/pdf-parse.js' {
  interface PdfData { text?: string; numpages?: number }
  const parse: (data: Buffer) => Promise<PdfData>
  export default parse
}
