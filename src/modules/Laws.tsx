import { useMemo, useState, type FormEvent } from 'react';
import { Pencil, Plus, Search } from 'lucide-react';
import { useAuth } from '@/auth/AuthContext';
import { AsyncView, Badge, EmptyState } from '@/components/ui';
import { Check, ConfirmButton, Field, Input, Modal, PageHeader, Select, SubmitRow, Textarea, must, useAction } from '@/components/kit';
import { supabase } from '@/lib/supabase';
import { unwrap, useAsync } from '@/lib/useAsync';
import { opts, useDepartments } from '@/lib/refs';
import { fmtDate } from '@/lib/format';
import type { Law2, LawCategory } from '@/lib/types';
import { STATUS_AR, STATUS_TONE } from './shared';

export function Laws() {
  const { can } = useAuth();
  const [cat, setCat] = useState<string>('');
  const [q, setQ] = useState('');
  const [edit, setEdit] = useState<Partial<Law2> | null>(null);
  const { busy, run } = useAction();
  const cats = useAsync(async () => unwrap(await supabase.from('law_categories').select('*').order('sort_order')) as LawCategory[], []);
  const laws = useAsync(async () => unwrap(await supabase.from('laws').select('*').order('sort_order').order('created_at')) as Law2[], []);

  const shown = useMemo(() => {
    const s = q.trim();
    return (laws.data ?? []).filter((l) => (!cat || l.category_id === cat) && (!s || l.title.includes(s) || l.content.includes(s)));
  }, [laws.data, cat, q]);

  return (
    <div className="animate-fade-up">
      <PageHeader title="القوانين العسكرية" desc="تظهر لك القوانين المتاحة لرتبتك وقسمك."
        actions={can('laws.create') && <button className="btn btn-gold" onClick={() => setEdit({ category_id: cat || cats.data?.[0]?.id, status: 'published', sort_order: 0 })}><Plus className="h-4 w-4" /> قانون جديد</button>} />
      <div className="grid gap-6 lg:grid-cols-[18rem_1fr]">
        <aside className="card h-fit p-2">
          <button onClick={() => setCat('')} className={`w-full rounded px-3 py-2 text-start text-sm ${!cat ? 'bg-gold-500/15 text-gold-300' : 'text-slate-300 hover:bg-white/5'}`}>كل التصنيفات ({laws.data?.length ?? 0})</button>
          <AsyncView state={cats} emptyTitle="لا توجد تصنيفات" rows={4}>
            {(rows) => <>{rows.map((c) => (
              <button key={c.id} onClick={() => setCat(c.id)} aria-pressed={cat === c.id}
                className={`flex w-full items-center gap-2 rounded px-3 py-2 text-start text-[13px] ${cat === c.id ? 'bg-gold-500/15 text-gold-300' : 'text-slate-300 hover:bg-white/5'}`}>
                <span className="flex-1">{c.name_ar}</span>
                <span className="text-[11px] text-slate-500">{(laws.data ?? []).filter((l) => l.category_id === c.id).length}</span>
              </button>))}</>}
          </AsyncView>
        </aside>
        <section>
          <div className="relative mb-4"><Search className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
            <input className="input ps-9" placeholder="بحث في القوانين" value={q} onChange={(e) => setQ(e.target.value)} aria-label="بحث" /></div>
          <AsyncView state={laws} emptyTitle="لا توجد قوانين منشورة" emptyHint="لم تتم إضافة قوانين بعد. الإدارة المخولة تضيفها من هنا.">
            {() => shown.length === 0 ? <EmptyState title="لا نتائج" /> : (
              <div className="space-y-3">
                {shown.map((l) => (
                  <article key={l.id} className="card p-5">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="flex-1 font-bold text-white">{l.title}</h3>
                      {l.status !== 'published' && <Badge tone={STATUS_TONE[l.status]}>{STATUS_AR[l.status]}</Badge>}
                      {l.restricted && <Badge tone="bad">مقيّد</Badge>}
                      {l.is_public && <Badge tone="ok">علني</Badge>}
                    </div>
                    <p className="mt-1 text-[11px] text-slate-500">{cats.data?.find((c) => c.id === l.category_id)?.name_ar}</p>
                    <p className="mt-3 whitespace-pre-line text-sm leading-8 text-slate-300">{l.content}</p>
                    <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-white/[.06] pt-3 text-[11px] text-slate-500">
                      <span>الجهة المسؤولة: {l.responsible_party || '—'}</span><span>· آخر تحديث: {fmtDate(l.updated_at)}</span>
                      <span className="flex-1" />
                      {can('laws.update') && <button className="btn btn-ghost !px-2 !py-1 text-xs" onClick={() => setEdit(l)}><Pencil className="h-3.5 w-3.5" /> تعديل</button>}
                      {can('laws.delete') && <ConfirmButton label="حذف" busy={busy} onConfirm={() => run(async () => { must(await supabase.from('laws').delete().eq('id', l.id)); laws.reload(); }, 'تم حذف القانون')} />}
                    </div>
                  </article>
                ))}
              </div>
            )}
          </AsyncView>
        </section>
      </div>
      {edit && <LawForm initial={edit} cats={cats.data ?? []} onClose={() => setEdit(null)} onSaved={() => { setEdit(null); laws.reload(); }} />}
    </div>
  );
}

function LawForm({ initial, cats, onClose, onSaved }: { initial: Partial<Law2>; cats: LawCategory[]; onClose: () => void; onSaved: () => void }) {
  const [f, setF] = useState(initial);
  const depts = useDepartments();
  const { busy, run } = useAction();
  const set = <K extends keyof Law2>(k: K, v: Law2[K]) => setF((s) => ({ ...s, [k]: v }));
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const row = { category_id: f.category_id, title: f.title, content: f.content, responsible_party: f.responsible_party || null,
      department_id: f.department_id || null, restricted: !!f.restricted, is_public: !!f.is_public, status: f.status ?? 'published', sort_order: Number(f.sort_order ?? 0) };
    if (await run(async () => { must(f.id ? await supabase.from('laws').update(row).eq('id', f.id) : await supabase.from('laws').insert(row)); }, 'تم حفظ القانون')) onSaved();
  };
  return (
    <Modal title={f.id ? 'تعديل قانون' : 'قانون جديد'} onClose={onClose} wide>
      <form onSubmit={submit} className="space-y-4">
        <Field label="التصنيف"><Select value={f.category_id ?? ''} onChange={(v) => set('category_id', v)} options={opts(cats, (c) => c.id, (c) => c.name_ar)} /></Field>
        <Field label="العنوان"><Input required value={f.title ?? ''} onChange={(e) => set('title', e.target.value)} /></Field>
        <Field label="المحتوى"><Textarea required className="min-h-48" value={f.content ?? ''} onChange={(e) => set('content', e.target.value)} /></Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="الجهة المسؤولة"><Input value={f.responsible_party ?? ''} onChange={(e) => set('responsible_party', e.target.value)} /></Field>
          <Field label="قسم محدد (اختياري)"><Select value={f.department_id ?? ''} onChange={(v) => set('department_id', v || null)} placeholder="عام لكل الأقسام" options={opts(depts.data, (d) => d.id, (d) => d.name_ar)} /></Field>
          <Field label="الحالة"><Select value={f.status ?? 'published'} onChange={(v) => set('status', v)} options={Object.entries(STATUS_AR).map(([value, label]) => ({ value, label }))} /></Field>
          <Field label="الترتيب"><Input type="number" value={f.sort_order ?? 0} onChange={(e) => set('sort_order', Number(e.target.value))} /></Field>
        </div>
        <div className="flex flex-wrap gap-6">
          <Check label="يظهر للزوار في الصفحة الرئيسية" checked={!!f.is_public} onChange={(v) => set('is_public', v)} />
          <Check label="مقيّد (لأصحاب صلاحية خاصة)" checked={!!f.restricted} onChange={(v) => set('restricted', v)} />
        </div>
        <SubmitRow busy={busy} onCancel={onClose} />
      </form>
    </Modal>
  );
}
