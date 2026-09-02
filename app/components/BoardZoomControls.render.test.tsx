// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import BoardZoomControls from './BoardZoomControls';

// These three buttons are the only way back when someone has zoomed or dragged
// themselves off the edge of their own map, so the wiring is worth pinning. The
// corner and the no-pan marker are load-bearing too: the conversation now lives
// in the opposite corner, and dragging ON a control used to pan the board
// underneath it.

afterEach(cleanup);

function controls(overrides: Partial<Parameters<typeof BoardZoomControls>[0]> = {}) {
  return (
    <BoardZoomControls
      onZoomIn={vi.fn()}
      onZoomOut={vi.fn()}
      onFrameAll={vi.fn()}
      {...overrides}
    />
  );
}

describe('BoardZoomControls', () => {
  // Each control has to reach its own handler. Two buttons wired to one
  // callback is a bug you only notice when zooming out zooms in.
  it('reports each control separately', () => {
    const onZoomIn = vi.fn();
    const onZoomOut = vi.fn();
    const onFrameAll = vi.fn();
    render(controls({ onZoomIn, onZoomOut, onFrameAll }));

    fireEvent.click(screen.getByLabelText('Zoom in'));
    fireEvent.click(screen.getByLabelText('Zoom out'));
    fireEvent.click(screen.getByLabelText('Frame the whole board'));

    expect(onZoomIn).toHaveBeenCalledTimes(1);
    expect(onZoomOut).toHaveBeenCalledTimes(1);
    expect(onFrameAll).toHaveBeenCalledTimes(1);
  });

  // The glyphs are +, − and All, so the accessible names are the only thing a
  // screen reader or a test can address them by.
  it('names every control for anyone not looking at it', () => {
    render(controls());

    expect(screen.getByLabelText('Zoom in')).toBeTruthy();
    expect(screen.getByLabelText('Zoom out')).toBeTruthy();
    expect(screen.getByLabelText('Frame the whole board')).toBeTruthy();
  });

  // Bottom-LEFT. The conversation sits in the bottom-right, and the two sharing
  // one corner is exactly what this arrangement exists to undo.
  it('sits in the corner opposite the conversation', () => {
    const { container } = render(controls());

    const stack = container.firstElementChild as HTMLElement;
    expect(stack.className).toContain('left-6');
    expect(stack.className).not.toContain('right-6');
  });

  // Without this, dragging on the buttons pans the map underneath them — the
  // control moves the thing it is supposed to be fixed against.
  it('does not let a drag on the controls pan the board', () => {
    const { container } = render(controls());

    expect(container.querySelector('[data-no-pan]')).toBeTruthy();
  });
});
