-- ============================================================
-- Kho dữ liệu nghiệp vụ dùng chung (thay cho localStorage từng máy).
-- Mỗi bản ghi của app (đơn hàng, khách, NVL, định mức, tồn kho, cấu hình…)
-- là 1 dòng: (collection, id) → data jsonb. Chạy sau supabase-auth.sql (idempotent).
-- ============================================================

create table if not exists public.app_records (
  collection text not null,
  id         text not null,
  data       jsonb not null,
  seq        bigserial,                       -- giữ thứ tự thêm vào
  updated_at timestamptz not null default now(),
  updated_by uuid default auth.uid(),
  primary key (collection, id)
);

create index if not exists idx_app_records_seq on public.app_records (seq);

-- Thành viên đang hoạt động = có hồ sơ active trong profiles
create or replace function public.is_active_member() returns boolean
language sql stable security definer set search_path = public as
$$ select exists (select 1 from public.profiles where id = auth.uid() and status = 'active') $$;

create or replace function public.app_records_touch() returns trigger
language plpgsql as
$$ begin new.updated_at := now(); new.updated_by := auth.uid(); return new; end $$;

drop trigger if exists trg_app_records_touch on public.app_records;
create trigger trg_app_records_touch before update on public.app_records
  for each row execute function public.app_records_touch();

alter table public.app_records enable row level security;

-- Phân quyền chi tiết theo vai trò nằm ở app (lib/permissions.ts);
-- ở DB chỉ cho phép tài khoản đang hoạt động đọc/ghi.
drop policy if exists app_records_select on public.app_records;
create policy app_records_select on public.app_records for select to authenticated
  using (public.is_active_member());

drop policy if exists app_records_insert on public.app_records;
create policy app_records_insert on public.app_records for insert to authenticated
  with check (public.is_active_member());

drop policy if exists app_records_update on public.app_records;
create policy app_records_update on public.app_records for update to authenticated
  using (public.is_active_member()) with check (public.is_active_member());

drop policy if exists app_records_delete on public.app_records;
create policy app_records_delete on public.app_records for delete to authenticated
  using (public.is_active_member());

-- Realtime: các máy khác nhận thay đổi ngay
alter table public.app_records replica identity full;
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'app_records'
  ) then
    alter publication supabase_realtime add table public.app_records;
  end if;
end $$;
