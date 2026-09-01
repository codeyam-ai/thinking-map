'use client';

import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Component from '../../components/BriefDropTarget';

function Harness() {
  const s = useSearchParams().get('s') ?? 'Default';
  const preset: Record<string, { busy: boolean; error: string | null }> = {
    // At rest: dashed, quiet, and offering both doors. This is what sits under
    // the idea line on every visit to the landing screen.
    Default: { busy: false, error: null },
    // Extraction happens over the wire, and a twenty-page PDF is not instant.
    // Both buttons lock so a second file cannot race the first.
    Reading: { busy: true, error: null },
    // The upload itself failed — a protected or damaged file. Recoverable, and
    // the sentence says how.
    Failed: {
      busy: false,
      error:
        'We could not read renewal-spec.pdf. It may be protected or damaged — paste the text instead.',
    },
  };
  const config = preset[s];
  if (!config) return <div>Unknown scenario: {s}</div>;
  return (
    <div id="codeyam-capture">
      <div style={{ width: '100%', maxWidth: 930 }}>
        <Component
          busy={config.busy}
          error={config.error}
          onFile={() => {}}
          onPaste={() => {}}
        />
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
