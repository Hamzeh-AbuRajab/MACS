import { supabase } from './supabase';
import { unwrap, useAsync } from './useAsync';
import type { Department, Rank } from './types';

export const useRanks = () => useAsync(async () => unwrap(await supabase.from('ranks').select('*').order('level')) as Rank[], []);
export const useDepartments = () =>
  useAsync(async () => unwrap(await supabase.from('departments').select('*').order('sort_order')) as Department[], []);

export const opts = <T,>(rows: T[] | undefined, v: (r: T) => string, l: (r: T) => string) =>
  (rows ?? []).map((r) => ({ value: v(r), label: l(r) }));

/** Upload to a public bucket; returns the public URL. */
export async function uploadPublic(bucket: string, path: string, file: File) {
  const { error } = await supabase.storage.from(bucket).upload(path, file, { upsert: true, contentType: file.type });
  if (error) throw error;
  return supabase.storage.from(bucket).getPublicUrl(path).data.publicUrl;
}

export const randomPassword = () => {
  const a = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789';
  const buf = crypto.getRandomValues(new Uint32Array(14));
  return Array.from(buf, (n) => a[n % a.length]).join('');
};

/** Call the privileged edge function; surfaces its Arabic error message. */
export async function callAdmin<T = { ok: boolean; user_id?: string }>(body: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke('admin-users', { body });
  if (error) {
    let msg = error.message;
    try { const j = await (error as unknown as { context: Response }).context.json(); if (j?.error) msg = j.error; } catch { /* keep default */ }
    throw new Error(msg);
  }
  return data as T;
}
