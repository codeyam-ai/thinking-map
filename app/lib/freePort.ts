// "Give me a localhost port nothing is using."
//
// Three callers needed this and three callers had written it: the test
// database (`app/lib/testDatabase.ts`), the development database
// (`scripts/ensureDevDatabase.ts`), and the browser eval run
// (`scripts/run-browser-evals.ts`). The copies had already drifted — one
// unref'd its probe socket and the others did not — which is the ordinary way a
// duplicated helper goes wrong: not by being wrong, but by being three slightly
// different rights.
//
// The technique is the standard one and worth stating once: bind to port 0, let
// the OS assign a free port, read it back, and close. It is advisory rather
// than a reservation — nothing stops something else claiming the port between
// the close and the caller's own bind — which is fine for a server started
// immediately afterwards and is not a lock.

import { createServer } from 'node:net';

/**
 * An unused localhost port.
 *
 * @param purpose - what the port is for, used only in the failure message.
 *   Required rather than defaulted because the message is the entire value of
 *   the failure path: "could not find a free port" tells a reader nothing about
 *   which of the three servers failed to start.
 */
export function freePort(purpose: string): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = createServer();
    // Do not hold the event loop open on the probe socket. Without this a
    // caller that fails between the listen and the close can leave the process
    // alive with nothing to do.
    server.unref();
    server.on('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      if (address === null || typeof address === 'string') {
        server.close();
        reject(new Error(`could not determine a free port for the ${purpose}`));
        return;
      }
      const { port } = address;
      server.close(() => resolve(port));
    });
  });
}
