/** The question the whole product opens with. */
export default function IdeaHero() {
  return (
    <>
      {/* The clamp floored at 40px, so a half screen rendered the hero at its
          MINIMUM and it still took two lines plus 44px of margin. Retuned so it
          keeps its showcase size on a desktop and yields on a narrow window. */}
      <h1 className="max-w-[15ch] text-center text-[clamp(28px,4.6vw,64px)] font-extrabold leading-[1.04] tracking-[-0.025em]">
        What would you like to figure out?
      </h1>
      <p className="mt-3 mb-6 text-center text-[15px] text-ink-soft lg:mt-5 lg:mb-11 lg:text-[17px]">
        Start with an idea, problem, or goal. We&rsquo;ll help you break it down.
      </p>
    </>
  );
}
