# YÊU CẦU CHỈNH SỬA — NNNT-CRM

| | |
|---|---|
| **Ngày lập** | 17/08/2026 |
| **Nguồn** | Yêu cầu chỉnh sửa của khách hàng + file `Quản Lý Xưởng.xlsx` (sheet `Kiểm Kho`, `doanh thu`) |
| **Nhánh** | `feat/expenses-customer-detail-order-ux` |
| **Trạng thái** | Đã chốt toàn bộ hạng mục — sẵn sàng triển khai |

---

## 0. Nguyên tắc xuyên suốt

1. **Không hard-code bất kỳ công thức, định mức, đơn giá hay danh mục nào.** Người dùng phải tự thêm / bớt / sửa được: nguyên vật liệu, tỷ lệ định mức theo mẻ, chi phí trên đơn vị, danh mục thành phẩm, hằng số tính giá thành.
2. **Đơn vị đo là kg** trên toàn hệ thống (giữ nguyên `qtyKg` hiện tại). Không dùng đơn vị "cây 2 kg" của file Excel.
3. **Không xoá chứng từ** — giữ nguyên rule hiện hành, dùng trạng thái `cancelled`.
4. **Snapshot lịch sử**: sửa định mức / đơn giá hôm nay **không được** làm thay đổi số liệu của các ngày đã chốt.
5. Mọi thay đổi giữ nguyên route hiện có để không vỡ link; chỉ đổi nhãn hiển thị.

---

## F1 — Gom menu thành 2 danh mục lớn

### Mục tiêu
Tổ chức lại điều hướng theo 2 khối nghiệp vụ: Kho Cát Linh và Xưởng.

### Hiện trạng
`components/Sidebar.tsx` là danh sách **phẳng** 9 nhóm ngang cấp (`SECTIONS`), không có cấp lồng.

### Yêu cầu
1. Chuyển sidebar sang **cấu trúc 2 cấp**: danh mục lớn → nhóm con → trang.

```
Tổng quan
  └ Dashboard
🏬 KHO CÁT LINH
  ├ Bán hàng     → Đơn hàng · Phiếu thu · Công nợ
  ├ Khách hàng   → Khách & chi nhánh · Dự báo lịch order
  ├ Team Sale    → Lead · Hàng phát thử
  └ Kho Cát Linh → Tồn thành phẩm CL
🏭 XƯỞNG
  └ Sản xuất     → Sổ Xưởng · NVL & tồn · Chuyển kho · Recover / Tiêu huỷ
HRM · Tài chính · Khác   (giữ ngoài 2 danh mục lớn)
```

2. Danh mục lớn **co / giãn được**, ghi nhớ trạng thái mở.
3. Đổi nhãn hiển thị:
   - "Sản xuất", "Xưởng Đông Anh" → **Xưởng**
   - "Kho CL (Hà Nội)", "Kho Hà Nội" → **Kho Cát Linh**
   - "Mẻ sản xuất" → **Sổ Xưởng**
4. Badge cảnh báo (phiếu thu chờ duyệt, NVL sắp hết) **cộng dồn lên danh mục lớn** khi nhóm đang đóng.
5. Danh mục lớn tự ẩn khi role không có quyền xem bất kỳ trang con nào.

### File ảnh hưởng
`components/Sidebar.tsx`, các `PageHeader` liên quan.

### Nghiệm thu
- [ ] Sidebar hiển thị đúng 2 danh mục lớn với nhóm con lồng bên trong.
- [ ] Không còn chuỗi "Đông Anh" / "Kho CL" / "Mẻ sản xuất" trên giao diện.
- [ ] Mọi route cũ vẫn truy cập được.

---

## F2 — Sổ Xưởng (thay trang "Mẻ sản xuất")

### Mục tiêu
Dựng lại đúng sheet `Kiểm Kho` của xưởng, có bổ sung tách loại thành phẩm.

### Hiện trạng
`app/(app)/production/days/page.tsx`: mỗi ngày chỉ ghi **1 dòng** — số mẻ 1, mẻ 2, **một** loại thành phẩm, một số kg output. Không có tồn đầu / tồn cuối NVL trong ngày, không có chuỗi nối tồn thành phẩm ngày này sang ngày kia.

### Yêu cầu

**1. Bố cục 3 dòng / ngày sản xuất**

| Dòng | Nội dung |
|---|---|
| **đầu** | Tồn **đầu** ngày từng NVL · số mẻ 1 · số mẻ 2 · Ra thành phẩm · Kho Xưởng · Về CL · **Tổng Kho Xưởng** |
| **cuối** | Tồn **cuối** ngày từng NVL — **tự tính**, không nhập tay |
| **+nhập** | Nhập thêm NVL trong ngày (`+100`) · hao hụt/mẻ · giá thành/kg |

**2. Công thức tự động** (đúng như sổ, nhưng tham số lấy từ cấu hình F3):

| Chỉ số | Công thức |
|---|---|
| Tồn cuối NVL | `tồn đầu − (định mức mẻ 1 × số mẻ 1) − (định mức mẻ 2 × số mẻ 2)` |
| Tồn đầu ngày kế tiếp | `tồn cuối hôm trước + nhập thêm` |
| Kho Xưởng (đầu ngày) | `= Tổng Kho Xưởng của ngày sản xuất liền trước` |
| **Tổng Kho Xưởng** | `= Ra thành phẩm + Kho Xưởng − Về CL` |
| Hao hụt / mẻ | `(sản lượng chuẩn/mẻ 2 × số mẻ 2 − Ra thành phẩm) / số mẻ 2` |
| Giá thành / kg | `(số mẻ 2 × chi phí NVL/mẻ 2) / Ra thành phẩm` |
| Giá trị tồn NVL | `Σ (tồn cuối × đơn giá NVL)` |

**3. Tách theo loại thành phẩm.** Ba cột `Ra thành phẩm`, `Về CL`, `Tổng Kho Xưởng` phải tách theo **từng loại thành phẩm** (TT · TTC · **Ngắn** · Vụn · …) kèm cột tổng. Danh sách loại lấy từ danh mục sản phẩm cấu hình được ở F3 — **không cố định 4 loại**.

**4. Cột NVL sinh động** theo danh mục NVL đang bật ở F3, không cố định 18 cột như file Excel. Bảng rộng → cuộn ngang, ghim cột `Ca trong ngày` và `Date`.

**5. Chốt chặn.** Giữ rule hiện có: xem trước trừ NVL, **tồn âm → không cho chốt ngày**. Hiển thị cảnh báo đỏ ô âm.

**6. Snapshot.** Khi chốt ngày phải lưu kèm: tỷ lệ định mức, đơn giá NVL, sản lượng chuẩn/mẻ 2, chi phí NVL/mẻ 2 **tại thời điểm chốt**. Sửa cấu hình sau đó không được làm đổi số của ngày đã chốt.

### Thay đổi dữ liệu — `types/index.ts`

```ts
export interface ProductQty { productId: string; qtyKg: number; }
export interface MaterialQty { materialId: string; qty: number; }

export interface ProductionDay {
  // ... giữ: id, productionCode, productionDate, batch1Count, batch2Count,
  //          extraCostFactory, usages, status, closedBy, closedAt, note

  // THAY: outputKg: number            → outputs: ProductQty[]
  // THAY: transferToClKg: number      → transfersOut: ProductQty[]
  // THAY: factoryStockKgEnd: number   → factoryStockEnd: ProductQty[]  (+ tổng dẫn xuất)

  // THÊM:
  factoryStockOpen: ProductQty[];      // = factoryStockEnd ngày trước
  materialOpening: MaterialQty[];
  materialClosing: MaterialQty[];
  materialIntake: MaterialQty[];       // dòng "+nhập"
  recipeSnapshot: ProductionRecipe[];  // định mức tại thời điểm chốt
  standardOutputPerBatch2: number;     // snapshot hằng số
  materialCostPerBatch2: number;       // snapshot hằng số
  lossPerBatch: number;                // hao hụt / mẻ
  materialStockValue: number;          // giá trị tồn NVL cuối ngày
}
```

### File ảnh hưởng
`app/(app)/production/days/page.tsx`, `lib/production.ts`, `types/index.ts`, `lib/store.tsx`, `lib/mock-data.ts`, `lib/inventory.ts`.

### Nghiệm thu — đối chiếu số thật từ sổ (ngày 3/11)

- [ ] Tồn đầu Thịt gà `481,9`, số mẻ `7`, định mức `10/mẻ 1` → **tồn cuối = `411,9`**
- [ ] Ra TP `179,5` + Kho Xưởng `161` − Về CL `0` → **Tổng Kho Xưởng = `340,5`**
- [ ] Hao hụt/mẻ = `(33,5 × 6 − 179,5) / 6` = **`3,583`**
- [ ] Giá thành/kg = `(6 × 1.674.323) / 179,5` = **`55.966`**
- [ ] Tổng Kho Xưởng ngày 3/11 (`340,5`) hiện đúng ở ô "Kho Xưởng" của ngày 4/11
- [ ] Sửa định mức trong cấu hình → số liệu các ngày đã chốt **không đổi**

---

## F3 — Cấu hình Xưởng (hạng mục lớn nhất)

### Mục tiêu
Bỏ toàn bộ hard-code; người dùng tự định nghĩa quy tắc sản xuất.

### Hiện trạng
`lib/mock-data.ts` cố định 15 NVL, 15 dòng định mức, 5 sản phẩm. `lib/production.ts` hard-code `MAIN_MASS_MATERIAL_IDS` và cách tính `expectedOutput` / `costPerKg`. Trang `production/materials` chỉ cho "Nhập thêm", không cho thêm / sửa / xoá NVL. `daysLeft` dùng mẻ TB tự động từ lịch sử, người dùng không can thiệp được.

### Yêu cầu

**a) Danh mục NVL — CRUD đầy đủ**
Thêm / sửa / xoá / ẩn. Trường: `tên · đơn vị · đơn giá/đơn vị · ngưỡng cảnh báo (ngày) · thứ tự cột · bật/tắt`.
Không cho xoá NVL đã dùng trong ngày sản xuất đã chốt — chỉ cho ẩn.

**b) Định mức theo mẻ — CRUD**
Mỗi NVL nhập **tỷ lệ / mẻ 1** và **tỷ lệ / mẻ 2**. Để trống = **không trừ tự động** (đúng như Tỏi / Hành / Thịt xay trong sổ — có theo dõi tồn nhưng không có công thức).

**c) Hằng số tính giá thành — sửa được**
- `Sản lượng chuẩn / mẻ 2` (giá trị sổ: **33,5**)
- `Chi phí NVL / mẻ 2` (giá trị sổ: **1.674.323 đ**)

Bỏ cách tính cũ (`expectedOutput` = tổng khối lượng gà + mỡ + giò thừa; `costPerKg` = tổng tiền NVL / output) — thay bằng 2 hằng số này.

**d) Danh mục thành phẩm — CRUD**
Thêm / sửa loại thành phẩm, đánh dấu loại nào là **output của xưởng** (xuất hiện thành cột trong Sổ Xưởng). Bổ sung loại **"Ngắn"** (hiện chưa có).

**e) Trang "NVL & tồn"**
- Tồn NVL lấy thẳng từ **dòng "cuối" mới nhất của Sổ Xưởng** (không còn là con số chỉnh tay rời rạc).
- Thêm cột **Giá trị tồn NVL** = `Σ tồn × đơn giá`.
- Thêm **ô nhập "số mẻ dự kiến / ngày"** → cột "còn dùng được N ngày" và cảnh báo "sắp hết" tính lại ngay theo con số người dùng nhập, thay cho mẻ TB tự động.

### Seed lại theo sổ thật

| NVL | Định mức mẻ 1 | Định mức mẻ 2 | Đơn giá |
|---|---|---|---|
| Thịt gà | 10 | — | 67.000 |
| Mỡ | 7 | 6 | 38.000 |
| **Thịt Nạc** *(mới)* | — | 4 | 58.000 |
| Tỏi | — | — | *(giữ)* |
| Hành | — | — | *(giữ)* |
| Bột Sả | — | 0,245 | 150.000 |
| Bột Vàng | — | 0,1 | 300.000 |
| AAA | — | 0,1 | 270.000 |
| Tiêu | — | 0,06 | 170.000 |
| Mắm (L) | 0,575 | — | 13.000 |
| Đường | 1 | — | 19.200 |
| Muối Đỏ | 0,1874 | — | 80.000 |
| Mì chính | 0,2 | — | 41.000 |
| CBQ | 0,075 | — | 140.000 |
| HHHT | 1 | — | 85.500 |
| **Thịt xay** *(mới)* | — | — | *(nhập sau)* |
| Giò thừa | — | — | *(giữ)* |

Sản phẩm: `TT · TTC · Ngắn (mới) · Vụn · Nước chấm · Ram giòn`.

### Thay đổi dữ liệu

```ts
export interface AppSettings {
  // ... giữ nguyên các trường hiện có
  standardOutputPerBatch2: number;  // 33.5
  materialCostPerBatch2: number;    // 1674323
  plannedBatchesPerDay: number;     // số mẻ dự kiến/ngày cho dự báo NVL
}

export interface Material {
  // ... giữ nguyên
  sortOrder?: number;
}

export interface Product {
  // ... giữ nguyên
  isFactoryOutput?: boolean;  // hiện thành cột trong Sổ Xưởng
}
```

### File ảnh hưởng
`app/(app)/settings/page.tsx` (thêm tab **Cấu hình Xưởng**), `app/(app)/production/materials/page.tsx`, `lib/production.ts`, `lib/mock-data.ts`, `types/index.ts`, `lib/store.tsx`.

### Nghiệm thu
- [ ] Thêm mới 1 NVL + định mức → cột đó xuất hiện trong Sổ Xưởng và được trừ đúng khi chốt ngày.
- [ ] Xoá / ẩn 1 NVL → biến mất khỏi sổ ngày mới, ngày cũ giữ nguyên.
- [ ] Sửa "sản lượng chuẩn/mẻ 2" → hao hụt/mẻ của ngày **chưa chốt** đổi theo; ngày đã chốt không đổi.
- [ ] Thêm loại thành phẩm mới → xuất hiện thành cột trong Sổ Xưởng và trong ô chọn của phiếu chuyển kho.
- [ ] Đổi "số mẻ dự kiến/ngày" → cột "còn dùng được N ngày" đổi ngay.

---

## F4 — Chuyển kho Xưởng → Kho Cát Linh

### Mục tiêu
Tạo phiếu chuyển ngay trên tồn theo sổ, **giữ nguyên** bước xác nhận nhận hàng.

### Hiện trạng
`app/(app)/production/transfers/page.tsx`: tạo phiếu thì trừ tồn xưởng ngay; tồn Kho Cát Linh chỉ tăng khi Kho HN bấm "Xác nhận đã nhận".

### Yêu cầu
1. Trang Chuyển kho hiển thị **Tổng Kho Xưởng theo sổ, tách theo từng loại thành phẩm**.
2. Mỗi dòng có **nút tạo phiếu chuyển** ngay tại chỗ: nhập số kg + ngày chuyển.
3. Phiếu chuyển được tạo → ghi đồng thời vào cột **"Về CL"** của Sổ Xưởng ngày tương ứng, trừ tồn kho xưởng.
4. **KHÔNG bỏ bước xác nhận.** Kho Cát Linh vẫn phải bấm "Xác nhận đã nhận" thì tồn CL mới tăng. Trạng thái: `pending → received / cancelled`.
5. Hiển thị rõ số đang "trên đường" (đã rời xưởng, chưa được CL xác nhận).

### File ảnh hưởng
`app/(app)/production/transfers/page.tsx`, `app/(app)/warehouse-hn/page.tsx`, `lib/inventory.ts`.

### Nghiệm thu
- [ ] Tạo phiếu chuyển 50 kg TT → tồn xưởng −50, tồn CL **chưa đổi**, cột "Về CL" của Sổ Xưởng +50.
- [ ] Kho Cát Linh xác nhận → tồn CL +50.
- [ ] Huỷ phiếu ở trạng thái chờ → hoàn lại tồn xưởng.

---

## F5 — "Lọc hàng" → MCK (mất chân không) tại Kho Cát Linh

### Mục tiêu
Quản lý vòng đời hàng mất chân không, từ lúc trả về CL đến khi tiêu huỷ hoặc quay lại bán được.

### Hiện trạng
Chưa có khái niệm MCK. Phiếu chuyển kho chỉ 1 chiều Xưởng → CL, không có ô phí ship. Recover hiện nhập tay tuỳ ý.

### Yêu cầu

**1. Nút "Lọc hàng"** đặt cạnh "Tạo đơn" trên header trang Đơn hàng → mở màn hình MCK.

**2. Ghi nhận MCK.** Hàng mất chân không **trả về Kho Cát Linh trước**: `ngày · sản phẩm · số kg`. Trừ khỏi tồn CL bán được, chuyển sang trạng thái **"MCK chờ xử lý"**. Màn hình hiển thị tổng SL MCK theo từng ngày.

**3. Xử lý MCK — 3 nhánh**

| Nhánh | Điều kiện | Tác động |
|---|---|---|
| **Hút lại được tại CL** | Xử lý ngay tại chỗ | Trả về tồn CL bán được, không phát sinh chi phí |
| **Tiêu huỷ** | Không hút lại được | Trừ hẳn khỏi MCK + **tự sinh phiếu chi = giá vốn (`fixCost`) × số kg** |
| **Recover** | Không hút lại được | Tạo **phiếu chuyển CL → Xưởng** (số kg + **phí ship**) + **tự sinh phiếu chi bằng phí ship** |

**4. Phiếu chuyển ngược CL → Xưởng.** Xưởng phải **xác nhận đã nhận** (đối xứng F4) thì hàng mới vào hàng đợi recover của xưởng.

**5. Cả hai phiếu chi sinh ra (tiêu huỷ + ship) đều tính vào Tổng chi phí ở F8.**

### Thay đổi dữ liệu

```ts
export type MckStatus =
  | "pending"        // chờ xử lý tại CL
  | "revacuumed_cl"  // hút lại được tại CL → về tồn bán được
  | "destroyed"      // tiêu huỷ
  | "sent_to_factory"// đã tạo phiếu chuyển về xưởng
  | "recovered"      // xưởng đã hút lại → kho recover
  | "returned_cl";   // đã chuyển lại về CL

export interface MckLog {
  id: string;
  code: string;            // MCK-2026-000001
  logDate: string;
  productId: string;
  qtyKg: number;
  status: MckStatus;
  transferId?: string;     // phiếu chuyển CL → Xưởng
  destructionId?: string;
  expenseId?: string;
  note?: string;
  createdBy: string;
}

export interface StockTransfer {
  // ... giữ nguyên
  direction: "factory_to_cl" | "cl_to_factory" | "recover_to_cl";  // THÊM
  shipFee?: number;        // THÊM — phí ship, sinh phiếu chi
  expenseId?: string;      // THÊM
  mckLogId?: string;       // THÊM
}
```

Thêm loại phiếu chi: `mck_ship` → nhãn **"Ship hàng MCK về xưởng"**.
Store thêm slice: `mckLogs: MckLog[]`.

### File ảnh hưởng
`app/(app)/sales/orders/page.tsx`, component MCK mới, `types/index.ts`, `lib/store.tsx`, `lib/utils.ts` (`EXPENSE_TYPE_LABEL`), `lib/inventory.ts`.

### Nghiệm thu
- [ ] Ghi 20 kg TT bị MCK → tồn CL bán được −20, MCK chờ xử lý +20.
- [ ] Hút lại tại CL 5 kg → tồn CL +5, MCK còn 15, **không** sinh phiếu chi.
- [ ] Tiêu huỷ 5 kg → MCK còn 10, sinh phiếu chi `fixCost × 5`.
- [ ] Recover 10 kg với ship 200.000đ → tạo phiếu chuyển CL→Xưởng, sinh phiếu chi 200.000đ nhóm "Ship hàng MCK về xưởng".
- [ ] Cả 2 phiếu chi trên xuất hiện trong Tổng chi phí ngày ở F8.

---

## F6 — Recover (bên Xưởng) + Kho Recover riêng

### Mục tiêu
Hàng recover đi qua một kho riêng, không trộn vào tồn kho xưởng tổng.

### Hiện trạng
`app/(app)/production/recovery/page.tsx`: người dùng tự gõ sản phẩm + số kg, bấm "Hút lại" → cộng **thẳng vào tồn kho xưởng**. Không có hàng đợi, không có kho trung gian.

### Yêu cầu
1. **Bỏ nhập tay.** Tab "Recover" hiển thị **danh sách MCK cần recover**, lấy tự động từ phiếu chuyển CL → Xưởng đã được xưởng xác nhận. Mỗi dòng hiện: `sản phẩm · số kg · ngày chuyển sang · mã phiếu chuyển`.
2. Nút **"Hút lại"** trên từng dòng → hàng vào **Kho Recover** — kho thứ 3, **tách khỏi tồn kho xưởng tổng**, không cộng chi phí.
3. Khu vực **Kho Recover** hiển thị tồn theo từng loại sản phẩm, có nút **"Chuyển về Kho Cát Linh"** → tạo phiếu chuyển `recover_to_cl`; Kho Cát Linh xác nhận → cộng tồn CL bán được.
4. Tab **"Tiêu huỷ"** giữ nguyên cho hàng huỷ trực tiếp tại xưởng (đã có sẵn logic sinh phiếu chi).
5. Thẻ thống kê: `MCK chờ recover` · `Tồn kho Recover` · `Đã chuyển về CL trong tháng`.

### Thay đổi dữ liệu

```ts
export interface RecoveryLog {
  // ... giữ nguyên
  mckLogId: string;       // THÊM — bắt buộc, không còn nhập tay
  transferId: string;     // THÊM — phiếu chuyển CL → Xưởng
  sentToFactoryDate: string; // THÊM — "ngày chuyển sang"
}
```
Store thêm slice: `recoverInventory: ProductQty[]`.

### File ảnh hưởng
`app/(app)/production/recovery/page.tsx`, `types/index.ts`, `lib/store.tsx`, `lib/inventory.ts`.

### Nghiệm thu
- [ ] 10 kg MCK đã chuyển sang xưởng hiện trong danh sách chờ recover, đúng ngày chuyển.
- [ ] Bấm "Hút lại" → Kho Recover +10, **tồn kho xưởng tổng không đổi**, không sinh phiếu chi.
- [ ] Bấm "Chuyển về Kho Cát Linh" → Kho Recover −10, CL xác nhận → tồn CL +10.

---

## F7 — Nút "Tạo đơn" và "Tạo phiếu chi" cạnh nhau

### Hiện trạng
Đơn hàng ở nhóm "Bán hàng", Phiếu chi ở nhóm "Tài chính" — 2 trang rời nhau.

### Yêu cầu
1. Thêm nút **"Tạo phiếu chi"** ngay cạnh **"Tạo đơn"** ở header trang Đơn hàng.
2. Mở **modal tại chỗ**, dùng lại đúng form của `app/(app)/expenses/page.tsx` (ngày · nhóm chi · số tiền · hình thức · người nhận · nội dung).
3. Trang Phiếu chi giữ nguyên để tra cứu và lọc.
4. Nút tuân thủ quyền `manage_expenses`.

### File ảnh hưởng
`app/(app)/sales/orders/page.tsx`, tách form phiếu chi thành component dùng chung.

### Nghiệm thu
- [ ] Ba nút "Xuất Excel" · "Tạo đơn" · "Tạo phiếu chi" nằm cạnh nhau trên header Đơn hàng.
- [ ] Lưu phiếu chi từ modal → phiếu xuất hiện ở trang Phiếu chi và tính vào Tổng chi phí ngày.

---

## F8 — Chốt tiền cuối ngày

### Mục tiêu
Gộp ship và phiếu chi thành một cụm "tổng chi phí" duy nhất.

### Hiện trạng
`lib/finance.ts` đã tính sẵn theo ngày: `actualRevenue` (phiếu thu đã duyệt), `shipping` (tổng phí ship đơn), `expenses` (tổng phiếu chi) — nhưng hiển thị rời từng con số, chưa cộng gộp.

### Yêu cầu

```
Tổng chi phí = Σ phiếu chi trong ngày + Σ chi phí ship trong ngày
Tổng tiền    = Tiền hàng nhận về − Tổng chi phí
```

1. `Σ phiếu chi` bao gồm **mọi** phiếu chi trong ngày, trong đó có phiếu chi tiêu huỷ MCK và phiếu chi ship chuyển MCK về xưởng (F5).
2. `Tiền hàng nhận về` = **phiếu thu đã duyệt** trong ngày (tiền thật về), giữ nguyên định nghĩa `actualRevenue` hiện có.
3. Hiển thị khối chốt ngày ở **cuối trang Đơn hàng** và trên **Dashboard**.
4. Bổ sung 2 trường vào `summarizeFinanceRange`: `totalCost` và `netCash`.

### File ảnh hưởng
`lib/finance.ts`, `app/(app)/sales/orders/page.tsx`, `app/(app)/dashboard/page.tsx`.

### Nghiệm thu
- [ ] Ngày có: phiếu thu duyệt 15.658.000đ · ship 605.000đ · phiếu chi 19.000.000đ
      → Tổng chi phí `19.605.000`, Tổng tiền `−3.947.000`.
- [ ] Tạo thêm 1 phiếu chi → cả 2 con số cập nhật ngay.

---

## F9 — Phân quyền theo 2 danh mục lớn

### Yêu cầu
**Nhân viên Kho Cát Linh (`warehouse_hn`) xem được toàn bộ hệ thống. Nhân viên Xưởng (`factory_da`) không xem được khối Kho Cát Linh.**

| Role | 🏬 Kho Cát Linh | 🏭 Xưởng | Ghi chú |
|---|---|---|---|
| `admin` | Toàn quyền | Toàn quyền | Giữ độc quyền duyệt phiếu thu & khoá bảng lương |
| `manager` | Toàn quyền | Toàn quyền | |
| `warehouse_hn` | Toàn quyền | **Xem (mới)** | Được xem Sổ Xưởng, NVL & tồn, Chuyển kho, Recover — **không** sửa |
| `factory_da` | **Không thấy** | Toàn quyền | Không thấy Đơn hàng / Phiếu thu / Công nợ / Khách hàng / Team Sale / Kho Cát Linh |
| `sale` | Theo quyền hiện tại | Không thấy | |
| `accountant` | Theo quyền hiện tại | Xem | |

### Chi tiết thay đổi `lib/permissions.ts`
- `warehouse_hn`: **thêm** `view_production`, `manage_recovery` (chỉ phần xác nhận), `view_reports`, `view_expenses`. Giữ **không** có `manage_production`, `manage_materials`, `approve_receipt`, `view_financials`.
- `factory_da`: giữ nguyên tập quyền hiện tại (vốn đã không có quyền khối Kho Cát Linh). Bổ sung: **Dashboard của `factory_da` chỉ hiển thị khối chỉ số Xưởng**, ẩn doanh thu / công nợ / phiếu thu.
- Danh mục lớn trong sidebar tự ẩn khi role không có quyền xem bất kỳ trang con nào.

### Nghiệm thu
- [ ] Đăng nhập `hieu@nnnt.vn` (Kho Cát Linh) → thấy **cả 2** danh mục lớn; vào trang Xưởng chỉ đọc, không có nút tạo/sửa.
- [ ] Đăng nhập `xuong@nnnt.vn` (Xưởng) → **không** thấy danh mục Kho Cát Linh; truy cập thẳng `/sales/orders` bị chặn.
- [ ] Dashboard của `xuong@nnnt.vn` không hiển thị doanh thu / công nợ.

---

## Ngoài phạm vi lần này

- **Chấm công theo giờ vào–ra** + tăng ca theo giờ (sheet `chấm công nhân viên`: 6.000.000đ/tháng → 193.548đ/ngày → 21.505đ/giờ, tăng ca 30.000đ/giờ). Giữ chấm công theo ngày như hiện tại.
- Import trực tiếp file `.xlsx` vào app — lần này dựng lại **cấu trúc và công thức** của sổ, dữ liệu lịch sử nhập tay hoặc seed.
- Sheet `chi phí nhập đồ` và `Chi Phí Xưởng theo tháng` — hiện đã có thể ghi qua Phiếu chi (`materials`, `utilities`, `salary`).

## Rủi ro cần lưu ý khi triển khai

1. **Đổi kiểu `ProductionDay`** phá dữ liệu `localStorage` cũ → cần migration hoặc buộc "Reset demo".
2. **Seed NVL / định mức / đơn giá thay đổi toàn bộ** so với bản hiện tại — mọi con số giá thành, giá trị tồn, cảnh báo NVL sẽ khác. Đây là chủ ý, không phải lỗi.
3. **Không snapshot định mức** sẽ làm lệch số liệu lịch sử mỗi lần khách sửa cấu hình — đây là rủi ro nghiêm trọng nhất của F3.
4. Sổ Xưởng có thể rộng 25+ cột → cần thiết kế cuộn ngang và ghim cột ngay từ đầu.
