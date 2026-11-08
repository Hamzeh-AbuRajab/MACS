import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { Session } from '@supabase/supabase-js';
import { isConfigured, setRemember, supabase, usernameToEmail } from '@/lib/supabase';
import type { Personnel, Profile } from '@/lib/types';

interface AuthState {
  loading: boolean;
  session: Session | null;
  profile: Profile | null;
  personnel: Personnel | null;
  /** UI convenience only. The database re-checks every permission via RLS. */
  can: (code: string) => boolean;
  signIn: (username: string, password: string, remember: boolean) => Promise<string | null>;
  signOut: () => Promise<void>;
  refresh: () => Promise<void>;
}

const Ctx = createContext<AuthState | null>(null);
export const useAuth = () => {
  const v = useContext(Ctx);
  if (!v) throw new Error('useAuth outside AuthProvider');
  return v;
};

const GENERIC_FAIL = 'اسم المستخدم أو كلمة المرور غير صحيحة';

async function loadMe(userId: string) {
  const [p, pe, perms] = await Promise.all([
    supabase.from('profiles').select('*').eq('id', userId).maybeSingle(),
    supabase.from('personnel').select('*, rank:ranks(*), department:departments(*)').eq('user_id', userId).maybeSingle(),
    supabase.rpc('my_permissions'),
  ]);
  if (p.error) throw p.error;
  if (pe.error) throw pe.error;
  return {
    profile: p.data as Profile | null,
    personnel: pe.data as Personnel | null,
    perms: new Set(((perms.data ?? []) as { code: string }[]).map((r) => r.code)),
  };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [loading, setLoading] = useState(isConfigured);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [personnel, setPersonnel] = useState<Personnel | null>(null);
  const [perms, setPerms] = useState<Set<string>>(new Set());

  const clear = () => { setProfile(null); setPersonnel(null); setPerms(new Set()); };

  useEffect(() => {
    if (!isConfigured) return;
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      if (!data.session) setLoading(false);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => {
      setSession(s);
      if (!s) { clear(); setLoading(false); }
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  const userId = session?.user.id;
  const hydrate = useCallback(async () => {
    if (!userId) return;
    try {
      const me = await loadMe(userId);
      const dead = !me.profile || !me.profile.is_active || me.personnel?.service_status === 'terminated';
      if (dead) { await supabase.auth.signOut(); clear(); return; }
      setProfile(me.profile); setPersonnel(me.personnel); setPerms(me.perms);
    } catch {
      clear();
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => { void hydrate(); }, [hydrate]);

  const signIn: AuthState['signIn'] = async (username, password, remember) => {
    if (!isConfigured) return 'قاعدة البيانات غير مهيّأة بعد. راجع ملف README.';
    setRemember(remember);
    const { data, error } = await supabase.auth.signInWithPassword({ email: usernameToEmail(username), password });
    if (error || !data.session) return GENERIC_FAIL;
    const me = await loadMe(data.session.user.id).catch(() => null);
    if (!me?.profile) { await supabase.auth.signOut(); return 'الحساب غير مفعّل. تواصل مع الإدارة.'; }
    if (!me.profile.is_active) { await supabase.auth.signOut(); return 'تم تعطيل هذا الحساب. تواصل مع الإدارة.'; }
    if (me.personnel?.service_status === 'terminated') { await supabase.auth.signOut(); return 'انتهت الخدمة العسكرية لهذا الحساب.'; }
    return null;
  };

  const signOut = async () => { await supabase.auth.signOut(); clear(); };

  const value = useMemo<AuthState>(() => ({
    loading, session, profile, personnel,
    can: (c) => perms.has(c),
    signIn, signOut, refresh: hydrate,
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [loading, session, profile, personnel, perms, hydrate]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
