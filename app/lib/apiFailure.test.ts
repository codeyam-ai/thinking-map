import { describe, expect, it, vi } from 'vitest';
import { withFailure } from './apiFailure';

// The half a capture cannot show.
//
// Every scenario for this feature runs in development, so each frame carries the
// fix command and the column name. That the SAME throw yields neither in
// production is invisible to the eye, and it is the half that matters — it is
// the difference between a diagnosis and a leak. The other untestable-by-picture
// guarantee is that a handler which succeeds is not touched at all.
//
// `console.error` is stubbed throughout: the wrapper deliberately writes the
// whole error to the terminal, and a suite that printed a Prisma stack per case
// would bury its own output.

/**
 * The reported failure in the shape it actually arrives in — recognised by
 * `code` + `clientVersion` rather than by class, exactly as `classifyLoadError`
 * recognises it. A fixture built from the real Prisma class would exercise a
 * path production does not take.
 */
const driftError = () =>
  Object.assign(
    new Error(
      'Invalid `prisma.mapNode.create()` invocation:\n\nThe column `main.MapNode.testsNodeId` does not exist in the current database.',
    ),
    {
      code: 'P2022',
      clientVersion: '7.10.0',
      meta: {
        driverAdapterError: {
          cause: { column: 'main.MapNode.testsNodeId' },
        },
      },
    },
  );

const silenced = () => vi.spyOn(console, 'error').mockImplementation(() => {});

describe('withFailure', () => {
  // A handler that answers is not the wrapper's business — status and body come
  // back exactly as written, including a deliberate non-2xx.
  it('passes a successful response through untouched', async () => {
    const handler = withFailure(async () =>
      Response.json({ id: 'abc' }, { status: 201 }),
    );

    const response = await handler();

    expect(response.status).toBe(201);
    expect(await response.json()).toEqual({ id: 'abc' });
  });

  // A route's own 400 must survive: the wrapper covers the unanticipated throw,
  // not the faults a handler already decided how to report.
  it('leaves a handler-authored failure alone', async () => {
    const handler = withFailure(async () =>
      Response.json({ error: 'Tell me what you want to figure out first.' }, { status: 400 }),
    );

    const response = await handler();

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      error: 'Tell me what you want to figure out first.',
    });
  });

  // The reported case, from the route's side: a throw becomes a 500 that is
  // still JSON, so the browser has something it can read.
  it('turns a thrown database drift into a readable JSON 500', async () => {
    const spy = silenced();
    const handler = withFailure(async () => {
      throw driftError();
    });

    const response = await handler();
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body.error).toMatch(/database/i);
    expect(body.error).not.toMatch(/prisma/i);
    spy.mockRestore();
  });

  // Development gets the one command that fixes it, and the column that named
  // the problem. This is what the scenarios show.
  it('includes the fix and the diagnosis in development', async () => {
    const spy = silenced();
    const handler = withFailure(async () => {
      throw driftError();
    });

    const body = await (await handler()).json();

    expect(body.command).toBe('npm run db:push');
    expect(body.detail).toContain('MapNode.testsNodeId');
    spy.mockRestore();
  });

  // An unrecognised failure is by definition one nobody anticipated, so the
  // wrapper says nothing it has not been taught to say.
  it('leaks nothing internal for an ordinary error', async () => {
    const spy = silenced();
    const handler = withFailure(async () => {
      throw new Error('connection string user:hunter2@db');
    });

    const body = await (await handler()).json();

    expect(body.error).not.toContain('hunter2');
    expect(body.command).toBeUndefined();
    spy.mockRestore();
  });

  // The terminal keeps the whole thing. Swallowing the original would trade one
  // unreadable failure for an invisible one.
  it('still writes the original error to the terminal', async () => {
    const spy = silenced();
    const thrown = driftError();
    const handler = withFailure(async () => {
      throw thrown;
    });

    await handler();

    expect(spy).toHaveBeenCalledWith('unhandled API failure', thrown);
    spy.mockRestore();
  });

  // Route handlers on dynamic segments take a second context argument, and the
  // wrapper has to hand both through unchanged.
  it('forwards every argument to the handler', async () => {
    const request = new Request('http://localhost/api/maps/abc');
    const context = { params: Promise.resolve({ id: 'abc' }) };
    const inner = vi.fn(
      async (
        _request: Request,
        _context: { params: Promise<{ id: string }> },
      ) => Response.json({ ok: true }),
    );

    await withFailure(inner)(request, context);

    expect(inner).toHaveBeenCalledWith(request, context);
  });
});
