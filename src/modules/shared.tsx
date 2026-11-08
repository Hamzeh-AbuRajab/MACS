import { Chips, Field, Select } from '@/components/kit';
import { opts, useDepartments, useRanks } from '@/lib/refs';

export interface Targeting { target_department_id: string | null; target_rank_ids: string[] | null }

/** Audience picker: empty = everyone. Dept + ranks = those ranks inside that department. */
export function TargetFields({ value, onChange }: { value: Targeting; onChange: (v: Targeting) => void }) {
  const depts = useDepartments();
  const ranks = useRanks();
  return (
    <div className="space-y-3 rounded-md border border-white/[.08] p-3">
      <p className="text-xs font-semibold text-gold-300">الجهة المستهدفة (اتركها فارغة للجميع)</p>
      <Field label="القسم">
        <Select value={value.target_department_id ?? ''} placeholder="كل الأقسام"
          onChange={(v) => onChange({ ...value, target_department_id: v || null })} options={opts(depts.data, (d) => d.id, (d) => d.name_ar)} />
      </Field>
      <Field label="الرتب">
        <Chips value={value.target_rank_ids ?? []} onChange={(v) => onChange({ ...value, target_rank_ids: v.length ? v : null })}
          options={opts(ranks.data, (r) => r.id, (r) => r.name_ar)} />
      </Field>
    </div>
  );
}

export const STATUS_AR: Record<string, string> = { draft: 'مسودة', published: 'منشور', archived: 'مؤرشف' };
export const STATUS_TONE: Record<string, 'ok' | 'warn' | 'mute'> = { draft: 'warn', published: 'ok', archived: 'mute' };
