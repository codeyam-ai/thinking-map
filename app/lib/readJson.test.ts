import { describe, expect, it } from 'vitest';
import { readJson } from './readJson';

// The guarantee is negative, which is why it needs tests rather than a capture:
// whatever the server sends, the caller never sees a `SyntaxError`. A screenshot
// can show one failure reading correctly; it cannot show that no body shape
// produces the browser's parser message, and the reported bug was exactly one
// body shape nobody had tried.
//
// Every case is a constructed `Response`, so this runs with no network and no
// server — the function is pure over its argument by design.

const FALLBACK = 'Could not start a map.';

describe('readJson', () => {
  // The ordinary case: a route answered, and the caller gets the payload.
  it('returns the parsed body of a successful response', async () => {
    const result = await readJson<{ id: string }>(
      new Response(JSON.stringify({ id: 'abc' }), { status: 201 }),
      FALLBACK,
    );

    expect(result.ok).toBe(true);
    expect(result.data).toEqual({ id: 'abc' });
    expect(result.error).toBeNull();
  });

  // A route that failed the way it meant to. Its own sentence is better than
  // anything composed here, so it wins over the fallback.
  it('prefers the error a failing route stated itself', async () => {
    const result = await readJson(
      new Response(
        JSON.stringify({ error: 'Tell me what you want to figure out first.' }),
        { status: 400 },
      ),
      FALLBACK,
    );

    expect(result.ok).toBe(false);
    expect(result.data).toBeNull();
    expect(result.error).toBe('Tell me what you want to figure out first.');
  });

  // THE REPORTED CASE. An unhandled throw used to reach the browser as a 500
  // with nothing in it, and reading that as JSON is what put
  // `Unexpected end of JSON input` on screen.
  it('describes an empty error body without a parse error', async () => {
    const result = await readJson(new Response('', { status: 500 }), FALLBACK);

    expect(result.ok).toBe(false);
    expect(result.error).toBe('Could not start a map. (HTTP 500)');
    expect(result.error).not.toMatch(/JSON/i);
  });

  // A failure no route ever saw, so no route could have made it JSON.
  it('describes an HTML error page from a proxy', async () => {
    const result = await readJson(
      new Response('<html><body>Bad Gateway</body></html>', { status: 502 }),
      FALLBACK,
    );

    expect(result.ok).toBe(false);
    expect(result.error).toBe('Could not start a map. (HTTP 502)');
  });

  // A 200 is not on its own a reason to trust the body: a truncated one still
  // has to fail as a sentence rather than as a thrown SyntaxError.
  it('treats a truncated body as a failure even on a 200', async () => {
    const result = await readJson(
      new Response('{"revision": 3, "even', { status: 200 }),
      FALLBACK,
    );

    expect(result.ok).toBe(false);
    expect(result.data).toBeNull();
    expect(result.error).toBe('Could not start a map. (HTTP 200)');
  });

  // A failing response that IS JSON but carries no `error` field — well-formed
  // and still says nothing, so the fallback has to cover it.
  it('falls back when a failing body states no error', async () => {
    const result = await readJson(
      new Response(JSON.stringify({ detail: 'something' }), { status: 503 }),
      FALLBACK,
    );

    expect(result.error).toBe('Could not start a map. (HTTP 503)');
  });

  // A route that named the fix as well as the fault: the sentence is the
  // headline, and everything else it said comes back beside it rather than
  // being dropped on the floor of the network tab.
  it('hands back the rest of a failing body alongside the message', async () => {
    const result = await readJson(
      new Response(
        JSON.stringify({
          error: 'The database is behind the app',
          command: 'npm run db:push',
          detail: 'P2022 · MapNode.testsNodeId',
        }),
        { status: 500 },
      ),
      FALLBACK,
    );

    expect(result.error).toBe('The database is behind the app');
    expect(result.failure?.command).toBe('npm run db:push');
    expect(result.failure?.detail).toBe('P2022 · MapNode.testsNodeId');
  });

  // Production withholds the fix, so there is nothing to hand back — and the
  // absence has to read as absence rather than as an empty pill.
  it('reports no extra fields when the route withheld them', async () => {
    const result = await readJson(
      new Response(JSON.stringify({ error: 'The database is behind the app' }), {
        status: 500,
      }),
      FALLBACK,
    );

    expect(result.failure?.command).toBeUndefined();
  });

  // Nothing parsed means nothing to offer, and inventing a shape here would
  // put an undefined command in front of a caller that trusts the field.
  it('offers no failure body when there was nothing to parse', async () => {
    const result = await readJson(new Response('', { status: 500 }), FALLBACK);

    expect(result.failure).toBeNull();
  });

  // The fallback is used verbatim, so each call site's wording reaches the
  // person who was doing that particular thing.
  it('uses the caller wording rather than a generic one', async () => {
    const result = await readJson(
      new Response('', { status: 500 }),
      'Could not read that file.',
    );

    expect(result.error).toBe('Could not read that file. (HTTP 500)');
  });
});
