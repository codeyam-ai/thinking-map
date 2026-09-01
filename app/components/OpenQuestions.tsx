'use client';

import { useState } from 'react';
import OpenQuestionRow from './OpenQuestionRow';
import { useWebMcpBridge } from './WebMcpBridge';
import type { FlatNode } from '../lib/mapLayout';

/**
 * The questions addressed to the person, with somewhere to answer them.
 *
 * An `open-question` node is a request, not a shape — leaving it only as a
 * dashed pill in the tree buries the one thing anybody is waiting on. So it
 * gets a panel that empties as the questions are answered.
 *
 * Answering does the same thing whether or not an agent is currently blocked
 * on it: the answer is written to the log either way, and a pending `ask_user`
 * is released if one happens to be waiting. Nobody should have to know which
 * situation they are in to reply.
 */
export default function OpenQuestions({ nodes }: { nodes: FlatNode[] }) {
  const bridge = useWebMcpBridge();
  const [answered, setAnswered] = useState<Set<string>>(new Set());

  const open = nodes.filter(
    (node) =>
      node.kind === 'open-question' &&
      node.status === 'open' &&
      !answered.has(node.id),
  );

  if (open.length === 0) return null;

  const answer = async (id: string, label: string, text: string) => {
    // Optimistic: the row goes as soon as it is sent, and comes back only if
    // the write actually failed. A question that lingers after you answered it
    // reads as the answer being lost.
    setAnswered((prev) => new Set(prev).add(id));
    try {
      await bridge.answer({ [id]: text }, [{ id, text: label }]);
    } catch (error) {
      setAnswered((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
      throw error;
    }
  };

  return (
    <section className="shrink-0">
      <h2 className="eyebrow mb-2">Waiting on you · {open.length}</h2>
      <ul className="space-y-2.5">
        {open.map((node) => (
          <OpenQuestionRow
            key={node.id}
            id={node.id}
            label={node.label}
            onAnswer={answer}
          />
        ))}
      </ul>
    </section>
  );
}
