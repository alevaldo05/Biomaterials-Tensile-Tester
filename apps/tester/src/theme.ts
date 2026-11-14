/* Light, dark, or the computer's own setting (the default). The choice is remembered on this computer only; when the
   browser refuses storage the app still works and simply follows the computer. Colors are the website's default green. */
import { useEffect, useState } from 'react';

export type ThemeChoice = 'light' | 'dark' | 'system';
export type Theme = 'light' | 'dark';
export const THEME_KEY = 'app-theme';
export const THEME_CHOICES: { id: ThemeChoice; label: string }[] = [{ id: 'light', label: 'Light' }, { id: 'dark', label: 'Dark' }, { id: 'system', label: 'Follow system' }];

type Store = Pick<Storage, 'getItem' | 'setItem'>;
function store(): Store | null { try { return typeof localStorage === 'undefined' ? null : localStorage; } catch { return null; } }

/** The saved choice, or Follow system when nothing (or something unknown) is saved or storage is refused. */
export function readThemeChoice(s: Store | null = store()): ThemeChoice {
  let v: string | null = null;
  try { v = s ? s.getItem(THEME_KEY) : null; } catch { /* storage refused */ }
  return v === 'light' || v === 'dark' || v === 'system' ? v : 'system';
}
export function saveThemeChoice(choice: ThemeChoice, s: Store | null = store()): void {
  try { s?.setItem(THEME_KEY, choice); } catch { /* the choice is just not remembered */ }
}
export function resolveTheme(choice: ThemeChoice, systemDark: boolean): Theme {
  return choice === 'system' ? (systemDark ? 'dark' : 'light') : choice;
}

const DARK_QUERY = '(prefers-color-scheme: dark)';
function systemDark(): boolean { return typeof matchMedia === 'function' && matchMedia(DARK_QUERY).matches; }

/** The theme in use, the person's choice, and a way to change it. Follow system tracks the computer's setting live. */
export function useTheme(): { theme: Theme; choice: ThemeChoice; setChoice: (c: ThemeChoice) => void } {
  const [choice, setChoiceState] = useState<ThemeChoice>(() => readThemeChoice());
  const [dark, setDark] = useState(systemDark);
  useEffect(() => {
    if (typeof matchMedia !== 'function') return;
    const q = matchMedia(DARK_QUERY), on = () => setDark(q.matches);
    q.addEventListener('change', on);
    return () => q.removeEventListener('change', on);
  }, []);
  const theme = resolveTheme(choice, dark);
  useEffect(() => { document.documentElement.dataset.theme = theme; }, [theme]);
  return { theme, choice, setChoice: (c) => { saveThemeChoice(c); setChoiceState(c); } };
}
