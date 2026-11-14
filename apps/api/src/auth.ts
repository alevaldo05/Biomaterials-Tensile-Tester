/* Passwords and login sessions. Passwords are stored only as argon2id hashes; login tokens only as SHA-256 hashes. */
import crypto from 'node:crypto';
import argon2 from 'argon2';

export const COOKIE = 'tt_session';
export const MIN_PASSWORD = 10;

export function passwordProblem(p: unknown): string | null {
  if (typeof p !== 'string') return 'Enter a password.';
  if (p.length < MIN_PASSWORD) return 'Use at least ' + MIN_PASSWORD + ' characters.';
  if (p.length > 200) return 'Use at most 200 characters.';
  return null;
}
export const hashPassword = (p: string) => argon2.hash(p, { type: argon2.argon2id });
export async function verifyPassword(hash: string, p: string): Promise<boolean> {
  try { return await argon2.verify(hash, p); } catch { return false; }
}
/* Checked against when the username does not exist, so a wrong name takes as long as a wrong password. */
let dummy: Promise<string> | null = null;
export const dummyHash = () => (dummy ??= hashPassword(crypto.randomBytes(16).toString('hex')));

export function newToken(): { token: string; hash: Buffer } {
  const token = crypto.randomBytes(32).toString('base64url');
  return { token, hash: tokenHash(token) };
}
export const tokenHash = (t: string) => crypto.createHash('sha256').update(t).digest();

export function readCookie(header: string | undefined, name: string): string | null {
  if (!header) return null;
  for (const part of header.split(';')) {
    const i = part.indexOf('=');
    if (i > 0 && part.slice(0, i).trim() === name) {
      /* a cookie that cannot be decoded is treated as no cookie (signed out), not as a server error */
      try { return decodeURIComponent(part.slice(i + 1).trim()); } catch { return null; }
    }
  }
  return null;
}
export function sessionCookie(token: string, maxAgeSeconds: number, secure: boolean): string {
  return `${COOKIE}=${token}; Path=/api; HttpOnly; SameSite=Strict; Max-Age=${maxAgeSeconds}${secure ? '; Secure' : ''}`;
}

/** Slows down guessing: after 5 failed logins for a name (or from an address) within 15 minutes, wait.
    A sign-in reserves its attempt before the password is checked, so attempts sent at the same time cannot all get
    through; a success clears the count, and an attempt that could not be checked (a server error) is given back. */
export class LoginLimiter {
  private fails = new Map<string, { n: number; first: number }>();
  constructor(private readonly limit = 5, private readonly window_ms = 15 * 60_000, private readonly now = () => Date.now(), private readonly maxEntries = 10_000) {}
  /** Names and addresses being counted (for tests). */
  get size(): number { return this.fails.size; }
  blocked(keys: string[]): number {
    let wait = 0;
    for (const k of keys) {
      const f = this.fails.get(k);
      if (!f) continue;
      const age = this.now() - f.first;
      if (age > this.window_ms) this.fails.delete(k);
      else if (f.n >= this.limit) wait = Math.max(wait, this.window_ms - age);
    }
    return wait;
  }
  /** Counts an attempt. */
  failed(keys: string[]): void {
    for (const k of keys) {
      const f = this.fails.get(k);
      /* a new count goes to the end, so the map stays ordered oldest first */
      if (!f || this.now() - f.first > this.window_ms) { this.fails.delete(k); this.fails.set(k, { n: 1, first: this.now() }); }
      else f.n++;
    }
    if (this.fails.size > this.maxEntries) this.prune();
  }
  /** Checks and counts an attempt in one step: the wait in ms when paused (nothing counted), else 0 (counted). */
  reserve(keys: string[]): number {
    const wait = this.blocked(keys);
    if (!wait) this.failed(keys);
    return wait;
  }
  /** Gives back an attempt that was reserved but could not be checked. */
  release(keys: string[]): void {
    for (const k of keys) { const f = this.fails.get(k); if (f && --f.n <= 0) this.fails.delete(k); }
  }
  succeeded(keys: string[]): void { for (const k of keys) this.fails.delete(k); }
  /** When the table is full: drop counts that ran out, then the oldest that are not paused, then (only if still full) the oldest. */
  private prune(): void {
    const t = this.now();
    for (const [k, f] of this.fails) if (t - f.first > this.window_ms) this.fails.delete(k);
    for (const [k, f] of this.fails) { if (this.fails.size <= this.maxEntries) return; if (f.n < this.limit) this.fails.delete(k); }
    for (const k of this.fails.keys()) { if (this.fails.size <= this.maxEntries) return; this.fails.delete(k); }
  }
}
