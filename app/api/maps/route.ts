import { NextResponse } from 'next/server';
import { createMap, listMaps } from '@/app/lib/mapStore';
import { parseBriefInput } from '@/app/lib/briefInput';
import { withFailure } from '@/app/lib/apiFailure';

export const dynamic = 'force-dynamic';

// Both handlers are wrapped so a throw — a database behind the schema, most
// often — reaches the browser as a readable `{ error }` rather than as an
// unparseable body the fetch API then complains about.

export const GET = withFailure(async () => {
  return NextResponse.json({ maps: await listMaps() });
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

  const map = await createMap(seedIdea, brief, attachments);
  return NextResponse.json({ id: map.id }, { status: 201 });
});
