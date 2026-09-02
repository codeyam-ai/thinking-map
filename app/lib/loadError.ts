/**
 * Turning a thrown database failure into something a person can act on.
 *
 * The reported case: `MapNode.testsNodeId does not exist` came out of `getMap`
 * as a raw `PrismaClientKnownRequestError` and reached the browser as a stack
 * trace. The fix is not to swallow it — it is to say what broke. A database
 * that is behind the schema is a *setup* problem with a one-command answer,
 * and the app knowing that is the difference between a shrug and a fix.
 *
 * Pure on purpose. Classification is logic over an error code, so it is
 * testable here rather than inlined into two page components that would then
 * need a browser to test.
 */

export type LoadErrorInfo = {
  /** The headline. States what is wrong, not that we are sorry. */
  title: string;
  /** One or two sentences of what happened, in the product's voice. */
  message: string;
  /**
   * A command to run verbatim. Rendered as a monospace pill, so it holds a
   * command and nothing else — prose belongs in `hint`, which is why these are
   * two fields rather than one. A sentence in that pill reads as a slab of code
   * you are meant to type. Development only — see `dev`.
   */
  command?: string;
  /**
   * Where to look, when the fix is a setting rather than something runnable.
   * Ordinary prose, rendered as a line of text. Development only — see `dev`.
   */
  hint?: string;
  /** The Prisma code and the thing it named. Development only — see `dev`. */
  detail?: string;
};

/**
 * A Prisma known-request error, recognised STRUCTURALLY rather than with
 * `instanceof`.
 *
 * The thrown value has usually crossed a server component boundary by the time
 * anything here sees it, and it can also arrive from a different copy of the
 * client than the one this module imports — either way the class identity is
 * not something to bet the error screen on. A string `code` beside a
 * `clientVersion` is the shape, and the shape is reliable.
 */
function prismaCode(error: unknown): string | null {
  if (typeof error !== 'object' || error === null) return null;
  const candidate = error as { code?: unknown; clientVersion?: unknown };
  if (typeof candidate.code !== 'string') return null;
  if (typeof candidate.clientVersion !== 'string') return null;
  return candidate.code;
}

function messageOf(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === 'object' && error !== null) {
    const candidate = error as { message?: unknown };
    if (typeof candidate.message === 'string') return candidate.message;
  }
  return String(error);
}

/**
 * The one sentence of a Prisma message worth showing.
 *
 * Deliberately the LAST non-empty line, not the first. A Prisma message opens
 * with its own framing — ``Invalid `prisma.thinkingMap.findUnique()`
 * invocation:`` — and closes with the actual diagnosis: "The column
 * `main.MapNode.testsNodeId` does not exist in the current database." Taking
 * the first line puts the call site on screen and leaves out the column, which
 * is precisely backwards for someone trying to work out what to fix.
 */
function diagnosisLine(text: string): string {
  const lines = text
    .split('\n')
    .map((part) => part.trim())
    .filter((part) => part.length > 0);
  return lines[lines.length - 1] ?? '';
}

/**
 * The column or table the driver actually named, when it named one.
 *
 * Preferred over the message: it is a field rather than prose, so it does not
 * move when Prisma rewords itself. The message stays as the fallback, since
 * this nesting is adapter-specific and an unfamiliar adapter may not fill it.
 */
function namedColumn(error: unknown): string | null {
  if (typeof error !== 'object' || error === null) return null;
  const meta = (error as { meta?: unknown }).meta;
  if (typeof meta !== 'object' || meta === null) return null;
  const adapterError = (meta as { driverAdapterError?: unknown })
    .driverAdapterError;
  if (typeof adapterError !== 'object' || adapterError === null) return null;
  const cause = (adapterError as { cause?: unknown }).cause;
  if (typeof cause !== 'object' || cause === null) return null;
  const column = (cause as { column?: unknown }).column;
  return typeof column === 'string' && column.length > 0 ? column : null;
}

/**
 * @param opts.dev  Whether to include the fix and the internals. Defaults to
 *   "not production" — taken as a parameter because the production behaviour
 *   is the half most worth testing and `NODE_ENV` is not writable under test.
 */
export function classifyLoadError(
  error: unknown,
  opts: { dev?: boolean } = {},
): LoadErrorInfo {
  const dev = opts.dev ?? process.env.NODE_ENV !== 'production';
  const code = prismaCode(error);

  // P2022 column not found, P2021 table not found. Both mean the same thing to
  // a person: this database file predates the schema the app is running.
  if (code === 'P2022' || code === 'P2021') {
    return {
      title: 'The database is behind the app',
      message:
        'The schema has moved on since this database was created, so the map cannot be read. Nothing is lost — the database just needs to catch up.',
      ...(dev
        ? {
            command: 'npm run db:push',
            detail: `${code} · ${
              namedColumn(error) ?? diagnosisLine(messageOf(error))
            }`,
          }
        : {}),
    };
  }

  // P1001 unreachable, P1003 the database does not exist at that path.
  if (code === 'P1001' || code === 'P1003') {
    return {
      title: "Can't reach the database",
      message:
        'The app is running but nothing answered at the database it was pointed at.',
      ...(dev
        ? {
            hint: 'Check DATABASE_URL in .env — DATABASE.md covers the setup.',
            detail: `${code} · ${diagnosisLine(messageOf(error))}`,
          }
        : {}),
    };
  }

  // Everything else. No internals: an unrecognised failure is exactly the case
  // where we do not know what is safe to show.
  return {
    title: 'Something went wrong loading this map',
    message:
      'The map is still there. Reloading is worth a try, and the terminal running the app has the details.',
    ...(dev ? { detail: diagnosisLine(messageOf(error)) } : {}),
  };
}
