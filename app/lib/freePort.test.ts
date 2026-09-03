import { createServer } from 'node:net';
import { describe, expect, it } from 'vitest';
import { freePort } from './freePort';

// This helper replaced three near-identical private copies, so what is worth
// pinning is the contract all three callers depend on — that the port is real
// and unclaimed — plus the one thing the copies disagreed about, which was how
// a failure describes itself.

describe('freePort', () => {
  // The contract all three callers depend on. A number in the right range would
  // satisfy a shape assertion while naming a port something else already holds,
  // so the proof that the port is usable is using it.
  it('returns a port that can actually be bound', async () => {
    const port = await freePort('test');

    // The proof that the port is usable is using it. A number in range would
    // pass a shape assertion while being a port something else already holds.
    const bound = await new Promise<number>((resolve, reject) => {
      const server = createServer();
      server.on('error', reject);
      server.listen(port, '127.0.0.1', () => {
        const address = server.address();
        const actual =
          address !== null && typeof address !== 'string' ? address.port : -1;
        server.close(() => resolve(actual));
      });
    });

    expect(bound).toBe(port);
  });

  // Two calls landing on one port would mean the probe socket was never really
  // released — the failure that would silently collide two servers started back
  // to back.
  it('does not hand out the same port twice in a row', async () => {
    // Not a guarantee the OS makes in general, but consecutive calls landing on
    // one port would mean the probe socket was never really released — the
    // failure mode that would silently collide two servers.
    const [a, b] = await Promise.all([freePort('test'), freePort('test')]);
    expect(a).not.toBe(b);
  });
});

// Not tested here: the `purpose` string in the failure message. Reaching that
// branch needs `server.address()` to return null or a pipe path, which a
// successful TCP listen never does — so any test of it would have to assert a
// message this file constructed itself, which pins nothing.
