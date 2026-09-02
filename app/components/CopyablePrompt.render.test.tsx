// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import CopyablePrompt from './CopyablePrompt';

// The button had no test of its own until it became the primary action on the
// arrival screen. What matters here is not the styling but the two behaviours
// a screenshot cannot show: that the text actually reaching the clipboard is
// the text on screen, and that a REFUSED clipboard does not leave a button
// claiming success. The second is the one worth pinning — a copy button that
// says "Copied" after copying nothing is worse than one that never claimed to.

const PROMPT = 'Work on thinking map map-under-test. Start with read_map.';

// jsdom ships no clipboard, so every case has to install one. Returning the
// spy lets each test assert on what was actually handed over.
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

describe('CopyablePrompt', () => {
  // The text stays on screen whatever the clipboard does, because
  // select-and-copy by hand is the path underneath every other failure.
  it('renders the prompt text', () => {
    stubClipboard(() => Promise.resolve());
    render(<CopyablePrompt text={PROMPT} />);
    expect(screen.getByText(PROMPT)).toBeTruthy();
  });

  // A button that copies something OTHER than what is displayed would be the
  // worst version of this bug: silent, and only discovered after pasting.
  it('writes exactly the displayed text to the clipboard', async () => {
    const writeText = stubClipboard(() => Promise.resolve());
    render(<CopyablePrompt text={PROMPT} />);

    fireEvent.click(screen.getByRole('button'));
    await vi.waitFor(() => expect(writeText).toHaveBeenCalledTimes(1));
    expect(writeText).toHaveBeenCalledWith(PROMPT);
  });

  // The label flip is the entire success signal there is.
  it('flips the label once the copy succeeds', async () => {
    stubClipboard(() => Promise.resolve());
    render(<CopyablePrompt text={PROMPT} label="Copy start prompt" copiedLabel="Copied" />);

    expect(screen.getByRole('button').textContent).toBe('Copy start prompt');
    fireEvent.click(screen.getByRole('button'));
    await vi.waitFor(() =>
      expect(screen.getByRole('button').textContent).toBe('Copied'),
    );
  });

  // The deliberate failure behaviour. A browser can refuse clipboard access,
  // and when it does the button must neither throw nor claim it worked — the
  // prompt stays on screen and the label stays as an offer.
  it('neither throws nor claims success when the clipboard is refused', async () => {
    const writeText = stubClipboard(() => Promise.reject(new Error('denied')));
    render(<CopyablePrompt text={PROMPT} label="Copy start prompt" copiedLabel="Copied" />);

    expect(() => fireEvent.click(screen.getByRole('button'))).not.toThrow();
    await vi.waitFor(() => expect(writeText).toHaveBeenCalledTimes(1));

    expect(screen.getByRole('button').textContent).toBe('Copy start prompt');
    expect(screen.getByText(PROMPT)).toBeTruthy();
  });

  // Promoted to the primary action, the confirmation cannot be a purely visual
  // signal — a live region is what makes the flip reach a screen reader too.
  it('announces the copied state in a live region', () => {
    stubClipboard(() => Promise.resolve());
    const { container } = render(<CopyablePrompt text={PROMPT} tone="primary" />);
    expect(container.querySelector('[aria-live="polite"]')).toBeTruthy();
  });

  // The tone prop exists so promoting the handoff caller cannot restyle the
  // others, which only holds if the default is genuinely unchanged.
  it('renders the default tone when none is given', () => {
    stubClipboard(() => Promise.resolve());
    const { container } = render(<CopyablePrompt text={PROMPT} />);
    const button = container.querySelector('button');
    expect(button?.className).not.toMatch(/bg-lime/);
  });
});
