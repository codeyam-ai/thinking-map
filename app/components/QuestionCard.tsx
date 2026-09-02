'use client';

// One card on the board.
//
// A card is one of three things, and each looks different enough that the board
// can be read at a glance without a legend:
//
//   open      — saturated in the theme's colour, carrying an empty field. The
//               ones still asking something of you.
//   answered  — near-black, the question in the theme's colour and YOUR words
//               in white underneath. What you said is the content; the question
//               becomes its label.
//   insight   — near-black too, but eyebrowed as the partner's own thinking
//               rather than as something you wrote.
//
// An answered card keeps a pencil, because an answer is a thought at a moment
// and thinking is the thing this board is for. Re-answering replaces the
// previous answer through the same path a first answer takes.

import { useEffect, useState } from 'react';
import type { PlacedCard } from '@/app/lib/galaxyLayout';
import { themeColor } from '@/app/lib/themeHue';

/** Kinds that are the partner's own thinking rather than a question for you. */
const INSIGHT_KINDS = new Set([
  'assumption',
  'finding',
  'gap',
  'risk',
  'pro',
  'direction',
  'known',
  'unknown',
]);

export default function QuestionCard({
  card,
  focused,
  onFocus,
  onAnswer,
}: {
  card: PlacedCard;
  focused: boolean;
  onFocus: () => void;
  onAnswer: (text: string) => void;
}) {
  const isInsight = INSIGHT_KINDS.has(card.kind);
  const answered = card.status === 'answered' && !isInsight;
  const open = !answered && !isInsight;

  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');

  // Seed the editor from what is on the card, so opening the pencil shows the
  // existing answer to amend rather than an empty box to retype.
  useEffect(() => {
    if (editing) setDraft(card.detail ?? '');
  }, [editing, card.detail]);

  const accent = themeColor(card.hue);
  const writing = open || editing;

  function submit() {
    const text = draft.trim();
    if (!text) return;
    onAnswer(text);
    setDraft('');
    setEditing(false);
  }

  return (
    <button
      type="button"
      onClick={onFocus}
      data-no-pan={focused ? '' : undefined}
      className="relative flex h-full w-full flex-col rounded-[22px] p-7 text-left transition-all duration-300"
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
      {isInsight ? (
        <>
          <span
            className="text-[11px] font-semibold uppercase tracking-[0.14em]"
            style={{ color: accent }}
          >
            Insight
          </span>
          <p className="mt-4 text-[19px] font-semibold leading-snug">
            {card.label}
          </p>
          {card.detail ? (
            <p className="mt-3 text-[13px] leading-relaxed text-white/60">
              {card.detail}
            </p>
          ) : null}
        </>
      ) : answered && !editing ? (
        <>
          {/* Vertically centred: an answered card is a statement, and hanging
              it from the top would leave it looking like a form with the rest
              of the fields missing. */}
          <span className="flex-1" />
          <p
            className="text-[15px] font-semibold leading-snug"
            style={{ color: accent }}
          >
            {card.label}
          </p>
          <p className="mt-2 text-[19px] font-semibold leading-snug text-white">
            {card.detail}
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
            <svg width="19" height="19" viewBox="0 0 24 24" fill="none" aria-hidden="true">
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
          <span
            className="text-[11px] font-semibold uppercase tracking-[0.14em]"
            style={{ color: open ? 'rgba(0,0,0,0.55)' : accent }}
          >
            {editing ? 'Editing your answer' : 'Open question'}
          </span>
          <p className="mt-4 text-[19px] font-semibold leading-snug">
            {card.label}
          </p>
        </>
      )}

      {/* The field is on EVERY unanswered card, not just the focused one: the
          one thing a first-time user has to discover is that these are typed
          into, so the affordance has to exist before the interaction that would
          reveal it. Only the focused card autofocuses, so a dozen visible
          fields still leave exactly one cursor on the board. */}
      {/* Offered options, when the partner gave any.
          Picking one answers immediately — a chosen option is already the whole
          answer, and making someone confirm it would add a step that carries no
          information. The free field stays underneath as "Other", so a list can
          narrow the question without ever closing it: every list the partner
          writes is a guess about what you might say, and the guess must never
          be the only thing you are allowed to say. */}
      {writing && card.choices?.length ? (
        <div
          className="mt-4 flex flex-col gap-2"
          data-no-pan
          onClick={(e) => e.stopPropagation()}
        >
          {card.choices.map((choice) => (
            <button
              key={choice}
              type="button"
              onClick={() => {
                onAnswer(choice);
                setEditing(false);
              }}
              className="rounded-full px-4 py-2.5 text-left text-[14px] font-semibold transition-transform hover:scale-[1.02]"
              style={{
                background: open ? 'rgba(255,255,255,0.85)' : 'rgba(255,255,255,0.1)',
                color: open ? '#000' : '#fff',
              }}
            >
              {choice}
            </button>
          ))}
        </div>
      ) : null}

      {writing ? (
        <div className="mt-auto" data-no-pan onClick={(e) => e.stopPropagation()}>
          <textarea
            autoFocus={focused || editing}
            value={draft}
            onFocus={() => { if (!focused) onFocus(); }}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              // Enter sends; shift+enter is a newline. A question here is
              // usually one sentence, so sending is the common case.
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                submit();
              }
              if (e.key === 'Escape' && editing) setEditing(false);
            }}
            placeholder={card.choices?.length ? 'Other…' : 'Answer here'}
            rows={2}
            className="w-full resize-none rounded-xl bg-black/25 p-3 text-[15px] outline-none placeholder:opacity-45"
            style={{ color: open ? '#000' : '#fff' }}
          />
          <span className="mt-2 block text-[11px] opacity-60">
            {editing ? 'Enter to save · Esc to cancel' : 'Enter to answer'}
          </span>
        </div>
      ) : null}
    </button>
  );
}
