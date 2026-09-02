import { NextResponse } from 'next/server';
import { extractHtmlPage } from '@/app/lib/briefHtml';
import {
  briefSourceName,
  classifyFetchedContent,
  extractionWarning,
  normalizeBriefText,
} from '@/app/lib/briefFormat';
import { fetchGuarded } from '@/app/lib/briefUrl';
import { withFailure } from '@/app/lib/apiFailure';

// Node, not edge: the guard resolves hostnames through `node:dns` and the
// extractor parses the page with a Node DOM. Neither runs on the edge runtime.
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** The same ceiling the upload route uses. A page far past it is not a brief,
 *  and reading one into memory to find that out is the thing to avoid. */
const MAX_BYTES = 10 * 1024 * 1024;

/** Long enough for a slow origin, short enough that a link into a black hole
 *  does not hold the intake open while the person waits. */
const TIMEOUT_MS = 10_000;

/** Asking for HTML the way a browser would. Some origins answer a bare fetch
 *  with a consent wall, which is the difference between getting a spec and
 *  getting a cookie notice. */
const REQUEST_HEADERS = {
  Accept: 'text/html,application/xhtml+xml,text/plain;q=0.9,*/*;q=0.8',
  'User-Agent': 'ThinkingMapBot/1.0 (+brief intake)',
};

/**
 * Turn a link into brief text and hand it straight back.
 *
 * A sibling of `app/api/briefs/extract/route.ts` in every way that matters: it
 * creates nothing, and it answers with the IDENTICAL body shape, so the client
 * has one reader for the result whether the brief came off a disk or off the
 * web.
 *
 * The fetch happens server-side because CORS blocks a browser from retrieving
 * almost any third-party document — but moving it here is also what turns this
 * into an SSRF surface, which is why the retrieval goes through `fetchGuarded`
 * rather than a bare `fetch`. That function owns the whole guard, redirects
 * included; this handler deliberately does not re-implement any part of it.
 */
export const POST = withFailure(async (request: Request) => {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: 'That request did not arrive in one piece. Try again.' },
      { status: 400 },
    );
  }

  const raw =
    typeof body === 'object' && body !== null
      ? (body as { url?: unknown }).url
      : undefined;
  if (typeof raw !== 'string' || raw.trim().length === 0) {
    return NextResponse.json(
      { error: 'No link came through. Paste one, or paste the text instead.' },
      { status: 400 },
    );
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const { response, url, error } = await fetchGuarded(raw, {
      signal: controller.signal,
      headers: REQUEST_HEADERS,
    });

    // A refused address is the person's to fix, so it is a 400 with the
    // guard's own sentence rather than a generic failure.
    if (!response) return NextResponse.json({ error }, { status: 400 });

    if (!response.ok) {
      return NextResponse.json(
        {
          error: `That page answered ${response.status}. Check the link, or paste the text instead.`,
        },
        { status: 422 },
      );
    }

    // Trust the header when it is there, and check the real length anyway: a
    // missing or lying `content-length` is exactly how something enormous gets
    // read into memory.
    const declared = Number(response.headers.get('content-length'));
    if (Number.isFinite(declared) && declared > MAX_BYTES) {
      return NextResponse.json(
        {
          error: `That page is ${Math.round(
            declared / 1024 / 1024,
          )}MB. The limit is ${MAX_BYTES / 1024 / 1024}MB — paste the text instead.`,
        },
        { status: 413 },
      );
    }

    const bytes = await response.arrayBuffer();
    if (bytes.byteLength > MAX_BYTES) {
      return NextResponse.json(
        {
          error: `That page is larger than the ${
            MAX_BYTES / 1024 / 1024
          }MB limit — paste the text instead.`,
        },
        { status: 413 },
      );
    }

    const contentType = response.headers.get('content-type') ?? '';
    const kind = classifyFetchedContent(contentType);

    if (kind === 'unsupported') {
      return NextResponse.json(
        {
          error: `That link is not a web page — it is ${
            contentType.split(';')[0]
          }. Download it and attach the file instead.`,
        },
        { status: 415 },
      );
    }

    const markup = new TextDecoder().decode(bytes);
    const page =
      kind === 'page'
        ? await extractHtmlPage(markup)
        : { text: markup, title: null };

    const text = normalizeBriefText(page.text);
    const sourceName = briefSourceName(url, page.title);

    return NextResponse.json({
      text,
      sourceName,
      mediaType: 'text/html',
      charCount: text.length,
      // A page that extracts to nothing is the same fact as a scanned PDF that
      // extracts to nothing, so it gets the same sentence from the same judge.
      warning: extractionWarning(text, bytes.byteLength, sourceName),
    });
  } catch (err) {
    if (err instanceof Error && err.name === 'AbortError') {
      return NextResponse.json(
        {
          error: `That page did not answer within ${
            TIMEOUT_MS / 1000
          } seconds. Try again, or paste the text instead.`,
        },
        { status: 504 },
      );
    }
    // A DNS failure, a refused connection, a TLS error. The person needs a
    // sentence they can act on, not the underlying cause object.
    console.error('brief link fetch failed', err);
    return NextResponse.json(
      {
        error:
          'We could not reach that page. Check the link, or paste the text instead.',
      },
      { status: 502 },
    );
  } finally {
    clearTimeout(timer);
  }
});
