import { useState, type FormEvent } from 'react';
import { AlertTriangle, ArrowLeftRight, Hash, PackagePlus, Plus, Undo2, UserRound } from 'lucide-react';
import { useAuth } from '@/auth/AuthContext';
import { AsyncView, Badge } from '@/components/ui';
import { Field, Input, Modal, PageHeader, Select, SubmitRow, Table, Tabs, Textarea, must, useAction } from '@/components/kit';
import { supabase } from '@/lib/supabase';
import { unwrap, useAsync } from '@/lib/useAsync';
import { opts } from '@/lib/refs';
import { fmtDateTime } from '@/lib/format';

interface Wh { id: string; code: string; name_ar: string; kind: string }
interface Item { id: string; warehouse_id: string; sku: string; name: string; category: string | null; quantity: number; min_quantity: number; unit: string; serial_tracked: boolean }
interface Asset { id: string; serial_number: string; status: string }
interface Cust { id: string; quantity: number; reason: string; issued_at: string; returned_at: string | null; status: string;
  item: { name: string } | null; holder: { full_name: string } | null; issuer: { full_name: string } | null; asset: { serial_number: string } | null }
interface Mov { id: string; movement_type: string; quantity: number; reason: string; created_at: string; expected_qty: number | null; counted_qty: number | null;
  item: { name: string } | null; performer: { full_name: string } | null; from_w: { name_ar: string } | null; to_w: { name_ar: string } | null }

const MOVE_AR: Record<string, string> = { in: 'إدخال', out: 'إخراج', transfer: 'نقل', custody_issue: 'صرف عهدة', custody_return: 'إرجاع عهدة', adjustment: 'تسوية', stocktake: 'جرد' };
type Tab = 'stock' | 'custody' | 'moves';
type Modal_ = { kind: 'move'; item: Item } | { kind: 'custody'; item: Item } | { kind: 'serials'; item: Item } | { kind: 'item' } | { kind: 'wh' } | null;

export function Warehouses() {
  const { can } = useAuth();
  const [tab, setTab] = useState<Tab>('stock');
  const [wh, setWh] = useState('');
  const [m, setM] = useState<Modal_>(null);
  const { busy, run } = useAction();

  const whs = useAsync(async () => unwrap(await supabase.from('warehouses').select('id,code,name_ar,kind').eq('is_active', true).order('code')) as Wh[], []);
  const items = useAsync(async () => unwrap(await supabase.from('inventory_items').select('*').order('name')) as Item[], []);
  const cust = useAsync(async () => unwrap(await supabase.from('custody_records')
    .select('id,quantity,reason,issued_at,returned_at,status,item:inventory_items(name),holder:profiles!custody_records_holder_id_fkey(full_name),issuer:profiles!custody_records_issued_by_fkey(full_name),asset:assets(serial_number)')
    .order('issued_at', { ascending: false }).limit(200)) as unknown as Cust[], []);
  const moves = useAsync(async () => unwrap(await supabase.from('stock_movements')
    .select('id,movement_type,quantity,reason,created_at,expected_qty,counted_qty,item:inventory_items(name),performer:profiles!stock_movements_performed_by_fkey(full_name),from_w:warehouses!stock_movements_from_warehouse_id_fkey(name_ar),to_w:warehouses!stock_movements_to_warehouse_id_fkey(name_ar)')
    .order('created_at', { ascending: false }).limit(200)) as unknown as Mov[], []);

  const cur = wh || whs.data?.[0]?.id || '';
  const list = (items.data ?? []).filter((i) => i.warehouse_id === cur);
  const reloadAll = () => { items.reload(); cust.reload(); moves.reload(); };

  return (
    <div className="animate-fade-up">
      <PageHeader title="المستودعات والعهد" desc="كل عملية تُسجَّل باسم المنفذ والتاريخ والسبب."
        actions={<>{can('warehouses.create') && <button className="btn btn-outline" onClick={() => setM({ kind: 'wh' })}><Plus className="h-4 w-4" /> مستودع</button>}
          {can('inventory.create') && cur && <button className="btn btn-gold" onClick={() => setM({ kind: 'item' })}><PackagePlus className="h-4 w-4" /> صنف جديد</button>}</>} />
      <Tabs value={tab} onChange={setTab} tabs={[{ id: 'stock', label: 'المخزون' }, { id: 'custody', label: 'العهد' }, { id: 'moves', label: 'سجل الحركة' }]} />

      {tab === 'stock' && (
        <>
          <div className="mb-4 max-w-xs"><AsyncView state={whs} emptyTitle="لا توجد مستودعات ظاهرة لك" rows={1}>
            {(w) => <Select value={cur} onChange={setWh} options={opts(w, (x) => x.id, (x) => x.name_ar)} aria-label="المستودع" />}</AsyncView></div>
          <AsyncView state={{ ...items, data: items.data ? list : undefined }} emptyTitle="لا توجد أصناف في هذا المستودع">
            {(rows) => (
              <Table head={['الصنف', 'الكمية', 'الحد الأدنى', '']}>
                {rows.map((i) => (
                  <tr key={i.id}>
                    <td className="px-4 py-3"><p className="font-semibold text-white">{i.name}</p><p className="ltr text-start text-[11px] text-slate-500">{i.sku}{i.category && ` · ${i.category}`}</p></td>
                    <td className="px-4 py-3 font-mono text-slate-100">{i.quantity} <span className="font-sans text-xs text-slate-500">{i.unit}</span>
                      {i.quantity <= i.min_quantity && <AlertTriangle className="ms-2 inline h-4 w-4 text-gold-400" aria-label="منخفض" />}</td>
                    <td className="px-4 py-3 font-mono text-slate-400">{i.min_quantity}</td>
                    <td className="px-4 py-3"><div className="flex justify-end gap-1">
                      {can('inventory.create') && <button className="btn btn-ghost !p-1.5" title="حركة / جرد" onClick={() => setM({ kind: 'move', item: i })}><ArrowLeftRight className="h-4 w-4" /></button>}
                      {can('custody.create') && <button className="btn btn-ghost !p-1.5" title="صرف عهدة" onClick={() => setM({ kind: 'custody', item: i })}><UserRound className="h-4 w-4" /></button>}
                      {i.serial_tracked && <button className="btn btn-ghost !p-1.5" title="الأرقام التسلسلية" onClick={() => setM({ kind: 'serials', item: i })}><Hash className="h-4 w-4" /></button>}
                    </div></td>
                  </tr>))}
              </Table>)}
          </AsyncView>
        </>
      )}

      {tab === 'custody' && (
        <AsyncView state={cust} emptyTitle="لا توجد عهد مسجلة">
          {(rows) => (
            <Table head={['الصنف', 'العسكري', 'الكمية', 'التاريخ', 'الحالة', '']}>
              {rows.map((c) => (
                <tr key={c.id}>
                  <td className="px-4 py-3 text-white">{c.item?.name}{c.asset && <span className="ltr ms-2 font-mono text-[11px] text-slate-500">{c.asset.serial_number}</span>}
                    <p className="text-[11px] text-slate-500">{c.reason}</p></td>
                  <td className="px-4 py-3 text-slate-300">{c.holder?.full_name}<p className="text-[11px] text-slate-500">سلّمه: {c.issuer?.full_name}</p></td>
                  <td className="px-4 py-3 font-mono">{c.quantity}</td>
                  <td className="px-4 py-3 text-xs text-slate-400">{fmtDateTime(c.issued_at)}</td>
                  <td className="px-4 py-3"><Badge tone={c.status === 'active' ? 'warn' : 'ok'}>{c.status === 'active' ? 'نشطة' : c.status === 'returned' ? 'أُرجعت' : 'مفقودة'}</Badge></td>
                  <td className="px-4 py-3">{c.status === 'active' && can('custody.update') && <button className="btn btn-outline !py-1 text-xs" disabled={busy}
                    onClick={() => run(async () => { must(await supabase.rpc('return_custody', { p_id: c.id })); reloadAll(); }, 'تم تسجيل الإرجاع')}><Undo2 className="h-3.5 w-3.5" /> إرجاع</button>}</td>
                </tr>))}
            </Table>)}
        </AsyncView>
      )}

      {tab === 'moves' && (
        <AsyncView state={moves} emptyTitle="لا توجد حركات">
          {(rows) => (
            <Table head={['الحركة', 'الصنف', 'الكمية', 'المنفذ / السبب', 'التاريخ']}>
              {rows.map((x) => (
                <tr key={x.id}>
                  <td className="px-4 py-3"><Badge tone={x.movement_type === 'stocktake' ? 'warn' : 'mute'}>{MOVE_AR[x.movement_type]}</Badge>
                    <p className="text-[11px] text-slate-500">{x.from_w?.name_ar} {x.from_w && x.to_w && '←'} {x.to_w?.name_ar}</p></td>
                  <td className="px-4 py-3 text-white">{x.item?.name}</td>
                  <td className="px-4 py-3 font-mono">{x.quantity}{x.movement_type === 'stocktake' && x.quantity !== 0 && <span className="ms-1 text-xs text-red-300">فرق ({x.expected_qty}→{x.counted_qty})</span>}</td>
                  <td className="px-4 py-3 text-slate-300">{x.performer?.full_name}<p className="text-[11px] text-slate-500">{x.reason}</p></td>
                  <td className="px-4 py-3 text-xs text-slate-400">{fmtDateTime(x.created_at)}</td>
                </tr>))}
            </Table>)}
        </AsyncView>
      )}

      {m?.kind === 'move' && <MoveModal item={m.item} whs={whs.data ?? []} onClose={() => setM(null)} onDone={() => { setM(null); reloadAll(); }} />}
      {m?.kind === 'custody' && <CustodyModal item={m.item} onClose={() => setM(null)} onDone={() => { setM(null); reloadAll(); }} />}
      {m?.kind === 'serials' && <SerialsModal item={m.item} onClose={() => setM(null)} />}
      {m?.kind === 'item' && <ItemModal wh={cur} onClose={() => setM(null)} onDone={() => { setM(null); items.reload(); }} />}
      {m?.kind === 'wh' && <WhModal onClose={() => setM(null)} onDone={() => { setM(null); whs.reload(); }} />}
    </div>
  );
}

function MoveModal({ item, whs, onClose, onDone }: { item: Item; whs: Wh[]; onClose: () => void; onDone: () => void }) {
  const [type, setType] = useState('in');
  const [qty, setQty] = useState(1);
  const [to, setTo] = useState('');
  const [reason, setReason] = useState('');
  const { busy, run } = useAction();
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (await run(async () => { must(await supabase.rpc('stock_move', { p_item: item.id, p_type: type, p_qty: qty, p_to: type === 'transfer' ? to : null, p_reason: reason })); }, 'تم تسجيل الحركة')) onDone();
  };
  return (
    <Modal title={`حركة: ${item.name} (المتوفر ${item.quantity})`} onClose={onClose}>
      <form onSubmit={submit} className="space-y-4">
        <Field label="نوع العملية"><Select value={type} onChange={setType} options={[{ value: 'in', label: 'إدخال' }, { value: 'out', label: 'إخراج' }, { value: 'transfer', label: 'نقل لمستودع آخر' }, { value: 'stocktake', label: 'جرد (الكمية الفعلية)' }]} /></Field>
        <Field label={type === 'stocktake' ? 'الكمية المعدودة فعلياً' : 'الكمية'}><Input required type="number" min={type === 'stocktake' ? 0 : 1} value={qty} onChange={(e) => setQty(Number(e.target.value))} /></Field>
        {type === 'transfer' && <Field label="مستودع الوجهة"><Select required value={to} onChange={setTo} placeholder="اختر" options={opts(whs.filter((w) => w.id !== item.warehouse_id), (w) => w.id, (w) => w.name_ar)} /></Field>}
        <Field label="السبب"><Textarea required value={reason} onChange={(e) => setReason(e.target.value)} /></Field>
        <SubmitRow busy={busy} onCancel={onClose} label="تنفيذ" />
      </form>
    </Modal>
  );
}

function CustodyModal({ item, onClose, onDone }: { item: Item; onClose: () => void; onDone: () => void }) {
  const people = useAsync(async () => unwrap(await supabase.from('profiles').select('id,full_name').eq('is_active', true).order('full_name')) as { id: string; full_name: string }[], []);
  const assets = useAsync(async () => unwrap(await supabase.from('assets').select('id,serial_number,status').eq('item_id', item.id).eq('status', 'available')) as Asset[], [item.id]);
  const [holder, setHolder] = useState('');
  const [asset, setAsset] = useState('');
  const [qty, setQty] = useState(1);
  const [reason, setReason] = useState('');
  const { busy, run } = useAction();
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (await run(async () => { must(await supabase.rpc('issue_custody', { p_item: item.id, p_holder: holder, p_qty: asset ? 1 : qty, p_asset: asset || null, p_reason: reason })); }, 'تم تسجيل العهدة')) onDone();
  };
  return (
    <Modal title={`صرف عهدة: ${item.name}`} onClose={onClose}>
      <form onSubmit={submit} className="space-y-4">
        <Field label="المستلم"><Select required value={holder} onChange={setHolder} placeholder="اختر العسكري" options={opts(people.data, (p) => p.id, (p) => p.full_name)} /></Field>
        {item.serial_tracked && <Field label="الرقم التسلسلي"><Select required value={asset} onChange={setAsset} placeholder="اختر" options={opts(assets.data, (a) => a.id, (a) => a.serial_number)} /></Field>}
        {!item.serial_tracked && <Field label="الكمية"><Input required type="number" min={1} max={item.quantity} value={qty} onChange={(e) => setQty(Number(e.target.value))} /></Field>}
        <Field label="السبب"><Textarea required value={reason} onChange={(e) => setReason(e.target.value)} /></Field>
        <SubmitRow busy={busy} onCancel={onClose} label="صرف" />
      </form>
    </Modal>
  );
}

function SerialsModal({ item, onClose }: { item: Item; onClose: () => void }) {
  const list = useAsync(async () => unwrap(await supabase.from('assets').select('id,serial_number,status').eq('item_id', item.id).order('serial_number')) as Asset[], [item.id]);
  const [sn, setSn] = useState('');
  const { busy, run } = useAction();
  const { can } = useAuth();
  const AR: Record<string, string> = { available: 'متاح', assigned: 'في عهدة', maintenance: 'صيانة', lost: 'مفقود', retired: 'مُخرج' };
  return (
    <Modal title={`الأرقام التسلسلية: ${item.name}`} onClose={onClose}>
      {can('inventory.create') && (
        <form className="mb-4 flex gap-2" onSubmit={async (e) => { e.preventDefault(); if (await run(async () => { must(await supabase.from('assets').insert({ item_id: item.id, serial_number: sn.trim() })); }, 'تمت الإضافة')) { setSn(''); list.reload(); } }}>
          <Input required className="ltr" placeholder="Serial" value={sn} onChange={(e) => setSn(e.target.value)} /><button className="btn btn-gold" disabled={busy}>إضافة</button></form>)}
      <AsyncView state={list} emptyTitle="لا توجد أرقام مسجلة">{(r) => <ul className="divide-y divide-white/[.06]">{r.map((a) => (
        <li key={a.id} className="flex items-center justify-between py-2 text-sm"><span className="ltr font-mono text-slate-100">{a.serial_number}</span><Badge tone={a.status === 'available' ? 'ok' : 'warn'}>{AR[a.status]}</Badge></li>))}</ul>}</AsyncView>
    </Modal>
  );
}

function ItemModal({ wh, onClose, onDone }: { wh: string; onClose: () => void; onDone: () => void }) {
  const [f, setF] = useState({ sku: '', name: '', category: '', unit: 'قطعة', quantity: 0, min_quantity: 0, serial_tracked: false });
  const { busy, run } = useAction();
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (await run(async () => { must(await supabase.from('inventory_items').insert({ ...f, category: f.category || null, warehouse_id: wh })); }, 'تمت إضافة الصنف')) onDone();
  };
  return (
    <Modal title="صنف جديد" onClose={onClose}>
      <form onSubmit={submit} className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <Field label="الاسم"><Input required value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></Field>
          <Field label="الرمز (SKU)"><Input required className="ltr" value={f.sku} onChange={(e) => setF({ ...f, sku: e.target.value })} /></Field>
          <Field label="التصنيف"><Input value={f.category} onChange={(e) => setF({ ...f, category: e.target.value })} /></Field>
          <Field label="الوحدة"><Input value={f.unit} onChange={(e) => setF({ ...f, unit: e.target.value })} /></Field>
          <Field label="الكمية الافتتاحية"><Input type="number" min={0} value={f.quantity} onChange={(e) => setF({ ...f, quantity: Number(e.target.value) })} /></Field>
          <Field label="الحد الأدنى"><Input type="number" min={0} value={f.min_quantity} onChange={(e) => setF({ ...f, min_quantity: Number(e.target.value) })} /></Field>
        </div>
        <label className="flex items-center gap-2 text-sm text-slate-300"><input type="checkbox" className="h-4 w-4 accent-[#B69A52]" checked={f.serial_tracked} onChange={(e) => setF({ ...f, serial_tracked: e.target.checked })} /> يُتتبَّع بأرقام تسلسلية</label>
        <SubmitRow busy={busy} onCancel={onClose} />
      </form>
    </Modal>
  );
}

function WhModal({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const [f, setF] = useState({ code: '', name_ar: '', kind: 'equipment' });
  const { busy, run } = useAction();
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (await run(async () => { must(await supabase.from('warehouses').insert(f)); }, 'تم إنشاء المستودع')) onDone();
  };
  return (
    <Modal title="مستودع جديد" onClose={onClose}>
      <form onSubmit={submit} className="space-y-4">
        <Field label="الاسم"><Input required value={f.name_ar} onChange={(e) => setF({ ...f, name_ar: e.target.value })} /></Field>
        <Field label="الكود"><Input required className="ltr" pattern="[a-z0-9_]+" value={f.code} onChange={(e) => setF({ ...f, code: e.target.value })} /></Field>
        <Field label="النوع"><Select value={f.kind} onChange={(v) => setF({ ...f, kind: v })} options={[['main', 'رئيسي'], ['department', 'قسم'], ['weapons', 'أسلحة'], ['ammo', 'ذخائر'], ['equipment', 'معدات'], ['vehicles', 'مركبات']].map(([value, label]) => ({ value, label }))} /></Field>
        <SubmitRow busy={busy} onCancel={onClose} />
      </form>
    </Modal>
  );
}
