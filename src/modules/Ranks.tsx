import { useState, type FormEvent } from 'react';
import { ArrowDown, ArrowUp, Pencil, Plus } from 'lucide-react';
import { useAuth } from '@/auth/AuthContext';
import { RankInsignia } from '@/components/RankInsignia';
import { AsyncView } from '@/components/ui';
import { ConfirmButton, Field, Input, Modal, PageHeader, Select, SubmitRow, Textarea, must, useAction } from '@/components/kit';
import { supabase } from '@/lib/supabase';
import { unwrap, useAsync } from '@/lib/useAsync';
import { uploadPublic } from '@/lib/refs';
import { RANK_CATEGORY } from '@/lib/format';
import type { Rank, RankCategory } from '@/lib/types';

interface Holder { user_id: string; rank_id: string; profile: { full_name: string } | null }

export function Ranks() {
  const { can } = useAuth();
  const [edit, setEdit] = useState<Partial<Rank> | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  const { busy, run } = useAction();
  const ranks = useAsync(async () => unwrap(await supabase.from('ranks').select('*').order('level')) as Rank[], []);
  const holders = useAsync(async () => unwrap(await supabase.from('personnel').select('user_id,rank_id,profile:profiles(full_name)')) as unknown as Holder[], []);

  const move = (list: Rank[], i: number, dir: -1 | 1) => run(async () => {
    const a = list[i], b = list[i + dir];
    if (!b) return;
    must(await supabase.from('ranks').update({ level: 9999 }).eq('id', a.id));
    must(await supabase.from('ranks').update({ level: a.level }).eq('id', b.id));
    must(await supabase.from('ranks').update({ level: b.level }).eq('id', a.id));
    ranks.reload();
  });

  return (
    <div className="animate-fade-up">
      <PageHeader title="الرتب العسكرية" desc="التسلسل من الأعلى إلى الأدنى. الرتبة لا تمنح أي صلاحيات إدارية — الصلاحيات تُمنح عبر الأدوار."
        actions={can('ranks.create') && <button className="btn btn-gold" onClick={() => setEdit({ category: 'enlisted', level: (ranks.data?.[ranks.data.length - 1]?.level ?? 0) + 1 })}><Plus className="h-4 w-4" /> رتبة جديدة</button>} />
      <AsyncView state={ranks} emptyTitle="لا توجد رتب">
        {(rows) => (
          <div className="space-y-2">
            {rows.map((r, i) => {
              const hs = (holders.data ?? []).filter((h) => h.rank_id === r.id);
              return (
                <div key={r.id} className="card">
                  <div className="flex items-center gap-4 p-4">
                    <span className="w-7 font-mono text-sm text-slate-600">{String(r.level).padStart(2, '0')}</span>
                    <RankInsignia category={r.category} level={r.level} url={r.insignia_url} size={52} label={r.name_ar} />
                    <button className="min-w-0 flex-1 text-start" onClick={() => setOpen(open === r.id ? null : r.id)} aria-expanded={open === r.id}>
                      <p className="font-bold text-white">{r.name_ar}</p>
                      <p className="ltr text-start text-xs text-gold-400">{r.name_en}</p>
                    </button>
                    <span className="hidden text-xs text-slate-500 sm:block">{RANK_CATEGORY[r.category]}</span>
                    <span className="badge badge-mute">{hs.length} فرد</span>
                    {can('ranks.update') && (
                      <div className="flex">
                        <button className="btn btn-ghost !p-1.5" disabled={busy || i === 0} onClick={() => move(rows, i, -1)} aria-label="أعلى"><ArrowUp className="h-4 w-4" /></button>
                        <button className="btn btn-ghost !p-1.5" disabled={busy || i === rows.length - 1} onClick={() => move(rows, i, 1)} aria-label="أسفل"><ArrowDown className="h-4 w-4" /></button>
                        <button className="btn btn-ghost !p-1.5" onClick={() => setEdit(r)} aria-label="تعديل"><Pencil className="h-4 w-4" /></button>
                      </div>
                    )}
                  </div>
                  {open === r.id && (
                    <div className="border-t border-white/[.06] px-5 py-4 text-sm">
                      <p className="leading-7 text-slate-400">{r.description || 'لا يوجد وصف.'}</p>
                      <p className="mt-3 text-xs font-semibold text-slate-500">الأفراد الذين تراهم ضمن صلاحياتك:</p>
                      <p className="mt-1 text-slate-300">{hs.length ? hs.map((h) => h.profile?.full_name).join('، ') : 'لا أحد'}</p>
                      {can('ranks.delete') && (
                        <div className="mt-3"><ConfirmButton label="حذف الرتبة" busy={busy}
                          onConfirm={() => run(async () => { must(await supabase.from('ranks').delete().eq('id', r.id)); ranks.reload(); }, 'تم حذف الرتبة')} /></div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </AsyncView>
      {edit && <RankForm initial={edit} onClose={() => setEdit(null)} onSaved={() => { setEdit(null); ranks.reload(); }} />}
    </div>
  );
}

function RankForm({ initial, onClose, onSaved }: { initial: Partial<Rank>; onClose: () => void; onSaved: () => void }) {
  const [f, setF] = useState(initial);
  const [file, setFile] = useState<File | null>(null);
  const { busy, run } = useAction();
  const set = <K extends keyof Rank>(k: K, v: Rank[K]) => setF((s) => ({ ...s, [k]: v }));
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const ok = await run(async () => {
      let insignia_url = f.insignia_url ?? null;
      if (file) insignia_url = await uploadPublic('insignia', `${f.code}-${Date.now()}.${file.name.split('.').pop()}`, file);
      const row = { code: f.code, name_ar: f.name_ar, name_en: f.name_en, category: f.category, level: Number(f.level), description: f.description ?? null, insignia_url };
      must(f.id ? await supabase.from('ranks').update(row).eq('id', f.id) : await supabase.from('ranks').insert(row));
    }, 'تم حفظ الرتبة');
    if (ok) onSaved();
  };
  return (
    <Modal title={f.id ? 'تعديل رتبة' : 'رتبة جديدة'} onClose={onClose}>
      <form onSubmit={submit} className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <Field label="الاسم بالعربية"><Input required value={f.name_ar ?? ''} onChange={(e) => set('name_ar', e.target.value)} /></Field>
          <Field label="الاسم بالإنجليزية"><Input required className="ltr" value={f.name_en ?? ''} onChange={(e) => set('name_en', e.target.value)} /></Field>
          <Field label="الكود"><Input required className="ltr" pattern="[a-z0-9_]+" value={f.code ?? ''} onChange={(e) => set('code', e.target.value)} /></Field>
          <Field label="الترتيب" hint="1 = الأعلى"><Input required type="number" min={1} value={f.level ?? ''} onChange={(e) => set('level', Number(e.target.value))} /></Field>
        </div>
        <Field label="الفئة"><Select value={f.category ?? 'enlisted'} onChange={(v) => set('category', v as RankCategory)} options={Object.entries(RANK_CATEGORY).map(([value, label]) => ({ value, label }))} /></Field>
        <Field label="الوصف"><Textarea value={f.description ?? ''} onChange={(e) => set('description', e.target.value)} /></Field>
        <Field label="شعار الرتبة (صورة)"><input type="file" accept="image/*" className="input" onChange={(e) => setFile(e.target.files?.[0] ?? null)} /></Field>
        <SubmitRow busy={busy} onCancel={onClose} />
      </form>
    </Modal>
  );
}
