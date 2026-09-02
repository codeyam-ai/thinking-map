'use client';

import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Component from '../../components/BriefWarning';

function Harness() {
  const s = useSearchParams().get('s') ?? 'Default';
  const preset: Record<string, string> = {
    // The one this whole line exists for: a big file that yielded almost
    // nothing, which is what a photographed document looks like from here.
    Default:
      'Only 41 characters came out of a 2,180KB file. It is probably a scan, and the words are a picture rather than text — check the preview below before you start.',
    // A file we cannot read at all. Same treatment, because the outcome for
    // the person is the same: this document did not make it in.
    Unsupported:
      'We can read .pdf, .docx, .md and .txt files. northgate-renewal.pages is not one of those — paste the text instead.',
  };
  const text = preset[s];
  if (!text) return <div>Unknown scenario: {s}</div>;
  return (
    <div id="codeyam-capture">
      <div style={{ width: '100%', maxWidth: 930 }}>
        <Component text={text} />
      </div>
    </div>
  );
}

export default function Page() {
  return (
    <Suspense fallback={<div />}>
      <Harness />
    </Suspense>
  );
}
