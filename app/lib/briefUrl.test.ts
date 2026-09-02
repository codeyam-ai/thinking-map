import { describe, expect, it } from 'vitest';
import { isBlockedAddress, parseBriefUrl } from './briefUrl';

// The guard on a server that will fetch any address a stranger hands it.
//
// These tests are the security boundary written down. Without them the rule
// lives only in a list of CIDR blocks that reads as correct to anyone
// skimming it — and a boundary nobody can enumerate is a boundary nobody can
// trust. Every range here is one an attacker actually reaches for: the cloud
// metadata endpoint, loopback, and the private blocks behind them.
//
// `checkBriefUrl` itself is deliberately NOT tested here: it resolves real
// hostnames through DNS, so a test of it would be a test of the network. Its
// two halves — the syntax rules and the address rules — are both pure, and
// both are covered below.

describe('parseBriefUrl', () => {
  // The ordinary case, and the reason the function returns a URL rather than
  // a boolean: everything downstream works from the parsed form.
  it('accepts an ordinary https page', () => {
    const verdict = parseBriefUrl('https://example.com/spec');
    expect(verdict.error).toBeNull();
    expect(verdict.url?.href).toBe('https://example.com/spec');
  });

  // Plain http is still most of the web, and refusing it would reject working
  // pages for a reason the person cannot act on.
  it('accepts plain http', () => {
    expect(parseBriefUrl('http://example.com/spec').error).toBeNull();
  });

  // Nobody types the scheme. Assuming https is the difference between a door
  // that works and one that rejects the first thing everyone tries.
  it('assumes https when no scheme was typed', () => {
    expect(parseBriefUrl('example.com/spec').url?.protocol).toBe('https:');
  });

  // `file://` is the one that matters: it would read the server's own disk.
  // The refusal names the scheme so the person knows what was wrong.
  it('refuses a file URL and says which scheme it refused', () => {
    const verdict = parseBriefUrl('file:///etc/passwd');
    expect(verdict.url).toBeNull();
    expect(verdict.error).toContain('file');
  });

  // Every other exotic scheme goes the same way, rather than being parsed and
  // handed to fetch to find out.
  it('refuses non-web schemes generally', () => {
    expect(parseBriefUrl('ftp://example.com/spec').url).toBeNull();
    expect(parseBriefUrl('data:text/html,<p>hi</p>').url).toBeNull();
  });

  // Credentials in a URL would send somebody else's password out of OUR
  // server, and are also the classic way to disguise the real host from a
  // person reading the address.
  it('refuses a URL carrying credentials', () => {
    const verdict = parseBriefUrl('https://user:pass@example.com/');
    expect(verdict.url).toBeNull();
    expect(verdict.error).toContain('username and password');
  });

  // An empty box is a thing to say, not a thing to crash on.
  it('asks for a link when given nothing', () => {
    expect(parseBriefUrl('   ').url).toBeNull();
  });

  // Whitespace around a pasted address is normal and is not the person's
  // mistake to fix.
  it('trims surrounding whitespace', () => {
    expect(parseBriefUrl('  https://example.com/spec  ').url?.href).toBe(
      'https://example.com/spec',
    );
  });

  // Not everything with a slash in it is an address.
  it('refuses something that is not a web address at all', () => {
    expect(parseBriefUrl('this is not a url').url).toBeNull();
  });
});

describe('isBlockedAddress', () => {
  // The single most valuable address to an attacker: on every major cloud it
  // serves the instance's own credentials to anything that asks.
  it('blocks the cloud metadata endpoint', () => {
    expect(isBlockedAddress('169.254.169.254')).toBe(true);
  });

  // Loopback reaches every other service bound on the same box — an admin
  // panel, a database, the app's own unauthenticated internals.
  it('blocks loopback across the whole /8, not just 127.0.0.1', () => {
    expect(isBlockedAddress('127.0.0.1')).toBe(true);
    expect(isBlockedAddress('127.1.2.3')).toBe(true);
  });

  // The three private blocks are the rest of whatever network this server
  // sits inside.
  it('blocks the private ranges', () => {
    expect(isBlockedAddress('10.0.0.5')).toBe(true);
    expect(isBlockedAddress('172.16.0.1')).toBe(true);
    expect(isBlockedAddress('172.31.255.254')).toBe(true);
    expect(isBlockedAddress('192.168.1.1')).toBe(true);
  });

  // The edges of 172.16/12 specifically, because it is the one range whose
  // boundaries are easy to get wrong by an octet.
  it('gets the edges of the 172.16/12 block right', () => {
    expect(isBlockedAddress('172.15.255.255')).toBe(false);
    expect(isBlockedAddress('172.32.0.0')).toBe(false);
  });

  // Carrier-grade NAT, benchmarking, multicast, the reserved top sixteenth,
  // and the unspecified address — none of them is a page.
  it('blocks the other non-public v4 ranges', () => {
    expect(isBlockedAddress('0.0.0.0')).toBe(true);
    expect(isBlockedAddress('100.64.0.1')).toBe(true);
    expect(isBlockedAddress('198.18.0.1')).toBe(true);
    expect(isBlockedAddress('224.0.0.1')).toBe(true);
    expect(isBlockedAddress('255.255.255.255')).toBe(true);
  });

  // The whole point is that ordinary public addresses go through.
  it('allows ordinary public addresses', () => {
    expect(isBlockedAddress('93.184.216.34')).toBe(false);
    expect(isBlockedAddress('8.8.8.8')).toBe(false);
    expect(isBlockedAddress('172.217.16.142')).toBe(false);
  });

  // IPv6 loopback and unspecified, in both the compressed forms they arrive in.
  it('blocks IPv6 loopback and unspecified', () => {
    expect(isBlockedAddress('::1')).toBe(true);
    expect(isBlockedAddress('::')).toBe(true);
  });

  // Unique-local and link-local are v6's private ranges.
  it('blocks IPv6 unique-local and link-local', () => {
    expect(isBlockedAddress('fc00::1')).toBe(true);
    expect(isBlockedAddress('fd12:3456:789a::1')).toBe(true);
    expect(isBlockedAddress('fe80::1')).toBe(true);
  });

  // A zone id is a local routing detail, and anything carrying one is
  // link-local anyway — parsing must not choke on the suffix and let it past.
  it('blocks a link-local address carrying a zone id', () => {
    expect(isBlockedAddress('fe80::1%eth0')).toBe(true);
  });

  // The bypass that makes an IPv6-unaware check useless: every blocked v4
  // range can be written as a v6 address, and has to be judged as the v4
  // address it actually is.
  it('blocks IPv4 addresses wearing an IPv6 mapping', () => {
    expect(isBlockedAddress('::ffff:127.0.0.1')).toBe(true);
    expect(isBlockedAddress('::ffff:169.254.169.254')).toBe(true);
    expect(isBlockedAddress('::ffff:10.0.0.1')).toBe(true);
  });

  // A mapped PUBLIC address is still public — the unwrapping must not turn
  // into a blanket refusal of the mapped form.
  it('allows a mapped public address', () => {
    expect(isBlockedAddress('::ffff:93.184.216.34')).toBe(false);
  });

  // Ordinary public IPv6 has to work.
  it('allows a public IPv6 address', () => {
    expect(isBlockedAddress('2606:2800:220:1:248:1893:25c8:1946')).toBe(false);
  });

  // Anything that is not a resolved address at all is a surprise, and a
  // surprise here has to fail closed rather than open.
  it('refuses anything that is not an address', () => {
    expect(isBlockedAddress('example.com')).toBe(true);
    expect(isBlockedAddress('')).toBe(true);
    expect(isBlockedAddress('999.999.999.999')).toBe(true);
  });
});
