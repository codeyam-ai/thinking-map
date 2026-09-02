import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  bindTools,
  isWebMcpAvailable,
  publishAgentDriver,
  webMcpUnavailableReason,
} from './webmcp';
import { TOOL_CATALOG } from './toolCatalog';

// Counted from the catalog rather than written down: the claim these tests
// make is "every shared tool is bound", and a literal would restate the
// catalog's size as a second source of truth that goes stale the next time a
// tool is added.
const CATALOG_SIZE = TOOL_CATALOG.length;

// WebMCP is top-level-secure-context only. Getting these gates wrong in either
// direction is costly: too strict and a real agent silently cannot attach; too
// loose and the page claims to be connected to nothing. The iframe branch in
// particular is why every codeyam preview and captured scenario is unbound —
// that is by design, and it needs to stay honestly reported rather than
// mistaken for a bug.

function setEnvironment(options: {
  secure?: boolean;
  topLevel?: boolean;
  agent?: boolean;
}) {
  const { secure = true, topLevel = true, agent = true } = options;
  vi.stubGlobal('window', {
    isSecureContext: secure,
    // `window.top === window` is the top-level test; a distinct object stands
    // in for being framed.
    top: topLevel ? undefined : {},
  });
  // Self-reference so `window.top === window` holds in the top-level case.
  const w = globalThis.window as unknown as { top: unknown };
  if (topLevel) w.top = globalThis.window;

  vi.stubGlobal('navigator', agent ? { modelContext: {} } : {});
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('isWebMcpAvailable', () => {
  // The only configuration where a real agent can attach. If this goes false
  // the feature is dead in the one place it is supposed to work.
  it('is available in a top-level secure page with a browser agent', () => {
    setEnvironment({});
    expect(isWebMcpAvailable()).toBe(true);
  });

  // Any browser older than Chrome 146 lands here, which is most of them today.
  it('is unavailable without a browser agent', () => {
    setEnvironment({ agent: false });
    expect(isWebMcpAvailable()).toBe(false);
  });

  // Binding tools over plain HTTP would hand map-write access to anyone on the
  // wire, so this gate must hold even when an agent is present.
  it('is unavailable outside a secure context', () => {
    setEnvironment({ secure: false });
    expect(isWebMcpAvailable()).toBe(false);
  });

  // The codeyam capture iframe lands here every time.
  it('is unavailable inside an iframe', () => {
    setEnvironment({ topLevel: false });
    expect(isWebMcpAvailable()).toBe(false);
  });
});

describe('webMcpUnavailableReason', () => {
  // A bound page must return null, since the UI shows this string only when
  // there is genuinely something wrong to report.
  it('reports nothing to explain when the page is bound', () => {
    setEnvironment({});
    expect(webMcpUnavailableReason()).toBeNull();
  });

  // Each reason names a different fix, so they must not collapse into one
  // generic "unavailable" the person cannot act on.
  it('names the insecure context', () => {
    setEnvironment({ secure: false });
    expect(webMcpUnavailableReason()).toBe('needs HTTPS or localhost');
  });

  // This is the string every codeyam preview and captured scenario shows. It
  // has to read as an expected condition, not as a failure.
  it('names the iframe', () => {
    setEnvironment({ topLevel: false });
    expect(webMcpUnavailableReason()).toBe('running inside an iframe');
  });

  // Naming the version requirement is the difference between a person knowing
  // what to do next and assuming the page is broken.
  it('names the missing browser agent', () => {
    setEnvironment({ agent: false });
    expect(webMcpUnavailableReason()).toBe('no browser agent (needs Chrome 146+)');
  });

  // The security gates are checked before the agent gate, so an insecure page
  // is told to fix that first rather than being sent hunting for a browser.
  it('reports the security problem first when several apply', () => {
    setEnvironment({ secure: false, agent: false });
    expect(webMcpUnavailableReason()).toBe('needs HTTPS or localhost');
  });
});

// The two functions that talk to the browser. `navigator.modelContext` is the
// only thing they touch, so a stub of it is enough to check the parts that
// actually matter: that both spec conventions are handled, and that disposal
// really unregisters — a live name re-registered throws InvalidStateError, so a
// leaky disposer breaks the next map the person opens.

describe('bindTools', () => {
  // The current spec convention (Chrome 146+): one registerTool per tool.
  it('registers every tool through registerTool when that convention is present', () => {
    const registered: string[] = [];
    vi.stubGlobal('navigator', {
      modelContext: {
        registerTool: (d: { name: string }) => registered.push(d.name),
        unregisterTool: () => {},
      },
    });
    bindTools({ mapId: 'm' });
    expect(registered).toContain('read_map');
    expect(registered).toContain('await_user_activity');
    expect(registered).toHaveLength(9);
  });

  // Disposal must remove exactly what was registered, or re-binding the same
  // name on the next map throws InvalidStateError.
  it('unregisters everything it registered when disposed', () => {
    const removed: string[] = [];
    vi.stubGlobal('navigator', {
      modelContext: {
        registerTool: () => {},
        unregisterTool: (name: string) => removed.push(name),
      },
    });
    bindTools({ mapId: 'm' })();
    expect(removed).toHaveLength(9);
    expect(removed).toContain('post_note');
  });

  // A name left registered by a binding that failed to dispose must not take
  // down the whole binding — losing one tool beats losing all of them.
  it('keeps binding the rest when one registration throws', () => {
    let calls = 0;
    vi.stubGlobal('navigator', {
      modelContext: {
        registerTool: () => {
          calls += 1;
          if (calls === 1) throw new Error('InvalidStateError');
        },
        unregisterTool: () => {},
      },
    });
    expect(() => bindTools({ mapId: 'm' })).not.toThrow();
    expect(calls).toBe(9);
  });

  // The pre-March-2026 convention the @mcp-b/global polyfill still ships:
  // one call replaces the whole set, so disposal clears it with an empty set.
  it('falls back to provideContext when only the older convention exists', () => {
    const sets: number[] = [];
    vi.stubGlobal('navigator', {
      modelContext: {
        provideContext: ({ tools }: { tools: unknown[] }) => sets.push(tools.length),
      },
    });
    const dispose = bindTools({ mapId: 'm' });
    dispose();
    expect(sets).toEqual([9, 0]);
  });

  // No agent at all — the common case, including every codeyam capture. It must
  // be a silent no-op with a disposer that is safe to call.
  it('does nothing and returns a safe disposer with no browser agent', () => {
    vi.stubGlobal('navigator', {});
    expect(() => bindTools({ mapId: 'm' })()).not.toThrow();
  });
});

describe('publishAgentDriver', () => {
  // This driver is the only way the tools can be driven inside a capture
  // iframe, where WebMCP is unreachable by design.
  it('publishes a driver listing every catalog tool', () => {
    const fakeWindow: Record<string, unknown> = {};
    vi.stubGlobal('window', fakeWindow);
    publishAgentDriver({ mapId: 'map-1' });
    const driver = fakeWindow.__thinkingMapAgent as {
      mapId: string;
      listTools: () => { name: string }[];
    };
    expect(driver.mapId).toBe('map-1');
    expect(driver.listTools().map((t) => t.name)).toContain('read_map');
    expect(driver.listTools()).toHaveLength(9);
  });

  // Disposal removes the driver so a stale one cannot answer for a map the
  // page has already navigated away from.
  it('removes its own driver on disposal', () => {
    const fakeWindow: Record<string, unknown> = {};
    vi.stubGlobal('window', fakeWindow);
    publishAgentDriver({ mapId: 'map-1' })();
    expect(fakeWindow.__thinkingMapAgent).toBeUndefined();
  });

  // A disposer from a previous map must not delete the driver a newer binding
  // has already published, or the current page loses its tools.
  it('leaves a newer map’s driver alone when an older disposer runs', () => {
    const fakeWindow: Record<string, unknown> = {};
    vi.stubGlobal('window', fakeWindow);
    const disposeOld = publishAgentDriver({ mapId: 'map-1' });
    publishAgentDriver({ mapId: 'map-2' });
    disposeOld();
    expect(
      (fakeWindow.__thinkingMapAgent as { mapId: string } | undefined)?.mapId,
    ).toBe('map-2');
  });
});
