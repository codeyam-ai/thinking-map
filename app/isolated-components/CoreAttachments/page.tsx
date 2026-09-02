import Component from "../../components/CoreAttachments";
import type { ComponentProps } from "react";

type Props = ComponentProps<typeof Component>;

// What the person brought along with the idea, listed under the core.
//
// Names only — the board is a place to point AT things rather than to hold
// them, and storing the files themselves is a different product with a
// different set of problems. So what these frames show is the list and the way
// to add to it, never a file.

const scenarios: Record<string, Props> = {
  // The ordinary case: a couple of things attached, and the way to add more.
  Default: {
    mapId: "map-galaxy",
    attachments: [
      { name: "shift-handover-notes.pdf" },
      { name: "whiteboard-photo.jpg" },
    ],
  },

  // Nothing attached, which is most boards. It has to read as an invitation
  // rather than as an empty row where something failed to load.
  Empty: { mapId: "map-galaxy", attachments: [] },

  // Exactly one — the boundary where the strip becomes a list.
  Single: { mapId: "map-galaxy", attachments: [{ name: "scope-doc.pdf" }] },

  // Enough to wrap, with a filename long enough to test how a name that will
  // not fit is handled — a truncated name still has to be identifiable enough
  // to remove the right one.
  Many: {
    mapId: "map-galaxy",
    attachments: [
      { name: "shift-handover-notes.pdf" },
      { name: "whiteboard-photo.jpg" },
      { name: "practice-management-system-evaluation-2024-final-v3.xlsx" },
      { name: "call-back-log.csv" },
      { name: "rota.pdf" },
    ],
  },
};

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ s?: string }>;
}) {
  const { s = "Default" } = await searchParams;
  const props = scenarios[s];
  if (!props) return <div>Unknown scenario: {s}</div>;

  // It hangs beneath the core card on the board's dark canvas, in a column no
  // wider than the core itself.
  return (
    <div id="codeyam-capture" style={{ background: "#000", padding: 28 }}>
      <div style={{ width: 420 }}>
        <Component {...props} />
      </div>
    </div>
  );
}
