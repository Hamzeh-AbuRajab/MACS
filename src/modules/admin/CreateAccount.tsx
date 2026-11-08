import { useState, type FormEvent } from 'react';
import { Copy, RefreshCw } from 'lucide-react';
import { Chips, Field, Input, Modal, Select, SubmitRow, useAction, useToast } from '@/components/kit';
import { useAuth } from '@/auth/AuthContext';
import { callAdmin, opts, randomPassword, useDepartments, useRanks } from '@/lib/refs';
import { supabase } from '@/lib/supabase';
import { unwrap, useAsync } from '@/lib/useAsync';

export function CreateAccountModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const { can } = useAuth();
  const ranks = useRanks();
  const depts = useDepartments();
  const roles = useAsync(async () => unwrap(await supabase.from('roles').select('code,name_ar').order('name_ar')) as { code: string; name_ar: string }[], []);
  const toast = useToast();
  const { busy, run } = useAction();
  const [f, setF] = useState({ username: '', full_name: '', full_name_en: '', military_number: '', rank_id: '', department_id: '' });
  const [pw, setPw] = useState(randomPassword());
  const [roleCodes, setRoleCodes] = useState<string[]>(['soldier']);
  const [created, setCreated] = useState<string | null>(null);
  const set = (k: keyof typeof f, v: string) => setF((s) => ({ ...s, [k]: v }));

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const ok = await run(async () => {
      await callAdmin({ action: 'create', ...f, department_id: f.department_id || null, password: pw, role_codes: roleCodes.length ? roleCodes : ['soldier'] });
    });
    if (ok) setCreated(pw);
  };

  if (created) {
    const text = `اسم المستخدم: ${f.username.toLowerCase()}\nكلمة المرور: ${created}`;
    return (
      <Modal title="تم إنشاء الحساب" onClose={onCreated}>
        <p className="text-sm text-slate-300">سلّم هذه البيانات للعسكري. لن تظهر كلمة المرور مرة أخرى.</p>
        <pre className="ltr my-4 whitespace-pre-wrap rounded-md bg-navy-900 p-4 font-mono text-sm text-gold-300">{text}</pre>
        <div className="flex justify-end gap-2">
          <button className="btn btn-outline" onClick={() => { void navigator.clipboard.writeText(text); toast.ok('تم النسخ'); }}><Copy className="h-4 w-4" /> نسخ</button>
          <button className="btn btn-gold" onClick={onCreated}>تم</button>
        </div>
      </Modal>
    );
  }

  return (
    <Modal title="إضافة عسكري" onClose={onClose} wide>
      <form onSubmit={submit} className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <Field label="الاسم الكامل"><Input required value={f.full_name} onChange={(e) => set('full_name', e.target.value)} /></Field>
          <Field label="الاسم بالإنجليزية"><Input className="ltr" value={f.full_name_en} onChange={(e) => set('full_name_en', e.target.value)} /></Field>
          <Field label="اسم المستخدم" hint="حروف إنجليزية صغيرة وأرقام"><Input required className="ltr" pattern="[a-zA-Z0-9._-]{3,32}" value={f.username} onChange={(e) => set('username', e.target.value)} autoCapitalize="none" /></Field>
          <Field label="الرقم العسكري"><Input required className="ltr" value={f.military_number} onChange={(e) => set('military_number', e.target.value)} /></Field>
          <Field label="الرتبة"><Select required value={f.rank_id} onChange={(v) => set('rank_id', v)} placeholder="اختر" options={opts(ranks.data, (r) => r.id, (r) => `${r.level}. ${r.name_ar}`)} /></Field>
          <Field label="القسم"><Select value={f.department_id} onChange={(v) => set('department_id', v)} placeholder="القيادة العليا (بدون قسم)" options={opts(depts.data, (d) => d.id, (d) => d.name_ar)} /></Field>
        </div>
        <Field label="كلمة المرور المؤقتة">
          <div className="flex gap-2"><Input required minLength={8} className="ltr font-mono" value={pw} onChange={(e) => setPw(e.target.value)} />
            <button type="button" className="btn btn-outline" onClick={() => setPw(randomPassword())} aria-label="توليد"><RefreshCw className="h-4 w-4" /></button></div>
        </Field>
        {can('roles.update') && (
          <Field label="الأدوار (الصلاحيات)" hint="الرتبة لا تمنح صلاحيات. اختر الأدوار الإدارية صراحةً.">
            <Chips value={roleCodes} onChange={setRoleCodes} options={opts(roles.data, (r) => r.code, (r) => r.name_ar)} />
          </Field>)}
        <SubmitRow busy={busy} onCancel={onClose} label="إنشاء الحساب" />
      </form>
    </Modal>
  );
}
