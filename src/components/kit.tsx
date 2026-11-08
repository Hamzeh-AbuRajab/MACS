import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { CheckCircle2, X, XCircle } from 'lucide-react';
import { Spinner } from './ui';

/* ───────── toast ───────── */
interface ToastCtx { ok: (m: string) => void; fail: (m: string) => void }
const T = createContext<ToastCtx>({ ok: () => {}, fail: () => {} });
export const useToast = () => useContext(T);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<{ id: number; kind: 'ok' | 'bad'; msg: string }[]>([]);
  const push = useCallback((kind: 'ok' | 'bad', msg: string) => {
    const id = Date.now() + Math.random();
    setItems((s) => [...s, { id, kind, msg }]);
    setTimeout(() => setItems((s) => s.filter((x) => x.id !== id)), 5000);
  }, []);
  return (
    <T.Provider value={{ ok: (m) => push('ok', m), fail: (m) => push('bad', m) }}>
      {children}
      <div className="fixed bottom-4 start-4 z-[60] flex max-w-sm flex-col gap-2" aria-live="polite">
        {items.map((t) => (
          <div key={t.id} role="status" className={`flex animate-fade-up items-start gap-2 rounded-md border px-4 py-3 text-sm shadow-xl ${
            t.kind === 'ok' ? 'border-olive-500/40 bg-navy-700 text-olive-400' : 'border-red-500/40 bg-navy-700 text-red-200'}`}>
            {t.kind === 'ok' ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" /> : <XCircle className="mt-0.5 h-4 w-4 shrink-0" />}
            <span>{t.msg}</span>
          </div>
        ))}
      </div>
    </T.Provider>
  );
}

export const errText = (e: unknown) =>
  e instanceof Error ? e.message : (e as { message?: string })?.message ?? 'حدث خطأ غير متوقع';

/** Run a mutation with busy state + toasts. Returns true on success. */
export function useAction() {
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const run = async (fn: () => Promise<unknown>, success?: string) => {
    setBusy(true);
    try { await fn(); if (success) toast.ok(success); return true; }
    catch (e) { toast.fail(errText(e)); return false; }
    finally { setBusy(false); }
  };
  return { busy, run };
}

/** Throw on a PostgREST error so useAction reports it. */
export const must = <T extends { error: { message: string } | null }>(r: T): T => {
  if (r.error) throw new Error(r.error.message);
  return r;
};

/* ───────── layout bits ───────── */
export function PageHeader({ title, desc, actions }: { title: string; desc?: string; actions?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end gap-3">
      <div className="min-w-0 flex-1">
        <h1 className="text-2xl font-bold text-white">{title}</h1>
        {desc && <p className="mt-1 text-sm text-slate-400">{desc}</p>}
      </div>
      {actions}
    </div>
  );
}

export function Modal({ title, onClose, children, wide }: { title: string; onClose: () => void; children: ReactNode; wide?: boolean }) {
  useEffect(() => {
    const k = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-50 grid place-items-center overflow-y-auto bg-black/65 p-4" role="dialog" aria-modal="true" aria-label={title}
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className={`card w-full animate-fade-up bg-navy-800 shadow-2xl ${wide ? 'max-w-2xl' : 'max-w-lg'}`}>
        <div className="flex items-center border-b border-white/[.07] px-5 py-3.5">
          <h2 className="flex-1 font-bold text-white">{title}</h2>
          <button onClick={onClose} className="btn btn-ghost !p-1.5" aria-label="إغلاق"><X className="h-4 w-4" /></button>
        </div>
        <div className="max-h-[75vh] overflow-y-auto p-5">{children}</div>
      </div>
    </div>
  );
}

export function Field({ label, children, hint }: { label: string; children: ReactNode; hint?: string }) {
  return (
    <label className="block">
      <span className="label">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-[11px] text-slate-500">{hint}</span>}
    </label>
  );
}

type InputProps = React.InputHTMLAttributes<HTMLInputElement>;
export const Input = (p: InputProps) => <input {...p} className={`input ${p.className ?? ''}`} />;
export const Textarea = (p: React.TextareaHTMLAttributes<HTMLTextAreaElement>) => (
  <textarea {...p} className={`input min-h-24 ${p.className ?? ''}`} />
);
export function Select({ value, onChange, options, placeholder, ...rest }: {
  value: string; onChange: (v: string) => void; options: { value: string; label: string }[]; placeholder?: string;
} & Omit<React.SelectHTMLAttributes<HTMLSelectElement>, 'onChange' | 'value'>) {
  return (
    <select {...rest} className={`input ${rest.className ?? ''}`} value={value} onChange={(e) => onChange(e.target.value)}>
      {placeholder !== undefined && <option value="">{placeholder}</option>}
      {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  );
}
export const Check = ({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) => (
  <label className="flex cursor-pointer items-center gap-2 text-sm text-slate-300">
    <input type="checkbox" className="h-4 w-4 accent-[#B69A52]" checked={checked} onChange={(e) => onChange(e.target.checked)} /> {label}
  </label>
);

export function SubmitRow({ busy, onCancel, label = 'حفظ', disabled }: { busy: boolean; onCancel: () => void; label?: string; disabled?: boolean }) {
  return (
    <div className="mt-5 flex justify-end gap-2">
      <button type="button" onClick={onCancel} className="btn btn-ghost">إلغاء</button>
      <button type="submit" disabled={busy || disabled} className="btn btn-gold">{busy && <Spinner className="h-4 w-4 !text-navy-900" />} {label}</button>
    </div>
  );
}

export function Tabs<T extends string>({ value, onChange, tabs }: { value: T; onChange: (v: T) => void; tabs: { id: T; label: string }[] }) {
  return (
    <div className="mb-5 flex gap-1 overflow-x-auto border-b border-white/[.08]" role="tablist">
      {tabs.map((t) => (
        <button key={t.id} role="tab" aria-selected={value === t.id} onClick={() => onChange(t.id)}
          className={`whitespace-nowrap border-b-2 px-4 py-2.5 text-sm font-semibold transition-colors ${
            value === t.id ? 'border-gold-500 text-gold-300' : 'border-transparent text-slate-400 hover:text-slate-200'}`}>
          {t.label}
        </button>
      ))}
    </div>
  );
}

export function Table({ head, children }: { head: string[]; children: ReactNode }) {
  return (
    <div className="card overflow-x-auto">
      <table className="w-full min-w-[560px] text-sm">
        <thead>
          <tr className="border-b border-white/[.08] text-start text-[11px] text-slate-500">
            {head.map((h) => <th key={h} className="px-4 py-3 text-start font-semibold">{h}</th>)}
          </tr>
        </thead>
        <tbody className="divide-y divide-white/[.05]">{children}</tbody>
      </table>
    </div>
  );
}

/** Two-click destructive confirm. */
export function ConfirmButton({ label, onConfirm, busy, className = '' }: { label: string; onConfirm: () => void; busy?: boolean; className?: string }) {
  const [armed, setArmed] = useState(false);
  useEffect(() => { if (armed) { const t = setTimeout(() => setArmed(false), 4000); return () => clearTimeout(t); } }, [armed]);
  return (
    <button disabled={busy} className={`btn !py-1.5 text-xs ${armed ? 'bg-red-500 text-white hover:bg-red-400' : 'btn-ghost text-red-300'} ${className}`}
      onClick={() => (armed ? (setArmed(false), onConfirm()) : setArmed(true))}>
      {armed ? 'تأكيد؟' : label}
    </button>
  );
}

/** Multi-select as toggle chips. */
export function Chips({ options, value, onChange }: { options: { value: string; label: string }[]; value: string[]; onChange: (v: string[]) => void }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map((o) => {
        const on = value.includes(o.value);
        return (
          <button type="button" key={o.value} aria-pressed={on}
            onClick={() => onChange(on ? value.filter((v) => v !== o.value) : [...value, o.value])}
            className={`rounded px-2.5 py-1 text-xs font-medium ring-1 ring-inset ${on ? 'bg-gold-500/20 text-gold-300 ring-gold-500/50' : 'text-slate-400 ring-white/10 hover:bg-white/5'}`}>
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
