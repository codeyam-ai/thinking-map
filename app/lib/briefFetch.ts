// Getting a brief out of one of the brief routes, from the browser.
//
// Both doors that produce a brief — uploading a file and pointing at a link —
// answer with the IDENTICAL body shape, deliberately, so that there is one
// reader rather than two. This module is that reader.
//
// It exists because there were briefly two copies of it: `IdeaPrompt` and
// `FirstCard` each did the same fetch, the same `readJson`, and the same
// mapping into the same four fields. Both had to keep getting the same
// details right — status before body, the route's own sentence over a generic
// one, an omitted warning spelled as null — and two copies of that is one copy
// away from drifting. The copy nobody updated would be the one a stranger is
// looking at.
//
// No `server-only`: this runs in the browser by design. The thing that must
// not run in the browser is the retrieval itself, which lives behind the
// routes these functions call.

import { readJson } from './readJson';

/** A brief as it arrives from a route, ready to attach. */
export interface FetchedBrief {
  text: string;
  /** The filename, the page's name and address, or "pasted". */
  sourceName: string;
  mediaType: string;
  /** Whatever extraction wanted the person to know, or null. Never undefined:
   *  the readout wants the absence stated rather than left open. */
  warning: string | null;
}

/** Either a brief or a sentence saying why there isn't one. Never both, and
 *  never a thrown error — a link that does not work is a thing that happened,
 *  not an exception. */
export interface BriefAttempt {
  brief: FetchedBrief | null;
  error: string | null;
}

/**
 * Read a brief route's answer, whatever shape it turned out to be.
 *
 * Status first, body second. Reading the body of a failed response as JSON is
 * what once put `Failed to execute 'json' on 'Response'` on screen instead of
 * a sentence about the upload — so this goes through `readJson`, which never
 * lets a parse failure reach a person.
 *
 * @param fallback What to say when the body cannot tell us anything.
 */
export async function readBriefResponse(
  response: Response,
  fallback: string,
): Promise<BriefAttempt> {
  const { data, error } = await readJson<{
    text: string;
    sourceName: string;
    mediaType: string;
    warning?: string | null;
  }>(response, fallback);

  // A 200 whose body has no text in it is not a brief, whatever the status
  // said. Attaching one would look to the person exactly like a successful
  // read of an empty document. Note this is `typeof`, not truthiness: `text:
  // ''` IS a legitimate answer — a scanned PDF extracts to nothing and says so
  // in its warning — and treating that as a failure would lose the warning
  // that explains it.
  if (!data || typeof data.text !== 'string') {
    return { brief: null, error: error ?? fallback };
  }

  return {
    brief: {
      text: data.text,
      sourceName: data.sourceName,
      mediaType: data.mediaType,
      warning: data.warning ?? null,
    },
    error: null,
  };
}

/**
 * Turn a link into a brief.
 *
 * The server does the retrieving, not the browser: CORS blocks a page from
 * fetching almost any third-party document, and a server that fetches a
 * stranger's URL needs a guard that a browser cannot be trusted to apply.
 * Both of those live behind `/api/briefs/fetch`.
 */
export async function fetchBriefFromLink(url: string): Promise<BriefAttempt> {
  const response = await fetch('/api/briefs/fetch', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url }),
  });
  return readBriefResponse(response, 'Could not read that page.');
}

/**
 * Turn a chosen or dropped file into a brief.
 *
 * The bytes go over the wire because reading a PDF is a server's job; nothing
 * is persisted by it, so a document the person then discards leaves nothing
 * behind.
 */
export async function extractBriefFromFile(file: File): Promise<BriefAttempt> {
  const form = new FormData();
  form.append('file', file);
  const response = await fetch('/api/briefs/extract', {
    method: 'POST',
    body: form,
  });
  return readBriefResponse(response, 'Could not read that file.');
}
