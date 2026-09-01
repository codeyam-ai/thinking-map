import { revalidatePath } from 'next/cache';
import { NextResponse } from 'next/server';

// Dev-only route used by codeyam-editor's capture path to flush the
// Next.js RSC cache between applying a scenario seed and taking the
// Playwright screenshot. 404s in production so it never ships live.

export async function POST(request: Request) {
  if (process.env.NODE_ENV !== 'development') {
    return new NextResponse('not found', { status: 404 });
  }

  let paths: string[] = ['/'];
  try {
    const body = (await request.json()) as { paths?: unknown } | null;
    if (
      body &&
      Array.isArray(body.paths) &&
      body.paths.every((p) => typeof p === 'string')
    ) {
      paths = body.paths as string[];
    }
  } catch {
    // Empty or malformed body — fall back to revalidating '/'.
  }

  for (const p of paths) {
    revalidatePath(p);
  }

  return NextResponse.json({ revalidated: paths });
}
