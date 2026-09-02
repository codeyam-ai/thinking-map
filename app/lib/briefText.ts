import 'server-only';

// Turning a client's file into text.
//
// Every format-specific dependency in the project lives behind this one
// function, so "which PDF library" is one file's problem rather than the
// app's. Nothing here persists anything: extraction happens in a request, the
// text is handed back, and the file it came out of is thrown away. That is why
// the project has no uploads directory and no story about serving one.
//
// A note for whoever changes the PDF path: `pdf-parse` is the obvious first
// reach and it runs a debug branch at import that reads a fixture off disk,
// which fails in a bundled server runtime. `unpdf` wraps the same pdfjs
// without that. Whatever is used, the route calling this must be the Node
// runtime, not edge.

import { extractionWarning, normalizeBriefText } from './briefFormat';
import { extractHtmlPage } from './briefHtml';

export interface ExtractedBrief {
  text: string;
  /** Something the person should see before they start a map on this, or null
   *  when the extraction looks healthy. Never a thrown error: a thin
   *  extraction is a fact about their file, not a fault in ours. */
  warning: string | null;
}

function extensionOf(filename: string): string {
  const dot = filename.lastIndexOf('.');
  return dot === -1 ? '' : filename.slice(dot + 1).toLowerCase();
}

async function extractPdf(bytes: ArrayBuffer): Promise<string> {
  const { extractText, getDocumentProxy } = await import('unpdf');
  const document = await getDocumentProxy(new Uint8Array(bytes));
  const { text } = await extractText(document, { mergePages: true });
  return Array.isArray(text) ? text.join('\n\n') : text;
}

async function extractDocx(bytes: ArrayBuffer): Promise<string> {
  const mammoth = await import('mammoth');
  const { value } = await mammoth.extractRawText({
    buffer: Buffer.from(bytes),
  });
  return value;
}

/**
 * Get the words out of whatever the client actually sent.
 *
 * Dispatches on media type first and falls back to the file extension, because
 * browsers are inconsistent about the type they attach to a `.md` — several
 * send `application/octet-stream` for one.
 */
export async function extractBriefText(
  bytes: ArrayBuffer,
  mediaType: string,
  filename: string,
): Promise<ExtractedBrief> {
  const type = mediaType.toLowerCase();
  const ext = extensionOf(filename);

  // Read the size BEFORE extracting. pdfjs transfers the buffer to its worker,
  // which DETACHES it — `bytes.byteLength` is 0 from then on. Reading it
  // afterwards silently disabled the scanned-PDF warning below for the exact
  // file type that warning exists for.
  const byteLength = bytes.byteLength;

  let raw: string;
  if (type === 'application/pdf' || ext === 'pdf') {
    raw = await extractPdf(bytes);
  } else if (
    type ===
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
    ext === 'docx'
  ) {
    raw = await extractDocx(bytes);
  } else if (type === 'text/html' || ext === 'html' || ext === 'htm') {
    // Checked BEFORE the `text/` branch below, which would otherwise claim
    // `text/html` and hand the markup through as if the tags were prose. The
    // same branch is what makes a dropped or picked `.html` file work, and it
    // is the branch a fetched page goes through.
    const page = await extractHtmlPage(new TextDecoder().decode(bytes));
    raw = page.text;
  } else if (type.startsWith('text/') || ext === 'md' || ext === 'txt') {
    raw = new TextDecoder().decode(bytes);
  } else {
    return {
      text: '',
      warning: `We can read .pdf, .docx, .md, .txt and .html files. ${
        filename || 'That file'
      } is not one of those — paste the text instead.`,
    };
  }

  const text = normalizeBriefText(raw);
  return { text, warning: extractionWarning(text, byteLength, filename) };
}
