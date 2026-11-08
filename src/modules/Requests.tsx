import { useState, type FormEvent } from 'react';
import { Check, Plus, X } from 'lucide-react';
import { useAuth } from '@/auth/AuthContext';
import { AsyncView, Badge } from '@/components/ui';
import { ConfirmButton, Field, Input, Modal, PageHeader, Select, SubmitRow, Tabs, Textarea, must, useAction } from '@/components/kit';
import { supabase } from '@/lib/supabase';
import { unwrap, useAsync } from '@/lib/useAsync';
import { opts, useRanks } from '@/lib/refs';
import { REQUEST_STATUS, fmtDate } from '@/lib/format';

interface Promo { id: string; status: string; justification: string; review_reason: string | null; created_at: string; applicant_id: string;
  applicant: { full_name: string } | null; current_rank: { name_ar: string } | null; requested_rank: { name_ar: string } | null }
interface Leave { id: string; status: string; reason: string; review_reason: string | null; start_date: string; end_date: string; created_at: string;
  applicant_id: string; applicant: { full_name: string } | null }

const PSEL = 'id,status,justification,review_reason,created_at,applicant_id,applicant:profiles!promotion_requests_applicant_id_fkey(full_name),current_rank:ranks!promotion_requests_current_rank_id_fkey(name_ar),requested_rank:ranks!promotion_requests_requested_rank_id_fkey(name_ar)';
const LSEL = 'id,status,reason,review_reason,start_date,end_date,created_at,applicant_id,applicant:profiles!leave_requests_applicant_id_fkey(full_name)';

type Tab = 'mine' | 'promo' | 'leave';

export function Requests() {
  const { can, profile } = useAuth();
  const uid = profile!.id;
  const [tab, setTab] = useState<Tab>('mine');
  const [form, setForm] = useState<'promo' | 'leave' | null>(null);
  const [review, setReview] = useState<{ kind: 'promo' | 'leave'; id: string; approve: boolean } | null>(null);
  const { busy, run } = useAction();

  const all = useAsync(async () => unwrap(await supabase.from('promotion_requests').select(PSEL).order('created_at', { ascending: false })) as unknown as Promo[], [uid]);
  const allL = useAsync(async () => unwrap(await supabase.from('leave_requests').select(LSEL).order('created_at', { ascending: false })) as unknown as Leave[], [uid]);
  const reload = () => { all.reload(); allL.reload(); };

  const mineP = { ...all, data: all.data?.filter((r) => r.applicant_id === uid) };
  const mineL = { ...allL, data: allL.data?.filter((r) => r.applicant_id === uid) };
  const revP = { ...all, data: all.data?.filter((r) => r.applicant_id !== uid) };
  const revL = { ...allL, data: allL.data?.filter((r) => r.applicant_id !== uid) };

  const actions = (kind: 'promo' | 'leave', r: { id: string; status: string }) =>
    r.status === 'pending' && ((kind === 'promo' && can('promotions.approve')) || (kind === 'leave' && can('leaves.approve'))) && (
      <div className="flex gap-1">
        <button className="btn btn-outline !px-2 !py-1 text-xs" onClick={() => setReview({ kind, id: r.id, approve: true })}><Check className="h-3.5 w-3.5" /> قبول</button>
        <button className="btn btn-ghost !px-2 !py-1 text-xs text-red-300" onClick={() => setReview({ kind, id: r.id, approve: false })}><X className="h-3.5 w-3.5" /> رفض</button>
      </div>);

  return (
    <div className="animate-fade-up">
      <PageHeader title="الترقيات والإجازات" actions={<>
        <button className="btn btn-outline" onClick={() => setForm('leave')}><Plus className="h-4 w-4" /> طلب إجازة</button>
        <button className="btn btn-gold" onClick={() => setForm('promo')}><Plus className="h-4 w-4" /> طلب ترقية</button></>} />
      <Tabs value={tab} onChange={setTab} tabs={[{ id: 'mine', label: 'طلباتي' },
        ...(can('promotions.view') ? [{ id: 'promo' as const, label: `مراجعة الترقيات${revP.data?.filter((r) => r.status === 'pending').length ? ` (${revP.data.filter((r) => r.status === 'pending').length})` : ''}` }] : []),
        ...(can('leaves.view') ? [{ id: 'leave' as const, label: `مراجعة الإجازات${revL.data?.filter((r) => r.status === 'pending').length ? ` (${revL.data.filter((r) => r.status === 'pending').length})` : ''}` }] : [])]} />

      {tab === 'mine' && (
        <div className="grid gap-6 lg:grid-cols-2">
          <section><h2 className="mb-3 text-sm font-bold text-gold-300">طلبات الترقية</h2>
            <AsyncView state={mineP} emptyTitle="لا توجد طلبات ترقية">{(rows) => <ul className="space-y-2">{rows.map((r) => (
              <li key={r.id} className="card p-4 text-sm"><div className="flex items-center gap-2"><Badge tone={REQUEST_STATUS[r.status].tone}>{REQUEST_STATUS[r.status].label}</Badge>
                <span className="flex-1 text-slate-100">{r.current_rank?.name_ar} ← {r.requested_rank?.name_ar}</span><span className="text-[11px] text-slate-500">{fmtDate(r.created_at)}</span></div>
                <p className="mt-2 text-xs text-slate-400">{r.justification}</p>
                {r.review_reason && <p className="mt-1 text-xs text-gold-300">قرار المراجع: {r.review_reason}</p>}
                {r.status === 'pending' && <div className="mt-2"><ConfirmButton label="إلغاء الطلب" busy={busy}
                  onConfirm={() => run(async () => { must(await supabase.from('promotion_requests').update({ status: 'cancelled' }).eq('id', r.id)); reload(); }, 'تم إلغاء الطلب')} /></div>}</li>))}</ul>}</AsyncView></section>
          <section><h2 className="mb-3 text-sm font-bold text-gold-300">طلبات الإجازة</h2>
            <AsyncView state={mineL} emptyTitle="لا توجد طلبات إجازة">{(rows) => <ul className="space-y-2">{rows.map((r) => (
              <li key={r.id} className="card p-4 text-sm"><div className="flex items-center gap-2"><Badge tone={REQUEST_STATUS[r.status].tone}>{REQUEST_STATUS[r.status].label}</Badge>
                <span className="flex-1 text-slate-100">{fmtDate(r.start_date)} ← {fmtDate(r.end_date)}</span></div>
                <p className="mt-2 text-xs text-slate-400">{r.reason}</p>
                {r.review_reason && <p className="mt-1 text-xs text-gold-300">قرار المراجع: {r.review_reason}</p>}</li>))}</ul>}</AsyncView></section>
        </div>
      )}

      {tab === 'promo' && (
        <AsyncView state={revP} emptyTitle="لا توجد طلبات ظاهرة لك">{(rows) => <ul className="space-y-2">{rows.map((r) => (
          <li key={r.id} className="card flex flex-wrap items-center gap-3 p-4 text-sm">
            <Badge tone={REQUEST_STATUS[r.status].tone}>{REQUEST_STATUS[r.status].label}</Badge>
            <div className="min-w-0 flex-1"><p className="font-semibold text-white">{r.applicant?.full_name} <span className="font-normal text-slate-400">— {r.current_rank?.name_ar} ← {r.requested_rank?.name_ar}</span></p>
              <p className="text-xs text-slate-400">{r.justification}</p>{r.review_reason && <p className="text-xs text-gold-300">القرار: {r.review_reason}</p>}</div>
            <span className="text-[11px] text-slate-500">{fmtDate(r.created_at)}</span>{actions('promo', r)}</li>))}</ul>}</AsyncView>
      )}
      {tab === 'leave' && (
        <AsyncView state={revL} emptyTitle="لا توجد طلبات ظاهرة لك">{(rows) => <ul className="space-y-2">{rows.map((r) => (
          <li key={r.id} className="card flex flex-wrap items-center gap-3 p-4 text-sm">
            <Badge tone={REQUEST_STATUS[r.status].tone}>{REQUEST_STATUS[r.status].label}</Badge>
            <div className="min-w-0 flex-1"><p className="font-semibold text-white">{r.applicant?.full_name} <span className="font-normal text-slate-400">— {fmtDate(r.start_date)} ← {fmtDate(r.end_date)}</span></p>
              <p className="text-xs text-slate-400">{r.reason}</p>{r.review_reason && <p className="text-xs text-gold-300">القرار: {r.review_reason}</p>}</div>
            {actions('leave', r)}</li>))}</ul>}</AsyncView>
      )}

      {form && <RequestForm kind={form} onClose={() => setForm(null)} onSaved={() => { setForm(null); reload(); }} />}
      {review && <ReviewModal r={review} onClose={() => setReview(null)} onDone={() => { setReview(null); reload(); }} />}
    </div>
  );
}

function RequestForm({ kind, onClose, onSaved }: { kind: 'promo' | 'leave'; onClose: () => void; onSaved: () => void }) {
  const { profile, personnel } = useAuth();
  const ranks = useRanks();
  const [rank, setRank] = useState('');
  const [text, setText] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const { busy, run } = useAction();
  const higher = (ranks.data ?? []).filter((r) => r.level < (personnel?.rank?.level ?? 0));
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const ok = await run(async () => {
      must(kind === 'promo'
        ? await supabase.from('promotion_requests').insert({ applicant_id: profile!.id, requested_rank_id: rank, justification: text })
        : await supabase.from('leave_requests').insert({ applicant_id: profile!.id, start_date: from, end_date: to, reason: text }));
    }, 'تم إرسال الطلب');
    if (ok) onSaved();
  };
  return (
    <Modal title={kind === 'promo' ? 'طلب ترقية' : 'طلب إجازة'} onClose={onClose}>
      <form onSubmit={submit} className="space-y-4">
        <p className="text-xs text-slate-400">{profile!.full_name} — {personnel?.rank?.name_ar} — {personnel?.department?.name_ar ?? 'القيادة العليا'}</p>
        {kind === 'promo' ? (
          <Field label="الرتبة المطلوبة"><Select required value={rank} onChange={setRank} placeholder="اختر الرتبة" options={opts(higher, (r) => r.id, (r) => r.name_ar)} /></Field>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            <Field label="بداية الإجازة"><Input required type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></Field>
            <Field label="نهاية الإجازة"><Input required type="date" min={from} value={to} onChange={(e) => setTo(e.target.value)} /></Field>
          </div>)}
        <Field label={kind === 'promo' ? 'مبررات الترقية' : 'سبب الإجازة'}><Textarea required value={text} onChange={(e) => setText(e.target.value)} /></Field>
        <SubmitRow busy={busy} onCancel={onClose} label="إرسال" />
      </form>
    </Modal>
  );
}

function ReviewModal({ r, onClose, onDone }: { r: { kind: 'promo' | 'leave'; id: string; approve: boolean }; onClose: () => void; onDone: () => void }) {
  const [reason, setReason] = useState('');
  const { busy, run } = useAction();
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const ok = await run(async () => {
      must(await supabase.rpc(r.kind === 'promo' ? 'review_promotion' : 'review_leave', { p_id: r.id, p_approve: r.approve, p_reason: reason }));
    }, r.approve ? 'تم قبول الطلب' : 'تم رفض الطلب');
    if (ok) onDone();
  };
  return (
    <Modal title={r.approve ? 'قبول الطلب' : 'رفض الطلب'} onClose={onClose}>
      <form onSubmit={submit} className="space-y-4">
        <Field label="سبب القرار"><Textarea required={!r.approve} value={reason} onChange={(e) => setReason(e.target.value)} /></Field>
        {r.approve && r.kind === 'promo' && <p className="text-xs text-gold-300">عند القبول تُطبَّق الرتبة الجديدة تلقائياً وتُسجَّل في ملف العسكري.</p>}
        <SubmitRow busy={busy} onCancel={onClose} label={r.approve ? 'قبول' : 'رفض'} />
      </form>
    </Modal>
  );
}
