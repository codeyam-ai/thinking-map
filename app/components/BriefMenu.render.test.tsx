// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import BriefMenu from './BriefMenu';

// The menu that replaced a 140px-tall dashed panel with 28px of width.
//
// What matters here is not how it looks — that is what the scenario captures
// show — but that collapsing the intake did not cost any of the behavior the
// panel had. The panel's two buttons were reachable by keyboard and always
// visible; a popover is only equivalent if it opens, closes on every gesture
// that means "not this", and still reports the same two choices.

afterEach(cleanup);

describe('BriefMenu', () => {
  // At rest it is a single button and nothing else. If the menu rendered its
  // items eagerly the collapse would have bought no space at all.
  it('shows no menu items until it is opened', () => {
    render(
      <BriefMenu
        busy={false}
        onChooseFile={vi.fn()}
        onPaste={vi.fn()}
        onLink={vi.fn()}
      />,
    );

    expect(screen.queryByRole('menu')).toBeNull();
    expect(screen.queryByText('Upload a file')).toBeNull();
  });

  // Every capability the dashed panel advertised has to survive the collapse,
  // and the link door added to it, which means all three must appear on the one
  // click that opens the menu.
  it('offers all three ways in once opened', () => {
    render(
      <BriefMenu
        busy={false}
        onChooseFile={vi.fn()}
        onPaste={vi.fn()}
        onLink={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByLabelText('Attach a brief'));

    expect(screen.getByRole('menu')).toBeTruthy();
    expect(screen.getByText('Upload a file')).toBeTruthy();
    expect(screen.getByText('Paste a brief')).toBeTruthy();
    expect(screen.getByText('Add a link')).toBeTruthy();
  });

  // The link route is the one that reaches a page nobody can upload — a Notion
  // doc, a client's own site — and it closes behind itself like the others.
  it('reports the link choice and closes behind it', () => {
    const onLink = vi.fn();
    render(
      <BriefMenu
        busy={false}
        onChooseFile={vi.fn()}
        onPaste={vi.fn()}
        onLink={onLink}
      />,
    );

    fireEvent.click(screen.getByLabelText('Attach a brief'));
    fireEvent.click(screen.getByText('Add a link'));

    expect(onLink).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('menu')).toBeNull();
  });

  // The trigger stopped being a bare `+` and started saying what it takes.
  // That label IS the fix for drag-and-drop reading as missing: a symbol with
  // no noun invites nobody to drop anything on it.
  it('says what it accepts rather than showing a bare plus', () => {
    render(
      <BriefMenu
        busy={false}
        onChooseFile={vi.fn()}
        onPaste={vi.fn()}
        onLink={vi.fn()}
      />,
    );

    expect(screen.getByText('Add docs, images or a link')).toBeTruthy();
  });

  // The file picker is the panel's "Choose a file" button, one level deeper.
  it('reports the file choice and closes behind it', () => {
    const onChooseFile = vi.fn();
    render(
      <BriefMenu
        busy={false}
        onChooseFile={onChooseFile}
        onPaste={vi.fn()}
        onLink={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByLabelText('Attach a brief'));
    fireEvent.click(screen.getByText('Upload a file'));

    expect(onChooseFile).toHaveBeenCalledTimes(1);
    // A menu left open over the answer is in the way of typing it.
    expect(screen.queryByRole('menu')).toBeNull();
  });

  // The paste route is the panel's "Paste it instead" link, and the door for
  // anyone working from a document they cannot upload.
  it('reports the paste choice and closes behind it', () => {
    const onPaste = vi.fn();
    render(
      <BriefMenu
        busy={false}
        onChooseFile={vi.fn()}
        onPaste={onPaste}
        onLink={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByLabelText('Attach a brief'));
    fireEvent.click(screen.getByText('Paste a brief'));

    expect(onPaste).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('menu')).toBeNull();
  });

  // Escape is the gesture someone reaches for when a popover appeared over the
  // thing they were reading. The old panel needed no dismissal; this does.
  it('closes on Escape', () => {
    render(
      <BriefMenu
        busy={false}
        onChooseFile={vi.fn()}
        onPaste={vi.fn()}
        onLink={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByLabelText('Attach a brief'));
    expect(screen.getByRole('menu')).toBeTruthy();

    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByRole('menu')).toBeNull();
  });

  // Clicking away is the other dismissal, and the one people try first.
  it('closes when the click lands outside it', () => {
    render(
      <div>
        <BriefMenu
          busy={false}
          onChooseFile={vi.fn()}
          onPaste={vi.fn()}
          onLink={vi.fn()}
        />
        <button type="button">elsewhere</button>
      </div>,
    );

    fireEvent.click(screen.getByLabelText('Attach a brief'));
    expect(screen.getByRole('menu')).toBeTruthy();

    fireEvent.mouseDown(screen.getByText('elsewhere'));
    expect(screen.queryByRole('menu')).toBeNull();
  });

  // With a document in hand the button stops inviting one and starts reporting
  // the one attached — the state the dashed panel used to make obvious.
  it('names the attached brief instead of inviting another', () => {
    render(
      <BriefMenu
        busy={false}
        attachedName="northgate-renewal-brief.pdf"
        onChooseFile={vi.fn()}
        onPaste={vi.fn()}
        onLink={vi.fn()}
      />,
    );

    expect(
      screen.getByLabelText('Brief attached: northgate-renewal-brief.pdf'),
    ).toBeTruthy();
    expect(screen.getByText('northgate-renewal-brief.pdf')).toBeTruthy();
  });

  // While a file is being read, offering to read another is a way to lose the
  // first one.
  it('cannot be opened while a file is being read', () => {
    render(
      <BriefMenu
        busy
        onChooseFile={vi.fn()}
        onPaste={vi.fn()}
        onLink={vi.fn()}
      />,
    );

    const button = screen.getByLabelText('Attach a brief') as HTMLButtonElement;
    expect(button.disabled).toBe(true);

    fireEvent.click(button);
    expect(screen.queryByRole('menu')).toBeNull();
  });

  // The popover is a real menu to a screen reader, and the button says whether
  // it is open — the panel's two plain buttons needed neither, this does.
  it('states its expanded state on the trigger', () => {
    render(
      <BriefMenu
        busy={false}
        onChooseFile={vi.fn()}
        onPaste={vi.fn()}
        onLink={vi.fn()}
      />,
    );

    const button = screen.getByLabelText('Attach a brief');
    expect(button.getAttribute('aria-haspopup')).toBe('menu');
    expect(button.getAttribute('aria-expanded')).toBe('false');

    fireEvent.click(button);
    expect(button.getAttribute('aria-expanded')).toBe('true');
  });
});
