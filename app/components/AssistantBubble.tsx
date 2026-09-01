import AgentAvatar from './AgentAvatar';
import { splitAssistantLines } from '../lib/messageLines';

/**
 * A turn the thinking partner took. Questions get bold weight on their own
 * line, because the questions are what the product is for.
 */
export default function AssistantBubble({ content }: { content: string }) {
  const lines = splitAssistantLines(content);

  return (
    <div className="flex items-start gap-2.5">
      <AgentAvatar />
      <div className="max-w-[85%] rounded-[18px] bg-[#EFEDE6] px-4 py-3">
        {lines.map((line, index) => (
          <p
            key={index}
            className={`mt-2 text-[14px] leading-[1.5] text-ink first:mt-0 ${
              line.isQuestion ? 'font-bold' : ''
            }`}
          >
            {line.text}
          </p>
        ))}
      </div>
    </div>
  );
}
