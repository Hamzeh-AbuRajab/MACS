import { useEffect, useState, type FormEvent } from 'react';
import { Pencil, Plus } from 'lucide-react';
import { useAuth } from '@/auth/AuthContext';
import { AsyncView, Badge, LoadingBlock } from '@/components/ui';
import { ConfirmButton, Field, Input, Modal, Select, SubmitRow, Textarea, must, useAction } from '@/components/kit';
import { supabase } from '@/lib/supabase';
import { unwrap, useAsync } from '@/lib/useAsync';
import { uploadPublic } from '@/lib/refs';
import { fmtDate } from '@/lib/format';
import type { MinistrySettings, NewsUpdate } from '@/lib/types';
import { STATUS_AR, STATUS_TONE } from '../shared';

export function Site() {
  const { can, profile } = useAuth();
  const settings = useAsync(async () => {
    const r = await supabase.from('site_settings').select('value').eq('key', 'ministry').maybeSingle();
    if (r.error) throw r.error;
    return (r.data?.value ?? {}) as MinistrySettings;
  }, []);
  const [f, setF] = useState<MinistrySettings>({});
  const [logo, setLogo] = useState<File | null>(null);
  const { busy, run } = useAction();
  useEffect(() => { if (settings.data) setF(settings.data); }, [settings.data]);

  const news = useAsync(async () => unwrap(await supabase.from('news_updates').select('*').order('created_at', { ascending: false })) as (NewsUpdate & { status: string; body: string | null })[], []);
  const [edit, setEdit] = useState<Partial<NewsUpdate & { status: string; body: string | null }> | null>(null);

  const save = async (e: FormEvent) => {
    e.preventDefault();
    await run(async () => {
      let logo_url = f.logo_url ?? null;
      if (logo) logo_url = await uploadPublic('site', `logo-${Date.now()}.${logo.name.split('.').pop()}`, logo);
      must(await supabase.from('site_settings').upsert({ key: 'ministry', value: { ...f, logo_url }, updated_by: profile!.id, updated_at: new Date().toISOString() }));
      setLogo(null); settings.reload();
    }, 'تم حفظ بيانات الوزارة');
  };

  if (settings.loading && !settings.data) return <LoadingBlock />;
  const ed = can('site.update');
  return (
    <div className="space-y-10">
      <form onSubmit={save} className="card space-y-4 p-5">
        <h2 className="font-bold text-white">بيانات الوزارة والصفحة الرئيسية</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="اسم الوزارة (عربي)"><Input disabled={!ed} value={f.name_ar ?? ''} onChange={(e) => setF({ ...f, name_ar: e.target.value })} /></Field>
          <Field label="اسم الوزارة (إنجليزي)"><Input disabled={!ed} className="ltr" value={f.name_en ?? ''} onChange={(e) => setF({ ...f, name_en: e.target.value })} /></Field>
          <Field label="الشعار النصي"><Input disabled={!ed} value={f.tagline ?? ''} onChange={(e) => setF({ ...f, tagline: e.target.value })} /></Field>
          <Field label="الشعار (صورة)" hint={f.logo_url ? 'يوجد شعار حالي — ارفع صورة لاستبداله' : undefined}><input disabled={!ed} type="file" accept="image/*" className="input" onChange={(e) => setLogo(e.target.files?.[0] ?? null)} /></Field>
        </div>
        <Field label="نبذة عن الوزارة"><Textarea disabled={!ed} value={f.about ?? ''} onChange={(e) => setF({ ...f, about: e.target.value })} /></Field>
        {ed && <div className="flex justify-end"><button className="btn btn-gold" disabled={busy}>حفظ</button></div>}
      </form>

      <section>
        <div className="mb-3 flex items-center"><h2 className="flex-1 font-bold text-white">آخر التحديثات العسكرية (الصفحة الرئيسية)</h2>
          {can('site.create') && <button className="btn btn-outline" onClick={() => setEdit({ status: 'published' })}><Plus className="h-4 w-4" /> تحديث جديد</button>}</div>
        <AsyncView state={news} emptyTitle="لا توجد تحديثات">
          {(rows) => <ul className="card divide-y divide-white/[.06]">{rows.map((n) => (
            <li key={n.id} className="flex items-center gap-3 px-4 py-3 text-sm">
              <span className="flex-1"><span className="font-semibold text-white">{n.title}</span> <span className="text-[11px] text-slate-500">{fmtDate(n.published_at)}</span></span>
              <Badge tone={STATUS_TONE[n.status]}>{STATUS_AR[n.status]}</Badge>
              {can('site.update') && <button className="btn btn-ghost !p-1.5" onClick={() => setEdit(n)} aria-label="تعديل"><Pencil className="h-4 w-4" /></button>}
              {can('site.delete') && <ConfirmButton label="حذف" onConfirm={() => run(async () => { must(await supabase.from('news_updates').delete().eq('id', n.id)); news.reload(); }, 'تم الحذف')} />}
            </li>))}</ul>}
        </AsyncView>
      </section>
      {edit && <NewsForm initial={edit} onClose={() => setEdit(null)} onSaved={() => { setEdit(null); news.reload(); }} />}
    </div>
  );
}

function NewsForm({ initial, onClose, onSaved }: { initial: Partial<NewsUpdate & { status: string; body: string | null }>; onClose: () => void; onSaved: () => void }) {
  const [f, setF] = useState(initial);
  const { busy, run } = useAction();
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const row = { title: f.title, summary: f.summary || null, body: f.body || null, status: f.status ?? 'draft' };
    if (await run(async () => { must(f.id ? await supabase.from('news_updates').update(row).eq('id', f.id) : await supabase.from('news_updates').insert(row)); }, 'تم الحفظ')) onSaved();
  };
  return (
    <Modal title={f.id ? 'تعديل التحديث' : 'تحديث جديد'} onClose={onClose}>
      <form onSubmit={submit} className="space-y-4">
        <Field label="العنوان"><Input required value={f.title ?? ''} onChange={(e) => setF({ ...f, title: e.target.value })} /></Field>
        <Field label="ملخص"><Input value={f.summary ?? ''} onChange={(e) => setF({ ...f, summary: e.target.value })} /></Field>
        <Field label="التفاصيل"><Textarea value={f.body ?? ''} onChange={(e) => setF({ ...f, body: e.target.value })} /></Field>
        <Field label="الحالة"><Select value={f.status ?? 'draft'} onChange={(v) => setF({ ...f, status: v })} options={Object.entries(STATUS_AR).map(([value, label]) => ({ value, label }))} /></Field>
        <SubmitRow busy={busy} onCancel={onClose} />
      </form>
    </Modal>
  );
}
