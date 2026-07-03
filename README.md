# NNNT-CRM — Nem Nướng Nha Trang Internal Webapp

Webapp quản trị nội bộ theo **Guideline_NemNuong_NhaTrang_Webapp** (CRM bán hàng, Team Sale, Sản xuất theo mẻ, Kho HN/Đông Anh, HRM & Payroll, Dashboard).

## Stack
- **Next.js 14** (App Router) + TypeScript + Tailwind CSS
- **Recharts** (biểu đồ), **Lucide** (icon)
- **Supabase** (Postgres + Auth) — *optional*. Mặc định chạy mock data trong `localStorage` để demo không cần backend.

## Chạy local
```bash
npm install
npm run dev      # http://localhost:3000
```

## Tài khoản demo (mật khẩu chung: `123456`)
| Email | Role |
|---|---|
| `admin@nnnt.vn` | Admin (Chủ DN) — toàn quyền, **duyệt phiếu thu & lương** |
| `manager@nnnt.vn` | Manager |
| `hoa@nnnt.vn` | Sale (Nguyễn Thị Hoa) |
| `manh@nnnt.vn` | Sale (Trần Văn Mạnh) |
| `ngoc@nnnt.vn` | Sale (Lê Thị Ngọc) |
| `hieu@nnnt.vn` | Kho Hà Nội (Hiếu) |
| `xuong@nnnt.vn` | Xưởng Đông Anh |
| `ketoan@nnnt.vn` | Kế toán |

## Các rule "không được sai" đã implement & verify
- ✅ **Chiết khấu 3 lớp tuần tự**: subtotal − special → ×(1−monthly%) → ×(1−early%) − ship (ship âm = cty trả). Hiển thị breakdown realtime trong form.
- ✅ **Hàng tặng** (is_gift): revenue = 0, vẫn cộng cost theo `fix_cost`.
- ✅ **Net Profit** = revenue_net − cost − sale_commission (commission = revenue_net × %).
- ✅ **Phiếu thu**: tự sinh theo payment_status (cash_done→approved, da_ck→chờ Admin, chưa_ck/công_nợ→chờ). **Chỉ Admin** được "Xác nhận tiền đã về" (chống gian lận). Kho HN chỉ được "Báo đã CK".
- ✅ **Công nợ tháng**: snapshot các phiếu thu chưa duyệt, không ghi đè.
- ✅ **Khách + Chi nhánh**: cùng tên khác địa chỉ = chi nhánh riêng; đơn ref `branch_id`; doanh thu tính riêng.
- ✅ **Dự báo lịch order**: est_next = lần lấy gần nhất + AVG khoảng cách đơn (3 tháng) → flag "sắp/đã hết hàng".
- ✅ **Lead + Visit timeline** (không ghi đè) + cộng dồn hàng phát thử; lead "đã chốt" → tạo customer + branch.
- ✅ **Sản xuất theo mẻ**: trừ lùi NVL theo `production_recipe` (Mẻ 1 + Mẻ 2), preview "Tồn trước/Sẽ trừ/Tồn sau", **cấm chốt nếu tồn âm**, tính loss% & cost/kg.
- ✅ **Tách kho**: bán hàng trừ kho CL (HN); xưởng chỉ trừ khi chuyển ra; kho HN xác nhận nhận mới cộng tồn CL.
- ✅ **Recover** (không cộng chi phí) / **Tiêu hủy** (trừ tồn + cộng expense).
- ✅ **Lương**: Sale = lương cứng + %×(phiếu thu approved trong tháng, gồm công nợ tháng trước) + 100k×khách mới qualified + thưởng thái độ − trừ nghỉ. Kho HN = + hoa hồng chéo 1%×doanh thu sale cấu hình. Xưởng = + bồi dưỡng mẻ vượt 10/ngày × 150k. Period có draft/approved/**locked** (chỉ Admin), xuất CSV.
- ✅ **Cảnh báo NVL** < 3 ngày sản xuất + badge sidebar.
- ✅ **Dashboard** card đầy đủ + **so sánh cùng kỳ tháng trước** + lọc kỳ (hôm nay/7 ngày/tháng/tùy chọn).
- ✅ **Không xóa chứng từ** — dùng status cancelled.
- ✅ **Phân quyền 6 role** qua `lib/permissions.ts`.

## Cấu trúc
```
app/(app)/
  dashboard/                  Dashboard + so sánh cùng kỳ
  sales/orders                Đơn (chiết khấu 3 lớp, hàng tặng, auto phiếu thu)
  sales/receipts              Phiếu thu (Admin duyệt)
  sales/debts                 Công nợ (snapshot tháng)
  customers + /forecast       Khách & chi nhánh, dự báo lịch
  team-sales/leads + /samples Lead + visit timeline, phễu chuyển đổi
  production/days             Mẻ SX (trừ lùi NVL, loss, cost/kg)
  production/materials        Tồn NVL + định mức + cảnh báo
  production/transfers        Chuyển kho Đông Anh → HN
  production/recovery         Recover / tiêu hủy
  warehouse-hn                Tồn kho thành phẩm CL (HN)
  hrm/payroll + /attendance   Bảng lương (period/lock) + chấm công
  reports, settings, users
lib/
  discount.ts   applyDiscount() — chiết khấu 3 lớp (test 10 ca)
  cost.ts       calcOrder, calcOrderItem (gift, profit)
  forecast.ts   recalcBranchForecast, isBranchDue
  production.ts computeUsages, computeBatchResult, batchesRemaining
  payroll.ts    calcSale/Warehouse/FactoryPayroll
  order-actions.ts  createOrder (+receipt +forecast +trừ kho)
  permissions.ts, store.tsx, auth.tsx, mock-data.ts, utils.ts
types/index.ts          TS types theo schema
supabase-schema.sql     Schema PostgreSQL đầy đủ (mục 10 guideline)
```

## Kết nối Supabase thật
1. Chạy `supabase-schema.sql` trong Supabase SQL Editor.
2. Copy `.env.example` → `.env.local`, điền `NEXT_PUBLIC_SUPABASE_URL` + `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
3. Restart. (Giai đoạn 2: thay `useStore()` bằng Supabase queries + RLS theo role.)

## Reset dữ liệu demo
Nút **Reset demo** ở header → xoá localStorage và nạp lại seed.
