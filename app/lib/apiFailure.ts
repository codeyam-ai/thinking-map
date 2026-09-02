/**
 * Making an API route answer in JSON even when it throws.
 *
 * The reported case: `createMap` threw P2022 out of `POST /api/maps`, nothing
 * caught it, and Next turned the escaped throw into a 500 with a body the
 * browser could not parse. What reached the person was
 * `Failed to execute 'json' on 'Response': Unexpected end of JSON input` — a
 * complaint about the fetch API, not a sentence about their app.
 *
 * Every route under `app/api/` already answers `{ error }` for the faults it
 * anticipates. This extends that same shape to the ones it does not, so a 500
 * is indistinguishable in form from a 400 and one client helper can read both.
 *
 * A wrapper rather than a try/catch in eight handlers: the handling is
 * identical every time, and eight copies is eight chances for one of them to
 * drift or be forgotten on the next route added.
 */

import { NextResponse } from 'next/server';
import { classifyLoadError } from './loadError';

/**
 * Wrap a route handler so an unanticipated throw becomes a JSON 500.
 *
 * Variadic so it composes with both `(request)` and `(request, { params })`
 * handlers without the call sites casting — Next passes the context argument
 * only to dynamic segments, and the wrapper should not care which it got.
 *
 * The handler's own response is passed through untouched. This only intervenes
 * on a throw, so a route's deliberate 400 or 404 keeps its own status and body.
 */
export function withFailure<Args extends unknown[]>(
  handler: (...args: Args) => Response | Promise<Response>,
): (...args: Args) => Promise<Response> {
  return async (...args: Args): Promise<Response> => {
    try {
      return await handler(...args);
    } catch (error) {
      // The terminal keeps the whole thing. The browser gets a sentence; the
      // person running the app gets the stack that says which query failed.
      console.error('unhandled API failure', error);

      // The same classifier the server-rendered error screen uses. A second one
      // here would answer P2022 differently within a week, and the one nobody
      // updated would be this one.
      const { message, command, hint, detail } = classifyLoadError(error);

      return NextResponse.json(
        {
          error: message,
          // Present only in development — the classifier already makes that
          // decision, so this spreads what it gives rather than re-deciding.
          ...(command ? { command } : {}),
          ...(hint ? { hint } : {}),
          ...(detail ? { detail } : {}),
        },
        { status: 500 },
      );
    }
  };
}
