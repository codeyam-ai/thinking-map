// Deciding whether a URL the person typed may be fetched by our server.
//
// This exists because of what the fetch route is: a server that will retrieve
// any address a stranger hands it. Without a guard, `http://169.254.169.254/`
// reads the cloud instance's credentials endpoint, `http://localhost:5555/`
// reads whatever else is bound on the box, and both come back out through the
// attached brief in plain sight. That is server-side request forgery, and it
// is the whole reason this module is separate and tested rather than a handful
// of `if`s inside the handler.
//
// No `server-only` import, unlike `briefText.ts`: the `node:dns` dependency is
// its own guard — a client bundle importing this fails loudly at build — and
// leaving it off keeps the module directly testable, which is the point of it
// being a module at all.

import { isIP } from 'node:net';
import { lookup } from 'node:dns/promises';

/** Either a URL we are willing to fetch, or a sentence saying why not.
 *  Never both, and never a thrown error: a bad address is a thing the person
 *  typed, not a fault, so it belongs in the return value. */
export type UrlVerdict =
  | { url: URL; error: null }
  | { url: null; error: string };

/**
 * Syntax, scheme and credentials — everything decidable without a network.
 *
 * Split from the DNS half so the pure rules can be tested exhaustively and so
 * the fetch can re-run the whole check per redirect hop without paying for a
 * lookup it does not need.
 */
export function parseBriefUrl(raw: string): UrlVerdict {
  const trimmed = raw.trim();
  if (trimmed.length === 0) {
    return { url: null, error: 'Paste a link first.' };
  }

  // Someone typing an address rarely types the scheme. Assume https rather
  // than rejecting, but only when there is no scheme at all — `ftp://x` is a
  // deliberate choice and gets the honest refusal below.
  const candidate = /^[a-z][a-z0-9+.-]*:/i.test(trimmed)
    ? trimmed
    : `https://${trimmed}`;

  let url: URL;
  try {
    url = new URL(candidate);
  } catch {
    return { url: null, error: `${trimmed} is not a web address.` };
  }

  if (url.protocol !== 'https:' && url.protocol !== 'http:') {
    return {
      url: null,
      error: `We can only read http and https pages. ${url.protocol.replace(
        ':',
        '',
      )} is not one — paste the text instead.`,
    };
  }

  // `https://user:pass@host/` would send someone else's credentials from our
  // server, and is also the classic way to disguise the real host from a
  // person reading the address.
  if (url.username.length > 0 || url.password.length > 0) {
    return {
      url: null,
      error: 'That link carries a username and password. Remove them and try again.',
    };
  }

  if (url.hostname.length === 0) {
    return { url: null, error: `${trimmed} has no site in it.` };
  }

  return { url, error: null };
}

/** IPv4 ranges that are not the public internet: this-network, private,
 *  carrier NAT, loopback, link-local, IETF protocol assignments,
 *  benchmarking, multicast, and the reserved top sixteenth. */
const BLOCKED_V4: ReadonlyArray<readonly [string, number]> = [
  ['0.0.0.0', 8],
  ['10.0.0.0', 8],
  ['100.64.0.0', 10],
  ['127.0.0.0', 8],
  ['169.254.0.0', 16],
  ['172.16.0.0', 12],
  ['192.0.0.0', 24],
  ['192.168.0.0', 16],
  ['198.18.0.0', 15],
  ['224.0.0.0', 4],
  ['240.0.0.0', 4],
];

function v4ToInt(address: string): number | null {
  const parts = address.split('.');
  if (parts.length !== 4) return null;
  let value = 0;
  for (const part of parts) {
    if (!/^\d{1,3}$/.test(part)) return null;
    const octet = Number(part);
    if (octet > 255) return null;
    value = value * 256 + octet;
  }
  return value;
}

/**
 * Expand any IPv6 form — `::`, embedded IPv4, the lot — into eight 16-bit
 * groups, or null when it is not an IPv6 address at all.
 */
function expandIpv6(address: string): number[] | null {
  let text = address;

  // A zone id (`fe80::1%eth0`) is a local routing detail, and everything
  // carrying one is link-local anyway.
  const zone = text.indexOf('%');
  if (zone !== -1) text = text.slice(0, zone);

  // `::ffff:192.168.0.1` — the trailing dotted quad becomes the last two
  // groups. This is the form a mapped IPv4 address arrives in, and missing it
  // would let every blocked v4 range through wearing a v6 hat.
  const lastColon = text.lastIndexOf(':');
  const tail = text.slice(lastColon + 1);
  if (tail.includes('.')) {
    const asInt = v4ToInt(tail);
    if (asInt === null) return null;
    text = `${text.slice(0, lastColon + 1)}${((asInt >>> 16) & 0xffff)
      .toString(16)}:${(asInt & 0xffff).toString(16)}`;
  }

  const halves = text.split('::');
  if (halves.length > 2) return null;

  const head = halves[0] ? halves[0].split(':') : [];
  const rest = halves.length === 2 ? (halves[1] ? halves[1].split(':') : []) : null;

  const groups: number[] = [];
  const push = (part: string): boolean => {
    if (!/^[0-9a-f]{1,4}$/i.test(part)) return false;
    groups.push(parseInt(part, 16));
    return true;
  };

  for (const part of head) if (!push(part)) return null;

  if (rest === null) {
    return groups.length === 8 ? groups : null;
  }

  const tailGroups: number[] = [];
  for (const part of rest) {
    if (!/^[0-9a-f]{1,4}$/i.test(part)) return null;
    tailGroups.push(parseInt(part, 16));
  }

  const zeros = 8 - groups.length - tailGroups.length;
  if (zeros < 0) return null;
  return [...groups, ...Array(zeros).fill(0), ...tailGroups];
}

/**
 * Is this resolved address somewhere we refuse to go?
 *
 * Pure and exported so the rule can be tested address by address — the ranges
 * are the security boundary, and a boundary nobody can enumerate in a test is
 * a boundary nobody can trust.
 */
export function isBlockedAddress(address: string): boolean {
  const family = isIP(address);

  if (family === 4) {
    const value = v4ToInt(address);
    if (value === null) return true;
    return BLOCKED_V4.some(([base, bits]) => {
      const baseValue = v4ToInt(base);
      if (baseValue === null) return false;
      const mask = bits === 0 ? 0 : (-1 << (32 - bits)) >>> 0;
      return ((value ^ baseValue) & mask) === 0;
    });
  }

  if (family === 6) {
    const groups = expandIpv6(address);
    if (groups === null) return true;

    // `::ffff:a.b.c.d` is an IPv4 address in v6 clothing — judge it as the
    // v4 address it actually is rather than letting it past this branch.
    const mappedV4 =
      groups.slice(0, 5).every((g) => g === 0) && groups[5] === 0xffff;
    if (mappedV4) {
      const value = (groups[6] << 16) | groups[7];
      return isBlockedAddress(
        [24, 16, 8, 0].map((shift) => (value >>> shift) & 0xff).join('.'),
      );
    }

    if (groups.every((g) => g === 0)) return true; // ::
    if (groups.slice(0, 7).every((g) => g === 0) && groups[7] === 1) return true; // ::1
    if ((groups[0] & 0xfe00) === 0xfc00) return true; // fc00::/7 unique-local
    if ((groups[0] & 0xffc0) === 0xfe80) return true; // fe80::/10 link-local
    if ((groups[0] & 0xff00) === 0xff00) return true; // ff00::/8 multicast
    return false;
  }

  // Not an IP literal at all. Callers only pass resolved addresses here, so
  // anything else is a surprise, and a surprise is a no.
  return true;
}

/** What to say when an address turns out to be somewhere inside our own
 *  network. Deliberately the same sentence whatever it resolved to: telling a
 *  stranger which of their guesses hit something is how a refusal becomes a
 *  port scanner. */
const PRIVATE_REFUSAL =
  'That link points inside a private network, so there is nothing there we can read. Paste the text instead.';

/**
 * The full check: syntax, scheme, credentials, then where the host actually
 * resolves to.
 *
 * Every address the hostname answers with is checked, not just the first — a
 * name that resolves to both a public address and `127.0.0.1` is a name we
 * refuse, because which one the fetch picks is not ours to decide.
 *
 * The honest limit: this resolves the name, and then `fetch` resolves it again
 * a moment later. A hostname whose DNS answer changes between the two calls
 * can still slip past — the classic rebinding hole. Closing it properly means
 * pinning the resolved address into the connection itself via a custom undici
 * dispatcher, which is a bigger change than this intake justifies today. The
 * window is narrow and the guard still stops every static private address,
 * which is the shape every casual attempt takes.
 */
export async function checkBriefUrl(raw: string | URL): Promise<UrlVerdict> {
  const parsed =
    typeof raw === 'string'
      ? parseBriefUrl(raw)
      : ({ url: raw, error: null } as UrlVerdict);
  if (!parsed.url) return parsed;

  // A bracketed IPv6 literal arrives as `[::1]`; the brackets are URL syntax,
  // not part of the address.
  const hostname = parsed.url.hostname.replace(/^\[|\]$/g, '');

  if (isIP(hostname) !== 0) {
    return isBlockedAddress(hostname)
      ? { url: null, error: PRIVATE_REFUSAL }
      : parsed;
  }

  let addresses: Array<{ address: string }>;
  try {
    addresses = await lookup(hostname, { all: true });
  } catch {
    return {
      url: null,
      error: `We could not find ${hostname}. Check the address and try again.`,
    };
  }

  if (addresses.length === 0 || addresses.some((a) => isBlockedAddress(a.address))) {
    return { url: null, error: PRIVATE_REFUSAL };
  }

  return parsed;
}

/** A page that bounces this many times is not trying to show us a document. */
const MAX_REDIRECTS = 5;

/** Either the response and the address it finally came from, or the sentence
 *  explaining why we stopped. The URL is the one that ANSWERED, not the one
 *  that was asked for — after a redirect those differ, and the brief should be
 *  named after where its words actually live. */
export type GuardedFetch =
  | { response: Response; url: URL; error: null }
  | { response: null; url: null; error: string };

/**
 * Fetch a URL, re-checking the guard at every hop.
 *
 * This lives HERE rather than in the route that calls it, and that placement
 * is the point. `redirect: 'follow'` would let a permitted host answer 302 to
 * `http://127.0.0.1/` with nothing left to check — so the guard is only a
 * guard if the redirect handling is part of it. Leaving the loop in a handler
 * meant the next route to reach for `checkBriefUrl` could do everything right
 * and still reopen the hole, because the half that matters was somewhere else.
 *
 * Every hop is validated as if the person had typed it.
 */
export async function fetchGuarded(
  raw: string,
  init: { signal?: AbortSignal; headers?: Record<string, string> } = {},
): Promise<GuardedFetch> {
  const first = await checkBriefUrl(raw);
  if (!first.url) return { response: null, url: null, error: first.error };

  let target = first.url;

  for (let hop = 0; hop <= MAX_REDIRECTS; hop += 1) {
    const response = await fetch(target, {
      redirect: 'manual',
      signal: init.signal,
      headers: init.headers,
    });

    const location = response.headers.get('location');
    if (response.status >= 300 && response.status < 400 && location) {
      const next = await checkBriefUrl(new URL(location, target));
      if (!next.url) return { response: null, url: null, error: next.error };
      target = next.url;
      continue;
    }

    return { response, url: target, error: null };
  }

  return {
    response: null,
    url: null,
    error:
      'That link keeps redirecting and never arrives anywhere. Paste the text instead.',
  };
}
