-- MACS 002: helper functions, guard triggers, audit, notifications, RLS.
-- Every permission is enforced here, never only in the UI.

-- ───────────────── helpers ─────────────────
create or replace function public.own_dept() returns uuid
language sql stable security definer set search_path = public as $$
  select department_id from personnel where user_id = auth.uid()
$$;

create or replace function public.user_dept(p_user uuid) returns uuid
language sql stable security definer set search_path = public as $$
  select department_id from personnel where user_id = p_user
$$;

create or replace function public.is_active_user() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from profiles pr
    left join personnel pe on pe.user_id = pr.id
    where pr.id = auth.uid() and pr.is_active
      and coalesce(pe.service_status, 'active') <> 'terminated'
  )
$$;

-- global role: permission applies everywhere. department role: only for p_dept = caller's own department.
create or replace function public.has_perm(p_code text, p_dept uuid default null) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1
    from profiles pr
    join user_roles ur on ur.user_id = pr.id
    join roles r on r.id = ur.role_id
    join role_permissions rp on rp.role_id = r.id
    join permissions pm on pm.id = rp.permission_id
    left join personnel pe on pe.user_id = pr.id
    where pr.id = auth.uid()
      and pr.is_active
      and pm.code = p_code
      and coalesce(pe.service_status, 'active') not in ('terminated','suspended')
      and (r.scope = 'global' or (p_dept is not null and pe.department_id = p_dept))
  )
$$;

create or replace function public.my_permissions() returns table (code text, scope text)
language sql stable security definer set search_path = public as $$
  select distinct pm.code, r.scope
  from profiles pr
  join user_roles ur on ur.user_id = pr.id
  join roles r on r.id = ur.role_id
  join role_permissions rp on rp.role_id = r.id
  join permissions pm on pm.id = rp.permission_id
  left join personnel pe on pe.user_id = pr.id
  where pr.id = auth.uid() and pr.is_active
    and coalesce(pe.service_status, 'active') not in ('terminated','suspended')
$$;

create or replace function public.wh_dept(p_wh uuid) returns uuid
language sql stable security definer set search_path = public as $$
  select department_id from warehouses where id = p_wh
$$;

create or replace function public.item_dept(p_item uuid) returns uuid
language sql stable security definer set search_path = public as $$
  select w.department_id from inventory_items i join warehouses w on w.id = i.warehouse_id where i.id = p_item
$$;

-- empty targeting = everyone. dept + ranks = intersection. explicit users always match.
create or replace function public.is_targeted(p_user uuid, p_dept uuid, p_ranks uuid[], p_users uuid[])
returns boolean language sql stable security definer set search_path = public as $$
  select case
    when p_dept is null and coalesce(array_length(p_ranks,1),0) = 0 and coalesce(array_length(p_users,1),0) = 0 then true
    when p_users is not null and p_user = any(p_users) then true
    when p_dept is null and coalesce(array_length(p_ranks,1),0) = 0 then false
    else exists (
      select 1 from personnel pe
      where pe.user_id = p_user
        and (p_dept is null or pe.department_id = p_dept)
        and (coalesce(array_length(p_ranks,1),0) = 0 or pe.rank_id = any(p_ranks))
    )
  end
$$;

-- ───────────────── audit ─────────────────
create or replace function public.log_audit() returns trigger
language plpgsql security definer set search_path = public as $$
declare rec jsonb;
begin
  rec := case when tg_op = 'DELETE' then to_jsonb(old) else to_jsonb(new) end;
  insert into audit_logs (actor_id, action, table_name, record_id, old_data, new_data)
  values (auth.uid(), tg_op, tg_table_name,
          coalesce(rec->>'id', rec->>'key', rec->>'role_id'),
          case when tg_op <> 'INSERT' then to_jsonb(old) end,
          case when tg_op <> 'DELETE' then to_jsonb(new) end);
  return null;
end $$;

do $$
declare t text;
begin
  foreach t in array array['profiles','ranks','departments','personnel','roles','role_permissions','user_roles',
    'laws','law_categories','decisions','announcements','news_updates','site_settings','personnel_events',
    'promotion_requests','leave_requests','disciplinary_records','warehouses','inventory_items','assets',
    'custody_records','stock_movements','cases','investigations','evidence','statements','password_reset_requests']
  loop
    execute format('create trigger trg_audit after insert or update or delete on public.%I for each row execute function public.log_audit()', t);
  end loop;
end $$;

-- ───────────────── guard triggers ─────────────────
create or replace function public.guard_profile_update() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null or public.has_perm('users.update') then return new; end if;
  if new.id <> old.id or new.username <> old.username or new.is_active <> old.is_active
     or new.full_name <> old.full_name or new.full_name_en is distinct from old.full_name_en then
    raise exception 'غير مصرح بتعديل هذه البيانات' using errcode = '42501';
  end if;
  return new;
end $$;
create trigger trg_guard before update on public.profiles for each row execute function public.guard_profile_update();

create or replace function public.guard_personnel_update() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then return new; end if;
  if new.user_id = auth.uid() then
    raise exception 'لا يمكنك تعديل بياناتك العسكرية بنفسك' using errcode = '42501';
  end if;
  if new.rank_id <> old.rank_id and not public.has_perm('promotions.approve', old.department_id) then
    raise exception 'تغيير الرتبة يتطلب صلاحية اعتماد الترقيات' using errcode = '42501';
  end if;
  if (new.department_id is distinct from old.department_id
      or new.service_status <> old.service_status
      or new.user_id <> old.user_id
      or new.military_number <> old.military_number)
     and not public.has_perm('personnel.approve', old.department_id) then
    raise exception 'هذا التغيير يتطلب صلاحية اعتماد شؤون الأفراد' using errcode = '42501';
  end if;
  return new;
end $$;
create trigger trg_guard before update on public.personnel for each row execute function public.guard_personnel_update();

-- rank / department / status changes become history automatically.
-- A caller RPC may set  select set_config('macs.reason','...',true)  first.
create or replace function public.record_personnel_events() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  reason text := nullif(current_setting('macs.reason', true), '');
  old_lvl int; new_lvl int;
begin
  if tg_op = 'INSERT' then
    insert into personnel_events (user_id, event_type, to_rank_id, to_department_id, reason, created_by)
    values (new.user_id, 'joined', new.rank_id, new.department_id, reason, auth.uid());
    return null;
  end if;
  if new.rank_id <> old.rank_id then
    select level into old_lvl from ranks where id = old.rank_id;
    select level into new_lvl from ranks where id = new.rank_id;
    insert into personnel_events (user_id, event_type, from_rank_id, to_rank_id, reason, created_by)
    values (new.user_id, case when new_lvl < old_lvl then 'promotion' else 'demotion' end,
            old.rank_id, new.rank_id, reason, auth.uid());
  end if;
  if new.department_id is distinct from old.department_id then
    insert into personnel_events (user_id, event_type, from_department_id, to_department_id, reason, created_by)
    values (new.user_id, 'transfer', old.department_id, new.department_id, reason, auth.uid());
  end if;
  if new.service_status <> old.service_status and new.service_status in ('suspended','terminated','active') then
    insert into personnel_events (user_id, event_type, reason, created_by)
    values (new.user_id,
            case new.service_status when 'suspended' then 'suspension' when 'terminated' then 'termination' else 'reinstatement' end,
            reason, auth.uid());
  end if;
  return null;
end $$;
create trigger trg_events_ins after insert on public.personnel for each row execute function public.record_personnel_events();
create trigger trg_events_upd after update on public.personnel for each row execute function public.record_personnel_events();

create or replace function public.set_request_context() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_table_name = 'promotion_requests' then
    select department_id, rank_id into new.department_id, new.current_rank_id from personnel where user_id = new.applicant_id;
  elsif tg_table_name = 'leave_requests' then
    select department_id, rank_id into new.department_id, new.rank_id from personnel where user_id = new.applicant_id;
  elsif tg_table_name = 'disciplinary_records' then
    select department_id, rank_id into new.department_id, new.rank_id from personnel where user_id = new.subject_id;
    new.issued_by := coalesce(auth.uid(), new.issued_by);
  end if;
  return new;
end $$;
create trigger trg_ctx before insert on public.promotion_requests for each row execute function public.set_request_context();
create trigger trg_ctx before insert on public.leave_requests for each row execute function public.set_request_context();
create trigger trg_ctx before insert on public.disciplinary_records for each row execute function public.set_request_context();

create or replace function public.stamp_review() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if old.status = 'pending' and new.status in ('approved','rejected') then
    new.reviewed_by := auth.uid();
    new.reviewed_at := now();
  end if;
  return new;
end $$;
create trigger trg_review before update on public.promotion_requests for each row execute function public.stamp_review();
create trigger trg_review before update on public.leave_requests for each row execute function public.stamp_review();

create or replace function public.stamp_author_decision() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  new.issued_by := coalesce(auth.uid(), new.issued_by);
  return new;
end $$;
create trigger trg_author before insert on public.decisions for each row execute function public.stamp_author_decision();

create or replace function public.stamp_author_content() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  new.author_id := coalesce(auth.uid(), new.author_id);
  if new.status = 'published' and new.published_at is null then new.published_at := now(); end if;
  return new;
end $$;
create trigger trg_author before insert on public.announcements for each row execute function public.stamp_author_content();
create trigger trg_author before insert on public.news_updates for each row execute function public.stamp_author_content();

create or replace function public.stamp_published_at() returns trigger
language plpgsql as $$
begin
  if new.status = 'published' and new.published_at is null then new.published_at := now(); end if;
  return new;
end $$;
create trigger trg_pub before update on public.announcements for each row execute function public.stamp_published_at();
create trigger trg_pub before update on public.news_updates for each row execute function public.stamp_published_at();

-- ───────────────── notifications ─────────────────
create or replace function public.notify_users(p_users uuid[], p_type text, p_title text, p_body text,
  p_link text, p_table text, p_ref uuid) returns void
language sql security definer set search_path = public as $$
  insert into notifications (user_id, type, title, body, link, ref_table, ref_id)
  select u, p_type, p_title, p_body, p_link, p_table, p_ref from unnest(p_users) u
$$;

create or replace function public.notify_on_publish() returns trigger
language plpgsql security definer set search_path = public as $$
declare ids uuid[]; kind text; lnk text;
begin
  select coalesce(array_agg(pe.user_id), '{}') into ids
  from personnel pe join profiles pr on pr.id = pe.user_id
  where pr.is_active and pe.service_status <> 'terminated'
    and public.is_targeted(pe.user_id, new.target_department_id, new.target_rank_ids, new.target_user_ids);
  kind := case tg_table_name when 'decisions' then 'decision' else 'announcement' end;
  lnk := case tg_table_name when 'decisions' then '/app/decisions' else '/app/announcements' end;
  perform public.notify_users(ids, kind,
    case kind when 'decision' then 'قرار جديد: ' else 'إعلان جديد: ' end || new.title,
    null, lnk, tg_table_name, new.id);
  return null;
end $$;
create trigger trg_notify_ins after insert on public.announcements for each row when (new.status = 'published') execute function public.notify_on_publish();
create trigger trg_notify_upd after update on public.announcements for each row when (new.status = 'published' and old.status is distinct from 'published') execute function public.notify_on_publish();
create trigger trg_notify_ins after insert on public.decisions for each row when (new.status = 'published') execute function public.notify_on_publish();
create trigger trg_notify_upd after update on public.decisions for each row when (new.status = 'published' and old.status is distinct from 'published') execute function public.notify_on_publish();

create or replace function public.notify_request_result() returns trigger
language plpgsql security definer set search_path = public as $$
declare label text;
begin
  if old.status = 'pending' and new.status in ('approved','rejected') then
    label := case tg_table_name when 'promotion_requests' then 'طلب الترقية' else 'طلب الإجازة' end;
    perform public.notify_users(array[new.applicant_id], 'request_result',
      label || (case new.status when 'approved' then ' — تم القبول' else ' — تم الرفض' end),
      new.review_reason, '/app/requests', tg_table_name, new.id);
  end if;
  return null;
end $$;
create trigger trg_notify after update on public.promotion_requests for each row execute function public.notify_request_result();
create trigger trg_notify after update on public.leave_requests for each row execute function public.notify_request_result();

create or replace function public.notify_personnel_event() returns trigger
language plpgsql security definer set search_path = public as $$
declare title text;
begin
  title := case new.event_type
    when 'promotion' then 'تمت ترقيتك' when 'demotion' then 'تم تخفيض رتبتك'
    when 'transfer' then 'تم نقلك إلى قسم آخر' when 'suspension' then 'تم إيقافك عن الخدمة'
    when 'termination' then 'تم إنهاء خدمتك' when 'reinstatement' then 'تمت إعادة تفعيل خدمتك'
    when 'assignment' then 'صدر تكليف جديد' else null end;
  if title is not null then
    perform public.notify_users(array[new.user_id], 'personnel', title, new.reason, '/app/profile', 'personnel_events', new.id);
  end if;
  return null;
end $$;
create trigger trg_notify after insert on public.personnel_events for each row execute function public.notify_personnel_event();

create or replace function public.notify_discipline() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  perform public.notify_users(array[new.subject_id], 'discipline', 'تم تسجيل عقوبة في ملفك', new.violation_type, '/app/profile', 'disciplinary_records', new.id);
  return null;
end $$;
create trigger trg_notify after insert on public.disciplinary_records for each row execute function public.notify_discipline();

-- ───────────────── RLS ─────────────────
do $$
declare t text;
begin
  for t in select tablename from pg_tables where schemaname = 'public' loop
    execute format('alter table public.%I enable row level security', t);
  end loop;
end $$;

revoke all on all tables in schema public from anon;
grant select on public.ranks, public.departments, public.law_categories, public.laws, public.decisions,
  public.announcements, public.news_updates, public.site_settings to anon;
grant insert on public.password_reset_requests to anon;

revoke update, delete on public.audit_logs, public.stock_movements, public.personnel_events from authenticated;
revoke insert on public.audit_logs, public.notifications from authenticated;
revoke update on public.notifications from authenticated;
grant update (is_read, read_at) on public.notifications to authenticated;

-- policy factory: insert/update/delete gated by  <resource>.<action>
create or replace function public._mk_policies(t text, res text, dept_expr text) returns void
language plpgsql as $$
begin
  execute format('create policy %I on public.%I for insert to authenticated with check (public.has_perm(%L, %s))', t||'_ins', t, res||'.create', dept_expr);
  execute format('create policy %I on public.%I for update to authenticated using (public.has_perm(%L, %s)) with check (public.has_perm(%L, %s))', t||'_upd', t, res||'.update', dept_expr, res||'.update', dept_expr);
  execute format('create policy %I on public.%I for delete to authenticated using (public.has_perm(%L, %s))', t||'_del', t, res||'.delete', dept_expr);
end $$;

-- public structure
create policy ranks_sel on public.ranks for select to anon, authenticated using (true);
select public._mk_policies('ranks', 'ranks', 'null');
create policy departments_sel on public.departments for select to anon, authenticated using (true);
select public._mk_policies('departments', 'departments', 'id');
create policy law_categories_sel on public.law_categories for select to anon, authenticated using (true);
select public._mk_policies('law_categories', 'laws', 'null');

-- identity
create policy profiles_sel on public.profiles for select to authenticated
  using (id = auth.uid() or public.is_active_user());
create policy profiles_ins on public.profiles for insert to authenticated with check (public.has_perm('users.create'));
create policy profiles_upd on public.profiles for update to authenticated
  using (id = auth.uid() or public.has_perm('users.update'))
  with check (id = auth.uid() or public.has_perm('users.update'));

create policy personnel_sel on public.personnel for select to authenticated
  using (user_id = auth.uid() or public.has_perm('personnel.view', department_id));
create policy personnel_ins on public.personnel for insert to authenticated
  with check (user_id <> auth.uid() and public.has_perm('personnel.create', department_id));
create policy personnel_upd on public.personnel for update to authenticated
  using (user_id <> auth.uid() and public.has_perm('personnel.update', department_id))
  with check (user_id <> auth.uid() and public.has_perm('personnel.update', department_id));
create policy personnel_del on public.personnel for delete to authenticated
  using (user_id <> auth.uid() and public.has_perm('personnel.delete', department_id));

create policy personnel_events_sel on public.personnel_events for select to authenticated
  using (user_id = auth.uid() or public.has_perm('personnel.view', public.user_dept(user_id)));
create policy personnel_events_ins on public.personnel_events for insert to authenticated
  with check (public.has_perm('personnel.update', public.user_dept(user_id)) and user_id <> auth.uid());

-- RBAC (a user can never grant roles to themselves)
create policy roles_sel on public.roles for select to authenticated using (public.has_perm('roles.view'));
select public._mk_policies('roles', 'roles', 'null');
create policy permissions_sel on public.permissions for select to authenticated using (public.has_perm('roles.view'));
create policy role_permissions_sel on public.role_permissions for select to authenticated using (public.has_perm('roles.view'));
select public._mk_policies('role_permissions', 'roles', 'null');
create policy user_roles_sel on public.user_roles for select to authenticated
  using (user_id = auth.uid() or public.has_perm('roles.view') or public.has_perm('users.view'));
create policy user_roles_ins on public.user_roles for insert to authenticated
  with check (user_id <> auth.uid() and public.has_perm('roles.update'));
create policy user_roles_del on public.user_roles for delete to authenticated
  using (user_id <> auth.uid() and public.has_perm('roles.update'));

-- laws
create policy laws_sel_anon on public.laws for select to anon
  using (status = 'published' and is_public and not restricted);
create policy laws_sel on public.laws for select to authenticated using (
  public.has_perm('laws.update', department_id)
  or (status = 'published' and public.is_active_user()
      and (department_id is null or department_id = public.own_dept())
      and (not restricted or public.has_perm('laws.view')))
);
select public._mk_policies('laws', 'laws', 'department_id');

-- decisions
create policy decisions_sel_anon on public.decisions for select to anon using (status = 'published' and is_public);
create policy decisions_sel on public.decisions for select to authenticated using (
  public.has_perm('decisions.view', target_department_id)
  or (status = 'published' and public.is_active_user()
      and public.is_targeted(auth.uid(), target_department_id, target_rank_ids, target_user_ids))
);
create policy decisions_ins on public.decisions for insert to authenticated with check (
  public.has_perm('decisions.create', target_department_id)
  and (status <> 'published' or public.has_perm('decisions.approve', target_department_id)));
create policy decisions_upd on public.decisions for update to authenticated
  using (public.has_perm('decisions.update', target_department_id))
  with check (public.has_perm('decisions.update', target_department_id)
    and (status <> 'published' or public.has_perm('decisions.approve', target_department_id)));
create policy decisions_del on public.decisions for delete to authenticated using (public.has_perm('decisions.delete', target_department_id));

-- announcements
create policy announcements_sel_anon on public.announcements for select to anon
  using (status = 'published' and is_public and (expires_at is null or expires_at > now()));
create policy announcements_sel on public.announcements for select to authenticated using (
  public.has_perm('announcements.view', target_department_id)
  or (status = 'published' and (expires_at is null or expires_at > now()) and public.is_active_user()
      and public.is_targeted(auth.uid(), target_department_id, target_rank_ids, target_user_ids))
);
select public._mk_policies('announcements', 'announcements', 'target_department_id');

-- site
create policy news_sel_anon on public.news_updates for select to anon using (status = 'published');
create policy news_sel on public.news_updates for select to authenticated
  using (status = 'published' or public.has_perm('site.view'));
select public._mk_policies('news_updates', 'site', 'null');
create policy site_settings_sel on public.site_settings for select to anon, authenticated using (true);
select public._mk_policies('site_settings', 'site', 'null');

-- notifications: own only; created by triggers
create policy notifications_sel on public.notifications for select to authenticated using (user_id = auth.uid());
create policy notifications_upd on public.notifications for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy notifications_del on public.notifications for delete to authenticated using (user_id = auth.uid());

-- requests
create policy promotion_requests_sel on public.promotion_requests for select to authenticated
  using (applicant_id = auth.uid() or public.has_perm('promotions.view', department_id));
create policy promotion_requests_ins on public.promotion_requests for insert to authenticated
  with check (applicant_id = auth.uid() and status = 'pending' and public.is_active_user());
create policy promotion_requests_rev on public.promotion_requests for update to authenticated
  using (applicant_id <> auth.uid() and public.has_perm('promotions.approve', department_id))
  with check (applicant_id <> auth.uid() and public.has_perm('promotions.approve', department_id));
create policy promotion_requests_cancel on public.promotion_requests for update to authenticated
  using (applicant_id = auth.uid() and status = 'pending')
  with check (applicant_id = auth.uid() and status in ('pending','cancelled'));

create policy leave_requests_sel on public.leave_requests for select to authenticated
  using (applicant_id = auth.uid() or public.has_perm('leaves.view', department_id));
create policy leave_requests_ins on public.leave_requests for insert to authenticated
  with check (applicant_id = auth.uid() and status = 'pending' and public.is_active_user());
create policy leave_requests_rev on public.leave_requests for update to authenticated
  using (applicant_id <> auth.uid() and public.has_perm('leaves.approve', department_id))
  with check (applicant_id <> auth.uid() and public.has_perm('leaves.approve', department_id));

create policy disciplinary_sel on public.disciplinary_records for select to authenticated
  using (subject_id = auth.uid() or public.has_perm('discipline.view', department_id));
create policy disciplinary_ins on public.disciplinary_records for insert to authenticated
  with check (subject_id <> auth.uid() and public.has_perm('discipline.create', public.user_dept(subject_id)));
create policy disciplinary_upd on public.disciplinary_records for update to authenticated
  using (public.has_perm('discipline.update', department_id)) with check (public.has_perm('discipline.update', department_id));
create policy disciplinary_del on public.disciplinary_records for delete to authenticated
  using (public.has_perm('discipline.delete', department_id));

-- warehouses & custody
create policy warehouses_sel on public.warehouses for select to authenticated using (public.has_perm('warehouses.view', department_id));
select public._mk_policies('warehouses', 'warehouses', 'department_id');
create policy inventory_items_sel on public.inventory_items for select to authenticated
  using (public.has_perm('inventory.view', public.wh_dept(warehouse_id)));
select public._mk_policies('inventory_items', 'inventory', 'public.wh_dept(warehouse_id)');
create policy assets_sel on public.assets for select to authenticated using (public.has_perm('inventory.view', public.item_dept(item_id)));
select public._mk_policies('assets', 'inventory', 'public.item_dept(item_id)');

create policy custody_sel on public.custody_records for select to authenticated
  using (holder_id = auth.uid() or public.has_perm('custody.view', public.item_dept(item_id)));
create policy custody_ins on public.custody_records for insert to authenticated
  with check (issued_by = auth.uid() and public.has_perm('custody.create', public.item_dept(item_id)));
create policy custody_upd on public.custody_records for update to authenticated
  using (public.has_perm('custody.update', public.item_dept(item_id)))
  with check (public.has_perm('custody.update', public.item_dept(item_id)));

create policy stock_sel on public.stock_movements for select to authenticated
  using (public.has_perm('inventory.view', public.item_dept(item_id)));
create policy stock_ins on public.stock_movements for insert to authenticated
  with check (performed_by = auth.uid()
    and public.has_perm('inventory.create', public.item_dept(item_id))
    and (to_warehouse_id is null or public.has_perm('inventory.create', public.wh_dept(to_warehouse_id))));

-- intelligence: regular users may only file a report, never read cases
create policy cases_sel on public.cases for select to authenticated using (public.has_perm('cases.view'));
create policy cases_ins on public.cases for insert to authenticated with check (
  public.has_perm('cases.create')
  or (reported_by = auth.uid() and case_type = 'report' and status = 'open' and public.is_active_user()));
create policy cases_upd on public.cases for update to authenticated
  using (public.has_perm('cases.update')) with check (public.has_perm('cases.update'));
create policy cases_del on public.cases for delete to authenticated using (public.has_perm('cases.delete'));

create policy investigations_sel on public.investigations for select to authenticated using (public.has_perm('investigations.view'));
select public._mk_policies('investigations', 'investigations', 'null');
create policy evidence_sel on public.evidence for select to authenticated using (public.has_perm('investigations.view'));
select public._mk_policies('evidence', 'investigations', 'null');
create policy statements_sel on public.statements for select to authenticated using (public.has_perm('investigations.view'));
select public._mk_policies('statements', 'investigations', 'null');

-- audit: read-only for auditors, written only by trigger
create policy audit_sel on public.audit_logs for select to authenticated using (public.has_perm('audit.view'));

-- forgot-password requests (accounts use internal emails, so resets are admin-handled)
create policy pwreq_ins on public.password_reset_requests for insert to anon, authenticated
  with check (status = 'pending' and handled_by is null);
create policy pwreq_sel on public.password_reset_requests for select to authenticated using (public.has_perm('users.view'));
create policy pwreq_upd on public.password_reset_requests for update to authenticated
  using (public.has_perm('users.update')) with check (public.has_perm('users.update'));
grant select, update on public.password_reset_requests to authenticated;

drop function public._mk_policies(text, text, text);
