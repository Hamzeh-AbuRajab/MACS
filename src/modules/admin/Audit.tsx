import { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { AsyncView, Badge } from '@/components/ui';
import { Select } from '@/components/kit';
import { supabase } from '@/lib/supabase';
import { unwrap, useAsync } from '@/lib/useAsync';
import { fmtDateTime } from '@/lib/format';

interface Log { id: number; actor_id: string | null; action: string; table_name: string; record_id: string | null; old_data: Record<string, unknown> | null; new_data: Record<string, unknown> | null; created_at: string }

const ACTION: Record<string, { label: string; tone: 'ok' | 'warn' | 'bad' }> = { INSERT: { label: 'إضافة', tone: 'ok' }, UPDATE: { label: 'تعديل', tone: 'warn' }, DELETE: { label: 'حذف', tone: 'bad' } };
const TABLE_AR: Record<string, string> = {
  profiles: 'الحسابات', personnel: 'الأفراد', ranks: 'الرتب', departments: 'الأقسام', roles: 'الأدوار', role_permissions: 'صلاحيات الأدوار', user_roles: 'أدوار المستخدمين',
  laws: 'القوانين', decisions: 'القرارات', announcements: 'الإعلانات', news_updates: 'التحديثات', site_settings: 'إعدادات الموقع', promotion_requests: 'الترقيات',
  leave_requests: 'الإجازات', disciplinary_records: 'العقوبات', warehouses: 'المستودعات', inventory_items: 'المخزون', assets: 'الأصول', custody_records: 'العهد',
  stock_movements: 'حركة المخزون', cases: 'القضايا', investigations: 'التحقيقات', evidence: 'الأدلة', statements: 'الإفادات', personnel_events: 'سجل الأفراد',
  law_categories: 'تصنيفات القوانين', password_reset_requests: 'طلبات كلمة المرور',
};

function diff(o: Log['old_data'], n: Log['new_data']) {
  const keys = [...new Set([...Object.keys(o ?? {}), ...Object.keys(n ?? {})])].filter((k) => k !== 'updated_at');
  return keys.filter((k) => JSON.stringify(o?.[k]) !== JSON.stringify(n?.[k])).map((k) => ({ k, from: o?.[k], to: n?.[k] }));
}
const show = (v: unknown) => (v === undefined ? '—' : typeof v === 'string' ? v : JSON.stringify(v));

export function Audit() {
  const [table, setTable] = useState('');
  const [action, setAction] = useState('');
  const [open, setOpen] = useState<number | null>(null);
  const names = useAsync(async () => Object.fromEntries((unwrap(await supabase.from('profiles').select('id,full_name')) as { id: string; full_name: string }[]).map((p) => [p.id, p.full_name])), []);
  const logs = useAsync(async () => {
    let q = supabase.from('audit_logs').select('*').order('created_at', { ascending: false }).limit(300);
    if (table) q = q.eq('table_name', table);
    if (action) q = q.eq('action', action);
    return unwrap(await q) as Log[];
  }, [table, action]);

  return (
    <div>
      <div className="mb-4 grid gap-3 sm:grid-cols-3">
        <Select value={table} onChange={setTable} placeholder="كل الجداول" options={Object.entries(TABLE_AR).map(([value, label]) => ({ value, label }))} aria-label="الجدول" />
        <Select value={action} onChange={setAction} placeholder="كل العمليات" options={Object.entries(ACTION).map(([value, v]) => ({ value, label: v.label }))} aria-label="العملية" />
      </div>
      <AsyncView state={logs} emptyTitle="لا توجد سجلات">
        {(rows) => (
          <ul className="card divide-y divide-white/[.06]">
            {rows.map((l) => {
              const d = diff(l.old_data, l.new_data);
              return (
                <li key={l.id}>
                  <button className="flex w-full items-center gap-3 px-4 py-3 text-start text-sm hover:bg-white/[.03]" onClick={() => setOpen(open === l.id ? null : l.id)} aria-expanded={open === l.id}>
                    <Badge tone={ACTION[l.action]?.tone}>{ACTION[l.action]?.label ?? l.action}</Badge>
                    <span className="flex-1 text-slate-200">{TABLE_AR[l.table_name] ?? l.table_name}
                      <span className="ms-2 text-xs text-slate-500">بواسطة {l.actor_id ? names.data?.[l.actor_id] ?? l.actor_id.slice(0, 8) : 'النظام'}</span></span>
                    <span className="text-[11px] text-slate-500">{fmtDateTime(l.created_at)}</span>
                    <ChevronDown className={`h-4 w-4 text-slate-500 transition-transform ${open === l.id ? 'rotate-180' : ''}`} />
                  </button>
                  {open === l.id && (
                    <div className="ltr overflow-x-auto bg-navy-900/60 px-4 py-3 text-start text-xs">
                      <p className="mb-2 text-slate-500">record: {l.record_id}</p>
                      {l.action === 'UPDATE' ? d.map((x) => (
                        <p key={x.k} className="font-mono"><span className="text-gold-400">{x.k}</span>: <span className="text-red-300 line-through">{show(x.from)}</span> → <span className="text-olive-400">{show(x.to)}</span></p>
                      )) : <pre className="whitespace-pre-wrap font-mono text-slate-300">{JSON.stringify(l.new_data ?? l.old_data, null, 2)}</pre>}
                    </div>
                  )}
                </li>);
            })}
          </ul>
        )}
      </AsyncView>
    </div>
  );
}
