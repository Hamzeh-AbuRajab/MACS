import { createClient } from '@supabase/supabase-js';
import fs from 'node:fs';
const env = Object.fromEntries(fs.readFileSync('.env', 'utf8').trim().split('\n').map((l) => l.split('=')));
const mk = () => createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY, { auth: { persistSession: false } });
const login = async (u, p = 'Test12345!') => { const c = mk(); const r = await c.auth.signInWithPassword({ email: `${u}@macs.internal`, password: p }); if (r.error) throw r.error; return c; };
const call = async (c, body) => {
  const { data, error } = await c.functions.invoke('admin-users', { body });
  if (error) { let m = error.message; try { m = (await error.context.json()).error; } catch {} return { error: m }; }
  return data;
};
const M = await login('minister'), S = await login('soldier1');
const rank = (await M.from('ranks').select('id').eq('code', 'private').single()).data.id;
const dept = (await M.from('departments').select('id').eq('code', 'army').single()).data.id;
const show = (n, r) => console.log(n.padEnd(34), JSON.stringify(r));

show('soldier create (expect 403)', await call(S, { action: 'create', username: 'hack1', full_name: 'x', password: 'Passw0rd!!', military_number: 'H1', rank_id: rank }));
show('bad username', await call(M, { action: 'create', username: 'Bad Name!', full_name: 'x', password: 'Passw0rd!!', military_number: 'N1', rank_id: rank }));
show('short password', await call(M, { action: 'create', username: 'newguy', full_name: 'x', password: 'abc', military_number: 'N1', rank_id: rank }));
const created = await call(M, { action: 'create', username: 'newguy', full_name: 'عسكري جديد', password: 'Passw0rd!!', military_number: 'N-100', rank_id: rank, department_id: dept, role_codes: ['soldier'] });
show('create newguy', created);
show('duplicate username', await call(M, { action: 'create', username: 'newguy', full_name: 'x', password: 'Passw0rd!!', military_number: 'N-101', rank_id: rank }));
show('duplicate military number (rollback)', await call(M, { action: 'create', username: 'newguy2', full_name: 'x', password: 'Passw0rd!!', military_number: 'N-100', rank_id: rank }));
const n2 = await login('newguy2', 'Passw0rd!!').then(() => 'AUTH USER LEFT BEHIND').catch(() => 'rolled back OK');
show('rollback check', n2);
const G = await login('newguy', 'Passw0rd!!');
show('newguy logs in, perms', (await G.rpc('my_permissions')).data.length);
const me = (await G.from('personnel').select('military_number, rank:ranks(code), department:departments(code)').single()).data;
show('newguy personnel', me);
show('reset password', await call(M, { action: 'reset_password', user_id: created.user_id, password: 'NewPass123!' }));
show('login with new pw', await login('newguy', 'NewPass123!').then(() => 'ok').catch((e) => e.message));
show('soldier reset (expect 403)', await call(S, { action: 'reset_password', user_id: created.user_id, password: 'Hacked1234!' }));
show('disable newguy', await call(M, { action: 'set_active', user_id: created.user_id, active: false }));
show('disabled can login?', await login('newguy', 'NewPass123!').then(() => 'STILL LOGS IN').catch((e) => e.message));
show('enable newguy', await call(M, { action: 'set_active', user_id: created.user_id, active: true }));
show('enabled login', await login('newguy', 'NewPass123!').then(() => 'ok').catch((e) => e.message));
const mid = (await M.auth.getUser()).data.user.id;
show('self-disable blocked', await call(M, { action: 'set_active', user_id: mid, active: false }));
show('role grant by non-admin blocked', await call(S, { action: 'create', username: 'x2', full_name: 'x', password: 'Passw0rd!!', military_number: 'X2', rank_id: rank, role_codes: ['minister'] }));
