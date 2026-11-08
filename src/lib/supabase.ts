import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const isConfigured = Boolean(url && key);
/** Usernames map to internal emails; users never see or type an email. */
export const AUTH_EMAIL_DOMAIN = import.meta.env.VITE_AUTH_EMAIL_DOMAIN ?? 'macs.internal';
export const usernameToEmail = (u: string) => `${u.trim().toLowerCase()}@${AUTH_EMAIL_DOMAIN}`;

// "Remember me" off → session lives in sessionStorage and dies with the tab.
export const REMEMBER_KEY = 'macs.remember';
const safe = <T,>(fn: () => T, fallback: T): T => {
  try { return fn(); } catch { return fallback; }
};
const target = () => (safe(() => localStorage.getItem(REMEMBER_KEY), '1') === '0' ? sessionStorage : localStorage);
const storage = {
  getItem: (k: string) => safe(() => sessionStorage.getItem(k) ?? localStorage.getItem(k), null),
  setItem: (k: string, v: string) => safe(() => target().setItem(k, v), undefined),
  removeItem: (k: string) => safe(() => { sessionStorage.removeItem(k); localStorage.removeItem(k); }, undefined),
};
export const setRemember = (remember: boolean) =>
  safe(() => localStorage.setItem(REMEMBER_KEY, remember ? '1' : '0'), undefined);

// Only the public anon key ever reaches the browser. Authority lives in RLS.
export const supabase = createClient(url ?? 'http://localhost:54321', key ?? 'missing-anon-key', {
  auth: { storage, persistSession: true, autoRefreshToken: true, detectSessionInUrl: false },
});
