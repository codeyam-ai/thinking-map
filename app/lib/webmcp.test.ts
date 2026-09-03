import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  bindTools,
  isWebMcpAvailable,
  onModelContextReady,
  publishAgentDriver,
  requestUserInteraction,
  webMcpUnavailableReason,
  type BindReport,
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

/** Binds and resolves with the report. Registration is async now — the shipped
 *  registerTool returns a promise — so the outcome cannot be read in the same
 *  tick the binding is made. */
function nextReport(ctx: { mapId: string }): Promise<BindReport> {
  return new Promise((resolve) => {
    bindTools({ ...ctx, onReport: resolve });
  });
}

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
    expect(registered).toHaveLength(CATALOG_SIZE);
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
    expect(removed).toHaveLength(CATALOG_SIZE);
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
    expect(calls).toBe(CATALOG_SIZE);
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
    expect(sets).toEqual([CATALOG_SIZE, 0]);
  });

  // Registration used to fail silently, so a page could report an attached
  // agent while offering nothing. The report is what makes the difference
  // observable — to the header, to the dev panel, and to this test.
  it('reports which tools the browser accepted and which it refused', async () => {
    vi.stubGlobal('navigator', {
      modelContext: {
        // A REJECTION, not a throw: the shipped registerTool is async, so this
        // is the shape a real refusal arrives in.
        registerTool: (d: { name: string }) =>
          d.name === 'add_nodes'
            ? Promise.reject(new Error('InvalidStateError'))
            : Promise.resolve(),
        unregisterTool: () => {},
      },
    });
    const report = await nextReport({ mapId: 'm' });
    expect(report.convention).toBe('registerTool');
    expect(report.registered).toContain('read_map');
    expect(report.registered).not.toContain('add_nodes');
    expect(report.failed).toEqual([
      { name: 'add_nodes', reason: 'InvalidStateError' },
    ]);
  });

  // Chrome unregisters by AbortSignal rather than by name, so the binding has
  // to hand one over — a disposer that cannot cancel leaves the next map's
  // binding failing on live names.
  it('passes an abort signal that disposal fires', async () => {
    let signal: AbortSignal | undefined;
    vi.stubGlobal('navigator', {
      modelContext: {
        registerTool: (_d: unknown, opts?: { signal?: AbortSignal }) => {
          signal ??= opts?.signal;
          return Promise.resolve();
        },
      },
    });
    const dispose = bindTools({ mapId: 'm' });
    expect(signal).toBeInstanceOf(AbortSignal);
    expect(signal!.aborted).toBe(false);
    dispose();
    expect(signal!.aborted).toBe(true);
  });

  // The descriptors have to reach a real `postMessage`-shaped boundary intact.
  // A browser that clones on the way in is the honest simulation of Chrome's
  // own behaviour, and the old Zod-schema descriptors died exactly here.
  it('registers through a browser that structured-clones the descriptor', async () => {
    const seen: { name: string; inputSchema: unknown }[] = [];
    vi.stubGlobal('navigator', {
      modelContext: {
        registerTool: (d: { name: string; inputSchema: unknown }) => {
          // Throws DataCloneError on anything a real registration would reject.
          seen.push(
            structuredClone({ name: d.name, inputSchema: d.inputSchema }),
          );
        },
        unregisterTool: () => {},
      },
    });
    const report = await nextReport({ mapId: 'm' });
    expect(report.failed).toEqual([]);
    expect(report.registered).toHaveLength(CATALOG_SIZE);
    expect(seen.find((t) => t.name === 'read_map')?.inputSchema).toMatchObject({
      type: 'object',
    });
  });

  // The surface that actually matters. Chrome's imperative-API guide and
  // ChatGPT's WebMCP docs both register on `document.modelContext`; the page
  // read only `navigator`, so a browser WITH WebMCP reported "no browser agent"
  // and registered nothing. This is that bug, pinned.
  it('binds to document.modelContext, where the browser actually keeps it', async () => {
    const registered: string[] = [];
    vi.stubGlobal('navigator', {});
    vi.stubGlobal('document', {
      modelContext: {
        registerTool: (d: { name: string }) => {
          registered.push(d.name);
          return Promise.resolve();
        },
      },
    });
    const report = await nextReport({ mapId: 'm' });
    expect(registered).toContain('read_map');
    expect(report.registered).toHaveLength(CATALOG_SIZE);
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
    expect(driver.listTools()).toHaveLength(CATALOG_SIZE);
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

// The agent injects the model context, not the page, and nothing guarantees it
// lands before React hydrates — in the ChatGPT and Chrome integrated browsers
// it frequently does not. A one-shot check at mount is a race the page loses
// silently, reporting "no browser agent" forever on a page that acquired one
// 300ms later.
describe('onModelContextReady', () => {
  // Stands in for a window that can be listened to and whose agent can arrive
  // partway through, which is the whole point of the watch.
  function watchableWindow() {
    const listeners = new Map<string, Set<() => void>>();
    return {
      isSecureContext: true,
      addEventListener: (type: string, fn: () => void) => {
        if (!listeners.has(type)) listeners.set(type, new Set());
        listeners.get(type)!.add(fn);
      },
      removeEventListener: (type: string, fn: () => void) => {
        listeners.get(type)?.delete(fn);
      },
      emit: (type: string) => listeners.get(type)?.forEach((fn) => fn()),
      listenerCount: () =>
        [...listeners.values()].reduce((n, set) => n + set.size, 0),
    };
  }

  // The common case in an ordinary browser: the agent is already there, so the
  // page must bind now rather than wait a poll interval to notice.
  it('fires immediately when the model context is already present', () => {
    vi.stubGlobal('window', watchableWindow());
    vi.stubGlobal('document', { modelContext: {} });
    const ready = vi.fn();
    onModelContextReady(ready);
    expect(ready).toHaveBeenCalledTimes(1);
  });

  // The race this exists for. Nothing at mount, an agent a moment later, and
  // the page has to notice on its own.
  it('fires once the model context appears later', () => {
    vi.useFakeTimers();
    vi.stubGlobal('window', watchableWindow());
    vi.stubGlobal('document', {});
    const ready = vi.fn();
    onModelContextReady(ready);
    expect(ready).not.toHaveBeenCalled();

    vi.stubGlobal('document', { modelContext: {} });
    vi.advanceTimersByTime(500);
    expect(ready).toHaveBeenCalledTimes(1);

    // And only once, however long the page stays open afterwards.
    vi.advanceTimersByTime(5_000);
    expect(ready).toHaveBeenCalledTimes(1);
    vi.useRealTimers();
  });

  // Some hosts announce themselves rather than make the page poll. Honouring
  // the event removes up to a quarter-second of lag when they do.
  it('fires on a host-announced ready event without waiting for a poll', () => {
    vi.useFakeTimers();
    const fakeWindow = watchableWindow();
    vi.stubGlobal('window', fakeWindow);
    vi.stubGlobal('document', {});
    const ready = vi.fn();
    onModelContextReady(ready);

    vi.stubGlobal('document', { modelContext: {} });
    fakeWindow.emit('modelcontextready');
    expect(ready).toHaveBeenCalledTimes(1);
    vi.useRealTimers();
  });

  // An announcement with no agent actually behind it is not readiness. Firing
  // here would bind against nothing and report a connection that does not
  // exist — the exact class of lie this feature was built to end.
  it('ignores a ready event when no model context arrived with it', () => {
    vi.useFakeTimers();
    const fakeWindow = watchableWindow();
    vi.stubGlobal('window', fakeWindow);
    vi.stubGlobal('document', {});
    const ready = vi.fn();
    onModelContextReady(ready);

    fakeWindow.emit('mcp-ready');
    expect(ready).not.toHaveBeenCalled();
    vi.useRealTimers();
  });

  // Bounded on purpose: an agent that has not appeared within the window is not
  // coming, and a map left open for hours must not keep an interval and two
  // listeners alive waiting for one.
  it('stops watching after the deadline and never fires', () => {
    vi.useFakeTimers();
    const fakeWindow = watchableWindow();
    vi.stubGlobal('window', fakeWindow);
    vi.stubGlobal('document', {});
    const ready = vi.fn();
    onModelContextReady(ready);

    vi.advanceTimersByTime(30_001);
    expect(fakeWindow.listenerCount()).toBe(0);

    vi.stubGlobal('document', { modelContext: {} });
    vi.advanceTimersByTime(5_000);
    expect(ready).not.toHaveBeenCalled();
    vi.useRealTimers();
  });

  // Navigating between boards disposes the watch. A leaked one would keep
  // polling for a map the page has already left.
  it('stops watching when disposed', () => {
    vi.useFakeTimers();
    const fakeWindow = watchableWindow();
    vi.stubGlobal('window', fakeWindow);
    vi.stubGlobal('document', {});
    const ready = vi.fn();
    const stop = onModelContextReady(ready);

    stop();
    expect(fakeWindow.listenerCount()).toBe(0);

    vi.stubGlobal('document', { modelContext: {} });
    vi.advanceTimersByTime(5_000);
    expect(ready).not.toHaveBeenCalled();
    vi.useRealTimers();
  });

  // Server rendering has no window to watch, and this runs during the bridge's
  // setup — throwing here would take the whole map page down.
  it('does nothing outside a browser', () => {
    vi.stubGlobal('window', undefined);
    const ready = vi.fn();
    expect(() => onModelContextReady(ready)()).not.toThrow();
    expect(ready).not.toHaveBeenCalled();
  });
});

// Brings the page forward so the person actually sees an ask_user question.
// It lives in this file so that this stays the ONLY place naming where the
// browser keeps its model context — the bridge used to reach for
// `navigator.modelContext` itself, quietly making it a second place the
// discovery fix had to be applied.
describe('requestUserInteraction', () => {
  // The supported host: the work is handed to the browser so it can surface the
  // tab first, and the result still comes back to the caller.
  it('delegates to the host and returns the result', async () => {
    const seen: unknown[] = [];
    vi.stubGlobal('document', {
      modelContext: {
        requestUserInteraction: (run: () => Promise<unknown>) => {
          seen.push(run);
          return run();
        },
      },
    });
    vi.stubGlobal('navigator', {});

    await expect(requestUserInteraction(async () => 'answered')).resolves.toBe(
      'answered',
    );
    expect(seen).toHaveLength(1);
  });

  // A host without the capability must still run the work. Requiring it would
  // mean a question that is never asked rather than one asked in a background
  // tab, and the second is plainly the better failure.
  it('runs the work directly when the host does not support it', async () => {
    vi.stubGlobal('document', { modelContext: {} });
    vi.stubGlobal('navigator', {});
    await expect(requestUserInteraction(async () => 'answered')).resolves.toBe(
      'answered',
    );
  });

  // No agent at all — an ordinary browser, or a captured scenario — takes the
  // same path rather than throwing on a missing model context.
  it('runs the work directly when there is no model context', async () => {
    vi.stubGlobal('document', {});
    vi.stubGlobal('navigator', {});
    await expect(requestUserInteraction(async () => 'answered')).resolves.toBe(
      'answered',
    );
  });

  // A rejection is the agent's to handle. Swallowing it here would settle a
  // pending question with nothing and leave the agent waiting on a turn that
  // already failed.
  it('propagates a rejection from the work', async () => {
    vi.stubGlobal('document', {});
    vi.stubGlobal('navigator', {});
    await expect(
      requestUserInteraction(async () => {
        throw new Error('timed out');
      }),
    ).rejects.toThrow('timed out');
  });
});
