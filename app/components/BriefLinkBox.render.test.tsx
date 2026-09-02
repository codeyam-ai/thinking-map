// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import BriefLinkBox from './BriefLinkBox';

// The third door into the intake.
//
// What matters here is the contract between this box and its parent, because
// that boundary is where the security of the whole feature rests: this
// component reports an ADDRESS and never retrieves anything. If it ever
// started fetching, the guard on the server would be bypassable by definition,
// so "it hands the string up and stops" is a property worth pinning rather
// than assuming.
//
// The rest is the small behaviour a person actually meets: a dead button until
// there is something to attach, and Enter meaning "attach this" rather than
// "start a board on nothing".

afterEach(cleanup);

describe('BriefLinkBox', () => {
  // An empty box has nothing to attach, and a live button that does nothing is
  // worse than a dead one that explains itself by being dead.
  it('will not attach an empty address', () => {
    const onAttach = vi.fn();
    render(<BriefLinkBox onAttach={onAttach} onCancel={vi.fn()} />);

    const attach = screen.getByText('Attach it') as HTMLButtonElement;
    expect(attach.disabled).toBe(true);

    fireEvent.click(attach);
    expect(onAttach).not.toHaveBeenCalled();
  });

  // Whitespace is not an address. Someone who hits space then Attach should
  // get the same nothing as someone who typed nothing.
  it('treats whitespace as empty', () => {
    const onAttach = vi.fn();
    render(
      <BriefLinkBox defaultUrl="   " onAttach={onAttach} onCancel={vi.fn()} />,
    );

    expect((screen.getByText('Attach it') as HTMLButtonElement).disabled).toBe(
      true,
    );
  });

  // The whole job: report the address upward, trimmed, and retrieve nothing.
  it('reports the address and fetches nothing itself', () => {
    const onAttach = vi.fn();
    const spy = vi.spyOn(globalThis, 'fetch');
    render(
      <BriefLinkBox
        defaultUrl="  https://example.gov/spec  "
        onAttach={onAttach}
        onCancel={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByText('Attach it'));

    expect(onAttach).toHaveBeenCalledWith('https://example.gov/spec');
    // The guard against a stranger's URL lives on the server. A browser fetch
    // from here would route around it entirely.
    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
  });

  // The box lives inside the form whose submit starts a map. Enter has to mean
  // "attach this link" here, or the keystroke starts a board on a half-typed
  // idea instead.
  it('attaches on Enter instead of submitting the form', () => {
    const onAttach = vi.fn();
    render(
      <BriefLinkBox
        defaultUrl="https://example.gov/spec"
        onAttach={onAttach}
        onCancel={vi.fn()}
      />,
    );

    fireEvent.keyDown(screen.getByLabelText('Link to the brief'), {
      key: 'Enter',
    });

    expect(onAttach).toHaveBeenCalledWith('https://example.gov/spec');
  });

  // Enter on an empty box means nothing, the same as the dead button does.
  it('does nothing on Enter with an empty box', () => {
    const onAttach = vi.fn();
    render(<BriefLinkBox onAttach={onAttach} onCancel={vi.fn()} />);

    fireEvent.keyDown(screen.getByLabelText('Link to the brief'), {
      key: 'Enter',
    });

    expect(onAttach).not.toHaveBeenCalled();
  });

  // A way out that does not attach anything is the difference between opening
  // this by accident and being stuck in it.
  it('reports a cancel without attaching', () => {
    const onAttach = vi.fn();
    const onCancel = vi.fn();
    render(
      <BriefLinkBox
        defaultUrl="https://example.gov/spec"
        onAttach={onAttach}
        onCancel={onCancel}
      />,
    );

    fireEvent.click(screen.getByText('Cancel'));

    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(onAttach).not.toHaveBeenCalled();
  });
});
