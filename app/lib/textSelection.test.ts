// @vitest-environment jsdom

import { afterEach, describe, expect, it } from 'vitest';
import { suppressTextSelection } from './textSelection';

// Selecting a node's label is worth keeping — it is how you copy one out — so
// what matters here is that the suppression is strictly bounded to the drag and
// always hands the previous value back.

afterEach(() => {
  document.body.style.userSelect = '';
});

describe('suppressTextSelection', () => {
  // The highlight trailing the cursor was the reported complaint; this is the
  // suppression that stops it.
  it('turns selection off for the duration of the gesture', () => {
    const restore = suppressTextSelection();
    expect(document.body.style.userSelect).toBe('none');
    restore();
  });

  // The map must be selectable again the moment the drag ends.
  it('restores selection when the gesture ends', () => {
    suppressTextSelection()();
    expect(document.body.style.userSelect).toBe('');
  });

  // A page that had already set a value must get that value back, not a blank.
  it('restores the previous value rather than clearing it', () => {
    document.body.style.userSelect = 'text';
    const restore = suppressTextSelection();
    expect(document.body.style.userSelect).toBe('none');
    restore();
    expect(document.body.style.userSelect).toBe('text');
  });

  // pointerup can fire more than once in practice; a second restore must not
  // undo a suppression that a later drag has since started.
  it('is safe to restore twice', () => {
    const restore = suppressTextSelection();
    restore();
    const second = suppressTextSelection();
    restore();
    expect(document.body.style.userSelect).toBe('none');
    second();
  });

  // The drag threshold is a few pixels in, so the browser may already have
  // selected a character or two before suppression starts.
  it('clears any selection the browser already started', () => {
    const paragraph = document.createElement('p');
    paragraph.textContent = 'Two are hospital-scale only';
    document.body.appendChild(paragraph);

    const range = document.createRange();
    range.selectNodeContents(paragraph);
    const selection = document.getSelection();
    selection?.removeAllRanges();
    selection?.addRange(range);
    expect(document.getSelection()?.rangeCount).toBe(1);

    const restore = suppressTextSelection();
    expect(document.getSelection()?.rangeCount).toBe(0);

    restore();
    paragraph.remove();
  });
});
