/**
 * Reading a response whose body might not be JSON.
 *
 * `await response.json()` is only safe on a body you already know parses, and
 * the browser's failure message when it does not — `Failed to execute 'json' on
 * 'Response': Unexpected end of JSON input` — describes the fetch API rather
 * than the app. That message is what the reported bug put on screen.
 *
 * A route that always answers in JSON (see `apiFailure.ts`) is the primary fix.
 * This is the belt: a proxy 502 with an HTML body, a truncated response, or a
 * gateway that never reached the route at all are all failures no route ever
 * saw, and the page still has to say something a person can read.
 *
 * Generalised from `forward` in `webmcp.ts`, which already gets this right —
 * status first, body second, and never a parse on a body that may not be one.
 *
 * Pure over a `Response`, so it is testable with a constructed one and no
 * network.
 */

export type ReadJsonResult<T> = {
  /**
   * Whether the caller got usable data. NOT a copy of `response.ok`: a 200
   * carrying a truncated body is a failure for whoever needed the body, and
   * saying otherwise would hand them `data: null` under an `ok: true`.
   */
  ok: boolean;
  data: T | null;
  /** A sentence to show a person. Never a `SyntaxError` from `JSON.parse`. */
  error: string | null;
  /**
   * The rest of a failing route's body, when it sent one that parsed.
   *
   * `error` is the sentence; a route may also have said how to fix it, and
   * throwing that away here would mean the fix reaches the network tab and
   * nowhere a person is looking. Deliberately untyped — this function knows
   * nothing about any particular route's error shape, so the caller reads the
   * fields it understands and ignores the rest.
   */
  failure: Record<string, unknown> | null;
};

/**
 * @param fallback What to say when the body cannot tell us anything — used
 *   verbatim, with the HTTP status appended so a report is still diagnosable.
 */
export async function readJson<T>(
  response: Response,
  fallback: string,
): Promise<ReadJsonResult<T>> {
  // Read as text ONCE. A body is a stream that can only be consumed once, so
  // trying `.json()` and falling back to `.text()` cannot work — by the time
  // the parse has failed the body is gone.
  let text: string;
  try {
    text = await response.text();
  } catch {
    // The connection dropped mid-body. There is nothing to parse and nothing
    // the status alone can tell us beyond what the fallback already says.
    return {
      ok: false,
      data: null,
      error: `${fallback} (HTTP ${response.status})`,
      failure: null,
    };
  }

  let parsed: unknown;
  try {
    parsed = text.length > 0 ? JSON.parse(text) : undefined;
  } catch {
    parsed = undefined;
  }

  if (parsed === undefined) {
    // An empty body, an HTML error page, or a truncated one. Whether the status
    // was ok is beside the point: the caller wanted a body and there is none.
    return {
      ok: false,
      data: null,
      error: `${fallback} (HTTP ${response.status})`,
      failure: null,
    };
  }

  if (response.ok) {
    return { ok: true, data: parsed as T, error: null, failure: null };
  }

  // A route that failed the way it meant to — the message it wrote is better
  // than anything this function could compose, so prefer it.
  const stated =
    typeof parsed === 'object' && parsed !== null
      ? (parsed as { error?: unknown }).error
      : null;

  return {
    ok: false,
    data: null,
    error:
      typeof stated === 'string' && stated.length > 0
        ? stated
        : `${fallback} (HTTP ${response.status})`,
    failure:
      typeof parsed === 'object' && parsed !== null
        ? (parsed as Record<string, unknown>)
        : null,
  };
}
