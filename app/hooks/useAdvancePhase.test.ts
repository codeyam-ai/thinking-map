// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';
import { useAdvancePhase } from './useAdvancePhase';

// The ordering guarantee is the whole reason this is its own module: the note
// saying what was decided has to be on the log BEFORE the phase moves, so an
// agent reads the transition rather than inferring it from a value that changed
// under it. That is not visible in a screenshot, and it is exactly what a test
// can pin.

const refresh = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: () => refresh() }),
}));

afterEach(() => {
  vi.restoreAllMocks();
  refresh.mockClear();
});

/** Typed with fetch's own argument list, so a test can read back the URL and
 *  body the hook actually sent rather than just that it sent something. */
function mockFetch(impl: () => Promise<Partial<Response>>) {
  const spy = vi.fn(
    (_url: string, _init?: RequestInit) => impl() as Promise<Response>,
  );
  vi.stubGlobal('fetch', spy);
  return spy;
}

const ok = async () => ({ ok: true, status: 200 });

describe('useAdvancePhase', () => {
  // The order that makes the log readable.
  it('writes the note before it moves the phase', async () => {
    const calls: string[] = [];
    const contribute = vi.fn(async () => {
      calls.push('note');
    });
    mockFetch(async () => {
      calls.push('set_phase');
      return ok();
    });

    const { result } = renderHook(() =>
      useAdvancePhase('research', 'map-1', contribute),
    );
    await act(() => result.current.advance());

    expect(calls).toEqual(['note', 'set_phase']);
  });

  // The note names the phase in the words the nav uses, so someone reading the
  // log and someone reading the screen see the same vocabulary.
  it('names the destination phase in the note', async () => {
    const contribute = vi.fn(async () => {});
    mockFetch(ok);

    const { result } = renderHook(() =>
      useAdvancePhase('research', 'map-1', contribute),
    );
    await act(() => result.current.advance());

    expect(contribute).toHaveBeenCalledWith(
      'user.note',
      expect.objectContaining({ text: expect.stringContaining('03 Research') }),
    );
  });

  // It calls the same tool through the same route an agent would, rather than
  // reaching around it — so there is one implementation of what a phase set is.
  it('moves the phase through the tools route', async () => {
    const fetchSpy = mockFetch(ok);

    const { result } = renderHook(() =>
      useAdvancePhase('explore', 'map-1', async () => {}),
    );
    await act(() => result.current.advance());

    const [url, init] = fetchSpy.mock.calls[0]!;
    expect(url).toBe('/api/maps/map-1/tools');
    expect(JSON.parse(init!.body as string)).toEqual({
      name: 'set_phase',
      input: { phase: 'explore' },
    });
  });

  // The phase is server-rendered, so without this the nav would keep showing
  // the old step until something else happened to refresh the page.
  it('re-reads the page once the phase has moved', async () => {
    mockFetch(ok);
    const { result } = renderHook(() =>
      useAdvancePhase('research', 'map-1', async () => {}),
    );
    await act(() => result.current.advance());
    expect(refresh).toHaveBeenCalled();
  });

  // A declined write must not leave the button claiming success.
  it('reports a failed phase write', async () => {
    mockFetch(async () => ({ ok: false, status: 500 }));

    const { result } = renderHook(() =>
      useAdvancePhase('research', 'map-1', async () => {}),
    );
    await act(() => result.current.advance());

    await waitFor(() => expect(result.current.error).not.toBeNull());
    expect(refresh).not.toHaveBeenCalled();
  });

  // And it must not say the note was lost, because it was not — it is on the
  // log, and telling someone otherwise is its own small dishonesty.
  it('says the note survived a failed phase write', async () => {
    mockFetch(async () => ({ ok: false, status: 500 }));
    const contribute = vi.fn(async () => {});

    const { result } = renderHook(() =>
      useAdvancePhase('research', 'map-1', contribute),
    );
    await act(() => result.current.advance());

    expect(contribute).toHaveBeenCalled();
    await waitFor(() => expect(result.current.error).toMatch(/on the log/i));
  });

  // A network throw is the same story as a declined write, not a crash.
  it('survives the request throwing outright', async () => {
    mockFetch(async () => {
      throw new Error('offline');
    });

    const { result } = renderHook(() =>
      useAdvancePhase('research', 'map-1', async () => {}),
    );
    await act(() => result.current.advance());

    await waitFor(() => expect(result.current.error).not.toBeNull());
    expect(result.current.busy).toBe(false);
  });

  // The busy flag has to clear on both paths, or the button stays dead after
  // one failure.
  it('clears busy after a successful move', async () => {
    mockFetch(ok);
    const { result } = renderHook(() =>
      useAdvancePhase('research', 'map-1', async () => {}),
    );
    await act(() => result.current.advance());
    expect(result.current.busy).toBe(false);
  });

  // In an isolated scenario there is no map to advance. It must be inert, not
  // throw — the same way the map is readable without a bridge.
  it('does nothing at all with no map to advance', async () => {
    const fetchSpy = mockFetch(ok);
    const contribute = vi.fn(async () => {});

    const { result } = renderHook(() =>
      useAdvancePhase('research', undefined, contribute),
    );
    await act(() => result.current.advance());

    expect(fetchSpy).not.toHaveBeenCalled();
    expect(contribute).not.toHaveBeenCalled();
  });

  // `next-steps` has nowhere further to go, and neither does an unknown phase.
  it('does nothing when there is no next phase', async () => {
    const fetchSpy = mockFetch(ok);
    const { result } = renderHook(() =>
      useAdvancePhase(null, 'map-1', async () => {}),
    );
    await act(() => result.current.advance());
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  // Without a bridge the phase still moves. The note is the part that needs
  // somewhere to go, not the phase set.
  it('still moves the phase when there is no way to leave a note', async () => {
    const fetchSpy = mockFetch(ok);
    const { result } = renderHook(() =>
      useAdvancePhase('research', 'map-1', undefined),
    );
    await act(() => result.current.advance());
    expect(fetchSpy).toHaveBeenCalled();
  });
});
