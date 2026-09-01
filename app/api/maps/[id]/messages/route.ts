import { NextResponse } from 'next/server';
import { prisma } from '@/app/lib/prisma';
import { applyToolCalls, getMap, summarizeMap } from '@/app/lib/mapStore';
import { MissingCredentialsError, runTurn } from '@/app/lib/thinkingPartner';

export const dynamic = 'force-dynamic';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const body = await request.json().catch(() => ({}));
  const content = typeof body.content === 'string' ? body.content.trim() : '';
  if (!content) {
    return NextResponse.json({ error: 'Say something first.' }, { status: 400 });
  }

  const map = await getMap(id);
  if (!map) return NextResponse.json({ error: 'No such map' }, { status: 404 });

  await prisma.message.create({ data: { mapId: id, role: 'user', content } });

  const history = [...map.messages, { role: 'user', content }].map((m) => ({
    role: m.role === 'assistant' ? ('assistant' as const) : ('user' as const),
    content: m.content,
  }));

  try {
    const turn = await runTurn({ history, mapSummary: summarizeMap(map.nodes) });
    if (turn.toolCalls.length > 0) await applyToolCalls(id, turn.toolCalls);
    if (turn.text) {
      await prisma.message.create({
        data: { mapId: id, role: 'assistant', content: turn.text },
      });
    }
    await prisma.thinkingMap.update({ where: { id }, data: { updatedAt: new Date() } });
    return NextResponse.json({ ok: true });
  } catch (error) {
    // The user's message is already saved, so nothing they typed is lost.
    if (error instanceof MissingCredentialsError) {
      return NextResponse.json({ error: error.message }, { status: 503 });
    }
    const message = error instanceof Error ? error.message : 'Something went wrong.';
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
