import { NextResponse } from 'next/server';
import { prisma } from '@/app/lib/prisma';
import { withFailure } from '@/app/lib/apiFailure';
import { fitsAttachmentCaps, type CapRefusal } from '@/app/lib/attachments';

/** Which HTTP status each refusal is. Kept here rather than in the rule itself
 *  because the caps are a product decision and a status code is a transport
 *  one — the browser upload and the client-side courtesy check share the rule
 *  and neither has any use for a number. */
const REFUSAL_STATUS: Record<CapRefusal, number> = {
  // Not something this map can hold, whatever its size.
  type: 415,
  size: 413,
  total: 413,
  // A conflict with what is already there, not with the file itself — which is
  // why this one is fixable by removing something rather than by sending less.
  count: 409,
};

// Node, not edge: this reads an uploaded file into a Buffer and writes it to
// SQLite, and neither is an edge-runtime thing to do.
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Edit the list of things brought along with an idea: renames and removals.
 *
 * Still a whole-list PUT, and for the reason it always was — the client already
 * holds the list it is editing, and two verbs that each mutate it would have to
 * read-modify-write with a race this shape does not have.
 *
 * What changed is what an item is. Attachments are rows now, so the list is
 * keyed by id rather than by name, and an item's absence is a deletion of that
 * row rather than a rewrite of a JSON blob. That is also why this verb can no
 * longer be the way a file arrives: replacing the list every time would mean
 * re-uploading every image on every edit. Bytes come in through POST below.
 */
export const PUT = withFailure(
  async (request: Request, { params }: { params: Promise<{ id: string }> }) => {
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
        { error: 'Expected { attachments: [{ id, name }] }.' },
        { status: 400 },
      );
    }

    const map = await prisma.thinkingMap.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!map) {
      return NextResponse.json({ error: 'No such map' }, { status: 404 });
    }

    const wanted = raw.flatMap((a) => {
      const item = a as { id?: unknown; name?: unknown };
      const rowId = typeof item?.id === 'string' ? item.id : '';
      const name = String(item?.name ?? '').trim();
      if (!rowId || !name) return [];
      return [{ id: rowId, name }];
    });

    const existing = await prisma.mapAttachment.findMany({
      where: { mapId: id },
      select: { id: true, name: true },
    });

    const keep = new Map(wanted.map((a) => [a.id, a.name]));
    // Scoped by mapId as well as by row id throughout, so a list carrying an id
    // from another map can only ever be ignored — never reach that map's rows.
    const removed = existing.filter((row) => !keep.has(row.id)).map((row) => row.id);
    const renamed = existing.filter(
      (row) => keep.has(row.id) && keep.get(row.id) !== row.name,
    );

    await prisma.$transaction([
      ...(removed.length
        ? [prisma.mapAttachment.deleteMany({ where: { mapId: id, id: { in: removed } } })]
        : []),
      ...renamed.map((row) =>
        prisma.mapAttachment.updateMany({
          where: { mapId: id, id: row.id },
          data: { name: keep.get(row.id)! },
        }),
      ),
    ]);

    return NextResponse.json({ attachments: await listFor(id) });
  },
);

/**
 * Append one attachment, with its bytes.
 *
 * A separate verb from the PUT above rather than a widening of it: a whole-list
 * replace that carried files would re-upload every image whenever somebody
 * removed one. Appending one file at a time is also what lets a per-file error
 * be reported per file, instead of failing a batch on its worst member.
 *
 * The three caps are enforced HERE and nowhere else that matters. A cap the
 * client checks is a courtesy; this is the one that decides.
 */
export const POST = withFailure(
  async (request: Request, { params }: { params: Promise<{ id: string }> }) => {
    const { id } = await params;

    const map = await prisma.thinkingMap.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!map) {
      return NextResponse.json({ error: 'No such map' }, { status: 404 });
    }

    let form: FormData;
    try {
      form = await request.formData();
    } catch {
      return NextResponse.json(
        { error: 'That upload did not arrive in one piece. Try again.' },
        { status: 400 },
      );
    }

    const file = form.get('file');
    if (!(file instanceof File)) {
      return NextResponse.json(
        { error: 'No file came through. Pick one and try again.' },
        { status: 400 },
      );
    }

    const mediaType = file.type || 'application/octet-stream';

    const held = await prisma.mapAttachment.findMany({
      where: { mapId: id },
      select: { byteSize: true },
    });

    // The caps themselves live in `app/lib/attachments.ts`, where they can be
    // exercised at their edges without an HTTP round trip — and where the
    // browser's own courtesy check reads the same rules, so the two cannot
    // drift into wording the same refusal differently. This is still the
    // enforcement: the client's copy is advice, and only this one decides.
    const verdict = fitsAttachmentCaps(held, file);
    if (!verdict.ok) {
      return NextResponse.json(
        { error: verdict.error },
        { status: REFUSAL_STATUS[verdict.reason] },
      );
    }

    const bytes = Buffer.from(await file.arrayBuffer());
    const created = await prisma.mapAttachment.create({
      data: {
        mapId: id,
        name: file.name,
        mediaType,
        bytes,
        byteSize: bytes.byteLength,
      },
      // Never the bytes. The caller just sent them and has no use for them
      // back, and selecting them would put a megabyte through a JSON encoder
      // for nothing.
      select: { id: true, name: true, mediaType: true, byteSize: true },
    });

    return NextResponse.json(
      { attachment: { ...created, hasBytes: true } },
      { status: 201 },
    );
  },
);

/** Metadata for every attachment on a map, in the order they arrived. Bytes are
 *  reduced to a boolean before they ever leave the database. */
async function listFor(mapId: string) {
  const rows = await prisma.mapAttachment.findMany({
    where: { mapId },
    orderBy: { createdAt: 'asc' },
    select: { id: true, name: true, mediaType: true, byteSize: true },
  });
  return rows.map((row) => ({ ...row, hasBytes: row.byteSize > 0 }));
}
