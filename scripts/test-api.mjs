import { createClient } from '@supabase/supabase-js';
import fs from 'node:fs';
const env = Object.fromEntries(fs.readFileSync('.env', 'utf8').trim().split('\n').map((l) => l.split('=')));
const mk = () => createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY, { auth: { persistSession: false } });
const login = async (u) => { const c = mk(); const r = await c.auth.signInWithPassword({ email: `${u}@macs.internal`, password: 'Test12345!' }); if (r.error) throw r.error; return c; };
let fails = 0;
const t = async (name, fn) => { try { const r = await fn(); console.log('PASS', name, r ?? ''); } catch (e) { fails++; console.log('FAIL', name, '->', e.message ?? JSON.stringify(e)); } };
const ok = (r) => { if (r.error) throw new Error(r.error.message); return r.data; };
const EV = 'id,event_type,reason,created_at,from_rank:ranks!personnel_events_from_rank_id_fkey(name_ar),to_rank:ranks!personnel_events_to_rank_id_fkey(name_ar),from_department:departments!personnel_events_from_department_id_fkey(name_ar),to_department:departments!personnel_events_to_department_id_fkey(name_ar)';
const M = await login('minister'), S = await login('soldier1'), S2 = await login('soldier2');
const sid = (await S.auth.getUser()).data.user.id;
const anon = mk();

await t('anon landing queries', async () => { for (const [tb, sel] of [['site_settings', 'value'], ['ranks', '*'], ['departments', '*'], ['law_categories', '*'], ['decisions', 'id'], ['announcements', 'id'], ['news_updates', 'id'], ['laws', 'id']]) ok(await anon.from(tb).select(sel).limit(1)); });
await t('anon blocked from personnel', async () => { const r = await anon.from('personnel').select('*'); if (!r.error) throw new Error('anon read personnel'); });
await t('my_permissions minister', async () => `${ok(await M.rpc('my_permissions')).length} perms`);
await t('my_permissions soldier', async () => `${ok(await S.rpc('my_permissions')).length} perms`);
await t('auth load personnel embed', async () => (ok(await M.from('personnel').select('*, rank:ranks(*), department:departments(*)').eq('user_id', sid).maybeSingle()) ? 'row' : 'none'));
await t('personnel list embed', async () => `${ok(await M.from('personnel').select('*, profile:profiles(*), rank:ranks(*), department:departments(*)')).length} rows`);
await t('soldier sees only self', async () => { const n = ok(await S.from('personnel').select('id')).length; if (n !== 1) throw new Error('saw ' + n); return n; });
await t('events embed', async () => `${ok(await M.from('personnel_events').select(EV).eq('user_id', sid)).length}`);
await t('dashboard queries soldier', async () => {
  for (const q of [
    S.from('announcements').select('id,title,body,image_url,pinned,published_at,is_public').eq('status', 'published').limit(4),
    S.from('decisions').select('id,title').eq('status', 'published').limit(4),
    S.from('notifications').select('id').limit(5),
    S.from('promotion_requests').select('id', { count: 'exact', head: true }),
    S.from('leave_requests').select('id', { count: 'exact', head: true })]) ok(await q);
});
await t('departments detail queries', async () => {
  const d = ok(await M.from('departments').select('*').eq('code', 'army').single());
  ok(await M.from('personnel').select('*, profile:profiles(*), rank:ranks(*)').eq('department_id', d.id));
  ok(await M.from('leave_requests').select('id,start_date,end_date,status,applicant:profiles!leave_requests_applicant_id_fkey(full_name)').eq('department_id', d.id));
  ok(await M.from('promotion_requests').select('id,status,created_at,applicant:profiles!promotion_requests_applicant_id_fkey(full_name),requested_rank:ranks!promotion_requests_requested_rank_id_fkey(name_ar)').eq('department_id', d.id));
});
await t('accounts query', async () => `${ok(await M.from('profiles').select('id,username,full_name,is_active,personnel(military_number,service_status,rank:ranks(name_ar),department:departments(name_ar)),user_roles!user_roles_user_id_fkey(role_id,roles(code,name_ar))').order('full_name')).length}`);
await t('roles matrix queries', async () => { ok(await M.from('roles').select('*')); ok(await M.from('permissions').select('*')); ok(await M.from('role_permissions').select('role_id,permission_id')); });
await t('command_stats minister', async () => Object.keys(ok(await M.rpc('command_stats'))).length + ' keys');
await t('command_stats soldier denied', async () => { const r = await S.rpc('command_stats'); if (!r.error) throw new Error('allowed'); });

await t('create law', async () => { const c = ok(await M.from('law_categories').select('id').eq('code', 'general').single()); ok(await M.from('laws').insert({ category_id: c.id, title: 'قانون تجريبي', content: 'نص', is_public: true, status: 'published' })); });
await t('anon sees public law', async () => { const n = ok(await anon.from('laws').select('id')).length; if (n < 1) throw new Error('0'); });
await t('publish announcement -> notification', async () => { ok(await M.from('announcements').insert({ title: 'إعلان', body: 'نص', status: 'published', is_public: true })); const n = ok(await S.from('notifications').select('id,type').eq('type', 'announcement')).length; if (n < 1) throw new Error('no notification'); });
await t('decision publish visible to soldier', async () => { ok(await M.from('decisions').insert({ title: 'قرار', body: 'نص', status: 'published', is_public: true, decision_type: 'general', importance: 'urgent' })); if (ok(await S.from('decisions').select('id')).length < 1) throw new Error('soldier cannot see'); });
await t('soldier cannot create decision', async () => { const r = await S.from('decisions').insert({ title: 'x', body: 'y' }); if (!r.error) throw new Error('allowed'); });
await t('targeted announcement navy only', async () => {
  const navy = ok(await M.from('departments').select('id').eq('code', 'navy').single());
  ok(await M.from('announcements').insert({ title: 'بحرية فقط', body: 'x', status: 'published', target_department_id: navy.id }));
  const a = ok(await S.from('announcements').select('title')).map((x) => x.title), b = ok(await S2.from('announcements').select('title')).map((x) => x.title);
  if (a.includes('بحرية فقط') || !b.includes('بحرية فقط')) throw new Error('targeting wrong');
});

let reqId;
await t('soldier files promotion', async () => { const r = ok(await S.from('ranks').select('id').eq('code', 'corporal').single()); ok(await S.from('promotion_requests').insert({ applicant_id: sid, requested_rank_id: r.id, justification: 'جدير' })); });
await t('promotion embed (as UI)', async () => { const r = ok(await M.from('promotion_requests').select('id,status,justification,review_reason,created_at,applicant_id,applicant:profiles!promotion_requests_applicant_id_fkey(full_name),current_rank:ranks!promotion_requests_current_rank_id_fkey(name_ar),requested_rank:ranks!promotion_requests_requested_rank_id_fkey(name_ar)')); reqId = r[0].id; });
await t('leave file + embed', async () => { ok(await S.from('leave_requests').insert({ applicant_id: sid, start_date: '2026-12-01', end_date: '2026-12-05', reason: 'راحة' })); ok(await M.from('leave_requests').select('id,status,reason,review_reason,start_date,end_date,created_at,applicant_id,applicant:profiles!leave_requests_applicant_id_fkey(full_name)')); });
await t('approve promotion -> rank changes', async () => { ok(await M.rpc('review_promotion', { p_id: reqId, p_approve: true, p_reason: 'تمت' })); const p = ok(await S.from('personnel').select('rank:ranks(code)').eq('user_id', sid).single()); if (p.rank.code !== 'corporal') throw new Error(p.rank.code); });
await t('soldier notified', async () => { const n = ok(await S.from('notifications').select('type')).map((x) => x.type); if (!n.includes('personnel') || !n.includes('request_result')) throw new Error(n.join()); });
await t('review_leave reject', async () => { const l = ok(await M.from('leave_requests').select('id').eq('status', 'pending'))[0]; ok(await M.rpc('review_leave', { p_id: l.id, p_approve: false, p_reason: 'لا' })); });
await t('soldier self-promote blocked', async () => { const g = ok(await S.from('ranks').select('id').eq('code', 'general').single()); const r = await S.rpc('change_personnel', { p_user: sid, p_reason: 'x', p_rank: g.id }); if (!r.error) throw new Error('allowed'); });
await t('transfer + status rpc', async () => {
  const a = ok(await M.from('departments').select('id').eq('code', 'air_force').single());
  ok(await M.rpc('change_personnel', { p_user: sid, p_department: a.id, p_set_department: true, p_reason: 'نقل' }));
  ok(await M.rpc('change_personnel', { p_user: sid, p_status: 'on_leave', p_reason: 'x' }));
  ok(await M.rpc('change_personnel', { p_user: sid, p_status: 'active', p_reason: 'x' }));
  return ok(await S.from('personnel_events').select(EV)).map((x) => x.event_type).join(',');
});
await t('soldier profile page queries', async () => { for (const q of [S.from('disciplinary_records').select('id,violation_type,penalty_type,issued_at,description').eq('subject_id', sid), S.from('leave_requests').select('id,start_date,end_date,status,reason').eq('applicant_id', sid), S.from('promotion_requests').select('id,status,created_at,requested_rank:ranks!promotion_requests_requested_rank_id_fkey(name_ar)').eq('applicant_id', sid)]) ok(await q); });

await t('discipline: create, own-only visibility', async () => { ok(await M.from('disciplinary_records').insert({ subject_id: sid, violation_type: 'غياب', description: 'غاب', penalty_type: 'warning' })); if (ok(await S.from('disciplinary_records').select('id')).length !== 1) throw new Error('soldier mine != 1'); if (ok(await S2.from('disciplinary_records').select('id')).length) throw new Error('S2 sees'); });
await t('discipline list embed', async () => ok(await M.from('disciplinary_records').select('id,violation_type,description,evidence,penalty_type,penalty_details,issued_at,subject:profiles!disciplinary_records_subject_id_fkey(full_name),rank:ranks(name_ar),department:departments(name_ar),issuer:profiles!disciplinary_records_issued_by_fkey(full_name)')).length + ' rows');

let itemId;
await t('inventory item + stock moves', async () => {
  const w = ok(await M.from('warehouses').select('id').eq('code', 'weapons').single()); const main = ok(await M.from('warehouses').select('id').eq('code', 'main').single());
  itemId = ok(await M.from('inventory_items').insert({ warehouse_id: w.id, sku: 'AR15', name: 'بندقية', quantity: 10, serial_tracked: true }).select('id').single()).id;
  ok(await M.rpc('stock_move', { p_item: itemId, p_type: 'in', p_qty: 5, p_reason: 'توريد' }));
  ok(await M.rpc('stock_move', { p_item: itemId, p_type: 'transfer', p_qty: 3, p_to: main.id, p_reason: 'نقل' }));
  ok(await M.rpc('stock_move', { p_item: itemId, p_type: 'stocktake', p_qty: 11, p_reason: 'جرد' }));
});
await t('asset + custody issue/return', async () => {
  const a = ok(await M.from('assets').insert({ item_id: itemId, serial_number: 'SN-001' }).select('id').single()).id;
  ok(await M.rpc('issue_custody', { p_item: itemId, p_holder: sid, p_qty: 1, p_asset: a, p_reason: 'دورية' }));
  if (ok(await S.from('custody_records').select('id')).length !== 1) throw new Error('soldier cannot see own custody');
  const c = ok(await M.from('custody_records').select('id').eq('status', 'active'))[0].id; ok(await M.rpc('return_custody', { p_id: c }));
});
await t('custody + movements UI embeds', async () => {
  ok(await M.from('custody_records').select('id,quantity,reason,issued_at,returned_at,status,item:inventory_items(name),holder:profiles!custody_records_holder_id_fkey(full_name),issuer:profiles!custody_records_issued_by_fkey(full_name),asset:assets(serial_number)').order('issued_at', { ascending: false }));
  return ok(await M.from('stock_movements').select('id,movement_type,quantity,reason,created_at,expected_qty,counted_qty,item:inventory_items(name),performer:profiles!stock_movements_performed_by_fkey(full_name),from_w:warehouses!stock_movements_from_warehouse_id_fkey(name_ar),to_w:warehouses!stock_movements_to_warehouse_id_fkey(name_ar)')).length + ' moves';
});
await t('soldier blocked from warehouses', async () => { if (ok(await S.from('warehouses').select('id')).length) throw new Error('visible'); });

await t('soldier files report, cannot read cases', async () => { ok(await S.from('cases').insert({ title: 'بلاغ', description: 'x', case_type: 'report', status: 'open', reported_by: sid })); if (ok(await S.from('cases').select('id')).length) throw new Error('soldier reads cases'); });
await t('intel: investigation/evidence/signed url/statement', async () => {
  const c = ok(await M.from('cases').select('id,case_number,title,description,case_type,status,final_decision,created_at,subject_id,assigned_to,reporter:profiles!cases_reported_by_fkey(full_name),subject:profiles!cases_subject_id_fkey(full_name)'))[0];
  ok(await M.from('investigations').insert({ case_id: c.id, summary: 'ملخص', report: 'تقرير' }));
  ok(await M.from('investigations').select('id,summary,report,status,lead:profiles!investigations_lead_investigator_id_fkey(full_name)').eq('case_id', c.id));
  const up = await M.storage.from('evidence').upload(`${c.id}/t.txt`, new Blob(['evidence']), { contentType: 'text/plain' }); if (up.error) throw up.error;
  ok(await M.from('evidence').insert({ case_id: c.id, title: 'دليل', file_path: `${c.id}/t.txt` }));
  ok(await M.from('evidence').select('id,title,description,file_path,created_at,by:profiles!evidence_added_by_fkey(full_name)').eq('case_id', c.id));
  const s = await M.storage.from('evidence').createSignedUrl(`${c.id}/t.txt`, 60); if (s.error) throw s.error;
  const sr = await S.storage.from('evidence').createSignedUrl(`${c.id}/t.txt`, 60); if (!sr.error) throw new Error('soldier got signed url');
  ok(await M.from('statements').insert({ case_id: c.id, witness_name: 'شاهد', content: 'نص' }));
  ok(await M.from('statements').select('id,witness_name,content,created_at,witness:profiles!statements_witness_id_fkey(full_name),taker:profiles!statements_taken_by_fkey(full_name)').eq('case_id', c.id));
});

await t('roles: toggle permission', async () => { const r = ok(await M.from('roles').select('id').eq('code', 'officer').single()); const p = ok(await M.from('permissions').select('id').eq('code', 'laws.view').single()); ok(await M.from('role_permissions').insert({ role_id: r.id, permission_id: p.id })); ok(await M.from('role_permissions').delete().eq('role_id', r.id).eq('permission_id', p.id)); });
await t('grant role; self-grant blocked', async () => {
  const r = ok(await M.from('roles').select('id').eq('code', 'warehouse_manager').single()); ok(await M.from('user_roles').insert({ user_id: sid, role_id: r.id }));
  const mr = ok(await M.from('roles').select('id').eq('code', 'minister').single());
  const x = await S.from('user_roles').insert({ user_id: sid, role_id: mr.id }); if (!x.error) throw new Error('self grant allowed');
  ok(await M.from('user_roles').delete().eq('user_id', sid).eq('role_id', r.id));
});
await t('site settings upsert + news visible to anon', async () => { const v = ok(await M.from('site_settings').select('value').eq('key', 'ministry').single()).value; ok(await M.from('site_settings').upsert({ key: 'ministry', value: { ...v, tagline: 'جديد' } })); ok(await M.from('news_updates').insert({ title: 'تحديث', status: 'published' })); if (!ok(await anon.from('news_updates').select('id')).length) throw new Error('anon cannot see news'); });
await t('audit log: minister reads, soldier blocked', async () => { const n = ok(await M.from('audit_logs').select('*').limit(300)).length; if (ok(await S.from('audit_logs').select('id')).length) throw new Error('soldier reads audit'); return n + ' rows'; });
await t('password reset request (anon) + admin list', async () => { ok(await anon.from('password_reset_requests').insert({ username: 'soldier1', note: 'نسيت' })); ok(await M.from('password_reset_requests').select('*').eq('status', 'pending')); });
await t('rank reorder swap', async () => { const rs = ok(await M.from('ranks').select('id,level').order('level')); const [a, b] = [rs[12], rs[13]]; ok(await M.from('ranks').update({ level: 9999 }).eq('id', a.id)); ok(await M.from('ranks').update({ level: a.level }).eq('id', b.id)); ok(await M.from('ranks').update({ level: b.level }).eq('id', a.id)); });
console.log(fails ? `\n${fails} FAILED` : '\nALL PASSED');
