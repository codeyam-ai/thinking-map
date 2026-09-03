import { NextResponse } from 'next/server';
import { prisma } from '@/app/lib/prisma';
import { withFailure } from '@/app/lib/apiFailure';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * The file itself. This is what a thumbnail's `src` points at.
 *
 * The lookup is scoped by BOTH mapId and attachment id, and deliberately so: an
 * id is a cuid rather than a secret, and a route keyed on the attachment alone
 * would let an id learned from one board read a file off another. Scoping by
 * the pair means a mismatched pair is simply a 404 — the same answer as an id
 * that never existed, which is also the only answer that does not confirm the
 * row is real.
 *
 * A row with no bytes is a legacy attachment: a name recorded back when the
 * board stored names and nothing else. There is genuinely nothing to serve, so
 * it 404s rather than returning an empty body a browser would render as a
 * broken image.
 */
export const GET = withFailure(
  async (
    _request: Request,
    { params }: { params: Promise<{ id: string; attachmentId: string }> },
  ) => {
    const { id, attachmentId } = await params;

    const attachment = await prisma.mapAttachment.findFirst({
      where: { id: attachmentId, mapId: id },
      select: { bytes: true, mediaType: true, name: true },
    });

    if (!attachment?.bytes) {
      return NextResponse.json({ error: 'No such attachment' }, { status: 404 });
    }

    return new NextResponse(new Uint8Array(attachment.bytes), {
      headers: {
        'Content-Type': attachment.mediaType,
        'Content-Length': String(attachment.bytes.byteLength),
        // An attachment is written once and never edited — the PUT beside this
        // renames and removes, it does not replace bytes — so the content at
        // this URL cannot change. Immutable is the honest header, and it is
        // what keeps a board with four thumbnails from re-fetching them on
        // every render.
        'Cache-Control': 'private, max-age=31536000, immutable',
        // Inline: this is pointed at by an <img>, not offered as a download.
        'Content-Disposition': `inline; filename="${encodeURIComponent(attachment.name)}"`,
      },
    });
  },
);
