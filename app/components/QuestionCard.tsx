'use client';

// One card on the board.
//
// A card is one of three things, and each looks different enough that the board
// can be read at a glance without a legend:
//
//   open      — saturated in the theme's colour, and always carrying a way to
//               answer. The ones still asking something of you.
//   answered  — near-black, the question in the theme's colour and YOUR words
//               in white underneath. What you said is the content; the question
//               becomes its label.
//   insight   — near-black too, but eyebrowed as the partner's own thinking
//               rather than as something you wrote.
//
// Which face it wears is decided by `cardPresentation`, not here: it is a rule
// about the node rather than about rendering, and it is worth a test.
//
// An open card's answer area has two modes and shows exactly one of them — the
// partner's shortlist, or the box for saying something the shortlist does not
// contain. Never both: stacked, the box read as one more option and the pair
// overflowed the card's fixed height.
//
// An answered card keeps a pencil, because an answer is a thought at a moment
// and thinking is the thing this board is for. Re-answering replaces the
// previous answer through the same path a first answer takes.

import { useEffect, useState } from 'react';
import { composeAnswer, toggleChoice } from '@/app/lib/answerDraft';
import { cardCopyLabel, cardCopyText } from '@/app/lib/boardCopyText';
import { cardEyebrow } from '@/app/lib/cardEyebrow';
import {
  isAnsweredCard,
  isInsightCard,
  isOpenCard,
} from '@/app/lib/cardPresentation';
import type { PlacedCard } from '@/app/lib/galaxyLayout';
import { themeColor } from '@/app/lib/themeHue';
import CardDiagram from './CardDiagram';
import CardChoiceList from './CardChoiceList';
import AnswerComposer from './AnswerComposer';
import CopyTextButton from './CopyTextButton';

export default function QuestionCard({
  card,
  focused,
  onFocus,
  onAnswer,
  onSkip,
}: {
  card: PlacedCard;
  focused: boolean;
  onFocus: () => void;
  onAnswer: (text: string) => void;
  /** Move on without answering. Optional: an isolated fixture has nowhere to
   *  move on TO, and a Skip that goes nowhere is worse than no Skip. */
  onSkip?: () => void;
}) {
  // Which of the three faces this card shows. The rule is a property of the
  // node rather than of rendering, so it lives in `cardPresentation` where a
  // test can hold it — including the clause a card carrying a diagram or a
  // picture depends on, which this component used to get wrong.
  const isInsight = isInsightCard(card);
  const answered = isAnsweredCard(card);
  const open = isOpenCard(card);

  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  /** The options taken so far — plural, because "two of those" is an ordinary
   *  answer and the card used to be able to record only one. */
  const [picked, setPicked] = useState<string[]>([]);

  /** What was just recorded, shown before the map has caught up.
   *
   *  Answering writes to the shared log and the board re-renders from the
   *  server when the map's revision rises — which is a round trip, and until it
   *  lands the card someone just answered still looks unanswered. Holding the
   *  answer here lets the card turn over IMMEDIATELY, so the person sees their
   *  own words land on the card they put them on. It is cleared by the real
   *  node arriving answered, which is what makes this an early view of the
   *  truth rather than a second copy of it. */
  const [justAnswered, setJustAnswered] = useState<string | null>(null);
  useEffect(() => {
    if (card.status === 'answered') setJustAnswered(null);
  }, [card.status]);

  // Seed the editor from what is on the card, so opening the pencil shows the
  // existing answer to amend rather than an empty box to retype.
  useEffect(() => {
    if (editing) setDraft(card.detail ?? '');
  }, [editing, card.detail]);

  const accent = themeColor(card.hue);
  const settled = answered || justAnswered !== null;
  // Editing OUTRANKS settled, and the order matters. `settled` covers both a
  // node that arrived answered and one answered a moment ago, and a card in
  // either state stops offering a field — but the pencil's whole job is to put
  // the field back on exactly such a card. Ordering these the other way round
  // made the pencil open onto nothing.
  const writing = editing || (open && !settled);
  const choices = card.choices ?? [];
  const hasChoices = choices.length > 0;

  // The shortlist and the box for your own words now stand TOGETHER. They were
  // mutually exclusive, which made the list a cage: you could take exactly one
  // option, or reject the lot and type instead, and "one of those, with a
  // qualification" — which is what most answers are — could not be said at all.
  //
  // The reason they were split was real and is solved rather than ignored: two
  // full-height regions overflowed a fixed-size card. So the list keeps the
  // card's spare room and scrolls, and the field goes compact beneath it.
  const answerText = composeAnswer(picked, draft, choices);

  /** There is somewhere to go back TO. A first answer has nothing to cancel. */
  const cancellable = editing;

  function closeComposer() {
    setEditing(false);
    setDraft('');
    setPicked([]);
  }

  function submit() {
    if (!answerText) return;
    // Turn the card over first, so the answer is visible on it before the
    // board moves on. `onAnswer` is what arms that move.
    setJustAnswered(answerText);
    closeComposer();
    onAnswer(answerText);
  }

  return (
    // A plain div, and deliberately NOT role="button".
    //
    // It was a <button> first, which is invalid — a button may not contain the
    // choice pills and the pencil, and the parser hoists them out, leaving them
    // unclickable. Giving the div role="button" instead fixed the markup but
    // not the meaning: an element's accessible name is computed from its
    // contents, so the card announced itself as a button called "How much time
    // did you have… Under 20 minutes About an hour…", swallowing its own
    // controls into one label.
    //
    // The card is a container. Clicking it to bring it into focus is a
    // convenience on top of the real controls inside it, so it takes the click
    // and no role: the pills, the pencil and the field are what a keyboard or a
    // screen reader should find here.
    <div
      onClick={onFocus}
      data-no-pan={focused ? '' : undefined}
      // `overflow-hidden` and `break-words`: a card may scroll DOWN, inside the
      // one region built to (the shortlist, the answer field), and never
      // sideways. A horizontal scrollbar hides content in the axis nobody
      // thinks to look in, and the thing that pushes a card sideways is
      // always the same — one long unbroken word, a URL, a pasted id — so the
      // fix is to break it rather than to let the card grow a second scrollbar.
      className="group relative flex h-full w-full flex-col overflow-hidden break-words rounded-[22px] p-7 text-left transition-all duration-300"
      style={{
        background: open ? accent : '#141416',
        border: `1.5px solid ${open ? accent : themeColor(card.hue, { a: 0.42 })}`,
        color: open ? '#000' : '#fff',
        boxShadow: focused
          ? `0 0 0 3px ${themeColor(card.hue, { a: 0.55 })}, 0 30px 70px rgba(0,0,0,0.65)`
          : '0 18px 44px rgba(0,0,0,0.5)',
        cursor: 'pointer',
      }}
    >
      {/* Top-right, because the bottom-right corner is already the pencil on an
          answered card. Absent while the composer is open: a card being typed
          into is a form, and its content is not finished being written yet.
          The icon takes the eyebrow's treatment rather than the raw accent — on
          an open card the accent IS the background, so an accent-coloured glyph
          would be invisible on the very card it sits on. */}
      {writing ? null : (
        <CopyTextButton
          text={cardCopyText(card)}
          label={cardCopyLabel(card)}
          accent={open ? 'rgba(0,0,0,0.55)' : accent}
          visible={focused}
          className="absolute right-6 top-6"
        />
      )}

      {isInsight ? (
        <>
          {/* What the card CARRIES wins over what kind it is: a drawn shape and
              a piece of reference are recognisable at a glance and worth naming
              as such. Everything else defers to `cardEyebrow`, so the word for a
              kind is decided in exactly one tested place — an assumption says
              "Assumption" here and on every other card in the app, rather than
              the generic "Insight" this used to flatten them all into. */}
          <span
            className="text-[11px] font-semibold uppercase tracking-[0.14em]"
            style={{ color: accent }}
          >
            {card.diagram
              ? 'Shape'
              : card.imageUrl
                ? 'Reference'
                : cardEyebrow({ kind: card.kind })}
          </span>

          {/* The picture, above the words. A reference card exists so someone
              can LOOK at the thing — a competitor's screen, a sketch, a diagram
              — and a caption printed above the evidence makes them read a
              description of what they are about to see. */}
          {card.imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={card.imageUrl}
              alt={card.imageAlt ?? card.label}
              className="mt-3 w-full rounded-[12px] object-cover"
              style={{ maxHeight: 150, background: 'rgba(255,255,255,0.05)' }}
              // A reference that 404s should leave the card readable rather
              // than a broken-image glyph where the evidence was.
              onError={(e) => {
                (e.currentTarget as HTMLImageElement).style.display = 'none';
              }}
            />
          ) : null}
          <p className="mt-3 text-[16px] font-semibold leading-snug">
            {card.label}
          </p>

          {card.diagram ? (
            <CardDiagram
              steps={card.diagram.steps}
              note={card.diagram.note}
              accent={accent}
            />
          ) : card.detail ? (
            <p className="mt-2.5 text-[13px] leading-relaxed text-white/60">
              {card.detail}
            </p>
          ) : null}
        </>
      ) : settled && !editing ? (
        <>
          {/* Vertically centred: an answered card is a statement, and hanging
              it from the top would leave it looking like a form with the rest
              of the fields missing. */}
          <span className="flex-1" />
          <p
            className="text-[13px] font-semibold leading-snug"
            style={{ color: accent }}
          >
            {card.label}
          </p>
          <p className="mt-2 text-[16px] font-semibold leading-snug text-white">
            {/* The answer just given outranks the node's own, for the moment
                between writing it and the map catching up. */}
            {justAnswered ?? card.detail}
          </p>
          <span className="flex-1" />

          <span
            role="button"
            tabIndex={0}
            aria-label="Edit this answer"
            data-no-pan
            onClick={(e) => {
              e.stopPropagation();
              setEditing(true);
              onFocus();
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.stopPropagation();
                setEditing(true);
                onFocus();
              }
            }}
            className="absolute bottom-6 right-6 opacity-70 transition-opacity hover:opacity-100"
            style={{ color: accent }}
          >
            <svg
              width="19"
              height="19"
              viewBox="0 0 24 24"
              fill="none"
              aria-hidden="true"
            >
              <path
                d="M4 20h4L19 9a2.1 2.1 0 10-3-3L5 17v3z"
                stroke="currentColor"
                strokeWidth="1.7"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </span>
        </>
      ) : (
        <>
          {/* Editing is a transient state of the CARD, not a fact about the
              node, so it stays local. The resting word comes from `cardEyebrow`
              — the same helper that guarantees an answered question stops
              calling itself Open, which is the rule this card would otherwise
              be a second, untested implementation of. */}
          <span
            className="text-[11px] font-semibold uppercase tracking-[0.14em]"
            style={{ color: open ? 'rgba(0,0,0,0.55)' : accent }}
          >
            {editing
              ? 'Editing your answer'
              : cardEyebrow({
                  kind: card.kind,
                  answered: card.status === 'answered',
                })}
          </span>
          {/* Smaller than it was. The question is the label on a card whose
              real content is the answer, and at 19px a two-line question ate
              the space the options and the field need. */}
          <p className="mt-3 text-[16px] font-semibold leading-snug">
            {card.label}
          </p>
        </>
      )}

      {/* The answer area: the shortlist AND the box for what it does not
          contain, together, submitted once. Wrapped in `data-no-pan` so a drag
          that starts on a control belongs to the control rather than panning
          the board underneath it. */}
      {writing ? (
        <div
          data-no-pan
          className="contents"
          onClick={(e) => e.stopPropagation()}
        >
          {hasChoices ? (
            <CardChoiceList
              choices={choices}
              picked={picked}
              light={open}
              onToggle={(choice) => {
                setPicked((p) => toggleChoice(p, choice));
                if (!focused) onFocus();
              }}
            />
          ) : null}

          <AnswerComposer
            value={draft}
            onChange={setDraft}
            onSubmit={submit}
            onCancel={cancellable ? closeComposer : null}
            onSkip={onSkip ?? null}
            // Under a shortlist the box is the place to QUALIFY what you
            // picked; alone on the card it is the whole answer, so it says
            // what to do rather than what it is for.
            placeholder={
              hasChoices ? 'Add anything the options miss…' : 'Answer here'
            }
            // Options taken with nothing typed is a complete answer, so Save
            // cannot be gated on the field alone.
            canSubmit={answerText !== null}
            // The field gives up the card's spare room to the options above it.
            compact={hasChoices}
            // Only the focused card autofocuses, so a dozen visible fields
            // still leave exactly one cursor on the board. Never on a card
            // with a shortlist: the options are what to read first, and a
            // cursor in the box below them says otherwise.
            autoFocus={(focused || editing) && !hasChoices}
            onFieldFocus={() => {
              if (!focused) onFocus();
            }}
            light={open}
            accent={accent}
          />
        </div>
      ) : null}
    </div>
  );
}
