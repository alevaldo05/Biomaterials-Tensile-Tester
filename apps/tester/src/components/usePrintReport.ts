/* Print report: opens every collapsible panel inside the given element, draws the graph light for paper
   (the caller passes `printing` to the graph as its theme), then opens the browser's print window, where the
   report can be saved as a PDF. Nothing is saved or sent by the app. */
import { useEffect, useRef, useState } from 'react';
import type { RefObject } from 'react';

export function usePrintReport<T extends HTMLElement>(): { ref: RefObject<T | null>; printing: boolean; print: () => void } {
  const ref = useRef<T | null>(null);
  const [printing, setPrinting] = useState(false);
  useEffect(() => {
    if (!printing) return;
    ref.current?.querySelectorAll('details').forEach((d) => { d.open = true; });
    const done = () => setPrinting(false);
    window.addEventListener('afterprint', done, { once: true });
    const t = setTimeout(() => window.print(), 50);
    return () => { clearTimeout(t); window.removeEventListener('afterprint', done); };
  }, [printing]);
  return { ref, printing, print: () => setPrinting(true) };
}
