-- ============================================================
-- Quản lý tài khoản từ trang Người dùng (chỉ Admin / Super Admin)
-- + siết quyền ghi dữ liệu nhạy cảm trong app_records.
-- Chạy sau supabase-app-records.sql (idempotent).
-- ============================================================

create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as
$$ select coalesce(public.current_role_name() in ('admin', 'superadmin'), false) $$;

-- Tạo / cập nhật tài khoản đăng nhập + hồ sơ phân quyền (bảng profiles là nguồn quyền thật).
-- p_password: bắt buộc khi tạo mới; truyền null/'' khi sửa để giữ mật khẩu cũ.
-- Ngưng (inactive) → khoá đăng nhập (banned_until) + mất quyền đọc/ghi dữ liệu (RLS).
create or replace function public.admin_upsert_user(
  p_email text,
  p_password text,
  p_full_name text,
  p_role text,
  p_status text default 'active',
  p_base_salary numeric default 0,
  p_commission_pct numeric default 0,
  p_debt_commission_pct numeric default null,
  p_region text default null,
  p_factory_level text default null
) returns uuid
language plpgsql security definer set search_path = public, extensions
as $$
declare
  caller text := public.current_role_name();
  v_email text := lower(trim(p_email));
  v_uid uuid;
  v_target_role text;
begin
  if caller is null or caller not in ('admin', 'superadmin') then
    raise exception 'Chỉ Admin được quản lý tài khoản';
  end if;
  if v_email !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' then
    raise exception 'Email không hợp lệ';
  end if;
  if coalesce(trim(p_full_name), '') = '' then
    raise exception 'Họ tên là bắt buộc';
  end if;
  if p_role not in ('superadmin', 'admin', 'manager', 'sale', 'warehouse_hn', 'factory_da', 'accountant') then
    raise exception 'Vai trò không hợp lệ';
  end if;
  if p_status not in ('active', 'inactive') then
    raise exception 'Trạng thái không hợp lệ';
  end if;

  select id into v_uid from auth.users where lower(email) = v_email;
  if v_uid is not null then
    select role into v_target_role from public.profiles where id = v_uid;
  end if;

  if caller <> 'superadmin' and (p_role = 'superadmin' or v_target_role = 'superadmin') then
    raise exception 'Chỉ Super Admin được gán hoặc sửa tài khoản Super Admin';
  end if;
  if v_uid = auth.uid() and (p_status <> 'active' or p_role is distinct from v_target_role) then
    raise exception 'Không thể tự đổi vai trò hoặc tự khoá tài khoản đang đăng nhập';
  end if;

  if v_uid is null then
    if coalesce(length(p_password), 0) < 8 then
      raise exception 'Mật khẩu tối thiểu 8 ký tự';
    end if;
    v_uid := gen_random_uuid();
    insert into auth.users (
      instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
      raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
      confirmation_token, recovery_token, email_change_token_new, email_change
    ) values (
      '00000000-0000-0000-0000-000000000000', v_uid, 'authenticated', 'authenticated', v_email,
      extensions.crypt(p_password, extensions.gen_salt('bf')), now(),
      '{"provider":"email","providers":["email"]}', jsonb_build_object('full_name', trim(p_full_name)),
      now(), now(), '', '', '', ''
    );
    insert into auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
    values (gen_random_uuid(), v_uid, v_uid::text,
      jsonb_build_object('sub', v_uid::text, 'email', v_email, 'email_verified', true),
      'email', now(), now(), now());
  elsif coalesce(p_password, '') <> '' then
    if length(p_password) < 8 then
      raise exception 'Mật khẩu tối thiểu 8 ký tự';
    end if;
    update auth.users set encrypted_password = extensions.crypt(p_password, extensions.gen_salt('bf')), updated_at = now()
    where id = v_uid;
  end if;

  -- Ngưng → chặn đăng nhập; Hoạt động → mở lại
  update auth.users
  set banned_until = case when p_status = 'inactive' then now() + interval '100 years' else null end, updated_at = now()
  where id = v_uid;
  if p_status = 'inactive' then
    delete from auth.sessions where user_id = v_uid;
  end if;

  insert into public.profiles (id, full_name, email, role, base_salary, commission_pct, debt_commission_pct, region, factory_level, status)
  values (v_uid, trim(p_full_name), v_email, p_role, coalesce(p_base_salary, 0), coalesce(p_commission_pct, 0),
          p_debt_commission_pct, nullif(p_region, ''), nullif(p_factory_level, ''), p_status)
  on conflict (id) do update set
    full_name = excluded.full_name, email = excluded.email, role = excluded.role,
    base_salary = excluded.base_salary, commission_pct = excluded.commission_pct,
    debt_commission_pct = excluded.debt_commission_pct, region = excluded.region,
    factory_level = excluded.factory_level, status = excluded.status, updated_at = now();

  return v_uid;
end $$;

revoke all on function public.admin_upsert_user(text, text, text, text, text, numeric, numeric, numeric, text, text) from public, anon;
grant execute on function public.admin_upsert_user(text, text, text, text, text, numeric, numeric, numeric, text, text) to authenticated;

-- Hồ sơ nhân sự (lương, % hoa hồng, vai trò) và cấu hình: chỉ Admin được ghi.
-- Các nghiệp vụ khác vẫn mở cho thành viên đang hoạt động (phân quyền chi tiết ở app).
drop policy if exists app_records_insert on public.app_records;
create policy app_records_insert on public.app_records for insert to authenticated
  with check (public.is_active_member() and (collection not in ('profiles', 'settings') or public.is_admin()));

drop policy if exists app_records_update on public.app_records;
create policy app_records_update on public.app_records for update to authenticated
  using (public.is_active_member() and (collection not in ('profiles', 'settings') or public.is_admin()))
  with check (public.is_active_member() and (collection not in ('profiles', 'settings') or public.is_admin()));

drop policy if exists app_records_delete on public.app_records;
create policy app_records_delete on public.app_records for delete to authenticated
  using (public.is_active_member() and (collection not in ('profiles', 'settings', '_meta') or public.is_admin()));
