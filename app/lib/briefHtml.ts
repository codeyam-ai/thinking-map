// Getting a brief out of a web page.
//
// Split out of `briefText.ts` for the same reason `briefFormat.ts` was: that
// module imports `server-only`, which THROWS the moment anything outside a
// server component touches it — a test included. The HTML branch is the one
// this whole intake door depends on, and a branch that cannot be tested is a
// branch nobody can change safely.
//
// No `server-only` here, then, matching `briefUrl.ts`: the parsers are pulled
// in through dynamic imports, so nothing reaches a client bundle unless it
// actually calls this, and calling it in a browser would fail loudly rather
// than silently.

/** A web page reduced to the two things the intake wants from it. */
export interface ExtractedPage {
  /** The article, not the document: nav, cookie banner and footer are gone,
   *  and the page's own title opens it as a markdown heading. */
  text: string;
  /** The `<title>`, when the page has a non-empty one. The fetch route uses it
   *  to name the brief, which is why it comes back alongside the text rather
   *  than being re-derived from a second parse. */
  title: string | null;
}

/**
 * Get the readable article out of a web page.
 *
 * A page is not a document: the same markup that carries the spec also carries
 * a nav bar, a cookie banner, a newsletter box and a footer. Handing all of it
 * to `briefSections.ts` would turn every one of those into a section an agent
 * then reads and asks about, so the noise has to go before the text is text.
 * Readability is the same extraction Firefox's reader mode runs, over a
 * `linkedom` document because there is no DOM in a route.
 *
 * Readability MUTATES the document it is given, so the plain-body fallback
 * parses its own copy rather than reading the wreckage of the first attempt.
 * That fallback matters: Readability declines outright on a page that is not
 * article-shaped — a bare spec with no `<article>`, a wiki, a docs page — and
 * declining is not the same as there being nothing to read.
 */
export async function extractHtmlPage(html: string): Promise<ExtractedPage> {
  const { parseHTML } = await import('linkedom');
  const { Readability } = await import('@mozilla/readability');

  const { document } = parseHTML(html);
  const title = document.title?.trim() || null;

  let body = '';
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const article = new Readability(document as any).parse();
    body = article?.textContent?.trim() ?? '';
  } catch {
    // Readability throws on markup it cannot walk at all. That is a fact about
    // the page, and the fallback below is exactly what it is for.
  }

  if (body.length === 0) {
    const { document: plain } = parseHTML(html);
    for (const el of plain.querySelectorAll(
      'script, style, noscript, template',
    )) {
      el.remove();
    }
    body = plain.body?.textContent?.trim() ?? '';
  }

  return { text: withTitleHeading(body, title), title };
}

/**
 * Open the brief with the page's own name, as a heading.
 *
 * A page arrives with no heading structure at all — extraction flattens the
 * markup — so the section splitter has nothing to split on and the map has
 * nothing to be named after but the first line of prose. On a Wikipedia
 * article that first line is "From Wikipedia, the free encyclopedia", which
 * named every board started from that site the same boilerplate thing.
 *
 * The title is genuinely part of the document, so adding it is restoring
 * something extraction dropped rather than inventing something. It is skipped
 * when the article already opens with it, which happens whenever an `<h1>`
 * survives — saying the name twice before the first sentence reads as a bug.
 */
function withTitleHeading(body: string, title: string | null): string {
  if (!title) return body;

  const opening = body.split('\n').find((line) => line.trim().length > 0) ?? '';
  if (opening.trim() === title) return `# ${body.trim()}`;

  return body.length > 0 ? `# ${title}\n\n${body}` : `# ${title}`;
}
