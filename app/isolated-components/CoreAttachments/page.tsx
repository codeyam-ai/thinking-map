import Component from "../../components/CoreAttachments";
import type { ComponentProps } from "react";

type Props = ComponentProps<typeof Component>;

// What the person brought along with the idea, listed under the core.
//
// The board holds the file now, not just its name, so an image shows the
// picture and everything else shows a paperclip. The two are not a styling
// choice: a thumbnail means there is something the partner can open, and the
// paperclip means there is not. Both states are real and both are here — a
// legacy attachment, recorded when the board stored names and nothing else,
// renders exactly as it always did.
//
// `att-whiteboard` is a real row in the `map-galaxy` seed, so the thumbnail in
// these frames is served by the byte route rather than mocked. An id that is
// NOT in the seed would render as a broken image, which is the honest result
// and the reason these ids are the seed's own.

const scenarios: Record<string, Props> = {
  // The ordinary case: a picture and a document, and the way to add more.
  Default: {
    mapId: "map-galaxy",
    attachments: [
      {
        id: "att-whiteboard",
        name: "whiteboard-photo.png",
        mediaType: "image/png",
        byteSize: 1563,
        hasBytes: true,
      },
      {
        id: "att-handover-notes",
        name: "shift-handover-notes.pdf",
        mediaType: "application/octet-stream",
        byteSize: 0,
        hasBytes: false,
      },
    ],
  },

  // Nothing attached, which is most boards. It has to read as an invitation
  // rather than as an empty row where something failed to load.
  Empty: { mapId: "map-galaxy", attachments: [] },

  // Exactly one — the boundary where the strip becomes a list.
  Single: {
    mapId: "map-galaxy",
    attachments: [
      {
        id: "att-whiteboard",
        name: "whiteboard-photo.png",
        mediaType: "image/png",
        byteSize: 1563,
        hasBytes: true,
      },
    ],
  },

  // An attachment from before the board could hold files: a name, and nothing
  // behind it. It has to render as an ordinary part of the thinking rather
  // than as something that failed — there is no picture because none was ever
  // stored, which is a fact about its age, not an error.
  LegacyNameOnly: {
    mapId: "map-galaxy",
    attachments: [
      {
        id: "att-handover-notes",
        name: "shift-handover-notes.pdf",
        mediaType: "application/octet-stream",
        byteSize: 0,
        hasBytes: false,
      },
    ],
  },

  // At the cap: four is the limit, so the "+ Add" control is gone rather than
  // present-and-refusing. A filename long enough to be truncated is in here
  // too — a shortened name still has to be identifiable enough to remove the
  // right one.
  Full: {
    mapId: "map-galaxy",
    attachments: [
      {
        id: "att-whiteboard",
        name: "whiteboard-photo.png",
        mediaType: "image/png",
        byteSize: 1563,
        hasBytes: true,
      },
      {
        id: "att-2",
        name: "practice-management-system-evaluation-2024-final-v3.md",
        mediaType: "text/markdown",
        byteSize: 48_210,
        hasBytes: true,
      },
      {
        id: "att-3",
        name: "call-back-log.txt",
        mediaType: "text/plain",
        byteSize: 3_400,
        hasBytes: true,
      },
      {
        id: "att-handover-notes",
        name: "shift-handover-notes.pdf",
        mediaType: "application/octet-stream",
        byteSize: 0,
        hasBytes: false,
      },
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
