import { describe, expect, it } from 'vitest';
import { classifyLoadError } from './loadError';

// The two things a screenshot of this feature cannot show.
//
// The first is the PRODUCTION half: every capture runs in development, so the
// frames all show the command and the column name. That the same input yields
// neither when deployed is invisible to the eye and is the half that actually
// matters — it is the difference between a diagnosis and a leak.
//
// The second is the FALLBACK. An unrecognised error is by definition one we did
// not think of, so there is no scenario to capture for it; the guarantee worth
// pinning is that it says nothing it has not been taught to say.

/**
 * The reported failure, in the shape it actually arrives in.
 *
 * Built structurally rather than by importing Prisma's error class: the value
 * `classifyLoadError` receives has crossed a server component boundary, and the
 * classifier deliberately recognises it by `code` + `clientVersion` rather than
 * by `instanceof`. A fixture that used the real class would test a path
 * production does not take.
 */
const driftError = () => ({
  code: 'P2022',
  clientVersion: '7.10.0',
  meta: {
    modelName: 'ThinkingMap',
    driverAdapterError: {
      name: 'DriverAdapterError',
      cause: {
        originalCode: 'SQLITE_ERROR',
        kind: 'ColumnNotFound',
        column: 'main.MapNode.testsNodeId',
      },
    },
  },
  message:
    '\nInvalid `prisma.thinkingMap.findUnique()` invocation:\n\n\nThe column `main.MapNode.testsNodeId` does not exist in the current database.',
});

describe('classifyLoadError', () => {
  describe('a database behind the schema — P2022', () => {
    // The whole point of the feature in one assertion: the reported failure
    // becomes a diagnosis, the command that fixes it, and the exact column —
    // instead of a stack trace someone has to read Prisma's framing out of.
    it('names the fix and the column that is missing', () => {
      const info = classifyLoadError(driftError(), { dev: true });

      expect(info.title).toBe('The database is behind the app');
      expect(info.command).toBe('npm run db:push');
      expect(info.detail).toBe('P2022 · main.MapNode.testsNodeId');
    });

    // The half no screenshot can show, since every capture runs in
    // development. Deployed, the same input must keep the diagnosis and drop
    // the command and the column — one describes our schema, the other is
    // useless to a visitor. This is the security claim of the whole screen.
    it('withholds both once deployed', () => {
      const info = classifyLoadError(driftError(), { dev: false });

      // The diagnosis survives — a visitor is still told what is wrong.
      expect(info.title).toBe('The database is behind the app');
      expect(info.message).toContain('schema has moved on');
      // What does not survive is anything only a maintainer can act on.
      expect(info.command).toBeUndefined();
      expect(info.detail).toBeUndefined();
    });

    // Pins WHICH line of the message is the diagnosis. Taking the first line
    // renders the call site and omits the column — the bug this test exists to
    // stop coming back.
    it('falls back to the message when the driver names no column', () => {
      // A different adapter fills `meta` differently or not at all. The last
      // line of a Prisma message is its diagnosis; the FIRST is the invocation
      // header, which names the call site instead of the problem.
      const { meta: _meta, ...withoutMeta } = driftError();

      expect(classifyLoadError(withoutMeta, { dev: true }).detail).toBe(
        'P2022 · The column `main.MapNode.testsNodeId` does not exist in the current database.',
      );
    });

    // Two Prisma codes, one situation as a person experiences it, so they must
    // not drift into two different screens.
    it('treats a missing table the same as a missing column', () => {
      // P2021 is the same situation one step further along — the database
      // predates the model entirely — and has the same one-command answer.
      const info = classifyLoadError(
        { code: 'P2021', clientVersion: '7.10.0', message: 'The table `main.MapNode` does not exist' },
        { dev: true },
      );

      expect(info.title).toBe('The database is behind the app');
      expect(info.command).toBe('npm run db:push');
    });
  });

  describe('a database that cannot be reached — P1001', () => {
    // Guards the command/hint split at the source. There is nothing runnable
    // for an unreachable database, so `command` must stay empty and the
    // guidance must travel as prose.
    it('points at the setting rather than offering a command', () => {
      const info = classifyLoadError(
        { code: 'P1001', clientVersion: '7.10.0', message: "Can't reach database server" },
        { dev: true },
      );

      expect(info.title).toBe("Can't reach the database");
      expect(info.hint).toContain('DATABASE_URL');
      // Prose belongs in `hint`. Nothing here is runnable, so nothing goes in
      // the pill — that separation is the point of the two fields.
      expect(info.command).toBeUndefined();
    });
  });

  describe('anything else', () => {
    // The fallback carries a connection string and a username to prove the
    // point: an error we did not anticipate is exactly the one where we cannot
    // know what is safe to show, so nothing from it reaches the page.
    it('leaks nothing it was not taught to say', () => {
      const info = classifyLoadError(
        new Error('connect ECONNREFUSED 10.0.0.4:5432 as user admin'),
        { dev: false },
      );

      expect(info.title).toBe('Something went wrong loading this map');
      expect(info.command).toBeUndefined();
      expect(info.hint).toBeUndefined();
      expect(info.detail).toBeUndefined();
    });

    // Why the recogniser requires `clientVersion` and not just `code`.
    // Without it, a missing FILE would be diagnosed as a missing COLUMN and
    // someone would be told to run db:push over an unrelated failure.
    it('is not fooled by an object that merely has a code', () => {
      // A Node system error carries `code` ('ENOENT') but no `clientVersion`.
      // Matching on `code` alone would dress an unrelated failure up as a
      // Prisma diagnosis and tell someone to run db:push for a missing file.
      const info = classifyLoadError({ code: 'P2022', message: 'not really prisma' }, { dev: true });

      expect(info.title).toBe('Something went wrong loading this map');
      expect(info.command).toBeUndefined();
    });

    // A throw is not obliged to throw an Error. This classifier runs on the
    // failure path, so it must not itself crash on the way to explaining a
    // crash.
    it('survives a thrown value that is not an error at all', () => {
      expect(classifyLoadError('something threw a string', { dev: true }).title).toBe(
        'Something went wrong loading this map',
      );
      expect(classifyLoadError(undefined, { dev: true }).title).toBe(
        'Something went wrong loading this map',
      );
    });
  });
});
