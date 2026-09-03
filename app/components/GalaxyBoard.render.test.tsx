// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';

// What the board draws at a given zoom.
//
// The board used to hide every card below scale 0.16, on the premise that they
// had degraded to single pixels. They had not — a card is 300x360 board units,
// so even at the camera's 0.12 floor it is a ~36x43px block of colour. What the
// rule actually did was empty the board at exactly the zoom where someone is
// trying to take in its shape, and the shape IS the cards.
//
// Two zooms reach below that old threshold, and this file pins both, because
// only one of them requires anyone to touch a control:
//
//   - Framing the whole board. `frameAll` fits the layout to the viewport and
//     runs on mount, so a board with enough themes OPENS below the threshold.
//     Nobody zoomed. The board just came up with nothing on it.
//   - Driving the zoom-out control to the camera's floor.
//
// The decorative children are stubbed. GalaxyBackdrop and ThemeParticles are
// canvas-ish ornament with nothing to say about card visibility, and stubbing
// them keeps a failure here readable as "the cards are gone" rather than as
// noise from a child that dislikes jsdom.

vi.mock('./GalaxyBackdrop', () => ({
  default: () => <div data-testid="backdrop" />,
}));
vi.mock('./ThemeParticles', () => ({
  default: () => <div data-testid="particles" />,
}));
vi.mock('./InsightStack', () => ({
  default: () => <div data-testid="insight-stack" />,
}));

const { default: GalaxyBoard } = await import('./GalaxyBoard');

const theme = (id: string, label: string, order: number) => ({
  id,
  label,
  hue: 40 * order,
  order,
});

const question = (id: string, themeId: string, label: string) => ({
  id,
  themeId,
  kind: 'question',
  label,
  detail: null,
  status: 'open',
});

afterEach(cleanup);

describe('GalaxyBoard card visibility', () => {
  // Shows that the question cards are still drawn on screen at the camera's
  // lowest zoom, instead of the board emptying out to hubs and lines.
  it('keeps the cards on the board at the minimum zoom', () => {
    render(
      <GalaxyBoard
        seedIdea="a seed"
        themes={[theme('t1', 'Positioning', 0)]}
        nodes={[question('n1', 't1', 'Who is this for?')]}
      />,
    );

    // Far more clicks than the floor needs: each is a factor of 1/1.35, so the
    // camera is clamped at MIN_SCALE long before the last one. The point is to
    // be unambiguously AT the floor, not to count steps to it.
    const zoomOut = screen.getByLabelText('Zoom out');
    for (let i = 0; i < 20; i++) fireEvent.click(zoomOut);

    expect(screen.getByText('Who is this for?')).toBeTruthy();
  });

  // Shows that a board with enough themes to frame below the old cutoff still
  // displays every card the moment it opens, with no gesture from anyone.
  it('opens a many-theme board with its cards drawn, not just its hubs', () => {
    // Enough themes that the fit computed by `frameAll` lands below the old
    // 0.16 cutoff. This is the face of the bug that needs no gesture at all:
    // the framing effect runs on mount, so this board simply came up empty.
    const themes = Array.from({ length: 12 }, (_, i) =>
      theme(`t${i}`, `Theme ${i}`, i),
    );
    const nodes = themes.map((t, i) =>
      question(`n${i}`, t.id, `Question about theme ${i}?`),
    );

    render(<GalaxyBoard seedIdea="a seed" themes={themes} nodes={nodes} />);

    // Asserted on every card rather than on a count, so a board that drops a
    // single cluster's cards fails by naming which one.
    for (let i = 0; i < themes.length; i++) {
      expect(screen.getByText(`Question about theme ${i}?`)).toBeTruthy();
    }
  });

  // Shows the hub's theme label on screen alongside the cards when zoomed far
  // out, which is the one job the scale threshold still has.
  it('still draws the hub label beside the cards when far out', () => {
    // The threshold survives the fix, narrowed to the one thing it earns: the
    // hub label grows once the card text has become texture. A future reader
    // deleting the constant outright should fail here.
    render(
      <GalaxyBoard
        seedIdea="a seed"
        themes={[theme('t1', 'Positioning', 0)]}
        nodes={[question('n1', 't1', 'Who is this for?')]}
      />,
    );

    const zoomOut = screen.getByLabelText('Zoom out');
    for (let i = 0; i < 20; i++) fireEvent.click(zoomOut);

    expect(screen.getByText('Positioning')).toBeTruthy();
    expect(screen.getByText('Who is this for?')).toBeTruthy();
  });
});
