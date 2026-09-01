export interface AssistantLine {
  text: string;
  isQuestion: boolean;
}

/**
 * Split an assistant reply into renderable lines, marking the ones that are
 * questions.
 *
 * The questions are the product — the partner earns its keep by asking rather
 * than answering — so the conversation panel gives them typographic weight.
 * Only a line that ENDS in "?" counts: a question mark mid-sentence is usually
 * the partner quoting the person back to themselves.
 */
export function splitAssistantLines(content: string): AssistantLine[] {
  return content
    .split('\n')
    .map((line) => line.trim())
    .filter((text) => text.length > 0)
    .map((text) => ({ text, isQuestion: text.endsWith('?') }));
}
