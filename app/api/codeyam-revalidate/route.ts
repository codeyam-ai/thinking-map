import { revalidatePath } from 'next/cache';
import { NextResponse } from 'next/server';

// Dev-only route used by codeyam-editor's capture path to flush the
// Next.js RSC cache between applying a scenario seed and taking the
// Playwright screenshot. 404s in production so it never ships live.
//
// This route deliberately does NOT use `codeyamLaunched()`, unlike the other
// codeyam-only surface in this app. Do not "fix" it to match.
//
// The reason is the caller. `request_revalidation` (codeyam-editor repo,
// crates/control-api/src/capture_revalidate.rs) treats a 404 from here as
// `RouteNotMounted` and PROCEEDS WITH THE CAPTURE ANYWAY. So a stricter gate
// would not refuse a request — it would let the screenshot be taken against the
// previous scenario's un-flushed HTML, silently producing captures of the wrong
// state. That failure mode is worse than the thing the gate would close, because
// what this route does when reached is flush a cache in a dev process, not
// expose anything: `revalidatePath` on caller-supplied paths is not an exposure
// worth trading silent wrong screenshots for.

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
