'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import AssistantBubble from './AssistantBubble';
import ReplyForm from './ReplyForm';
import UserBubble from './UserBubble';

export interface ChatMessage {
  id: string;
  role: string;
  content: string;
}

/**
 * The left panel — the conversation view of the thinking. Owns the send state;
 * each turn and the reply box are their own components.
 */
export default function ConversationPanel({
  mapId,
  messages,
}: {
  mapId: string;
  messages: ChatMessage[];
}) {
  const router = useRouter();
  const [value, setValue] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function send(event: React.FormEvent) {
    event.preventDefault();
    const content = value.trim();
    if (!content || busy) return;

    setBusy(true);
    setError(null);
    try {
      const response = await fetch(`/api/maps/${mapId}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error ?? 'That did not go through.');
      setValue('');
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'That did not go through.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="flex min-h-0 w-[380px] shrink-0 flex-col rounded-[20px] border border-line bg-surface">
      <header className="shrink-0 border-b border-line px-6 py-5">
        <span className="eyebrow">Conversation</span>
      </header>

      <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-6 py-6">
        {messages.map((message) =>
          message.role === 'user' ? (
            <UserBubble key={message.id} content={message.content} />
          ) : (
            <AssistantBubble key={message.id} content={message.content} />
          ),
        )}
      </div>

      <ReplyForm
        value={value}
        busy={busy}
        error={error}
        onChange={setValue}
        onSubmit={send}
      />
    </section>
  );
}
