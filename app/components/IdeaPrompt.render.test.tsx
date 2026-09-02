// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import IdeaPrompt from './IdeaPrompt';

// The reported bug, pinned.
//
// Someone typed an idea, pressed send, and the screen said
// `Failed to execute 'json' on 'Response': Unexpected end of JSON input` — a
// complaint about the fetch API rather than a sentence about their app. The
// cause was reading the body BEFORE checking the status, so an error response
// with nothing in it threw out of `response.json()` and the component's own
// catch dutifully displayed the parser's words.
//
// Both assertions are load-bearing and they are not the same one twice. The
// positive one says the intended sentence arrives; the negative one says the
// parser's message does not, which is the part that regressed. A fix that
// showed BOTH would pass the first and fail the second.
//
// `router.push` is stubbed because a successful submit navigates, and the App
// Router is not mounted here.

const push = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push }),
}));

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  push.mockClear();
});

/** Type an idea and send it, the way the form is actually driven. */
function submit(idea: string) {
  const input = screen.getByRole('textbox');
  fireEvent.change(input, { target: { value: idea } });
  fireEvent.submit(input.closest('form')!);
}

describe('IdeaPrompt', () => {
  // THE REPRODUCTION. A 500 with an empty body is what the drifted database
  // produced, and it is the shape that has no JSON to read.
  it('surfaces a server failure without leaking a parse error', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('', { status: 500 })),
    );
    render(<IdeaPrompt />);

    submit('a subscription box for hot sauce');

    const message = await screen.findByRole('alert');
    expect(message.textContent).toMatch(/could not start a map/i);
    expect(document.body.textContent).not.toMatch(/Unexpected end of JSON input/);
    expect(document.body.textContent).not.toMatch(/Failed to execute/);
  });

  // A route that classified the failure gets to say what it found; the
  // component must show that rather than its own fallback.
  it('shows the sentence a failing route stated itself', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(
        async () =>
          new Response(
            JSON.stringify({ error: 'The database is behind the app' }),
            { status: 500 },
          ),
      ),
    );
    render(<IdeaPrompt />);

    submit('a subscription box for hot sauce');

    expect((await screen.findByRole('alert')).textContent).toBe(
      'The database is behind the app',
    );
  });

  // Development offers the one command that fixes it. The pill is the whole
  // reason the route's extra fields are carried back rather than dropped.
  it('offers the fix a failing route named', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(
        async () =>
          new Response(
            JSON.stringify({
              error: 'The database is behind the app',
              command: 'npm run db:push',
            }),
            { status: 500 },
          ),
      ),
    );
    render(<IdeaPrompt />);

    submit('a subscription box for hot sauce');

    await screen.findByRole('alert');
    expect(screen.getByText('npm run db:push')).toBeTruthy();
  });

  // THE PRODUCTION HALF, and the one no development capture can show: the same
  // failure, with the classifier having withheld the command, must render the
  // sentence and no pill at all.
  it('shows no fix when the route withheld one', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(
        async () =>
          new Response(
            JSON.stringify({ error: 'The database is behind the app' }),
            { status: 500 },
          ),
      ),
    );
    render(<IdeaPrompt />);

    submit('a subscription box for hot sauce');

    await screen.findByRole('alert');
    expect(screen.queryByText(/npm run/)).toBeNull();
    expect(document.body.textContent).not.toMatch(/db:push/);
  });

  // A failure no route ever saw, so nothing upstream could have made it JSON.
  it('reads a proxy failure carrying HTML as a sentence', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(
        async () =>
          new Response('<html><body>Bad Gateway</body></html>', {
            status: 502,
          }),
      ),
    );
    render(<IdeaPrompt />);

    submit('a subscription box for hot sauce');

    const message = await screen.findByRole('alert');
    expect(message.textContent).toMatch(/could not start a map/i);
    expect(message.textContent).not.toMatch(/html|<|SyntaxError/i);
  });

  // The happy path still has to work — an error-handling change that broke
  // creation would pass every assertion above.
  it('routes to the new map when creation succeeds', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(
        async () =>
          new Response(JSON.stringify({ id: 'map-123' }), { status: 201 }),
      ),
    );
    render(<IdeaPrompt />);

    submit('a subscription box for hot sauce');

    await waitFor(() => expect(push).toHaveBeenCalledWith('/map/map-123'));
    expect(screen.queryByRole('alert')).toBeNull();
  });
});
