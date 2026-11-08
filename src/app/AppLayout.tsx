import { useEffect, useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { Bell, LogOut, Menu, X } from 'lucide-react';
import { useAuth } from '@/auth/AuthContext';
import { Wordmark } from '@/components/Logo';
import { RankInsignia } from '@/components/RankInsignia';
import { GROUP_LABEL, NAV, type NavItem } from './nav';
import { supabase } from '@/lib/supabase';

function useUnread(userId: string | undefined) {
  const [n, setN] = useState(0);
  useEffect(() => {
    if (!userId) return;
    let alive = true;
    const load = () =>
      supabase.from('notifications').select('id', { count: 'exact', head: true }).eq('user_id', userId).eq('is_read', false)
        .then(({ count }) => { if (alive) setN(count ?? 0); });
    void load();
    const timer = setInterval(load, 60_000);
    window.addEventListener('macs:notifications', load);
    const ch = supabase.channel(`notif-${userId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'notifications', filter: `user_id=eq.${userId}` }, () => void load())
      .subscribe();
    return () => { alive = false; clearInterval(timer); window.removeEventListener('macs:notifications', load); void supabase.removeChannel(ch); };
  }, [userId]);
  return n;
}

export function AppLayout() {
  const { profile, personnel, can, signOut } = useAuth();
  const [open, setOpen] = useState(false);
  const loc = useLocation();
  const nav = useNavigate();
  const unread = useUnread(profile?.id);

  useEffect(() => setOpen(false), [loc.pathname]);

  const visible = NAV.filter((i) => i.ready && (i.perm === null || (Array.isArray(i.perm) ? i.perm.some(can) : can(i.perm))));
  const groups = (['main', 'ops', 'admin'] as const)
    .map((g) => ({ g, items: visible.filter((i) => i.group === g) }))
    .filter((x) => x.items.length > 0);

  const link = (i: NavItem) => (
    <NavLink key={i.to} to={i.to} end={i.to === '/app'}
      className={({ isActive }) =>
        `group flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium transition-colors ${
          isActive ? 'bg-gold-500/15 text-gold-300 shadow-[inset_-3px_0_0_#B69A52]' : 'text-slate-400 hover:bg-white/5 hover:text-slate-100'}`}>
      <i.icon className="h-[18px] w-[18px] shrink-0" aria-hidden />
      <span className="flex-1">{i.label}</span>
      {i.to === '/app/notifications' && unread > 0 && (
        <span className="rounded-full bg-gold-500 px-1.5 text-[10px] font-bold text-navy-900">{unread > 99 ? '99+' : unread}</span>
      )}
    </NavLink>
  );

  const sidebar = (
    <div className="flex h-full flex-col">
      <div className="border-b border-white/[.06] px-5 py-5"><Wordmark /></div>
      <nav className="flex-1 space-y-6 overflow-y-auto px-3 py-5" aria-label="التنقل الرئيسي">
        {groups.map(({ g, items }) => (
          <div key={g}>
            <p className="mb-2 px-3 text-[11px] font-semibold tracking-wider text-slate-500">{GROUP_LABEL[g]}</p>
            <div className="space-y-1">{items.map(link)}</div>
          </div>
        ))}
      </nav>
      {personnel?.rank && (
        <div className="flex items-center gap-3 border-t border-white/[.06] p-4">
          <RankInsignia category={personnel.rank.category} level={personnel.rank.level} url={personnel.rank.insignia_url} size={40} label={personnel.rank.name_ar} />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-white">{profile?.full_name}</p>
            <p className="ltr truncate text-start text-[11px] text-gold-400">{personnel.rank.name_en}</p>
          </div>
        </div>
      )}
    </div>
  );

  return (
    <div className="min-h-screen lg:flex">
      <aside className="sticky top-0 hidden h-screen w-64 shrink-0 border-e border-white/[.06] bg-navy-800/90 lg:block">{sidebar}</aside>

      {open && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <button aria-label="إغلاق القائمة" className="absolute inset-0 bg-black/60" onClick={() => setOpen(false)} />
          <aside className="absolute inset-y-0 start-0 w-72 max-w-[85vw] bg-navy-800 shadow-2xl">{sidebar}</aside>
        </div>
      )}

      <div className="min-w-0 flex-1">
        <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-white/[.06] bg-navy-900/85 px-4 backdrop-blur sm:px-6">
          <button className="btn btn-ghost !p-2 lg:hidden" onClick={() => setOpen((o) => !o)} aria-label="القائمة" aria-expanded={open}>
            {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
          <div className="flex-1" />
          <button onClick={() => nav('/app/notifications')} className="btn btn-ghost relative !p-2" aria-label={`الإشعارات${unread ? ` (${unread} غير مقروء)` : ''}`}>
            <Bell className="h-5 w-5" />
            {unread > 0 && <span className="absolute end-1 top-1 h-2 w-2 rounded-full bg-gold-400" />}
          </button>
          <button onClick={async () => { await signOut(); nav('/login', { replace: true }); }} className="btn btn-ghost !px-3 !py-2 text-slate-400">
            <LogOut className="h-4 w-4" aria-hidden /> <span className="hidden sm:inline">تسجيل الخروج</span>
          </button>
        </header>
        <main className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6"><Outlet /></main>
      </div>
    </div>
  );
}
