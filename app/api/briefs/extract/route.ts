import { NextResponse } from 'next/server';
import { extractBriefText } from '@/app/lib/briefText';
import { withFailure } from '@/app/lib/apiFailure';

// Node, not edge: the PDF and .docx extractors are Node libraries and will not
// run on the edge runtime.
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Generous for a spec, small enough that an accidental video does not get
 *  read into memory before we notice. */
const MAX_BYTES = 10 * 1024 * 1024;

/**
 * Turn an uploaded file into text and hand it straight back.
 *
 * Deliberately creates nothing. The browser holds the extracted text and
 * submits it with the rest of the form, which keeps map creation a single
 * transaction and means an upload the person abandons leaves nothing behind —
 * no row, no orphaned file, nothing to clean up.
 *
 * The extractor's own failures are handled below. `withFailure` covers what is
 * left — a throw from `formData()` bookkeeping, or anything else unanticipated
 * — which would otherwise reach the upload readout as a parse error.
 */
export const POST = withFailure(async (request: Request) => {
  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json(
      { error: 'That upload did not arrive in one piece. Try again.' },
      { status: 400 },
    );
  }

  const file = form.get('file');
  if (!(file instanceof File)) {
    return NextResponse.json(
      { error: 'No file came through. Pick one, or paste the text instead.' },
      { status: 400 },
    );
  }

  if (file.size > MAX_BYTES) {
    return NextResponse.json(
      {
        error: `That file is ${Math.round(
          file.size / 1024 / 1024,
        )}MB. The limit is ${MAX_BYTES / 1024 / 1024}MB — paste the text instead.`,
      },
      { status: 413 },
    );
  }

  try {
    const { text, warning } = await extractBriefText(
      await file.arrayBuffer(),
      file.type,
      file.name,
    );
    return NextResponse.json({
      text,
      sourceName: file.name,
      mediaType: file.type || 'application/octet-stream',
      charCount: text.length,
      warning,
    });
  } catch (err) {
    // A corrupt or password-protected document throws from deep inside a
    // parser. The person needs a sentence they can act on, not a stack trace.
    console.error('brief extraction failed', err);
    return NextResponse.json(
      {
        error: `We could not read ${file.name}. It may be protected or damaged — paste the text instead.`,
      },
      { status: 422 },
    );
  }
});
