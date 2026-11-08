import { Link } from 'react-router-dom';
import { Activity, CalendarOff, FileSignature, Gavel, Search, TrendingUp, Users } from 'lucide-react';
import type { ReactNode } from 'react';
import { useAuth } from '@/auth/AuthContext';
import { ErrorState, LoadingBlock } from '@/components/ui';
import { PageHeader } from '@/components/kit';
import { supabase } from '@/lib/supabase';
import { unwrap, useAsync } from '@/lib/useAsync';
import { SERVICE_STATUS } from '@/lib/format';

interface Stats {
  by_status: Record<string, number>; by_department: { id: string; name: string; n: number }[]; by_rank: { name: string; level: number; n: number }[];
  pending_promotions: number; pending_leaves: number; open_cases: number; discipline_30d: number; draft_decisions: number;
}

const Stat = ({ icon, label, value, to }: { icon: ReactNode; label: string; value: number; to?: string }) => {
  const body = (<><span className="text-gold-400">{icon}</span><div><p className="text-2xl font-extrabold text-white">{value}</p><p className="text-xs text-slate-400">{label}</p></div></>);
  return to ? <Link to={to} className="card flex items-center gap-4 p-5 transition-colors hover:border-gold-500/40">{body}</Link> : <div className="card flex items-center gap-4 p-5">{body}</div>;
};

function Bars({ rows }: { rows: { label: string; n: number }[] }) {
  const max = Math.max(1, ...rows.map((r) => r.n));
  return (
    <ul className="space-y-2">{rows.map((r) => (
      <li key={r.label} className="flex items-center gap-3 text-sm"><span className="w-32 truncate text-slate-300">{r.label}</span>
        <span className="h-2 flex-1 overflow-hidden rounded bg-white/5"><span className="block h-full bg-gold-500" style={{ width: `${(r.n / max) * 100}%` }} /></span>
        <span className="w-8 text-end font-mono text-xs text-slate-400">{r.n}</span></li>))}</ul>
  );
}

export function Command() {
  const { can } = useAuth();
  const s = useAsync(async () => unwrap(await supabase.rpc('command_stats')) as Stats, []);
  if (s.loading && !s.data) return <LoadingBlock rows={4} />;
  if (s.error) return <ErrorState message={s.error} onRetry={s.reload} />;
  const d = s.data!;
  const total = Object.values(d.by_status).reduce((a, b) => a + b, 0);
  return (
    <div className="animate-fade-up space-y-6">
      <PageHeader title="لوحة القيادة العليا" desc="إحصائيات مجمّعة لجميع العسكريين والأقسام."
        actions={can('decisions.create') && <Link to="/app/decisions" className="btn btn-gold"><FileSignature className="h-4 w-4" /> إصدار قرار</Link>} />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Stat icon={<Users className="h-6 w-6" />} label="إجمالي العسكريين" value={total} />
        <Stat icon={<Activity className="h-6 w-6" />} label="على رأس الخدمة" value={d.by_status.active ?? 0} />
        <Stat icon={<TrendingUp className="h-6 w-6" />} label="طلبات ترقية معلقة" value={d.pending_promotions} to="/app/requests" />
        <Stat icon={<CalendarOff className="h-6 w-6" />} label="طلبات إجازة معلقة" value={d.pending_leaves} to="/app/requests" />
        <Stat icon={<FileSignature className="h-6 w-6" />} label="قرارات بانتظار النشر" value={d.draft_decisions} to="/app/decisions" />
        {can('cases.view') && <Stat icon={<Search className="h-6 w-6" />} label="قضايا مفتوحة" value={d.open_cases} to="/app/intelligence" />}
        <Stat icon={<Gavel className="h-6 w-6" />} label="عقوبات آخر 30 يوماً" value={d.discipline_30d} />
      </div>
      <div className="grid gap-4 lg:grid-cols-3">
        <section className="card p-5"><h2 className="mb-4 text-sm font-bold text-gold-300">العسكريون في كل قسم</h2>
          <Bars rows={[...d.by_department.map((x) => ({ label: x.name, n: x.n })), { label: 'القيادة العليا', n: total - d.by_department.reduce((a, b) => a + b.n, 0) }]} /></section>
        <section className="card p-5"><h2 className="mb-4 text-sm font-bold text-gold-300">حالة الخدمة</h2>
          <Bars rows={Object.entries(SERVICE_STATUS).map(([k, v]) => ({ label: v.label, n: d.by_status[k] ?? 0 }))} /></section>
        <section className="card p-5"><h2 className="mb-4 text-sm font-bold text-gold-300">توزيع الرتب</h2>
          <Bars rows={d.by_rank.map((r) => ({ label: r.name, n: r.n }))} /></section>
      </div>
    </div>
  );
}
