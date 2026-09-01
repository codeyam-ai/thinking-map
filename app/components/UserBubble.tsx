/** A turn the person took: ink-filled and right-aligned. */
export default function UserBubble({ content }: { content: string }) {
  return (
    <p className="ml-auto max-w-[85%] rounded-[18px] bg-ink px-4 py-3 text-[14px] leading-[1.5] text-white">
      {content}
    </p>
  );
}
