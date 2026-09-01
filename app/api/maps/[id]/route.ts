import { NextResponse } from 'next/server';
import { getMap } from '@/app/lib/mapStore';

export const dynamic = 'force-dynamic';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const map = await getMap(id);
  if (!map) return NextResponse.json({ error: 'No such map' }, { status: 404 });
  return NextResponse.json(map);
}
