-- ============================================================
-- NNNT-CRM — Nem Nướng Nha Trang Internal Webapp
-- Supabase / PostgreSQL schema (MVP) — theo guideline mục 10
-- ============================================================

create extension if not exists "pgcrypto";

-- 10.1 profiles
create table if not exists profiles (
  id uuid primary key,
  full_name text,
  email text unique,
  role text default 'sale' check (role in ('admin','manager','sale','warehouse_hn','factory_da','accountant')),
  base_salary numeric default 0,
  commission_pct numeric default 5,
  region text,
  status text default 'active',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- 10.2 customers + branches
create table if not exists customers (
  id uuid primary key default gen_random_uuid(),
  customer_code text unique not null,
  full_name text not null,
  customer_group text check (customer_group in ('quan_an','npp','sieu_thi','minimart','nha_hang','le')),
  region text,
  assigned_sale_id uuid references profiles(id),
  source text,
  status text default 'active',
  note text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists customer_branches (
  id uuid primary key default gen_random_uuid(),
  branch_code text unique not null,
  customer_id uuid references customers(id) on delete restrict,
  branch_name text,
  address text not null,
  phone text,
  status text default 'active',
  est_next_order_date date,
  avg_order_gap_days int,
  last_order_date date,
  created_at timestamptz default now()
);

-- 10.3 products
create table if not exists products (
  id uuid primary key default gen_random_uuid(),
  sku text unique not null,
  name text not null,
  unit text default 'kg',
  default_price numeric default 0,
  fix_cost numeric default 0,
  is_active boolean default true,
  created_at timestamptz default now()
);

-- 10.4 orders + order_items + receipts
create table if not exists orders (
  id uuid primary key default gen_random_uuid(),
  order_code text unique not null,
  order_date date not null,
  customer_id uuid references customers(id),
  branch_id uuid references customer_branches(id),
  sale_id uuid references profiles(id),
  ship_fee numeric default 0,
  discount_special numeric default 0,
  discount_monthly_pct numeric default 0,
  discount_early_pay_pct numeric default 0,
  revenue numeric default 0,
  revenue_net numeric default 0,
  cost numeric default 0,
  sale_commission_pct numeric default 5,
  sale_commission numeric default 0,
  profit_net numeric default 0,
  payment_status text default 'chua_ck' check (payment_status in ('cash_done','da_ck','chua_ck','cong_no','tang')),
  status text default 'active' check (status in ('active','cancelled')),
  cancel_reason text,
  note text,
  created_at timestamptz default now()
);

create table if not exists order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid references orders(id) on delete cascade,
  product_id uuid references products(id),
  quantity numeric not null,
  unit_price numeric default 0,
  is_gift boolean default false,
  fix_cost_unit numeric default 0,
  line_revenue numeric default 0,
  line_cost numeric default 0
);

create table if not exists receipts (
  id uuid primary key default gen_random_uuid(),
  receipt_code text unique not null,
  order_id uuid references orders(id) on delete set null,
  customer_id uuid references customers(id),
  amount numeric not null default 0,
  payment_method text,
  receipt_date date,
  status text default 'pending' check (status in ('pending','waiting_admin','approved','rejected','cancelled')),
  approved_by uuid references profiles(id),
  approved_at timestamptz,
  debt_statement_id uuid,
  note text,
  created_at timestamptz default now()
);

create table if not exists debt_statements (
  id uuid primary key default gen_random_uuid(),
  code text unique not null,
  customer_id uuid references customers(id),
  period_month text,
  opening_balance numeric default 0,
  total_due numeric default 0,
  total_paid numeric default 0,
  closing_balance numeric default 0,
  status text default 'open' check (status in ('open','closed')),
  created_at timestamptz default now()
);

-- 10.5 leads + visits
create table if not exists leads (
  id uuid primary key default gen_random_uuid(),
  lead_code text unique not null,
  sale_id uuid references profiles(id),
  customer_name text,
  region text,
  customer_group text,
  phone text,
  offered_price numeric,
  offered_gift_program text,
  offered_discount_program text,
  expected_revenue numeric,
  sample_qty_total numeric default 0,
  sample_cost_total numeric default 0,
  lead_status text default 'kem' check (lead_status in ('kem','trung_binh','tiem_nang','dang_chot','da_chot','mat')),
  converted_customer_id uuid references customers(id),
  converted_at timestamptz,
  created_at timestamptz default now()
);

create table if not exists lead_addresses (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid references leads(id) on delete cascade,
  address text,
  note text
);

create table if not exists lead_visits (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid references leads(id) on delete cascade,
  visit_date date not null,
  visit_type text,
  content text,
  next_action_date date,
  next_action_note text,
  new_sample_json jsonb,
  created_by uuid references profiles(id),
  created_at timestamptz default now()
);

-- 10.6 materials + recipe + production
create table if not exists materials (
  id uuid primary key default gen_random_uuid(),
  name text unique not null,
  unit text default 'kg',
  unit_price numeric default 0,
  warning_days int default 3,
  is_active boolean default true
);

create table if not exists material_inventory (
  id uuid primary key default gen_random_uuid(),
  material_id uuid references materials(id),
  qty numeric default 0,
  updated_at timestamptz default now()
);

create table if not exists production_recipe (
  id uuid primary key default gen_random_uuid(),
  material_id uuid references materials(id),
  batch1_rate numeric default 0,
  batch2_rate numeric default 0,
  note text
);

create table if not exists production_days (
  id uuid primary key default gen_random_uuid(),
  production_code text unique not null,
  production_date date unique not null,
  batch1_count numeric default 0,
  batch2_count numeric default 0,
  output_kg numeric default 0,
  transfer_to_cl_kg numeric default 0,
  factory_stock_kg_end numeric default 0,
  loss_kg numeric default 0,
  loss_pct numeric default 0,
  cost_per_kg numeric default 0,
  extra_cost_factory numeric default 0,
  status text default 'open' check (status in ('open','closed')),
  closed_by uuid references profiles(id),
  closed_at timestamptz,
  note text
);

create table if not exists material_usage (
  id uuid primary key default gen_random_uuid(),
  production_day_id uuid references production_days(id) on delete cascade,
  material_id uuid references materials(id),
  used_qty numeric default 0,
  unit_price_at_use numeric default 0,
  total_cost numeric default 0
);

create table if not exists recovery_logs (
  id uuid primary key default gen_random_uuid(),
  log_date date not null,
  product_id uuid references products(id),      -- recover về tồn kho xưởng
  qty_kg numeric default 0,
  note text,
  created_by uuid references profiles(id)
);

create table if not exists destruction_logs (
  id uuid primary key default gen_random_uuid(),
  log_date date not null,
  product_id uuid references products(id),
  warehouse text default 'factory' check (warehouse in ('factory','cl')),
  qty_kg numeric default 0,
  unit_cost numeric default 0,                  -- = fix_cost sản phẩm
  total_loss numeric default 0,                 -- = fix_cost × qty (giá trị phiếu chi)
  reason text,
  expense_id uuid,
  created_by uuid references profiles(id)
);

-- Phiếu chi (vd: tiêu huỷ thành phẩm)
create table if not exists expenses (
  id uuid primary key default gen_random_uuid(),
  code text unique not null,                    -- PC-2026-000001
  date date not null,
  type text default 'other' check (type in ('destruction','factory_extra','shipping','materials','marketing','utilities','salary','other')),
  amount numeric default 0,
  payment_method text check (payment_method in ('cash','bank_transfer')),
  payee text,
  note text,
  ref_id uuid,
  created_by uuid references profiles(id),
  created_at timestamptz default now()
);

create table if not exists stock_transfers (
  id uuid primary key default gen_random_uuid(),
  transfer_code text unique not null,
  transfer_date date not null,
  product_id uuid references products(id),
  qty_kg numeric default 0,
  status text default 'pending' check (status in ('pending','received','cancelled')),
  received_by uuid references profiles(id),
  received_at timestamptz,
  note text
);

-- Tồn kho thành phẩm Hà Nội (CL) — bán hàng trừ từ đây
create table if not exists cl_inventory (
  id uuid primary key default gen_random_uuid(),
  product_id uuid references products(id),
  qty_kg numeric default 0,
  updated_at timestamptz default now()
);

-- Tồn kho thành phẩm Xưởng Đông Anh — sản xuất + recover cộng vào, chuyển kho trừ ra
create table if not exists factory_inventory (
  id uuid primary key default gen_random_uuid(),
  product_id uuid references products(id),
  qty_kg numeric default 0,
  updated_at timestamptz default now()
);

-- 10.7 HRM
create table if not exists payroll_periods (
  id uuid primary key default gen_random_uuid(),
  period_year int not null,
  period_month int not null,
  status text default 'draft' check (status in ('draft','approved','locked')),
  approved_by uuid references profiles(id),
  approved_at timestamptz,
  unique (period_year, period_month)
);

create table if not exists payroll_lines (
  id uuid primary key default gen_random_uuid(),
  period_id uuid references payroll_periods(id) on delete cascade,
  profile_id uuid references profiles(id),
  base_salary numeric default 0,
  commission_amount numeric default 0,
  cross_commission numeric default 0,
  new_customer_bonus numeric default 0,
  extra_batches_bonus numeric default 0,
  attitude_bonus numeric default 0,
  other_bonus numeric default 0,
  off_day_deduction numeric default 0,
  total numeric default 0,
  note text
);

create table if not exists attendance (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid references profiles(id),
  work_date date not null,
  status text default 'work' check (status in ('work','off_paid','off_unpaid','half')),
  note text,
  unique (profile_id, work_date)
);

-- new_customer_credits (đếm khách mới qualified 3 tháng)
create table if not exists new_customer_credits (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid references customers(id),
  sale_id uuid references profiles(id),
  start_month text,
  qualifying_month text,
  bonus_amount numeric default 100000,
  status text default 'pending_qualification' check (status in ('pending_qualification','qualified','cancelled')),
  created_at timestamptz default now()
);

-- 10.8 settings + audit
create table if not exists settings (
  id uuid primary key default gen_random_uuid(),
  key text unique not null,
  value text,
  note text,
  updated_at timestamptz default now()
);

create table if not exists audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references profiles(id),
  action text,
  entity text,
  entity_id uuid,
  diff jsonb,
  created_at timestamptz default now()
);

-- Indexes
create index if not exists idx_orders_branch on orders(branch_id);
create index if not exists idx_orders_sale on orders(sale_id);
create index if not exists idx_orders_date on orders(order_date);
create index if not exists idx_receipts_order on receipts(order_id);
create index if not exists idx_receipts_status on receipts(status);
create index if not exists idx_expenses_date on expenses(date);
create index if not exists idx_branches_customer on customer_branches(customer_id);
create index if not exists idx_leads_sale on leads(sale_id);
create index if not exists idx_visits_lead on lead_visits(lead_id);
create index if not exists idx_usage_day on material_usage(production_day_id);
create index if not exists idx_attendance_profile_date on attendance(profile_id, work_date);

-- Seed config
insert into settings (key, value, note) values
  ('default_commission_pct', '5',       '% hoa hồng sale mặc định'),
  ('default_early_pay_pct',  '2',       '% CK trả sớm mặc định'),
  ('new_customer_bonus',     '100000',  'Thưởng khách mới qualified'),
  ('attitude_bonus',         '1000000', 'Thưởng thái độ'),
  ('factory_batch_threshold','10',      'Mẻ thường / ngày'),
  ('factory_extra_bonus',    '150000',  'Bồi dưỡng mẻ vượt'),
  ('cross_commission_pct',   '1',       'HH chéo kho HN'),
  ('nvl_warning_days',       '3',       'Cảnh báo NVL còn < N ngày')
on conflict (key) do nothing;
