'use client';

// Thumbnails for files that exist only in the browser.
//
// A hook rather than a few lines in a component because what it owns is a
// LIFECYCLE, not a rendering: `URL.createObjectURL` hands back a URL that holds
// the whole file alive until it is revoked, so a landing card somebody pastes
// into a dozen times would keep every one of those files in memory. The revoke
// is the entire reason this is not an inline `useMemo`.
//
// Only images get a URL. Everything else has nothing worth previewing, and
// minting a URL for a PDF would be a leak with no picture at the end of it.

import { useEffect, useRef, useState } from 'react';
import { isImage } from '@/app/lib/attachments';

/**
 * Object URLs for the images among `files`, keyed by filename.
 *
 * Built in an effect rather than during render because creating a URL is a
 * side effect that has to be undone. That also means the first paint has no
 * `src` and the second does — which is correct rather than a compromise: there
 * is no object URL to server-render, so a component using this never disagrees
 * with its own server output about what an image's address is.
 *
 * Keyed by name because that is already how both intake surfaces de-duplicate
 * what they are carrying.
 */
export function useFilePreviews(files: File[]): Record<string, string> {
  const [previews, setPreviews] = useState<Record<string, string>>({});

  // Keyed on WHAT the files are, not on the identity of the array holding
  // them. Depending on `files` itself makes this hook a trap: a caller that
  // builds the array inline — `useFilePreviews(file ? [file] : [])` — hands a
  // new reference on every render, so the effect reruns, calls setState,
  // triggers a render, and loops until React gives up with "Maximum update
  // depth exceeded". A caller holding the array in state happens to be safe,
  // which is worse than uniformly broken: the trap only springs for some
  // callers and looks like their bug.
  const signature = files
    .map((file) => `${file.name}:${file.size}:${file.type}`)
    .join('|');

  // The effect needs the files but must not re-run when only the array's
  // identity changed, so they arrive through a ref rather than the dep list.
  const latest = useRef(files);
  latest.current = files;

  useEffect(() => {
    const made: Record<string, string> = {};
    for (const file of latest.current) {
      if (isImage(file.type)) made[file.name] = URL.createObjectURL(file);
    }
    setPreviews(made);
    return () => {
      for (const url of Object.values(made)) URL.revokeObjectURL(url);
    };
  }, [signature]);

  return previews;
}
