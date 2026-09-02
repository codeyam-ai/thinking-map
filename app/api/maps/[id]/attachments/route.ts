import { NextResponse } from 'next/server';
import { prisma } from '@/app/lib/prisma';

/**
 * Replace the list of things brought along with an idea.
 *
 * A whole-list PUT rather than add/remove endpoints: the client already holds
 * the list it is editing, and two verbs that each mutate a JSON column would
 * have to read-modify-write it anyway — with a race between them that this
 * shape does not have.
 *
 * Names are the only thing accepted. Anything else on an item is dropped rather
 * than stored, so the column cannot quietly grow a shape the rest of the app
 * does not know how to read.
 */
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Expected a JSON body.' }, { status: 400 });
  }

  const raw = (body as { attachments?: unknown })?.attachments;
  if (!Array.isArray(raw)) {
    return NextResponse.json(
      { error: 'Expected { attachments: [{ name }] }.' },
      { status: 400 },
    );
  }

  const attachments = raw
    .map((a) => String((a as { name?: unknown })?.name ?? '').trim())
    .filter(Boolean)
    .map((name) => ({ name }));

  const { count } = await prisma.thinkingMap.updateMany({
    where: { id },
    data: {
      attachments: attachments.length ? JSON.stringify(attachments) : null,
    },
  });
  if (count === 0) {
    return NextResponse.json({ error: 'No such map' }, { status: 404 });
  }

  return NextResponse.json({ attachments });
}
