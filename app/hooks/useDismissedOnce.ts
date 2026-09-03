'use client';

// Show something once, until the person closes it.
//
// The pattern behind a standing note: visible until it is dismissed by hand,
// and then gone for good on that browser. Extracted from the board's
// how-it-works panel because the interesting part is not the panel — it is the
// three ways reading the browser's memory can go wrong, and the fact that all
// three have to fail TOWARDS showing.
//
// It starts hidden and is turned ON by the effect, rather than the reverse.
// Server and first client render must agree, and only the client can know what
// the browser remembers; rendering it open on the server and closing it on
// hydration is a flash of an instruction the person already dismissed.
//
// Every read and write is guarded. A private window, cleared site data, or a
// browser set to block site data can make the accessor THROW rather than
// return null — and the honest failure direction is VISIBLE: meeting a note
// twice is a much smaller failure than never meeting it at all. A write that
// fails costs one extra sighting on another visit, which is not worth an error.

import { useCallback, useEffect, useState } from 'react';

export function useDismissedOnce(key: string): {
  show: boolean;
  dismiss: () => void;
} {
  const [show, setShow] = useState(false);

  useEffect(() => {
    try {
      if (window.localStorage.getItem(key) !== '1') setShow(true);
    } catch {
      setShow(true);
    }
  }, [key]);

  const dismiss = useCallback(() => {
    setShow(false);
    try {
      window.localStorage.setItem(key, '1');
    } catch {
      // Closed either way.
    }
  }, [key]);

  return { show, dismiss };
}
