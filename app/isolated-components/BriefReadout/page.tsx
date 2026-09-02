'use client';

import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Component from '../../components/BriefReadout';
import type { AttachedBrief } from '../../components/BriefDrop';

const SPEC = `# Northgate Library — Digital Membership Renewal

## Background

Northgate Library District serves 41,000 cardholders across six branches and a
bookmobile. Membership is free but must be renewed every two years, which is a
state requirement tied to proof of residence rather than a policy we chose.
Renewal is currently done in person at a service desk. In FY24 we processed
9,180 renewals and lost an estimated 3,400 cardholders who simply let their
membership lapse rather than make the trip.

## Who this is for

Roughly 30% of active cardholders are over 65. About 5,600 households in the
district have no fixed broadband connection. Any solution that assumes a
smartphone, a printer, or a credit card on file will exclude the people who use
the library most.

## Residency verification

This is the part we are least sure about. State rules require proof that the
cardholder still lives in the district. We do not know what the digital
equivalent is, and we are not comfortable asking people to upload a photograph
of a bill to a system we would then have to secure and retain.`;

function Harness() {
  const s = useSearchParams().get('s') ?? 'Default';
  const preset: Record<string, AttachedBrief> = {
    // A real spec, arrived as a file: the ordinary healthy case, and the one
    // the feature exists for.
    Default: {
      text: SPEC.repeat(4),
      sourceName: 'northgate-renewal-brief.pdf',
      mediaType: 'application/pdf',
      warning: null,
    },
    // Pasted instead of uploaded — there is no filename to show, so the
    // source says so plainly rather than inventing one.
    Pasted: {
      text: SPEC,
      sourceName: 'pasted',
      mediaType: 'text/plain',
      warning: null,
    },
    // The state this readout is really for. A photographed document: two
    // megabytes of file, one stray caption of text, and the warning and the
    // near-empty preview both saying so before any map exists.
    ScannedPdf: {
      text: 'NORTHGATE LIBRARY DISTRICT',
      sourceName: 'renewal-spec-scanned.pdf',
      mediaType: 'application/pdf',
      warning:
        'Only 26 characters came out of a 2,180KB file. It is probably a scan, and the words are a picture rather than text — check the preview below before you start.',
    },
  };
  const brief = preset[s];
  if (!brief) return <div>Unknown scenario: {s}</div>;
  return (
    <div id="codeyam-capture">
      <div style={{ width: '100%', maxWidth: 930 }}>
        <Component brief={brief} onClear={() => {}} />
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
