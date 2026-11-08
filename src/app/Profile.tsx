import { useAuth } from '@/auth/AuthContext';
import { RankInsignia } from '@/components/RankInsignia';
import { AsyncView, Badge } from '@/components/ui';
import { supabase } from '@/lib/supabase';
import { unwrap, useAsync } from '@/lib/useAsync';
import { EVENT_LABEL, PENALTY, REQUEST_STATUS, SERVICE_STATUS, fmtDate, fmtDateTime } from '@/lib/format';
import type { PersonnelEvent } from '@/lib/types';

interface Penalty { id: string; violation_type: string; penalty_type: string; issued_at: string; description: string }
interface Leave { id: string; start_date: string; end_date: string; status: string; reason: string }
interface Promo { id: string; status: string; created_at: string; requested_rank: { name_ar: string } | null }

export function Profile() {
  const { profile, personnel } = useAuth();
  const uid = profile!.id;
  const rank = personnel?.rank;
  const st = personnel ? SERVICE_STATUS[personnel.service_status] : null;

  const events = useAsync(async () => unwrap(await supabase.from('personnel_events')
    .select('id,event_type,reason,created_at,from_rank:ranks!personnel_events_from_rank_id_fkey(name_ar),to_rank:ranks!personnel_events_to_rank_id_fkey(name_ar),from_department:departments!personnel_events_from_department_id_fkey(name_ar),to_department:departments!personnel_events_to_department_id_fkey(name_ar)')
    .eq('user_id', uid).order('created_at', { ascending: false })) as unknown as PersonnelEvent[], [uid]);
  const penalties = useAsync(async () => unwrap(await supabase.from('disciplinary_records')
    .select('id,violation_type,penalty_type,issued_at,description').eq('subject_id', uid).order('issued_at', { ascending: false })) as Penalty[], [uid]);
  const leaves = useAsync(async () => unwrap(await supabase.from('leave_requests')
    .select('id,start_date,end_date,status,reason').eq('applicant_id', uid).order('created_at', { ascending: false })) as Leave[], [uid]);
  const promos = useAsync(async () => unwrap(await supabase.from('promotion_requests')
    .select('id,status,created_at,requested_rank:ranks!promotion_requests_requested_rank_id_fkey(name_ar)').eq('applicant_id', uid)
    .order('created_at', { ascending: false })) as unknown as Promo[], [uid]);

  const rows: [string, React.ReactNode][] = [
    ['الاسم', profile!.full_name],
    ['اسم المستخدم', <span className="ltr font-mono">{profile!.username}</span>],
    ['الرقم العسكري', <span className="ltr font-mono">{personnel?.military_number ?? '—'}</span>],
    ['الرتبة', rank ? `${rank.name_ar} — ${rank.name_en}` : '—'],
    ['القسم', personnel?.department?.name_ar ?? 'القيادة العليا'],
    ['تاريخ الانتساب', fmtDate(personnel?.joined_at)],
    ['حالة الخدمة', st ? <Badge tone={st.tone}>{st.label}</Badge> : '—'],
  ];

  const box = (title: string, body: React.ReactNode) => (
    <section className="card p-5"><h2 className="mb-4 text-sm font-bold text-white">{title}</h2>{body}</section>
  );

  return (
    <div className="animate-fade-up space-y-6">
      <h1 className="text-2xl font-bold text-white">ملفي الشخصي</h1>
      <section className="card flex flex-col gap-6 p-6 sm:flex-row">
        {rank && <RankInsignia category={rank.category} level={rank.level} url={rank.insignia_url} size={110} label={rank.name_ar} />}
        <dl className="grid flex-1 gap-x-8 gap-y-3 sm:grid-cols-2">
          {rows.map(([k, v]) => (
            <div key={k} className="border-b border-white/[.06] pb-2">
              <dt className="text-[11px] text-slate-500">{k}</dt>
              <dd className="mt-0.5 text-sm font-semibold text-slate-100">{v}</dd>
            </div>
          ))}
        </dl>
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        {box('سجل الترقيات والنقل والخدمة', (
          <AsyncView state={events} emptyTitle="لا توجد سجلات">
            {(r) => (
              <ul className="space-y-3">
                {r.map((e) => (
                  <li key={e.id} className="text-sm">
                    <span className="font-semibold text-slate-100">{EVENT_LABEL[e.event_type] ?? e.event_type}</span>
                    {e.to_rank && <span className="text-slate-400"> — {e.from_rank ? `${e.from_rank.name_ar} ← ` : ''}{e.to_rank.name_ar}</span>}
                    {e.to_department && <span className="text-slate-400"> — {e.from_department ? `${e.from_department.name_ar} ← ` : ''}{e.to_department.name_ar}</span>}
                    {e.reason && <p className="text-xs text-slate-400">{e.reason}</p>}
                    <p className="text-[11px] text-slate-500">{fmtDateTime(e.created_at)}</p>
                  </li>
                ))}
              </ul>
            )}
          </AsyncView>
        ))}
        {box('سجل العقوبات', (
          <AsyncView state={penalties} emptyTitle="لا توجد عقوبات في ملفك">
            {(r) => (
              <ul className="space-y-3">
                {r.map((p) => (
                  <li key={p.id} className="text-sm">
                    <Badge tone="bad">{PENALTY[p.penalty_type] ?? p.penalty_type}</Badge>
                    <span className="ms-2 font-semibold text-slate-100">{p.violation_type}</span>
                    <p className="text-xs text-slate-400">{p.description}</p>
                    <p className="text-[11px] text-slate-500">{fmtDate(p.issued_at)}</p>
                  </li>
                ))}
              </ul>
            )}
          </AsyncView>
        ))}
        {box('سجل الإجازات', (
          <AsyncView state={leaves} emptyTitle="لا توجد طلبات إجازة">
            {(r) => (
              <ul className="space-y-3">
                {r.map((l) => (
                  <li key={l.id} className="text-sm">
                    <Badge tone={REQUEST_STATUS[l.status].tone}>{REQUEST_STATUS[l.status].label}</Badge>
                    <span className="ms-2 text-slate-100">{fmtDate(l.start_date)} ← {fmtDate(l.end_date)}</span>
                    <p className="text-xs text-slate-400">{l.reason}</p>
                  </li>
                ))}
              </ul>
            )}
          </AsyncView>
        ))}
        {box('سجل طلبات الترقية', (
          <AsyncView state={promos} emptyTitle="لا توجد طلبات ترقية">
            {(r) => (
              <ul className="space-y-3">
                {r.map((p) => (
                  <li key={p.id} className="text-sm">
                    <Badge tone={REQUEST_STATUS[p.status].tone}>{REQUEST_STATUS[p.status].label}</Badge>
                    <span className="ms-2 text-slate-100">إلى: {p.requested_rank?.name_ar ?? '—'}</span>
                    <p className="text-[11px] text-slate-500">{fmtDate(p.created_at)}</p>
                  </li>
                ))}
              </ul>
            )}
          </AsyncView>
        ))}
      </div>
    </div>
  );
}
