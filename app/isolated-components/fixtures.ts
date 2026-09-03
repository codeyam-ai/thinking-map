// Fixtures shared by the isolated-component harnesses.
//
// A real PNG, inlined so every frame is self-contained and byte-identical on
// every run. It is the picture the feature is about: a screenshot of a
// competing product, the kind of thing somebody pastes in rather than
// describes. Bytes rather than a zero-length placeholder because the claim
// these frames make is that a chip shows the PICTURE — a File with no contents
// renders an empty disc and proves the opposite.
//
// One copy, imported by three harnesses. Three copies of a 2KB base64 literal
// would be three chances for one of them to drift into a different image.

const SCREENSHOT_PNG =
  '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';

/** The inlined base64 as an actual image file, the way the clipboard hands one
 *  over. Built lazily rather than at module scope: `atob` does not exist while
 *  this module is evaluated on the server. */
export function pastedScreenshot(
  name = 'Screenshot 2026-09-03 at 14.22.11.png',
): File {
  const binary = atob(SCREENSHOT_PNG);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return new File([bytes], name, { type: 'image/png' });
}
