import { useState, type FormEvent } from 'react';
import { Pencil, Pin, Plus } from 'lucide-react';
import { useAuth } from '@/auth/AuthContext';
import { AsyncView, Badge } from '@/components/ui';
import { Check, ConfirmButton, Field, Input, Modal, PageHeader, Select, SubmitRow, Textarea, must, useAction } from '@/components/kit';
import { supabase } from '@/lib/supabase';
import { unwrap, useAsync } from '@/lib/useAsync';
import { uploadPublic } from '@/lib/refs';
import { fmtDate } from '@/lib/format';
import { STATUS_AR, STATUS_TONE, TargetFields } from './shared';

interface A {
  id: string; title: string; body: string; image_url: string | null; status: string; pinned: boolean; is_public: boolean;
  published_at: string | null; expires_at: string | null; target_department_id: string | null; target_rank_ids: string[] | null;
}

export function Announcements() {
  const { can } = useAuth();
  const [edit, setEdit] = useState<Partial<A> | null>(null);
  const { busy, run } = useAction();
  const s = useAsync(async () => unwrap(await supabase.from('announcements').select('*').order('pinned', { ascending: false }).order('created_at', { ascending: false })) as A[], []);
  return (
    <div className="animate-fade-up">
      <PageHeader title="الإعلانات والتعاميم" actions={can('announcements.create') && <button className="btn btn-gold" onClick={() => setEdit({ status: 'draft' })}><Plus className="h-4 w-4" /> إعلان جديد</button>} />
      <AsyncView state={s} emptyTitle="لا توجد إعلانات" emptyHint="لا توجد إعلانات موجهة إليك حالياً.">
        {(rows) => (
          <div className="space-y-3">
            {rows.map((a) => (
              <article key={a.id} className="card overflow-hidden">
                {a.image_url && <img src={a.image_url} alt="" className="max-h-60 w-full object-cover" />}
                <div className="p-5">
                  <div className="flex flex-wrap items-center gap-2">
                    {a.pinned && <Pin className="h-4 w-4 text-gold-400" aria-label="مثبّت" />}
                    <h3 className="flex-1 text-lg font-bold text-white">{a.title}</h3>
                    {a.status !== 'published' && <Badge tone={STATUS_TONE[a.status]}>{STATUS_AR[a.status]}</Badge>}
                    <span className="text-[11px] text-slate-500">{fmtDate(a.published_at)}</span>
                  </div>
                  <p className="mt-3 whitespace-pre-line text-sm leading-8 text-slate-300">{a.body}</p>
                  {(can('announcements.update') || can('announcements.delete')) && (
                    <div className="mt-3 flex gap-2 border-t border-white/[.06] pt-3">
                      {can('announcements.update') && <button className="btn btn-ghost !py-1 text-xs" onClick={() => setEdit(a)}><Pencil className="h-3.5 w-3.5" /> تعديل</button>}
                      {can('announcements.update') && a.status === 'draft' && <button className="btn btn-outline !py-1 text-xs" disabled={busy}
                        onClick={() => run(async () => { must(await supabase.from('announcements').update({ status: 'published' }).eq('id', a.id)); s.reload(); }, 'تم النشر وإشعار المستهدفين')}>نشر</button>}
                      {can('announcements.delete') && <ConfirmButton label="حذف" busy={busy} onConfirm={() => run(async () => { must(await supabase.from('announcements').delete().eq('id', a.id)); s.reload(); }, 'تم الحذف')} />}
                    </div>
                  )}
                </div>
              </article>
            ))}
          </div>
        )}
      </AsyncView>
      {edit && <AnnForm initial={edit} onClose={() => setEdit(null)} onSaved={() => { setEdit(null); s.reload(); }} />}
    </div>
  );
}

function AnnForm({ initial, onClose, onSaved }: { initial: Partial<A>; onClose: () => void; onSaved: () => void }) {
  const [f, setF] = useState(initial);
  const [file, setFile] = useState<File | null>(null);
  const { busy, run } = useAction();
  const set = <K extends keyof A>(k: K, v: A[K]) => setF((s) => ({ ...s, [k]: v }));
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const ok = await run(async () => {
      let image_url = f.image_url ?? null;
      if (file) image_url = await uploadPublic('announcements', `${Date.now()}-${file.name.replace(/[^\w.-]/g, '_')}`, file);
      const row = { title: f.title, body: f.body, image_url, status: f.status ?? 'draft', pinned: !!f.pinned, is_public: !!f.is_public,
        expires_at: f.expires_at || null, target_department_id: f.target_department_id ?? null, target_rank_ids: f.target_rank_ids ?? null };
      must(f.id ? await supabase.from('announcements').update(row).eq('id', f.id) : await supabase.from('announcements').insert(row));
    }, 'تم حفظ الإعلان');
    if (ok) onSaved();
  };
  return (
    <Modal title={f.id ? 'تعديل الإعلان' : 'إعلان جديد'} onClose={onClose} wide>
      <form onSubmit={submit} className="space-y-4">
        <Field label="العنوان"><Input required value={f.title ?? ''} onChange={(e) => set('title', e.target.value)} /></Field>
        <Field label="المحتوى"><Textarea required className="min-h-36" value={f.body ?? ''} onChange={(e) => set('body', e.target.value)} /></Field>
        <Field label="صورة (اختياري)"><input type="file" accept="image/*" className="input" onChange={(e) => setFile(e.target.files?.[0] ?? null)} /></Field>
        <TargetFields value={{ target_department_id: f.target_department_id ?? null, target_rank_ids: f.target_rank_ids ?? null }} onChange={(t) => setF((s) => ({ ...s, ...t }))} />
        <div className="grid grid-cols-2 gap-3">
          <Field label="الحالة"><Select value={f.status ?? 'draft'} onChange={(v) => set('status', v)} options={Object.entries(STATUS_AR).map(([value, label]) => ({ value, label }))} /></Field>
          <Field label="ينتهي في (اختياري)"><Input type="date" value={(f.expires_at ?? '').slice(0, 10)} onChange={(e) => set('expires_at', e.target.value ? new Date(e.target.value).toISOString() : null)} /></Field>
        </div>
        <div className="flex flex-wrap gap-6">
          <Check label="تثبيت في الأعلى" checked={!!f.pinned} onChange={(v) => set('pinned', v)} />
          <Check label="يظهر للزوار" checked={!!f.is_public} onChange={(v) => set('is_public', v)} />
        </div>
        <SubmitRow busy={busy} onCancel={onClose} />
      </form>
    </Modal>
  );
}
