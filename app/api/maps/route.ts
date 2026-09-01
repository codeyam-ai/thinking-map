import { NextResponse } from 'next/server';
import { createMap, listMaps } from '@/app/lib/mapStore';

export const dynamic = 'force-dynamic';

export async function GET() {
  return NextResponse.json({ maps: await listMaps() });
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const seedIdea = typeof body.seedIdea === 'string' ? body.seedIdea.trim() : '';
  if (!seedIdea) {
    return NextResponse.json(
      { error: 'Tell me what you want to figure out first.' },
      { status: 400 },
    );
  }
  const map = await createMap(seedIdea);
  return NextResponse.json({ id: map.id }, { status: 201 });
}
