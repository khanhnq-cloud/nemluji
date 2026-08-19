import type {
  Profile, Order, Receipt, Attendance, ProductionDay,
  AppSettings, PayrollLine, PayrollGroup,
} from "@/types";

const monthKey = (year: number, month: number) => `${year}-${String(month).padStart(2, "0")}`;

// 3 nhóm tính lương:
//  - sale            : sale + quản lý  → lương cứng + HH đơn + HH công nợ + thưởng/phạt
//  - factory_manager : quản lý xưởng   → lương theo ngày công + mẻ làm thêm + tăng ca + thưởng/phạt
//  - factory_staff   : nhân viên xưởng → lương theo ngày công + tăng ca + thưởng/phạt
//  - standard        : kho + NV thường → lương cứng + thưởng/phạt
export function payrollGroupOf(profile: Profile): PayrollGroup {
  if (profile.role === "sale" || profile.role === "manager") return "sale";
  if (profile.role === "factory_da") return profile.factoryLevel === "manager" ? "factory_manager" : "factory_staff";
  return "standard";
}

export const isFactoryGroup = (g: PayrollGroup) => g === "factory_manager" || g === "factory_staff";

// Số ngày trong tháng (dùng làm mẫu số cho lương theo ngày công của xưởng)
export const daysInMonth = (year: number, month: number) => new Date(year, month, 0).getDate();

// Hoa hồng sale tách làm 2 rổ, đều dựa trên PHIẾU THU ĐÃ DUYỆT (tiền thực về) trong tháng N.
// Đơn chưa thanh toán → không có phiếu thu duyệt → không được tính đồng nào.
//  - current : tiền thu trong tháng N của đơn phát sinh chính tháng N
//  - debt    : tiền thu trong tháng N của đơn phát sinh từ các tháng trước (công nợ kỳ trước)
// Lưu ý: phiếu thu không gắn đơn hàng (orderId rỗng) không quy được về sale nên không tính.
export function saleCommissionBases(
  saleId: string, year: number, month: number, orders: Order[], receipts: Receipt[],
): { current: number; debt: number } {
  const mk = monthKey(year, month);
  let current = 0;
  let debt = 0;

  for (const r of receipts) {
    if (r.status !== "approved") continue;
    const paidMonth = (r.approvedAt || r.receiptDate || "").slice(0, 7);
    if (paidMonth !== mk) continue;

    const order = orders.find(o => o.id === r.orderId);
    if (!order || order.status !== "active" || order.saleId !== saleId) continue;

    const orderMonth = order.orderDate.slice(0, 7);
    if (orderMonth === mk) current += r.amount;
    else if (orderMonth < mk) debt += r.amount;
    // đơn của tháng sau (nhập lùi ngày) → bỏ qua, chờ đúng kỳ
  }
  return { current, debt };
}

// Số ngày đi làm trong tháng theo bảng chấm công.
// Quy ước giống trang Chấm công: ngày không có bản ghi = đi làm.
// Làm = 1 • Nghỉ có phép = 1 (vẫn hưởng lương) • Nửa ngày = 0.5 • Nghỉ không phép = 0
export function workedDaysOf(
  profileId: string, year: number, month: number, attendance: Attendance[],
): number {
  const mk = monthKey(year, month);
  const total = daysInMonth(year, month);
  const byDate = new Map(
    attendance.filter(a => a.profileId === profileId && a.workDate.startsWith(mk))
      .map(a => [a.workDate, a.status] as const),
  );

  let worked = 0;
  for (let d = 1; d <= total; d++) {
    const status = byDate.get(`${mk}-${String(d).padStart(2, "0")}`) || "work";
    if (status === "work" || status === "off_paid") worked += 1;
    else if (status === "half") worked += 0.5;
  }
  return worked;
}

// Số mẻ làm thêm gợi ý = tổng mẻ vượt ngưỡng mẻ thường/ngày của các ngày SX đã chốt.
export function suggestedExtraBatches(
  year: number, month: number, productionDays: ProductionDay[], settings: AppSettings,
): number {
  const mk = monthKey(year, month);
  const days = productionDays.filter(d => d.status === "closed" && d.productionDate.startsWith(mk));
  const totalBatches = days.reduce((s, d) => s + d.batch1Count + d.batch2Count, 0);
  return Math.max(0, totalBatches - settings.factoryBatchThreshold * days.length);
}

// Tính lại tiền của 1 dòng từ các tham số đã có (dùng cả khi kế toán sửa tay % / số ngày / số mẻ)
export function recalcLine(line: PayrollLine): PayrollLine {
  const factory = isFactoryGroup(line.group);

  const baseSalaryEarned = factory && line.monthDays > 0
    ? Math.round((line.baseSalary / line.monthDays) * line.workedDays)
    : line.baseSalary;

  const commissionAmount = line.group === "sale"
    ? Math.round(line.commissionBase * line.commissionPct / 100) : 0;
  const debtCommissionAmount = line.group === "sale"
    ? Math.round(line.debtCommissionBase * line.debtCommissionPct / 100) : 0;

  // Chỉ quản lý xưởng được tính mẻ làm thêm
  const extraBatchesAmount = line.group === "factory_manager"
    ? Math.round(line.extraBatches * line.extraBatchRate) : 0;
  const overtimeAmount = factory
    ? Math.round(line.overtimeDays * line.overtimeDayRate) : 0;

  const total = baseSalaryEarned + commissionAmount + debtCommissionAmount
    + extraBatchesAmount + overtimeAmount + line.adjustment;

  return { ...line, baseSalaryEarned, commissionAmount, debtCommissionAmount, extraBatchesAmount, overtimeAmount, total };
}

export function buildPayrollLine(opts: {
  profile: Profile;
  year: number; month: number;
  orders: Order[]; receipts: Receipt[];
  attendance: Attendance[]; productionDays: ProductionDay[];
  settings: AppSettings;
  // giữ lại phần kế toán đã nhập tay khi bấm "Tính lại"
  keep?: Partial<Pick<PayrollLine, "adjustment" | "adjustmentReason" | "commissionPct" | "debtCommissionPct" | "workedDays" | "extraBatches" | "extraBatchRate" | "overtimeDays" | "overtimeDayRate">>;
}): PayrollLine {
  const { profile, year, month, orders, receipts, attendance, productionDays, settings, keep } = opts;
  const group = payrollGroupOf(profile);
  const factory = isFactoryGroup(group);

  const bases = group === "sale"
    ? saleCommissionBases(profile.id, year, month, orders, receipts)
    : { current: 0, debt: 0 };

  const line: PayrollLine = {
    id: "",
    profileId: profile.id,
    group,
    baseSalary: profile.baseSalary,
    baseSalaryEarned: 0,

    monthDays: daysInMonth(year, month),
    workedDays: factory ? (keep?.workedDays ?? workedDaysOf(profile.id, year, month, attendance)) : 0,
    extraBatches: group === "factory_manager"
      ? (keep?.extraBatches ?? suggestedExtraBatches(year, month, productionDays, settings)) : 0,
    extraBatchRate: keep?.extraBatchRate ?? settings.factoryExtraBatchBonus,
    extraBatchesAmount: 0,
    overtimeDays: keep?.overtimeDays ?? 0,
    overtimeDayRate: keep?.overtimeDayRate ?? settings.factoryOvertimeDayBonus,
    overtimeAmount: 0,

    commissionPct: keep?.commissionPct ?? (profile.commissionPct ?? settings.defaultCommissionPct),
    commissionBase: bases.current,
    commissionAmount: 0,
    debtCommissionPct: keep?.debtCommissionPct ?? (profile.debtCommissionPct ?? settings.defaultDebtCommissionPct),
    debtCommissionBase: bases.debt,
    debtCommissionAmount: 0,

    adjustment: keep?.adjustment ?? 0,
    adjustmentReason: keep?.adjustmentReason,

    total: 0,
  };

  return recalcLine(line);
}
