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
        briefs={[]}
        files={[]}
        onRemoveBrief={vi.fn()}
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
        briefs={[BRIEF]}
        files={[]}
        onRemoveBrief={vi.fn()}
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
        briefs={[{ ...BRIEF, sourceName: 'example.gov/spec' }]}
        files={[]}
        onRemoveBrief={vi.fn()}
        onRemoveFile={vi.fn()}
      />,
    );

    expect(screen.getByText('example.gov/spec')).toBeTruthy();
  });

  // Removing one names WHICH one. The card carries several links now, so a
  // bare "a link was dropped" would leave the caller guessing — and the guess
  // it would make is the first, which is the one you least often mean.
  it('reports removing a link by its source', () => {
    const onRemoveBrief = vi.fn();
    render(
      <FirstCardAttachments
        briefs={[BRIEF]}
        files={[]}
        onRemoveBrief={onRemoveBrief}
        onRemoveFile={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByLabelText(`Remove ${BRIEF.sourceName}`));
    expect(onRemoveBrief).toHaveBeenCalledWith(BRIEF.sourceName);
  });

  // The state the change exists for: an idea usually arrives with a repo AND a
  // doc AND somebody else's page, and the card used to allow the first and
  // then grey the control out. They all wear the same chip — which one becomes
  // the board's brief is a fact about the map's shape, not a ranking the
  // person needs to be shown.
  it('shows every link that was added, not only the first', () => {
    render(
      <FirstCardAttachments
        briefs={[
          { ...BRIEF, sourceName: 'example.gov/spec' },
          { ...BRIEF, sourceName: 'github.com/acme/thing' },
          { ...BRIEF, sourceName: 'competitor.example/pricing' },
        ]}
        files={[]}
        onRemoveBrief={vi.fn()}
        onRemoveFile={vi.fn()}
      />,
    );

    expect(screen.getByText('example.gov/spec')).toBeTruthy();
    expect(screen.getByText('github.com/acme/thing')).toBeTruthy();
    expect(screen.getByText('competitor.example/pricing')).toBeTruthy();
  });

  // Files are named rather than indexed, because the list is re-ordered by
  // nothing and identified by name everywhere else in this card.
  it('reports removing a browsed file by name', () => {
    const onRemoveFile = vi.fn();
    render(
      <FirstCardAttachments
        briefs={[]}
        files={[new File([''], 'renewal-brief.pdf')]}
        onRemoveBrief={vi.fn()}
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
        briefs={[{ ...BRIEF, sourceName: 'example.gov/spec' }]}
        files={[new File([''], 'notes.txt')]}
        onRemoveBrief={vi.fn()}
        onRemoveFile={vi.fn()}
      />,
    );

    expect(screen.getByText('example.gov/spec')).toBeTruthy();
    expect(screen.getByText('notes.txt')).toBeTruthy();
  });

  // Under the threshold a count would be arithmetic about chips the person can
  // already see, on a card whose emptiness is deliberate.
  it('shows no count while everything is visible at a glance', () => {
    render(
      <FirstCardAttachments
        briefs={[
          { ...BRIEF, sourceName: 'a.example' },
          { ...BRIEF, sourceName: 'b.example' },
        ]}
        files={[new File([''], 'notes.txt')]}
        onRemoveBrief={vi.fn()}
        onRemoveFile={vi.fn()}
      />,
    );

    expect(screen.queryByText(/attached$/)).toBeNull();
  });

  // Past it the strip scrolls, and this line is the only thing saying that what
  // went out of sight is still attached rather than dropped. It counts BOTH
  // kinds, because what overflows the strip is the total.
  it('states the total once the strip can no longer show it all', () => {
    render(
      <FirstCardAttachments
        briefs={[
          { ...BRIEF, sourceName: 'a.example' },
          { ...BRIEF, sourceName: 'b.example' },
          { ...BRIEF, sourceName: 'c.example' },
        ]}
        files={[new File([''], 'notes.txt'), new File([''], 'spec.pdf')]}
        onRemoveBrief={vi.fn()}
        onRemoveFile={vi.fn()}
      />,
    );

    expect(screen.getByText('5 attached')).toBeTruthy();
  });

  // The strip names itself the same way the board's own strip does, so the two
  // do not describe the same idea in two different words to a screen reader.
  it('labels the strip as what the idea is carrying', () => {
    render(
      <FirstCardAttachments
        briefs={[BRIEF]}
        files={[]}
        onRemoveBrief={vi.fn()}
        onRemoveFile={vi.fn()}
      />,
    );

    expect(screen.getByLabelText('Attached to this idea')).toBeTruthy();
  });
});
