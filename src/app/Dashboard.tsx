import { Link } from 'react-router-dom';
import { Bell, ClipboardList, FileSignature, Megaphone } from 'lucide-react';
import type { ReactNode } from 'react';
import { useAuth } from '@/auth/AuthContext';
import { RankInsignia } from '@/components/RankInsignia';
import { AsyncView, Badge } from '@/components/ui';
import { supabase } from '@/lib/supabase';
import { useAsync, unwrap } from '@/lib/useAsync';
import { EVENT_LABEL, IMPORTANCE, SERVICE_STATUS, fmtDate, fmtDateTime, timeAgo } from '@/lib/format';
import type { Announcement, AppNotification, Decision, PersonnelEvent } from '@/lib/types';

function Panel({ title, icon, to, children }: { title: string; icon: ReactNode; to?: string; children: ReactNode }) {
  return (
    <section className="card p-5">
      <div className="mb-4 flex items-center gap-2">
        <span className="text-gold-400">{icon}</span>
        <h2 className="flex-1 text-sm font-bold text-white">{title}</h2>
        {to && <Link to={to} className="text-xs text-gold-400 hover:underline">عرض الكل</Link>}
      </div>
      {children}
    </section>
  );
}

function Fact({ k, v }: { k: string; v: ReactNode }) {
  return (
    <div className="rounded-md bg-navy-900/50 px-3 py-2.5">
      <dt className="text-[11px] text-slate-500">{k}</dt>
      <dd className="mt-0.5 text-sm font-semibold text-slate-100">{v}</dd>
    </div>
  );
}

export function Dashboard() {
  const { profile, personnel } = useAuth();
  const uid = profile!.id;

  const announcements = useAsync(async () => unwrap(await supabase.from('announcements')
    .select('id,title,body,image_url,pinned,published_at,is_public').eq('status', 'published')
    .order('pinned', { ascending: false }).order('published_at', { ascending: false }).limit(4)) as Announcement[], [uid]);

  const decisions = useAsync(async () => unwrap(await supabase.from('decisions')
    .select('id,ref_number,title,body,decision_type,importance,issued_at').eq('status', 'published')
    .order('issued_at', { ascending: false }).limit(4)) as Decision[], [uid]);

  const notifs = useAsync(async () => unwrap(await supabase.from('notifications')
    .select('id,type,title,body,link,is_read,created_at').eq('user_id', uid)
    .order('created_at', { ascending: false }).limit(5)) as AppNotification[], [uid]);

  const pending = useAsync(async () => {
    const [a, b] = await Promise.all([
      supabase.from('promotion_requests').select('id', { count: 'exact', head: true }).eq('applicant_id', uid).eq('status', 'pending'),
      supabase.from('leave_requests').select('id', { count: 'exact', head: true }).eq('applicant_id', uid).eq('status', 'pending'),
    ]);
    if (a.error) throw a.error;
    if (b.error) throw b.error;
    return { promotions: a.count ?? 0, leaves: b.count ?? 0 };
  }, [uid]);

  const activity = useAsync(async () => unwrap(await supabase.from('personnel_events')
    .select('id,event_type,reason,created_at,from_rank:ranks!personnel_events_from_rank_id_fkey(name_ar),to_rank:ranks!personnel_events_to_rank_id_fkey(name_ar),from_department:departments!personnel_events_from_department_id_fkey(name_ar),to_department:departments!personnel_events_to_department_id_fkey(name_ar)')
    .eq('user_id', uid).order('created_at', { ascending: false }).limit(6)) as unknown as PersonnelEvent[], [uid]);

  const status = personnel ? SERVICE_STATUS[personnel.service_status] : null;
  const rank = personnel?.rank;

  return (
    <div className="animate-fade-up space-y-6">
      <section className="card relative overflow-hidden p-6 sm:p-8">
        <div className="grid-bg pointer-events-none absolute inset-0 opacity-40" aria-hidden />
        <div className="relative flex flex-col gap-6 sm:flex-row sm:items-center">
          {rank && <RankInsignia category={rank.category} level={rank.level} url={rank.insignia_url} size={96} label={rank.name_ar} />}
          <div className="flex-1">
            <p className="text-sm text-gold-400">مرحباً بك</p>
            <h1 className="mt-1 text-2xl font-extrabold text-white sm:text-3xl">{profile!.full_name}</h1>
            {rank && <p className="ltr mt-1 text-start text-sm text-slate-400">{rank.name_en}</p>}
          </div>
          {status && <Badge tone={status.tone}>{status.label}</Badge>}
        </div>
        <dl className="relative mt-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Fact k="الرتبة الحالية" v={rank?.name_ar ?? '—'} />
          <Fact k="القسم العسكري" v={personnel?.department?.name_ar ?? 'القيادة العليا'} />
          <Fact k="الرقم العسكري" v={<span className="ltr font-mono">{personnel?.military_number ?? '—'}</span>} />
          <Fact k="تاريخ الانتساب" v={fmtDate(personnel?.joined_at)} />
        </dl>
        {!personnel && (
          <p className="relative mt-4 rounded-md bg-gold-500/10 px-3 py-2 text-xs text-gold-300">
            لا يوجد ملف عسكري مرتبط بحسابك بعد. تواصل مع شؤون الأفراد.
          </p>
        )}
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <Panel title="الطلبات المعلقة" icon={<ClipboardList className="h-4 w-4" />}>
          <AsyncView state={{ ...pending, data: pending.data ? [pending.data] : undefined }} emptyTitle="لا توجد بيانات" rows={1}>
            {([p]) => (
              <div className="grid grid-cols-2 gap-3">
                <Fact k="طلبات الترقية" v={p.promotions} />
                <Fact k="طلبات الإجازة" v={p.leaves} />
              </div>
            )}
          </AsyncView>
        </Panel>

        <Panel title="الإشعارات" icon={<Bell className="h-4 w-4" />} to="/app/notifications">
          <AsyncView state={notifs} emptyTitle="لا توجد إشعارات" emptyHint="ستظهر هنا القرارات والإعلانات وتحديثات طلباتك.">
            {(rows) => (
              <ul className="divide-y divide-white/[.06]">
                {rows.map((n) => (
                  <li key={n.id} className="flex items-start gap-3 py-2.5">
                    <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${n.is_read ? 'bg-slate-600' : 'bg-gold-400'}`} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm text-slate-100">{n.title}</p>
                      <p className="text-[11px] text-slate-500">{timeAgo(n.created_at)}</p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </AsyncView>
        </Panel>

        <Panel title="آخر القرارات" icon={<FileSignature className="h-4 w-4" />}>
          <AsyncView state={decisions} emptyTitle="لا توجد قرارات منشورة" emptyHint="لم تصدر قرارات موجهة إليك حتى الآن.">
            {(rows) => (
              <ul className="space-y-3">
                {rows.map((d) => {
                  const imp = IMPORTANCE[d.importance];
                  return (
                    <li key={d.id} className="rounded-md bg-navy-900/50 p-3">
                      <div className="flex items-center gap-2">
                        <Badge tone={imp.tone}>{imp.label}</Badge>
                        <span className="text-[11px] text-slate-500">{fmtDate(d.issued_at)}</span>
                      </div>
                      <p className="mt-1.5 text-sm font-semibold text-slate-100">{d.title}</p>
                    </li>
                  );
                })}
              </ul>
            )}
          </AsyncView>
        </Panel>

        <Panel title="آخر الإعلانات" icon={<Megaphone className="h-4 w-4" />}>
          <AsyncView state={announcements} emptyTitle="لا توجد إعلانات" emptyHint="لا توجد إعلانات منشورة لك حالياً.">
            {(rows) => (
              <ul className="space-y-3">
                {rows.map((a) => (
                  <li key={a.id} className="rounded-md bg-navy-900/50 p-3">
                    <p className="text-sm font-semibold text-slate-100">{a.pinned && '📌 '}{a.title}</p>
                    <p className="mt-1 line-clamp-2 text-xs leading-6 text-slate-400">{a.body}</p>
                    <p className="mt-1 text-[11px] text-slate-500">{fmtDate(a.published_at)}</p>
                  </li>
                ))}
              </ul>
            )}
          </AsyncView>
        </Panel>
      </div>

      <Panel title="سجل النشاطات الشخصية" icon={<ClipboardList className="h-4 w-4" />} to="/app/profile">
        <AsyncView state={activity} emptyTitle="لا توجد نشاطات مسجلة">
          {(rows) => (
            <ol className="relative space-y-4 border-s border-white/10 ps-5">
              {rows.map((e) => (
                <li key={e.id} className="relative">
                  <span className="absolute -start-[25px] top-1.5 h-2.5 w-2.5 rounded-full border-2 border-navy-700 bg-gold-500" />
                  <p className="text-sm font-semibold text-slate-100">
                    {EVENT_LABEL[e.event_type] ?? e.event_type}
                    {e.to_rank && <span className="font-normal text-slate-400"> — {e.from_rank ? `${e.from_rank.name_ar} ← ` : ''}{e.to_rank.name_ar}</span>}
                    {e.to_department && <span className="font-normal text-slate-400"> — {e.from_department ? `${e.from_department.name_ar} ← ` : ''}{e.to_department.name_ar}</span>}
                  </p>
                  {e.reason && <p className="text-xs text-slate-400">{e.reason}</p>}
                  <p className="text-[11px] text-slate-500">{fmtDateTime(e.created_at)}</p>
                </li>
              ))}
            </ol>
          )}
        </AsyncView>
      </Panel>
    </div>
  );
}
