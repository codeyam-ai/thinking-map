import Component from "../../../app/components/CopyTextButton";
import type { ComponentProps } from "react";

type Props = ComponentProps<typeof Component>;

// The control that replaced selecting text on the board.
//
// It is a 15px icon that sits ON something — a near-black card, a saturated
// open question, the white core disc — and it takes its colour from whatever
// that is. Captured on the bare page it would be a dark speck on paper,
// demonstrating nothing, so each scenario carries the GROUND its caller gives
// it. That is not decoration: the reason `accent` exists at all is that an
// accent-coloured glyph on an open card would be invisible on the very card it
// sits on, and only a capture with the ground in it can show that.
//
// Sized to a card's top-right corner rather than full width — this is never a
// full-width surface, and a button floating in a 1440px frame would say it was.
const scenarios: Record<
  string,
  { props: Props; ground: string; note: string }
> = {
  // The ordinary case: the far end of the board and every answered card, where
  // the ground is near-black and the theme hue reads cleanly on it.
  OnADarkCard: {
    props: {
      text: "Which handover item goes missing most often?\n\nOwner call-backs.",
      label: "Copy this question and your answer",
      accent: "hsl(88 80% 62%)",
      visible: true,
    },
    ground: "#141416",
    note: "answered card",
  },

  // An open question is SATURATED in its theme colour, so the accent IS the
  // background. The ink treatment is what keeps the control visible, and this
  // is the frame that shows why passing `accent` straight through would fail.
  OnAnOpenCard: {
    props: {
      text: "Does this replace the whiteboard or sit beside it?",
      label: "Copy this question",
      accent: "rgba(0,0,0,0.55)",
      visible: true,
    },
    ground: "#e35bb8",
    note: "open card",
  },

  // The core idea is the one object on this board that takes no colour: a white
  // disc with black type. An accent here would be the first thing to contradict
  // that, so the control goes black too.
  OnTheCoreDisc: {
    props: {
      text: "Our vets lose things between the morning and evening shift.",
      label: "Copy this idea",
      accent: "rgba(0,0,0,0.5)",
      visible: true,
    },
    ground: "#ffffff",
    note: "core idea",
  },
};

// There is deliberately NO `Hidden` fixture here, and the reason is worth
// recording so nobody adds one back.
//
// At rest on an unfocused card the control is `opacity: 0` — verified directly
// in a plain browser — and the empty corner is a real state worth showing. But
// the capture pipeline hovers the page it photographs, and hover is one of the
// three things that reveals this control, so the frame came back showing the
// button under a caption saying it was gone. A scenario whose screenshot
// contradicts its own description is worse than an uncovered state.
//
// The behaviour is pinned instead by the render test
// ("is hidden at rest and shown when its card is the focused one"), which
// asserts it deterministically rather than photographically.
//
// There is no `Copied` fixture either, and the reason is the mirror image.
// `navigator.clipboard.writeText` rejects with NotAllowedError in the capture
// browser, so a driven capture exercises the REFUSED path — and a refusal is
// defined by nothing changing on screen, which is the whole point of the catch
// that leaves `copied` false. A scenario for it came back byte-identical to
// `OnADarkCard` and was retired: two frames that differ in no pixel document
// one state, not two. The successful tick and the silent refusal are both
// pinned by the render tests, which can see what a screenshot cannot.

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ s?: string }>;
}) {
  const { s = "OnADarkCard" } = await searchParams;
  const scenario = scenarios[s];
  if (!scenario) {
    return <div>Unknown scenario: {s}</div>;
  }
  const { props, ground, note } = scenario;
  const onPaper = ground === "#ffffff";

  // A card's top-right corner, at the width a card actually has, so the
  // control's placement is judged against the space it really occupies.
  return (
    <div id="codeyam-capture">
      <div
        style={{
          position: "relative",
          width: 300,
          height: 120,
          borderRadius: 22,
          background: ground,
          border: onPaper ? "1.5px solid #333336" : "1.5px solid rgba(255,255,255,0.2)",
        }}
      >
        <span
          style={{
            position: "absolute",
            left: 24,
            top: 24,
            fontSize: 11,
            fontWeight: 600,
            letterSpacing: "0.14em",
            textTransform: "uppercase",
            color: onPaper || ground === "#e35bb8" ? "rgba(0,0,0,0.55)" : "rgba(255,255,255,0.5)",
          }}
        >
          {note}
        </span>
        <div style={{ position: "absolute", right: 18, top: 18 }}>
          <Component {...props} />
        </div>
      </div>
    </div>
  );
}
