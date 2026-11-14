/* The Save data menu after a test. Focus moves to the first item when it opens; Up/Down/Home/End move between items;
   Esc closes it and focus goes back to the button; Tab and Shift+Tab close it and move on as usual; a click or tap
   outside closes it. Choosing an item closes it and gives focus back to the button. Esc here closes the menu only:
   nothing is sent to any device. */
import { useEffect, useRef, useState } from 'react';

export interface MenuItem { id: string; label: string; onSelect: () => void }

const FOCUSABLE = 'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), summary, [tabindex]:not([tabindex="-1"])';

export function SaveMenu({ items, label = 'Save data' }: { items: MenuItem[]; label?: string }) {
  const [saveOpen, setSaveOpen] = useState(false);
  const saveButton = useRef<HTMLButtonElement | null>(null);
  const saveMenu = useRef<HTMLDivElement | null>(null);
  const wrap = useRef<HTMLSpanElement | null>(null);
  const wasOpen = useRef(false);
  useEffect(() => {
    if (saveOpen) { saveMenu.current?.querySelector<HTMLElement>('[role="menuitem"]')?.focus(); wasOpen.current = true; }
    else if (wasOpen.current) { wasOpen.current = false; if (!document.activeElement || document.activeElement === document.body) saveButton.current?.focus(); }
  }, [saveOpen]);
  /* A click or tap anywhere outside the menu and its button closes it. */
  useEffect(() => {
    if (!saveOpen) return;
    const onDown = (e: PointerEvent) => { if (!wrap.current?.contains(e.target as Node)) setSaveOpen(false); };
    document.addEventListener('pointerdown', onDown);
    return () => document.removeEventListener('pointerdown', onDown);
  }, [saveOpen]);
  /* Tab leaves the menu: close it and move to the control after (or, with Shift, before) the Save data button. */
  const leave = (back: boolean) => {
    const all = [...document.querySelectorAll<HTMLElement>(FOCUSABLE)].filter((el) => !saveMenu.current?.contains(el) && !el.closest('[inert]') && el.offsetParent !== null);
    const i = all.indexOf(saveButton.current as HTMLElement);
    setSaveOpen(false);
    (back ? saveButton.current : all[i + 1] ?? saveButton.current)?.focus();
  };
  const onMenuKey = (e: React.KeyboardEvent) => {
    const items = [...(saveMenu.current?.querySelectorAll<HTMLElement>('[role="menuitem"]') ?? [])];
    const i = items.indexOf(document.activeElement as HTMLElement);
    if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); setSaveOpen(false); saveButton.current?.focus(); }
    else if (e.key === 'Tab') { e.preventDefault(); leave(e.shiftKey); }
    else if (e.key === 'ArrowDown') { e.preventDefault(); items[(i + 1) % items.length]?.focus(); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); items[(i - 1 + items.length) % items.length]?.focus(); }
    else if (e.key === 'Home') { e.preventDefault(); items[0]?.focus(); }
    else if (e.key === 'End') { e.preventDefault(); items[items.length - 1]?.focus(); }
  };
  return (
    <span className="menu" ref={wrap}>
      <button type="button" className="primary" ref={saveButton} aria-expanded={saveOpen} aria-haspopup="menu" onClick={() => setSaveOpen((v) => !v)}>
        {label}<svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 9l6 6 6-6" /></svg>
      </button>
      {saveOpen ? (
        <div className="menu-list" role="menu" aria-label={label} ref={saveMenu} onKeyDown={onMenuKey}>
          {items.map((it) => <button key={it.id} type="button" role="menuitem" tabIndex={-1} onClick={() => { setSaveOpen(false); it.onSelect(); }}>{it.label}</button>)}
        </div>) : null}
    </span>
  );
}
