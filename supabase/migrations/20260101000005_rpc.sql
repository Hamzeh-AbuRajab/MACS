-- MACS 005: atomic workflows. All SECURITY INVOKER, so RLS + guard triggers still apply.

create or replace function public.change_personnel(
  p_user uuid, p_rank uuid default null, p_department uuid default null, p_set_department boolean default false,
  p_status text default null, p_reason text default null) returns void
language plpgsql set search_path = public as $$
begin
  perform set_config('macs.reason', coalesce(p_reason, ''), true);
  update personnel set
    rank_id = coalesce(p_rank, rank_id),
    department_id = case when p_set_department then p_department else department_id end,
    service_status = coalesce(p_status, service_status)
  where user_id = p_user;
  if not found then raise exception 'لا يوجد ملف عسكري أو لا تملك صلاحية التعديل'; end if;
end $$;

create or replace function public.review_promotion(p_id uuid, p_approve boolean, p_reason text) returns void
language plpgsql set search_path = public as $$
declare r promotion_requests%rowtype;
begin
  select * into r from promotion_requests where id = p_id and status = 'pending';
  if not found then raise exception 'الطلب غير موجود أو تمت مراجعته'; end if;
  update promotion_requests set status = case when p_approve then 'approved' else 'rejected' end, review_reason = p_reason
   where id = p_id;
  if not found then raise exception 'لا تملك صلاحية مراجعة هذا الطلب'; end if;
  if p_approve and r.requested_rank_id is not null then
    perform public.change_personnel(r.applicant_id, r.requested_rank_id, null, false, null, coalesce(nullif(p_reason, ''), 'اعتماد طلب ترقية'));
  end if;
end $$;

create or replace function public.review_leave(p_id uuid, p_approve boolean, p_reason text) returns void
language plpgsql set search_path = public as $$
begin
  update leave_requests set status = case when p_approve then 'approved' else 'rejected' end, review_reason = p_reason
   where id = p_id and status = 'pending';
  if not found then raise exception 'الطلب غير موجود أو تمت مراجعته أو لا تملك صلاحية'; end if;
end $$;

create or replace function public.stock_move(p_item uuid, p_type text, p_qty int, p_to uuid default null, p_reason text default null)
returns void language plpgsql set search_path = public as $$
declare it inventory_items%rowtype;
begin
  if p_reason is null or length(trim(p_reason)) = 0 then raise exception 'السبب مطلوب'; end if;
  select * into it from inventory_items where id = p_item for update;
  if not found then raise exception 'الصنف غير موجود أو لا تملك صلاحية'; end if;

  if p_type = 'in' then
    if p_qty <= 0 then raise exception 'الكمية يجب أن تكون أكبر من صفر'; end if;
    update inventory_items set quantity = quantity + p_qty where id = p_item;
    if not found then raise exception 'لا تملك صلاحية التعديل'; end if;
    insert into stock_movements (item_id, movement_type, quantity, to_warehouse_id, performed_by, reason)
      values (p_item, 'in', p_qty, it.warehouse_id, auth.uid(), p_reason);
  elsif p_type = 'out' then
    if p_qty <= 0 or p_qty > it.quantity then raise exception 'الكمية غير صالحة أو أكبر من المتوفر'; end if;
    update inventory_items set quantity = quantity - p_qty where id = p_item;
    if not found then raise exception 'لا تملك صلاحية التعديل'; end if;
    insert into stock_movements (item_id, movement_type, quantity, from_warehouse_id, performed_by, reason)
      values (p_item, 'out', p_qty, it.warehouse_id, auth.uid(), p_reason);
  elsif p_type = 'transfer' then
    if p_to is null or p_to = it.warehouse_id then raise exception 'مستودع الوجهة غير صالح'; end if;
    if p_qty <= 0 or p_qty > it.quantity then raise exception 'الكمية غير صالحة أو أكبر من المتوفر'; end if;
    update inventory_items set quantity = quantity - p_qty where id = p_item;
    if not found then raise exception 'لا تملك صلاحية التعديل'; end if;
    insert into inventory_items (warehouse_id, sku, name, category, quantity, min_quantity, unit, serial_tracked)
      values (p_to, it.sku, it.name, it.category, p_qty, it.min_quantity, it.unit, it.serial_tracked)
      on conflict (warehouse_id, sku) do update set quantity = inventory_items.quantity + excluded.quantity;
    insert into stock_movements (item_id, movement_type, quantity, from_warehouse_id, to_warehouse_id, performed_by, reason)
      values (p_item, 'transfer', p_qty, it.warehouse_id, p_to, auth.uid(), p_reason);
  elsif p_type = 'stocktake' then
    if p_qty < 0 then raise exception 'الكمية المعدودة غير صالحة'; end if;
    update inventory_items set quantity = p_qty where id = p_item;
    if not found then raise exception 'لا تملك صلاحية التعديل'; end if;
    insert into stock_movements (item_id, movement_type, quantity, expected_qty, counted_qty, to_warehouse_id, performed_by, reason)
      values (p_item, 'stocktake', p_qty - it.quantity, it.quantity, p_qty, it.warehouse_id, auth.uid(), p_reason);
  else
    raise exception 'نوع حركة غير معروف';
  end if;
end $$;

create or replace function public.issue_custody(p_item uuid, p_holder uuid, p_qty int, p_asset uuid, p_reason text)
returns void language plpgsql set search_path = public as $$
declare it inventory_items%rowtype;
begin
  if p_reason is null or length(trim(p_reason)) = 0 then raise exception 'السبب مطلوب'; end if;
  select * into it from inventory_items where id = p_item for update;
  if not found then raise exception 'الصنف غير موجود أو لا تملك صلاحية'; end if;
  if p_qty <= 0 or p_qty > it.quantity then raise exception 'الكمية غير متوفرة'; end if;
  if p_asset is not null then
    update assets set status = 'assigned' where id = p_asset and item_id = p_item and status = 'available';
    if not found then raise exception 'الرقم التسلسلي غير متاح'; end if;
  end if;
  update inventory_items set quantity = quantity - p_qty where id = p_item;
  insert into custody_records (item_id, asset_id, holder_id, quantity, reason, issued_by)
    values (p_item, p_asset, p_holder, p_qty, p_reason, auth.uid());
  insert into stock_movements (item_id, movement_type, quantity, from_warehouse_id, performed_by, reason)
    values (p_item, 'custody_issue', p_qty, it.warehouse_id, auth.uid(), p_reason);
end $$;

create or replace function public.return_custody(p_id uuid, p_reason text default 'إرجاع عهدة') returns void
language plpgsql set search_path = public as $$
declare c custody_records%rowtype; wh uuid;
begin
  select * into c from custody_records where id = p_id and status = 'active' for update;
  if not found then raise exception 'العهدة غير موجودة أو أُرجعت مسبقاً'; end if;
  update custody_records set status = 'returned', returned_at = now(), returned_to = auth.uid() where id = p_id;
  if not found then raise exception 'لا تملك صلاحية'; end if;
  if c.asset_id is not null then update assets set status = 'available' where id = c.asset_id; end if;
  update inventory_items set quantity = quantity + c.quantity where id = c.item_id returning warehouse_id into wh;
  insert into stock_movements (item_id, movement_type, quantity, to_warehouse_id, performed_by, reason)
    values (c.item_id, 'custody_return', c.quantity, wh, auth.uid(), coalesce(p_reason, 'إرجاع عهدة'));
end $$;

-- command dashboard aggregates (counts only, no personal data)
create or replace function public.command_stats() returns jsonb
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.has_perm('reports.view') then raise exception 'غير مصرح' using errcode = '42501'; end if;
  return jsonb_build_object(
    'by_status', (select coalesce(jsonb_object_agg(service_status, n), '{}') from (select service_status, count(*) n from personnel group by 1) s),
    'by_department', (select coalesce(jsonb_agg(jsonb_build_object('id', d.id, 'name', d.name_ar, 'n', (select count(*) from personnel p where p.department_id = d.id))), '[]') from departments d),
    'by_rank', (select coalesce(jsonb_agg(jsonb_build_object('name', r.name_ar, 'level', r.level, 'n', (select count(*) from personnel p where p.rank_id = r.id)) order by r.level), '[]') from ranks r),
    'pending_promotions', (select count(*) from promotion_requests where status = 'pending'),
    'pending_leaves', (select count(*) from leave_requests where status = 'pending'),
    'open_cases', (select count(*) from cases where status in ('open','under_investigation')),
    'discipline_30d', (select count(*) from disciplinary_records where issued_at > now() - interval '30 days'),
    'draft_decisions', (select count(*) from decisions where status = 'draft')
  );
end $$;
