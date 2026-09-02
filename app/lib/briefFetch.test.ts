import { describe, expect, it } from 'vitest';
import { readBriefResponse } from './briefFetch';

// Reading whatever a brief route answered with.
//
// This exists because two components were doing it independently — the
// landing card and the older intake — and both had to get the same four
// things right: check the status before the body, keep the route's own
// sentence when it failed, spell an absent warning as null rather than
// undefined, and never let a non-JSON body reach a person as a parser error.
// Two copies of that is one copy away from drifting, and the copy nobody
// updated would be the one on the screen a stranger sees.
//
// Pure over a constructed Response, so none of this touches the network.

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

describe('readBriefResponse', () => {
  // The ordinary success, and the shape every caller downstream depends on.
  it('returns the brief a route handed back', async () => {
    const result = await readBriefResponse(
      jsonResponse({
        text: 'The whole spec.',
        sourceName: 'renewal-brief.pdf',
        mediaType: 'application/pdf',
        warning: null,
      }),
      'Could not read that.',
    );

    expect(result.error).toBeNull();
    expect(result.brief).toEqual({
      text: 'The whole spec.',
      sourceName: 'renewal-brief.pdf',
      mediaType: 'application/pdf',
      warning: null,
    });
  });

  // A route that saw nothing worth flagging simply omits the key. The readout
  // wants the absence spelled out, so an omitted warning becomes null rather
  // than travelling as undefined and reading as "not decided yet".
  it('spells an omitted warning as null', async () => {
    const result = await readBriefResponse(
      jsonResponse({
        text: 'Words.',
        sourceName: 'pasted',
        mediaType: 'text/plain',
      }),
      'Could not read that.',
    );

    expect(result.brief?.warning).toBeNull();
  });

  // A warning is the whole reason a scanned PDF does not silently become an
  // empty brief, so it has to survive the trip.
  it('carries a warning through', async () => {
    const result = await readBriefResponse(
      jsonResponse({
        text: '',
        sourceName: 'scan.pdf',
        mediaType: 'application/pdf',
        warning: 'No text came out of scan.pdf.',
      }),
      'Could not read that.',
    );

    expect(result.brief?.warning).toBe('No text came out of scan.pdf.');
  });

  // When a route failed the way it meant to, its own sentence is better than
  // anything this function could compose — it knows what actually went wrong.
  it('prefers the route’s own error sentence', async () => {
    const result = await readBriefResponse(
      jsonResponse(
        { error: 'That link points inside a private network.' },
        400,
      ),
      'Could not read that page.',
    );

    expect(result.brief).toBeNull();
    expect(result.error).toBe('That link points inside a private network.');
  });

  // The failure no route ever saw: a proxy answering with HTML. This is the
  // exact shape that once put "Failed to execute 'json' on 'Response'" on
  // screen, and the fallback plus the status is what a person can report.
  it('falls back to a readable sentence when the body is not JSON', async () => {
    const result = await readBriefResponse(
      new Response('<html>502 Bad Gateway</html>', { status: 502 }),
      'Could not read that page.',
    );

    expect(result.brief).toBeNull();
    expect(result.error).toBe('Could not read that page. (HTTP 502)');
    expect(result.error).not.toContain('JSON');
  });

  // A 500 with nothing in it at all — no body to read a reason out of.
  it('handles an empty body', async () => {
    const result = await readBriefResponse(
      new Response('', { status: 500 }),
      'Could not read that page.',
    );

    expect(result.error).toBe('Could not read that page. (HTTP 500)');
  });

  // A 200 whose body is missing the one field that makes a brief a brief. The
  // status said fine; the payload is not usable, and saying otherwise would
  // attach an empty brief that looks like a successful read.
  it('rejects a success response with no text in it', async () => {
    const result = await readBriefResponse(
      jsonResponse({ sourceName: 'empty.pdf', mediaType: 'application/pdf' }),
      'Could not read that.',
    );

    expect(result.brief).toBeNull();
    expect(result.error).toBe('Could not read that.');
  });
});
