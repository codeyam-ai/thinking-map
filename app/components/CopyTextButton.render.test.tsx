// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import CopyTextButton from './CopyTextButton';

// The control that replaced selecting text on the board.
//
// Dragging the board now suppresses text selection, so this button is the ONLY
// way the map's words get anywhere else. That raises the stakes on the two
// behaviours a screenshot cannot show: that what reaches the clipboard is the
// string it was handed, and that a REFUSED clipboard does not leave a control
// claiming to have copied something. The second matters more here than it did
// on `CopyablePrompt`, which this takes its behaviour from — there, the text
// was on screen to select by hand when the button failed. Here, by design, it
// is not.
//
// The third is that the press must belong to the button: the board underneath
// is a drag surface and the card underneath takes a click to focus itself, so
// a copy that also panned the map or moved the board's attention would be a
// button nobody could use without side effects.

// jsdom ships no clipboard, so each test installs one. Returning the spy is
// what lets a test assert on the exact string handed over.
const stubClipboard = (impl: () => Promise<void>) => {
  const writeText = vi.fn(impl);
  Object.defineProperty(navigator, 'clipboard', {
    value: { writeText },
    configurable: true,
    writable: true,
  });
  return writeText;
};

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('CopyTextButton', () => {
  // Nothing on screen shows what this button would copy — that is the whole
  // difference from `CopyablePrompt` — so the string it was given reaching the
  // clipboard unaltered is the only guarantee there is.
  it('writes exactly the text it was given', async () => {
    const writeText = stubClipboard(() => Promise.resolve());
    render(
      <CopyTextButton
        text={'Who is this for?\n\nPractice managers, not clinicians.'}
        label="Copy this question and your answer"
        accent="#fff"
      />,
    );

    fireEvent.click(screen.getByLabelText('Copy this question and your answer'));

    await vi.waitFor(() => expect(writeText).toHaveBeenCalledTimes(1));
    expect(writeText).toHaveBeenCalledWith(
      'Who is this for?\n\nPractice managers, not clinicians.',
    );
  });

  // The confirmation is a swapped glyph, which a screen reader cannot see. The
  // live region is the only channel that carries it.
  it('announces the copy in a live region once it succeeds', async () => {
    stubClipboard(() => Promise.resolve());
    const { container } = render(
      <CopyTextButton text="An idea." label="Copy this idea" accent="#000" />,
    );

    const live = container.querySelector('[aria-live="polite"]');
    expect(live?.textContent).toBe('');

    fireEvent.click(screen.getByLabelText('Copy this idea'));

    await vi.waitFor(() => expect(live?.textContent).toBe('Copied'));
  });

  // The case this component is most careful about. A browser can refuse
  // clipboard access, and with selection suppressed on the board there is no
  // fallback path — so a control that said "Copied" after copying nothing would
  // send someone away to paste something that is not there.
  it('does not claim success when the clipboard refuses', async () => {
    const writeText = stubClipboard(() => Promise.reject(new Error('denied')));
    const { container } = render(
      <CopyTextButton text="An idea." label="Copy this idea" accent="#000" />,
    );

    expect(() => fireEvent.click(screen.getByLabelText('Copy this idea'))).not.toThrow();
    await vi.waitFor(() => expect(writeText).toHaveBeenCalledTimes(1));

    expect(container.querySelector('[aria-live="polite"]')?.textContent).toBe('');
  });

  // The button sits ON a card that takes a click to focus itself, and ON a
  // board that reads a drag as a pan. Both have to be held off: `data-no-pan`
  // is what the camera's pointerdown guard looks for, and stopping propagation
  // is what keeps the card underneath from grabbing the board's attention.
  it('keeps the press to itself — no pan, no focus of the card underneath', () => {
    stubClipboard(() => Promise.resolve());
    const onParentClick = vi.fn();
    render(
      <div onClick={onParentClick}>
        <CopyTextButton text="An idea." label="Copy this idea" accent="#000" />
      </div>,
    );

    const button = screen.getByLabelText('Copy this idea');
    expect(button.hasAttribute('data-no-pan')).toBe(true);

    fireEvent.click(button);
    expect(onParentClick).not.toHaveBeenCalled();
  });

  // Hidden at rest and revealed on hover would make the control invisible in
  // every captured scenario, so a card that is the board's focused one shows it
  // outright. Both states have to be reachable or the reveal is not a reveal.
  it('is hidden at rest and shown when its card is the focused one', () => {
    stubClipboard(() => Promise.resolve());

    const { container: resting } = render(
      <CopyTextButton text="x" label="Copy at rest" accent="#000" />,
    );
    expect(resting.querySelector('button')?.className).toContain('opacity-0');

    const { container: focused } = render(
      <CopyTextButton text="x" label="Copy when focused" accent="#000" visible />,
    );
    expect(focused.querySelector('button')?.className).toContain('opacity-70');
  });
});
