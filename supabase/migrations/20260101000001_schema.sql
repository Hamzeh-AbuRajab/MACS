-- MACS 001: core schema (all phases). Tables only; security in 002.

create or replace function public.touch_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

-- ───────────────── identity ─────────────────
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text not null unique check (username ~ '^[a-z0-9._-]{3,32}$'),
  full_name text not null,
  full_name_en text,
  avatar_url text,
  is_active boolean not null default true,
  last_seen_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.ranks (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name_en text not null,
  name_ar text not null,
  category text not null check (category in ('supreme','officer','nco','enlisted')),
  level int not null unique check (level > 0),          -- 1 = highest
  description text,
  insignia_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.departments (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name_en text not null,
  name_ar text not null,
  description text,
  missions text,
  emblem_url text,
  commander_id uuid references public.profiles(id) on delete set null,
  deputy_id uuid references public.profiles(id) on delete set null,
  sort_order int not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- military data, separate from identity. Rank here grants NO system permissions.
create table public.personnel (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references public.profiles(id) on delete cascade,
  military_number text not null unique,
  rank_id uuid not null references public.ranks(id) on delete restrict,
  department_id uuid references public.departments(id) on delete restrict,
  service_status text not null default 'active'
    check (service_status in ('active','on_leave','suspended','terminated','reserve')),
  joined_at date not null default current_date,
  admin_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on public.personnel (department_id);
create index on public.personnel (rank_id);

-- ───────────────── RBAC ─────────────────
create table public.roles (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name_en text not null,
  name_ar text not null,
  description text,
  scope text not null default 'global' check (scope in ('global','department')),
  is_system boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.permissions (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,                    -- resource.action
  resource text not null,
  action text not null check (action in ('view','create','update','delete','approve')),
  description text
);

create table public.role_permissions (
  role_id uuid not null references public.roles(id) on delete cascade,
  permission_id uuid not null references public.permissions(id) on delete cascade,
  primary key (role_id, permission_id)
);

create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  role_id uuid not null references public.roles(id) on delete cascade,
  granted_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (user_id, role_id)
);

-- ───────────────── content ─────────────────
create table public.law_categories (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name_ar text not null,
  name_en text,
  description text,
  sort_order int not null default 0
);

create table public.laws (
  id uuid primary key default gen_random_uuid(),
  category_id uuid not null references public.law_categories(id) on delete restrict,
  department_id uuid references public.departments(id) on delete set null,
  title text not null,
  content text not null,
  responsible_party text,
  restricted boolean not null default false,    -- needs laws.view
  is_public boolean not null default false,
  status text not null default 'published' check (status in ('draft','published','archived')),
  sort_order int not null default 0,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.decisions (
  id uuid primary key default gen_random_uuid(),
  ref_number text,
  title text not null,
  body text not null,
  decision_type text not null default 'general'
    check (decision_type in ('general','supreme','promotion','appointment','dismissal','transfer','operation','department')),
  importance text not null default 'normal' check (importance in ('normal','important','urgent','critical')),
  status text not null default 'draft' check (status in ('draft','published','archived')),
  target_department_id uuid references public.departments(id) on delete set null,
  target_rank_ids uuid[],
  target_user_ids uuid[],
  is_public boolean not null default false,
  issued_at timestamptz not null default now(),
  issued_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.announcements (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  body text not null,
  image_url text,
  target_department_id uuid references public.departments(id) on delete set null,
  target_rank_ids uuid[],
  target_user_ids uuid[],
  status text not null default 'draft' check (status in ('draft','published','archived')),
  is_public boolean not null default false,
  pinned boolean not null default false,
  published_at timestamptz,
  expires_at timestamptz,
  author_id uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.news_updates (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  summary text,
  body text,
  status text not null default 'draft' check (status in ('draft','published','archived')),
  published_at timestamptz,
  author_id uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.site_settings (
  key text primary key,
  value jsonb not null default '{}'::jsonb,
  updated_by uuid references public.profiles(id) on delete set null,
  updated_at timestamptz not null default now()
);

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  type text not null,
  title text not null,
  body text,
  link text,
  ref_table text,
  ref_id uuid,
  is_read boolean not null default false,
  created_at timestamptz not null default now(),
  read_at timestamptz
);
create index on public.notifications (user_id, is_read, created_at desc);

-- ───────────────── personnel workflows ─────────────────
create table public.personnel_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  event_type text not null check (event_type in
    ('joined','promotion','demotion','transfer','suspension','reinstatement','termination','assignment','note')),
  from_rank_id uuid references public.ranks(id) on delete set null,
  to_rank_id uuid references public.ranks(id) on delete set null,
  from_department_id uuid references public.departments(id) on delete set null,
  to_department_id uuid references public.departments(id) on delete set null,
  reason text,
  decision_id uuid references public.decisions(id) on delete set null,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);
create index on public.personnel_events (user_id, created_at desc);

create table public.promotion_requests (
  id uuid primary key default gen_random_uuid(),
  applicant_id uuid not null references public.profiles(id) on delete cascade,
  department_id uuid references public.departments(id) on delete set null,
  current_rank_id uuid references public.ranks(id) on delete set null,
  requested_rank_id uuid references public.ranks(id) on delete set null,
  justification text not null,
  status text not null default 'pending' check (status in ('pending','approved','rejected','cancelled')),
  reviewed_by uuid references public.profiles(id) on delete set null,
  review_reason text,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.leave_requests (
  id uuid primary key default gen_random_uuid(),
  applicant_id uuid not null references public.profiles(id) on delete cascade,
  department_id uuid references public.departments(id) on delete set null,
  rank_id uuid references public.ranks(id) on delete set null,
  start_date date not null,
  end_date date not null,
  reason text not null,
  status text not null default 'pending' check (status in ('pending','approved','rejected')),
  reviewed_by uuid references public.profiles(id) on delete set null,
  review_reason text,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (end_date >= start_date)
);

create table public.disciplinary_records (
  id uuid primary key default gen_random_uuid(),
  subject_id uuid not null references public.profiles(id) on delete cascade,
  department_id uuid references public.departments(id) on delete set null,
  rank_id uuid references public.ranks(id) on delete set null,
  violation_type text not null,
  description text not null,
  evidence text,
  penalty_type text not null check (penalty_type in
    ('warning','formal_warning','deduction','temporary_suspension','demotion','dismissal','military_trial_referral')),
  penalty_details text,
  issued_by uuid references public.profiles(id) on delete set null,
  issued_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ───────────────── warehouses & custody ─────────────────
create table public.warehouses (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name_ar text not null,
  name_en text,
  kind text not null check (kind in ('main','department','weapons','ammo','equipment','vehicles')),
  department_id uuid references public.departments(id) on delete set null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.inventory_items (
  id uuid primary key default gen_random_uuid(),
  warehouse_id uuid not null references public.warehouses(id) on delete restrict,
  sku text not null,
  name text not null,
  category text,
  quantity int not null default 0 check (quantity >= 0),
  min_quantity int not null default 0,
  unit text not null default 'unit',
  serial_tracked boolean not null default false,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (warehouse_id, sku)
);

create table public.assets (
  id uuid primary key default gen_random_uuid(),
  item_id uuid not null references public.inventory_items(id) on delete restrict,
  serial_number text not null unique,
  status text not null default 'available' check (status in ('available','assigned','maintenance','lost','retired')),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.custody_records (
  id uuid primary key default gen_random_uuid(),
  item_id uuid not null references public.inventory_items(id) on delete restrict,
  asset_id uuid references public.assets(id) on delete restrict,
  holder_id uuid not null references public.profiles(id) on delete restrict,
  quantity int not null default 1 check (quantity > 0),
  reason text not null,
  issued_by uuid not null references public.profiles(id) on delete restrict,
  issued_at timestamptz not null default now(),
  returned_at timestamptz,
  returned_to uuid references public.profiles(id) on delete set null,
  status text not null default 'active' check (status in ('active','returned','lost')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.stock_movements (          -- immutable ledger
  id uuid primary key default gen_random_uuid(),
  item_id uuid not null references public.inventory_items(id) on delete restrict,
  movement_type text not null check (movement_type in
    ('in','out','transfer','custody_issue','custody_return','adjustment','stocktake')),
  quantity int not null,
  from_warehouse_id uuid references public.warehouses(id) on delete restrict,
  to_warehouse_id uuid references public.warehouses(id) on delete restrict,
  expected_qty int,
  counted_qty int,
  performed_by uuid not null references public.profiles(id) on delete restrict,
  reason text not null,
  created_at timestamptz not null default now()
);
create index on public.stock_movements (item_id, created_at desc);

-- ───────────────── intelligence ─────────────────
create table public.cases (
  id uuid primary key default gen_random_uuid(),
  case_number text not null unique default ('C-' || to_char(now(),'YYYYMMDD') || '-' || substr(gen_random_uuid()::text,1,6)),
  title text not null,
  description text,
  case_type text not null default 'case' check (case_type in ('report','case')),
  status text not null default 'open' check (status in ('open','under_investigation','closed','referred')),
  reported_by uuid references public.profiles(id) on delete set null,
  subject_id uuid references public.profiles(id) on delete set null,
  assigned_to uuid references public.profiles(id) on delete set null,
  final_decision text,
  closed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.investigations (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references public.cases(id) on delete cascade,
  lead_investigator_id uuid references public.profiles(id) on delete set null,
  summary text,
  report text,
  status text not null default 'active' check (status in ('active','suspended','completed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.evidence (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references public.cases(id) on delete cascade,
  title text not null,
  description text,
  file_path text,                              -- private 'evidence' bucket
  added_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create table public.statements (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references public.cases(id) on delete cascade,
  witness_id uuid references public.profiles(id) on delete set null,
  witness_name text,
  content text not null,
  taken_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

-- ───────────────── audit & misc ─────────────────
create table public.audit_logs (
  id bigint generated always as identity primary key,
  actor_id uuid,
  action text not null,
  table_name text not null,
  record_id text,
  old_data jsonb,
  new_data jsonb,
  created_at timestamptz not null default now()
);
create index on public.audit_logs (created_at desc);
create index on public.audit_logs (table_name, record_id);

create table public.password_reset_requests (
  id uuid primary key default gen_random_uuid(),
  username text not null check (char_length(username) between 3 and 32),
  note text check (note is null or char_length(note) <= 300),
  status text not null default 'pending' check (status in ('pending','done','dismissed')),
  handled_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

-- updated_at triggers
do $$
declare t text;
begin
  foreach t in array array['profiles','ranks','departments','personnel','roles','laws','decisions',
    'announcements','news_updates','promotion_requests','leave_requests','disciplinary_records',
    'warehouses','inventory_items','assets','custody_records','cases','investigations']
  loop
    execute format('create trigger trg_touch before update on public.%I for each row execute function public.touch_updated_at()', t);
  end loop;
end $$;
