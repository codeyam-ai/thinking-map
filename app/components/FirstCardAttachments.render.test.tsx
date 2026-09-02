// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import FirstCardAttachments from './FirstCardAttachments';

// What the first card is carrying, named back to the person.
//
// The interesting property is that a chip has to stay a chip: the card is
// 440px wide and the controls sit on the row below, so a page whose title runs
// to a sentence — which is most of them — must truncate rather than push the
// send button out of line. That is the case that decides whether a link can be
// shown in the card at all, so it is pinned here rather than left to a
// screenshot.

afterEach(cleanup);

const BRIEF = {
  text: 'The whole spec.',
  sourceName: 'Digital Membership Renewal — example.gov/board/renewal-brief',
  mediaType: 'text/html',
  warning: null,
};

describe('FirstCardAttachments', () => {
  // Almost every arrival is carrying nothing, and an empty list would still
  // take vertical space in a card whose emptiness is the point.
  it('renders nothing when the card is carrying nothing', () => {
    const { container } = render(
      <FirstCardAttachments
        brief={null}
        files={[]}
        onClearBrief={vi.fn()}
        onRemoveFile={vi.fn()}
      />,
    );

    expect(container.firstChild).toBeNull();
  });

  // A long source name truncates rather than growing. The full name stays in
  // the label so it is still recoverable by anyone who needs it.
  it('truncates a long source name but keeps it whole in the label', () => {
    render(
      <FirstCardAttachments
        brief={BRIEF}
        files={[]}
        onClearBrief={vi.fn()}
        onRemoveFile={vi.fn()}
      />,
    );

    expect(screen.queryByText(BRIEF.sourceName)).toBeNull();
    expect(screen.getByText(/^Digital Membership Renewal/)).toBeTruthy();
    expect(screen.getByLabelText(`Remove ${BRIEF.sourceName}`)).toBeTruthy();
  });

  // A name that already fits is shown as it is — truncation is for names that
  // need it, not a house style.
  it('leaves a short name alone', () => {
    render(
      <FirstCardAttachments
        brief={{ ...BRIEF, sourceName: 'example.gov/spec' }}
        files={[]}
        onClearBrief={vi.fn()}
        onRemoveFile={vi.fn()}
      />,
    );

    expect(screen.getByText('example.gov/spec')).toBeTruthy();
  });

  // There is one brief per board, so dropping it is how you attach a different
  // one — which makes this the only way back out of a wrong link.
  it('reports dropping the brief', () => {
    const onClearBrief = vi.fn();
    render(
      <FirstCardAttachments
        brief={BRIEF}
        files={[]}
        onClearBrief={onClearBrief}
        onRemoveFile={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByLabelText(`Remove ${BRIEF.sourceName}`));
    expect(onClearBrief).toHaveBeenCalledTimes(1);
  });

  // Files are named rather than indexed, because the list is re-ordered by
  // nothing and identified by name everywhere else in this card.
  it('reports removing a browsed file by name', () => {
    const onRemoveFile = vi.fn();
    render(
      <FirstCardAttachments
        brief={null}
        files={[new File([''], 'renewal-brief.pdf')]}
        onClearBrief={vi.fn()}
        onRemoveFile={onRemoveFile}
      />,
    );

    fireEvent.click(screen.getByLabelText('Remove renewal-brief.pdf'));
    expect(onRemoveFile).toHaveBeenCalledWith('renewal-brief.pdf');
  });

  // Both kinds at once is a real state — someone can browse for a doc and
  // point at a page — and the two have to coexist rather than replace.
  it('shows a brief and browsed files together', () => {
    render(
      <FirstCardAttachments
        brief={{ ...BRIEF, sourceName: 'example.gov/spec' }}
        files={[new File([''], 'notes.txt')]}
        onClearBrief={vi.fn()}
        onRemoveFile={vi.fn()}
      />,
    );

    expect(screen.getByText('example.gov/spec')).toBeTruthy();
    expect(screen.getByText('notes.txt')).toBeTruthy();
  });
});
