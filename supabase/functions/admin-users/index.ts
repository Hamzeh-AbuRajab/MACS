// Edge Function: privileged account operations. The service-role key lives ONLY here.
// Deploy: supabase functions deploy admin-users
// Every action re-checks the caller's permission through the database (has_perm).
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};
const json = (b: unknown, status = 200) =>
  new Response(JSON.stringify(b), { status, headers: { ...cors, 'Content-Type': 'application/json' } });

const DOMAIN = Deno.env.get('AUTH_EMAIL_DOMAIN') ?? 'macs.internal';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  try {
    const url = Deno.env.get('SUPABASE_URL')!;
    const caller = createClient(url, Deno.env.get('SUPABASE_ANON_KEY')!, {
      global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } },
    });
    const admin = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

    const { data: me } = await caller.auth.getUser();
    if (!me.user) return json({ error: 'غير مسجل الدخول' }, 401);
    const has = async (code: string, dept?: string | null) =>
      (await caller.rpc('has_perm', { p_code: code, p_dept: dept ?? null })).data === true;

    const b = await req.json();

    if (b.action === 'create') {
      const username = String(b.username ?? '').trim().toLowerCase();
      if (!/^[a-z0-9._-]{3,32}$/.test(username)) return json({ error: 'اسم المستخدم غير صالح (حروف إنجليزية وأرقام فقط)' }, 400);
      if (String(b.password ?? '').length < 8) return json({ error: 'كلمة المرور 8 أحرف على الأقل' }, 400);
      if (!b.full_name || !b.military_number || !b.rank_id) return json({ error: 'بيانات ناقصة' }, 400);
      if (!(await has('users.create')) || !(await has('personnel.create', b.department_id ?? null)))
        return json({ error: 'لا تملك صلاحية إنشاء حسابات' }, 403);

      const roleCodes: string[] = Array.isArray(b.role_codes) && b.role_codes.length ? b.role_codes : ['soldier'];
      const nonDefault = roleCodes.some((c) => c !== 'soldier');
      if (nonDefault && !(await has('roles.update'))) return json({ error: 'لا تملك صلاحية منح الأدوار' }, 403);

      const { data: created, error: e1 } = await admin.auth.admin.createUser({
        email: `${username}@${DOMAIN}`, password: b.password, email_confirm: true,
      });
      if (e1 || !created.user) return json({ error: e1?.message?.includes('already') ? 'اسم المستخدم مستخدم مسبقاً' : (e1?.message ?? 'فشل الإنشاء') }, 400);
      const uid = created.user.id;
      const rollback = async (msg: string) => { await admin.auth.admin.deleteUser(uid); return json({ error: msg }, 400); };

      const p = await caller.from('profiles').insert({ id: uid, username, full_name: b.full_name, full_name_en: b.full_name_en ?? null });
      if (p.error) return rollback(p.error.message);
      const pe = await caller.from('personnel').insert({
        user_id: uid, military_number: b.military_number, rank_id: b.rank_id, department_id: b.department_id ?? null,
      });
      if (pe.error) return rollback(pe.error.message);
      const { data: roles } = await admin.from('roles').select('id').in('code', roleCodes);
      const ur = await admin.from('user_roles').insert((roles ?? []).map((r) => ({ user_id: uid, role_id: r.id, granted_by: me.user!.id })));
      if (ur.error) return rollback(ur.error.message);
      return json({ ok: true, user_id: uid });
    }

    if (b.action === 'reset_password') {
      if (!(await has('users.update'))) return json({ error: 'غير مصرح' }, 403);
      if (String(b.password ?? '').length < 8) return json({ error: 'كلمة المرور 8 أحرف على الأقل' }, 400);
      const { error } = await admin.auth.admin.updateUserById(b.user_id, { password: b.password });
      if (error) return json({ error: error.message }, 400);
      if (b.request_id) await caller.from('password_reset_requests').update({ status: 'done', handled_by: me.user.id }).eq('id', b.request_id);
      return json({ ok: true });
    }

    if (b.action === 'set_active') {
      if (!(await has('users.update'))) return json({ error: 'غير مصرح' }, 403);
      if (b.user_id === me.user.id) return json({ error: 'لا يمكنك تعطيل حسابك' }, 400);
      const u = await caller.from('profiles').update({ is_active: !!b.active }).eq('id', b.user_id);
      if (u.error) return json({ error: u.error.message }, 400);
      await admin.auth.admin.updateUserById(b.user_id, { ban_duration: b.active ? 'none' : '876000h' });
      return json({ ok: true });
    }

    return json({ error: 'إجراء غير معروف' }, 400);
  } catch (e) {
    return json({ error: (e as Error).message }, 500);
  }
});
