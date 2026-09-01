// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import MapNodePill from './MapNodePill';
import type { LaidOutNode } from '../lib/mapLayout';

// The gesture MapNodePill carries, exercised through the real pointer events.
//
// This is the pill's half of direct manipulation, and the part a screenshot
// cannot show: whether a small movement is a click or a drag, whether the
// delta reported is in map pixels or screen pixels, and whether the drag is
// reported continuously or only once the button comes up. That last one was a
// real bug — an earlier version moved the pill with a CSS transform that
// `.node-in`'s `animation-fill-mode: both` silently overrode, so the node sat
// still until release.

const NODE: LaidOutNode = {
  id: 'n1',
  parentId: null,
  kind: 'idea',
  label: 'A platform that helps small clinics',
  detail: null,
  status: 'answered',
  sourceUrl: null,
  origin: 'user',
  depth: 0,
  x: 100,
  y: 40,
  width: 288,
  height: 62,
};

afterEach(cleanup);

/** The pill's own element — the drag starts on the outer positioned wrapper. */
function pillOf(label: string): HTMLElement {
  const text = screen.getByText(label);
  const wrapper = text.closest('.node-in');
  if (!wrapper) throw new Error('pill wrapper not found');
  return wrapper as HTMLElement;
}

describe('MapNodePill drag', () => {
  // Below the threshold the gesture is a click, which is what keeps a label
  // selectable and leaves room for click-to-ask on the same element.
  it('does not report a nudge for movement under the threshold', () => {
    const onNudge = vi.fn();
    const onDragMove = vi.fn();
    render(<MapNodePill node={NODE} onNudge={onNudge} onDragMove={onDragMove} />);

    const pill = pillOf(NODE.label);
    fireEvent.pointerDown(pill, { button: 0, clientX: 200, clientY: 100 });
    fireEvent.pointerMove(window, { clientX: 202, clientY: 101 });
    fireEvent.pointerUp(window, { clientX: 202, clientY: 101 });

    expect(onDragMove).not.toHaveBeenCalled();
    expect(onNudge).not.toHaveBeenCalled();
  });

  // The feedback complaint that produced this test: the node has to follow the
  // pointer, so movement is reported on every move rather than only on release.
  it('reports movement continuously while the drag is in flight', () => {
    const onDragMove = vi.fn();
    render(<MapNodePill node={NODE} onNudge={vi.fn()} onDragMove={onDragMove} />);

    const pill = pillOf(NODE.label);
    fireEvent.pointerDown(pill, { button: 0, clientX: 200, clientY: 100 });
    fireEvent.pointerMove(window, { clientX: 220, clientY: 100 });
    fireEvent.pointerMove(window, { clientX: 240, clientY: 130 });

    expect(onDragMove).toHaveBeenCalledTimes(2);
    expect(onDragMove).toHaveBeenNthCalledWith(1, 'n1', 20, 0);
    expect(onDragMove).toHaveBeenNthCalledWith(2, 'n1', 40, 30);
  });

  // The committed delta is what gets persisted, so it must be the total travel
  // from where the drag began, not the last increment.
  it('reports the total delta once on release', () => {
    const onNudge = vi.fn();
    render(<MapNodePill node={NODE} onNudge={onNudge} onDragMove={vi.fn()} />);

    const pill = pillOf(NODE.label);
    fireEvent.pointerDown(pill, { button: 0, clientX: 200, clientY: 100 });
    fireEvent.pointerMove(window, { clientX: 230, clientY: 120 });
    fireEvent.pointerUp(window, { clientX: 250, clientY: 140 });

    expect(onNudge).toHaveBeenCalledTimes(1);
    expect(onNudge).toHaveBeenCalledWith('n1', 50, 40);
  });

  // The plane is scaled, so screen travel has to be divided by the scale —
  // without it a node drifts further from the pointer the further you zoom in.
  it('converts screen travel into map pixels using the scale', () => {
    const onNudge = vi.fn();
    render(<MapNodePill node={NODE} scale={2} onNudge={onNudge} onDragMove={vi.fn()} />);

    const pill = pillOf(NODE.label);
    fireEvent.pointerDown(pill, { button: 0, clientX: 200, clientY: 100 });
    fireEvent.pointerMove(window, { clientX: 300, clientY: 100 });
    fireEvent.pointerUp(window, { clientX: 300, clientY: 100 });

    expect(onNudge).toHaveBeenCalledWith('n1', 50, 0);
  });

  // The frame beneath pans on pointerdown, so a pointer that lands on a node
  // must not also move the map.
  it('stops the pointerdown from reaching the panning canvas', () => {
    const onCanvasPointerDown = vi.fn();
    render(
      <div onPointerDown={onCanvasPointerDown}>
        <MapNodePill node={NODE} onNudge={vi.fn()} />
      </div>,
    );

    fireEvent.pointerDown(pillOf(NODE.label), { button: 0, clientX: 200, clientY: 100 });
    expect(onCanvasPointerDown).not.toHaveBeenCalled();
  });

  // A read-only mount — an isolated scenario with no map to write back to —
  // must not install a gesture at all.
  it('is inert when no nudge handler is given', () => {
    const onCanvasPointerDown = vi.fn();
    render(
      <div onPointerDown={onCanvasPointerDown}>
        <MapNodePill node={NODE} />
      </div>,
    );

    fireEvent.pointerDown(pillOf(NODE.label), { button: 0, clientX: 200, clientY: 100 });
    expect(onCanvasPointerDown).toHaveBeenCalled();
  });
});

describe('MapNodePill fold affordance', () => {
  // No children means nothing to fold, so the control must not appear at all.
  it('shows no fold control for a node with nothing under it', () => {
    render(<MapNodePill node={NODE} hiddenCount={0} onToggleCollapse={vi.fn()} />);
    expect(screen.queryByRole('button')).toBeNull();
  });

  // Unfolded, the control says what it will do rather than what it is hiding.
  it('offers to fold a node that has descendants', () => {
    render(<MapNodePill node={NODE} hiddenCount={3} onToggleCollapse={vi.fn()} />);
    expect(screen.getByLabelText(`Fold ${NODE.label}`)).toBeTruthy();
  });

  // Folded, it reports the cost — the count is what tells you whether the
  // branch is worth opening again.
  it('reports the hidden count once folded', () => {
    render(
      <MapNodePill
        node={NODE}
        collapsed
        hiddenCount={6}
        onToggleCollapse={vi.fn()}
      />,
    );
    expect(screen.getByText('+6')).toBeTruthy();
    expect(screen.getByLabelText(`Unfold ${NODE.label} — 6 hidden`)).toBeTruthy();
  });

  // The pill is presentational: it reports which node was folded and leaves
  // the decision about what that means to its caller.
  it('reports the toggle for its own node id', () => {
    const onToggleCollapse = vi.fn();
    render(
      <MapNodePill node={NODE} hiddenCount={3} onToggleCollapse={onToggleCollapse} />,
    );

    fireEvent.click(screen.getByLabelText(`Fold ${NODE.label}`));
    expect(onToggleCollapse).toHaveBeenCalledWith('n1');
  });

  // Reaching for the fold control is not a drag of the node it sits on.
  it('does not start a node drag when the fold control is pressed', () => {
    const onDragMove = vi.fn();
    render(
      <MapNodePill
        node={NODE}
        hiddenCount={3}
        onNudge={vi.fn()}
        onDragMove={onDragMove}
        onToggleCollapse={vi.fn()}
      />,
    );

    const fold = screen.getByLabelText(`Fold ${NODE.label}`);
    fireEvent.pointerDown(fold, { button: 0, clientX: 200, clientY: 100 });
    fireEvent.pointerMove(window, { clientX: 260, clientY: 160 });
    expect(onDragMove).not.toHaveBeenCalled();
  });
});
