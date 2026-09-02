// @vitest-environment jsdom

import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import ErrorScreen from './ErrorScreen';

// What the captured scenarios cannot pin.
//
// The registered scenarios show this card in its four states, so the LOOK is
// covered by a screenshot. What a screenshot cannot assert is ABSENCE: a card
// with no command and a card whose command failed to render are the same
// picture. Since withholding the command in production is the whole security
// claim of this screen, absence is exactly what needs a test.

afterEach(cleanup);

describe('ErrorScreen', () => {
  // The diagnosis has to be the page's heading, not styled text that merely
  // looks like one — it is what a screen reader announces and what the page
  // outline leads with on a page whose entire job is to be understood.
  it('leads with the title as the heading', () => {
    render(<ErrorScreen title="The database is behind the app" message="Nothing is lost." />);

    expect(
      screen.getByRole('heading', { name: 'The database is behind the app' }),
    ).toBeDefined();
  });

  // The development case, and the baseline the absence test below is measured
  // against — without this, "renders neither" could pass on a broken card.
  it('renders the command and detail when given them', () => {
    render(
      <ErrorScreen
        title="The database is behind the app"
        message="Nothing is lost."
        command="npm run db:push"
        detail="P2022 · main.MapNode.testsNodeId"
      />,
    );

    expect(screen.getByText('npm run db:push')).toBeDefined();
    expect(screen.getByText('P2022 · main.MapNode.testsNodeId')).toBeDefined();
  });

  // The production case. A card with no command and a card whose command
  // failed to render are the same screenshot, so absence is the one thing the
  // registered scenarios cannot assert and this test must.
  it('renders neither when they are omitted', () => {
    // The production case. `queryByText` rather than `getByText` because the
    // assertion IS that nothing matches.
    render(<ErrorScreen title="The database is behind the app" message="Nothing is lost." />);

    expect(screen.queryByText('npm run db:push')).toBeNull();
    expect(screen.queryByText(/^P2022/)).toBeNull();
  });

  // Pins the reason `command` and `hint` are separate fields. A sentence set
  // in the monospace pill spans the card and reads as code you are meant to
  // type — the defect that split them, caught by looking at a capture.
  it('keeps a prose hint out of the command pill', () => {
    // The two fields render differently on purpose: a sentence set in the
    // monospace pill spans the card and reads as code you are meant to type.
    render(
      <ErrorScreen
        title="Can't reach the database"
        message="Nothing answered."
        hint="Check DATABASE_URL in .env — DATABASE.md covers the setup."
      />,
    );

    const hint = screen.getByText(/Check DATABASE_URL/);
    expect(hint.className).not.toContain('font-mono');
    expect(hint.className).not.toContain('rounded-full');
  });

  // Only not-found has a next move a person can take from the page; the rest
  // are setup problems they cannot fix from here. A button on those would be
  // an affordance leading nowhere, so the slot must stay empty by default.
  it('renders an action only when one is passed', () => {
    const { rerender } = render(
      <ErrorScreen
        title="No map with that link"
        message="It may have been deleted."
        action={<a href="/">Start a new map</a>}
      />,
    );
    expect(screen.getByRole('link', { name: 'Start a new map' })).toBeDefined();

    // Every other state has no next move a person can take from the page, so
    // offering a button there would be an affordance that leads nowhere.
    rerender(<ErrorScreen title="No map with that link" message="It may have been deleted." />);
    expect(screen.queryByRole('link')).toBeNull();
  });
});
