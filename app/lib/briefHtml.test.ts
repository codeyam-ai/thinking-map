import { describe, expect, it } from 'vitest';
import { extractHtmlPage } from './briefHtml';

// Pulling a brief out of a web page.
//
// A page is not a document: the same markup that carries the spec also carries
// a nav bar, a cookie banner, a newsletter box and a footer. All of that would
// otherwise flow into the section splitter and become sections an agent then
// reads and asks questions about — so what this drops matters as much as what
// it keeps.
//
// It lives in `briefHtml.ts` rather than beside the PDF and .docx branches
// precisely so it can be tested: `briefText.ts` imports `server-only`, which
// throws the moment a test touches it.

describe('extractHtmlPage', () => {
  const PAGE = `
      <html><head><title>Renewal Brief</title></head><body>
        <nav>Home About Contact Careers Log in</nav>
        <div id="cookie-banner">We value your privacy. Accept all cookies?</div>
        <article>
          <h1>Renewal Brief</h1>
          <p>Northgate Library District serves 41,000 cardholders across six
          branches and a bookmobile. Membership is free but must be renewed
          every two years, which is a state requirement tied to proof of
          residence rather than a policy we chose.</p>
          <p>Renewal is currently done in person at a service desk. In FY24 we
          processed 9,180 renewals and lost an estimated 3,400 cardholders who
          simply let their membership lapse rather than make the trip.</p>
        </article>
        <footer>© 2026 Northgate Library District. Terms. Privacy.</footer>
      </body></html>
    `;

  // The core job, stated as the thing that would otherwise go wrong: the
  // chrome around an article is the majority of most pages by volume, and all
  // of it would become sections an agent reads and asks questions about.
  it('keeps the article', async () => {
    const { text } = await extractHtmlPage(PAGE);

    expect(text).toContain('41,000 cardholders');
    expect(text).toContain('9,180 renewals');
  });

  // Navigation and footers are the bulk of what has to go, and the part
  // Readability is reliably good at — they are structurally marked as chrome.
  it('drops navigation and the footer', async () => {
    const { text } = await extractHtmlPage(PAGE);

    expect(text).not.toContain('Careers');
    expect(text).not.toContain('Terms');
  });

  // A KNOWN LIMIT, pinned so it is a decision rather than a surprise.
  //
  // A cookie banner is an unmarked `<div>` of ordinary prose sitting next to
  // the article, so Readability keeps it — nothing in the markup says it is
  // furniture. Beating it would mean matching on class names and copy, which
  // is a heuristic that goes stale site by site and silently eats real content
  // when it misfires.
  //
  // The cost of leaving it is one short paragraph of noise at the top of a
  // brief; the cost of the heuristic is losing a paragraph of the spec. This
  // test asserts the CURRENT behaviour, so anyone who improves it will see
  // this fail and can delete it deliberately.
  it('still keeps an unmarked cookie banner, which is a known limit', async () => {
    const { text } = await extractHtmlPage(PAGE);

    expect(text).toContain('Accept all cookies');
  });

  // The title is how the brief gets named, both in the chip and on the board.
  it('reports the page title', async () => {
    const { title } = await extractHtmlPage(
      '<html><head><title>Renewal Brief</title></head><body><p>x</p></body></html>',
    );
    expect(title).toBe('Renewal Brief');
  });

  // A page with no title is common enough — an internal doc export, a raw
  // fragment — and has to come back as an honest absence rather than ''.
  it('reports no title as null rather than an empty string', async () => {
    const { title } = await extractHtmlPage('<html><body><p>x</p></body></html>');
    expect(title).toBeNull();
  });

  // Readability declines outright on pages that are not article-shaped — a
  // bare spec with no <article>, a wiki, a docs page. Declining is not the
  // same as there being nothing to read, so the body fallback has to catch it.
  it('falls back to the body when the page is not article-shaped', async () => {
    const { text } = await extractHtmlPage(`
      <html><head><title>Spec</title></head><body>
        <script>window.analytics = 1;</script>
        <style>body { color: red; }</style>
        <div>Residency verification is the part we are least sure about.</div>
      </body></html>
    `);

    expect(text).toContain('Residency verification');
    // Script and style contents are not words anyone wrote for a reader, and a
    // naive `textContent` would hand them to the agent as prose.
    expect(text).not.toContain('window.analytics');
    expect(text).not.toContain('color: red');
  });

  // The page's own title becomes a heading in the brief. Two things depend on
  // it: the section splitter, which has nothing else to split a page on, and
  // the map's name.
  it('opens the brief with the page title as a heading', async () => {
    const { text } = await extractHtmlPage(
      '<html><head><title>Renewal Brief</title></head><body><article><p>Northgate Library District serves 41,000 cardholders across six branches, and renewal is done in person at a service desk today.</p></article></body></html>',
    );

    expect(text.startsWith('# Renewal Brief')).toBe(true);
  });

  // Titles that the extracted text already opens with must not be repeated —
  // an article whose h1 survives extraction would otherwise say its own name
  // twice before the first sentence.
  it('does not repeat a title the article already opens with', async () => {
    const { text } = await extractHtmlPage(
      '<html><head><title>Renewal Brief</title></head><body><article><h1>Renewal Brief</h1><p>Northgate Library District serves 41,000 cardholders across six branches, and renewal is done in person at a service desk today.</p></article></body></html>',
    );

    expect(text.match(/Renewal Brief/g)?.length).toBe(1);
  });

  // The reason the heading is worth adding at all. `deriveTitle` in
  // `mapStore.ts` names a brief-started map after its first markdown heading,
  // and without one a board started from a Wikipedia article was called "From
  // Wikipedia, the free encyclopedia" — boilerplate, identical for every
  // article on the site. Asserted on the heading rather than by calling
  // `deriveTitle`, which would drag a database client into a parsing test.
  it('gives a board started from a page a name worth reading', async () => {
    const { text } = await extractHtmlPage(`
      <html><head><title>Server-side request forgery</title></head><body>
        <article>
          <p>From Wikipedia, the free encyclopedia</p>
          <p>Server-side request forgery is a vulnerability that enables an
          attacker to send requests from a vulnerable server to internal
          systems, or to the server itself, from a URL the attacker supplies.</p>
        </article>
      </body></html>
    `);

    expect(text.split('\n')[0]).toBe('# Server-side request forgery');
    expect(text).toContain('From Wikipedia, the free encyclopedia');
  });
});
