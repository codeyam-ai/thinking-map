// @vitest-environment jsdom

import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import ThinkingMapView from './ThinkingMapView';
import type { FlatNode } from '../lib/mapLayout';

// jsdom has no ResizeObserver, and useFitToFrame constructs one to watch the
// frame. A no-op stub is the honest stand-in: jsdom reports every element as
// zero-sized, so a working observer would have nothing to report anyway.
beforeAll(() => {
  if (!('ResizeObserver' in globalThis)) {
    globalThis.ResizeObserver = class {
      observe() {}
      unobserve() {}
      disconnect() {}
    } as unknown as typeof ResizeObserver;
  }
});

// The viewport and the folding, exercised through the controls a person
// actually presses.
//
// jsdom reports every element as zero-sized, so the auto-fit measurement
// resolves to the MIN_SCALE floor rather than a real fit. That is fine for what
// is asserted here — these are about who OWNS the scale (the fit until someone
// takes it, the person afterwards, the fit again on reset) and about which
// nodes survive a fold, neither of which depends on the measured number.

const n = (id: string, parentId: string | null, label = id): FlatNode => ({
  id,
  parentId,
  kind: parentId ? 'problem' : 'idea',
  label,
  detail: null,
  status: 'answered',
  sourceUrl: null,
  order: 0,
});

const TREE: FlatNode[] = [
  n('root', null, 'A platform for small clinics'),
  n('a', 'root', 'The actual problem'),
  n('a1', 'a', 'Follow-ups fall through'),
  n('a2', 'a', 'No shared view'),
  n('b', 'root', 'Existing tools'),
];

const percent = () => screen.getByText(/%$/).textContent;

afterEach(cleanup);

describe('ThinkingMapView viewport', () => {
  // The controls promise something the map can do; an empty map can do none of
  // it, so offering them would be a promise it cannot keep.
  it('offers no viewport controls on an empty map', () => {
    render(<ThinkingMapView nodes={[]} />);
    expect(screen.queryByLabelText('Zoom in')).toBeNull();
    expect(screen.queryByText('Fit')).toBeNull();
  });

  // The counterpart to the empty case: with a tree on screen, all three
  // controls have to be reachable.
  it('offers zoom and fit once there is a map to manipulate', () => {
    render(<ThinkingMapView nodes={TREE} />);
    expect(screen.getByLabelText('Zoom in')).toBeTruthy();
    expect(screen.getByLabelText('Zoom out')).toBeTruthy();
    expect(screen.getByText('Fit')).toBeTruthy();
  });

  // Zooming in has to raise the readout — this is the whole point of the
  // control, and the readout is the only thing that says where the map is.
  it('raises the scale when zoom in is pressed', () => {
    render(<ThinkingMapView nodes={TREE} />);
    const before = parseInt(percent()!, 10);
    fireEvent.click(screen.getByLabelText('Zoom in'));
    expect(parseInt(percent()!, 10)).toBeGreaterThan(before);
  });

  // Zoom is a ratio in both directions, so zooming out has to undo zooming in
  // rather than bottoming out at the fit.
  it('lowers the scale when zoom out is pressed', () => {
    render(<ThinkingMapView nodes={TREE} />);
    fireEvent.click(screen.getByLabelText('Zoom in'));
    const zoomed = parseInt(percent()!, 10);
    fireEvent.click(screen.getByLabelText('Zoom out'));
    expect(parseInt(percent()!, 10)).toBeLessThan(zoomed);
  });

  // Fit is disabled until there is something to reset, so a live button never
  // leaves the person wondering what it did.
  it('disables fit until the viewport is the person’s', () => {
    render(<ThinkingMapView nodes={TREE} />);
    const fit = screen.getByText('Fit') as HTMLButtonElement;
    expect(fit.disabled).toBe(true);
    fireEvent.click(screen.getByLabelText('Zoom in'));
    expect(fit.disabled).toBe(false);
  });

  // The reset hands control back to the auto-fit rather than computing a scale
  // of its own, which is what makes it exact instead of approximate.
  it('returns to the auto-fit scale when fit is pressed', () => {
    render(<ThinkingMapView nodes={TREE} />);
    const initial = percent();

    fireEvent.click(screen.getByLabelText('Zoom in'));
    fireEvent.click(screen.getByLabelText('Zoom in'));
    expect(percent()).not.toBe(initial);

    fireEvent.click(screen.getByText('Fit'));
    expect(percent()).toBe(initial);
    expect((screen.getByText('Fit') as HTMLButtonElement).disabled).toBe(true);
  });
});

describe('ThinkingMapView folding', () => {
  // Folding filters the layout's INPUT, so the descendants genuinely leave the
  // map — the behaviour that lets an oversized tree re-tidy and get narrower.
  it('removes a folded branch’s descendants from the map', () => {
    render(<ThinkingMapView nodes={TREE} />);
    expect(screen.getByText('Follow-ups fall through')).toBeTruthy();

    fireEvent.click(screen.getByLabelText('Fold The actual problem'));

    expect(screen.queryByText('Follow-ups fall through')).toBeNull();
    expect(screen.queryByText('No shared view')).toBeNull();
    // The folded node itself stays — it is what you click to unfold again.
    expect(screen.getByText('The actual problem')).toBeTruthy();
  });

  // The count is counted over the whole map rather than the visible slice, so
  // it stays truthful once the branch it describes has gone.
  it('reports how much a folded branch is holding', () => {
    render(<ThinkingMapView nodes={TREE} />);
    fireEvent.click(screen.getByLabelText('Fold The actual problem'));
    expect(screen.getByText('+2')).toBeTruthy();
  });

  // Folding is a reading posture, so it has to be reversible in place.
  it('brings the branch back when unfolded', () => {
    render(<ThinkingMapView nodes={TREE} />);
    fireEvent.click(screen.getByLabelText('Fold The actual problem'));
    fireEvent.click(screen.getByLabelText('Unfold The actual problem — 2 hidden'));
    expect(screen.getByText('Follow-ups fall through')).toBeTruthy();
  });

  // Folding one branch must not disturb another.
  it('leaves other branches alone', () => {
    render(<ThinkingMapView nodes={TREE} />);
    fireEvent.click(screen.getByLabelText('Fold The actual problem'));
    expect(screen.getByText('Existing tools')).toBeTruthy();
  });
});

describe('ThinkingMapView nudges', () => {
  // A committed drag is written back to the map it belongs to, and it must NOT
  // go through the exchange log — a move is arrangement, not thinking.
  it('persists a committed nudge to the positions endpoint', () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal('fetch', fetchMock);

    render(<ThinkingMapView nodes={TREE} mapId="map-1" />);

    const pill = screen.getByText('The actual problem').closest('.node-in')!;
    fireEvent.pointerDown(pill, { button: 0, clientX: 200, clientY: 100 });
    fireEvent.pointerMove(window, { clientX: 260, clientY: 140 });
    fireEvent.pointerUp(window, { clientX: 260, clientY: 140 });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('/api/maps/map-1/positions');
    expect(init.method).toBe('PATCH');
    expect(JSON.parse(init.body)[0].nodeId).toBe('a');

    vi.unstubAllGlobals();
  });

  // An isolated scenario has no map to write back to; the map must still be
  // draggable, the arrangement simply does not outlive the page.
  it('stays manipulable with no map id, without attempting a write', () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    render(<ThinkingMapView nodes={TREE} />);

    const pill = screen.getByText('The actual problem').closest('.node-in')!;
    fireEvent.pointerDown(pill, { button: 0, clientX: 200, clientY: 100 });
    fireEvent.pointerMove(window, { clientX: 260, clientY: 140 });
    fireEvent.pointerUp(window, { clientX: 260, clientY: 140 });

    expect(fetchMock).not.toHaveBeenCalled();

    vi.unstubAllGlobals();
  });
});
