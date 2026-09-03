import { NextResponse } from 'next/server';
import { createMap, listMaps } from '@/app/lib/mapStore';
import { parseBriefInput } from '@/app/lib/briefInput';
import { withFailure } from '@/app/lib/apiFailure';
import {
  VISITOR_COOKIE,
  mintVisitorId,
  readVisitorId,
  visitorCookieOptions,
} from '@/app/lib/visitor';

export const dynamic = 'force-dynamic';

// Both handlers are wrapped so a throw — a database behind the schema, most
// often — reaches the browser as a readable `{ error }` rather than as an
// unparseable body the fetch API then complains about.

// This door returns the same scoped list the landing page renders. It used to
// hand any caller every map on the instance, which is the enumeration the
// visitor cookie exists to close — fixing the page alone would have left the
// same list one fetch away.
export const GET = withFailure(async () => {
  return NextResponse.json({ maps: await listMaps(await readVisitorId()) });
});

export const POST = withFailure(async (request: Request) => {
  const body = await request.json().catch(() => ({}));
  const seedIdea =
    typeof body.seedIdea === 'string' ? body.seedIdea.trim() : '';
  // The brief arrives as text the browser already has, because extraction
  // happened in its own request.
  const brief = parseBriefInput(body.brief);

  // A brief is enough on its own — the document says what the person wants
  // thought through. What is not allowed is arriving with neither.
  if (!seedIdea && !brief) {
    return NextResponse.json(
      { error: 'Tell me what you want to figure out first.' },
      { status: 400 },
    );
  }
  // Names only — see the schema note on ThinkingMap.attachments.
  const attachments = Array.isArray(body.attachments)
    ? (body.attachments as unknown[])
        .map((a) => String((a as { name?: unknown })?.name ?? '').trim())
        .filter(Boolean)
        .map((name) => ({ name }))
    : [];

  // Creating a map is the only moment a browser earns something to remember, so
  // it is the only place the cookie is minted. Deliberately AFTER the validation
  // above: a request that was told to come back with an idea must not walk away
  // with an identity. And a server component cannot write a cookie in Next 16,
  // which is the other reason it happens on this door rather than on the page.
  const existingVisitorId = await readVisitorId();
  const visitorId = existingVisitorId ?? mintVisitorId();

  const map = await createMap(seedIdea, brief, attachments, visitorId);

  const response = NextResponse.json({ id: map.id }, { status: 201 });
  if (!existingVisitorId) {
    response.cookies.set(VISITOR_COOKIE, visitorId, visitorCookieOptions());
  }
  return response;
});
