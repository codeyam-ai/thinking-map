/**
 * One-off: turn the legacy `attachments` JSON column into MapAttachment rows.
 *
 * Run once against any database that predates the MapAttachment model:
 *
 *   npx tsx prisma/backfill-attachments.ts
 *
 * Every name recorded in the old column becomes a row with `bytes` null — a
 * legacy attachment stays exactly what it always was, a recorded name, and
 * simply has no picture to look at. Dropping those names instead would make
 * this change lose data on boards that predate it, which is the one outcome a
 * migration is not allowed to have.
 *
 * Idempotent: a map that already has rows is skipped, so running it twice does
 * not duplicate anything. It clears the old column as it goes, which is also
 * what makes a second run a no-op on a database it has already converted.
 */

import '../app/lib/loadEnv';
import { prisma } from '../app/lib/prisma';
import { parseAttachments } from '../app/lib/attachments';

async function main() {
  const maps = await prisma.thinkingMap.findMany({
    where: { attachmentsJson: { not: null } },
    select: { id: true, attachmentsJson: true, _count: { select: { attachments: true } } },
  });

  let created = 0;
  let skipped = 0;

  for (const map of maps) {
    // A map that already has rows was converted by an earlier run, or by the
    // app itself. Re-adding its names would double the list.
    if (map._count.attachments > 0) {
      skipped += 1;
      continue;
    }

    const names = parseAttachments(map.attachmentsJson);
    if (names.length > 0) {
      await prisma.mapAttachment.createMany({
        data: names.map((a) => ({
          mapId: map.id,
          name: a.name,
          // Unknown, and unknowable from a name alone. The generic type is
          // what a reader gets told, which is honest about there being
          // nothing here to open.
          mediaType: 'application/octet-stream',
          byteSize: 0,
        })),
      });
      created += names.length;
    }

    await prisma.thinkingMap.update({
      where: { id: map.id },
      data: { attachmentsJson: null },
    });
  }

  console.log(
    `Backfilled ${created} attachment(s) across ${maps.length - skipped} map(s); ` +
      `${skipped} already had rows.`,
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
