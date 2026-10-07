-- ============================================================
-- Supabase Auth setup — chạy sau supabase-schema.sql (idempotent)
-- ============================================================

-- Cột còn thiếu so với type Profile của app
alter table profiles add column if not exists debt_commission_pct numeric;
alter table profiles add column if not exists factory_level text;

-- RLS: bật cho mọi bảng. Bảng chưa có policy = chặn toàn bộ anon/authenticated
-- (app hiện vẫn dùng mock data cho phần nghiệp vụ; sẽ thêm policy khi chuyển từng module).
do $$
declare t record;
begin
  for t in select tablename from pg_tables where schemaname = 'public' loop
    execute format('alter table public.%I enable row level security', t.tablename);
  end loop;
end $$;

-- profiles: user đã đăng nhập đọc được danh sách; chỉ admin được sửa
create or replace function public.current_role_name() returns text
language sql stable security definer set search_path = public as
$$ select role from public.profiles where id = auth.uid() $$;

drop policy if exists profiles_read on profiles;
create policy profiles_read on profiles for select to authenticated using (true);

drop policy if exists profiles_admin_write on profiles;
create policy profiles_admin_write on profiles for all to authenticated
  using (public.current_role_name() = 'admin')
  with check (public.current_role_name() = 'admin');

-- Tài khoản: tạo qua Dashboard → Authentication → Users (hoặc Admin API), rồi thêm dòng
-- tương ứng vào profiles với id = auth.users.id, ví dụ:
--   insert into profiles (id, full_name, email, role) select id, 'Quản trị viên', email, 'admin' from auth.users where email = 'admin@nnnt.vn';

