import { afterEach, describe, expect, it, vi } from 'vitest';

const getMap = vi.fn();

vi.mock('@/app/lib/mapStore', () => ({
  getMap: (id: string) => getMap(id),
  listMaps: vi.fn(),
}));

import { generateMetadata } from './page';

const params = (id: string) => Promise.resolve({ id });

const map = (nodes: { status: string }[], title = 'Northgate Renewal') => ({
  title,
  nodes,
});

afterEach(() => {
  getMap.mockReset();
});

// The tab title is read from a backgrounded window, so it has to carry the one
// number that decides whether the window is worth coming back to: how many
// questions are still open.
describe('generateMetadata', () => {
  // Only `open` nodes count. Answered ones are already dealt with, so folding
  // them in would make the badge read as work that is still waiting.
  it('prefixes the open-question count when questions are waiting', async () => {
    getMap.mockResolvedValue(
      map([{ status: 'open' }, { status: 'answered' }, { status: 'open' }]),
    );

    expect(await generateMetadata({ params: params('m1') })).toEqual({
      title: '(2) Northgate Renewal',
    });
  });

  // A zero in parentheses reads like a notification badge that never clears, so
  // a fully-answered map shows its bare name instead of `(0)`.
  it('shows the bare title when nothing is open', async () => {
    getMap.mockResolvedValue(map([{ status: 'answered' }]));

    expect(await generateMetadata({ params: params('m1') })).toEqual({
      title: 'Northgate Renewal',
    });
  });

  // A bad id renders the not-found body, and the tab above it should say the
  // app's name rather than sit blank or repeat the id.
  it('falls back to the app name when the map does not exist', async () => {
    getMap.mockResolvedValue(null);

    expect(await generateMetadata({ params: params('missing') })).toEqual({
      title: 'Thinking Map',
    });
  });

  // Metadata runs a frame before the body. A throw here 500s the route before
  // the page can render the error it was going to explain, so a failed read
  // takes the same branch as no map at all.
  it('falls back to the app name when the read throws, rather than 500ing', async () => {
    getMap.mockRejectedValue(new Error('database is locked'));

    await expect(
      generateMetadata({ params: params('m1') }),
    ).resolves.toEqual({ title: 'Thinking Map' });
  });
});
