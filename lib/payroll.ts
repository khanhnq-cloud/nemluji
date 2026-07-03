import type {
  Profile, Order, Receipt, Attendance, ProductionDay,
  NewCustomerCredit, AppSettings, PayrollLine,
} from "@/types";

const monthKey = (year: number, month: number) => `${year}-${String(month).padStart(2, "0")}`;

// Hoa hồng sale (Rule 12.5): commission × (đơn tháng N đã thu + công nợ tháng trước đã thu trong N)
// => base = SUM(receipt.amount approved có approvedAt trong tháng N, thuộc đơn của sale này)
export function saleCommissionBase(saleId: string, year: number, month: number, orders: Order[], receipts: Receipt[]): number {
  const mk = monthKey(year, month);
  return receipts
    .filter(r => r.status === "approved" && (r.approvedAt || r.receiptDate || "").startsWith(mk))
    .filter(r => {
      const order = orders.find(o => o.id === r.orderId);
      return order && order.status === "active" && order.saleId === saleId;
    })
    .reduce((s, r) => s + r.amount, 0);
}

function offUnpaidDeduction(profile: Profile, year: number, month: number, attendance: Attendance[]): number {
  const mk = monthKey(year, month);
  const offDays = attendance.filter(a => a.profileId === profile.id && a.workDate.startsWith(mk) && a.status === "off_unpaid").length;
  return Math.round((profile.baseSalary / 26) * offDays);
}

export function calcSalePayroll(opts: {
  profile: Profile;
  year: number; month: number;
  orders: Order[]; receipts: Receipt[]; attendance: Attendance[];
  credits: NewCustomerCredit[]; settings: AppSettings;
  attitudeOn?: boolean; otherBonus?: number;
}): PayrollLine {
  const { profile, year, month, orders, receipts, attendance, credits, settings } = opts;
  const mk = monthKey(year, month);
  const base = profile.baseSalary;
  const commBase = saleCommissionBase(profile.id, year, month, orders, receipts);
  const commissionAmount = Math.round(commBase * (profile.commissionPct || 0) / 100);

  const qualified = credits.filter(c => c.saleId === profile.id && c.status === "qualified" && c.qualifyingMonth === mk).length;
  const newCustomerBonus = qualified * settings.newCustomerBonus;

  const attitudeBonus = opts.attitudeOn ? settings.attitudeBonus : 0;
  const otherBonus = opts.otherBonus || 0;
  const offDayDeduction = offUnpaidDeduction(profile, year, month, attendance);

  const total = base + commissionAmount + newCustomerBonus + attitudeBonus + otherBonus - offDayDeduction;
  return {
    id: "", profileId: profile.id, baseSalary: base,
    commissionAmount, crossCommission: 0, newCustomerBonus,
    extraBatchesBonus: 0, attitudeBonus, otherBonus, offDayDeduction, total,
  };
}

// Hoa hồng chéo kho HN (Rule 8.7.2): 1% × revenue_net các đơn (đã receipt approved) của 1 sale được cấu hình
export function calcWarehousePayroll(opts: {
  profile: Profile;
  year: number; month: number;
  orders: Order[]; receipts: Receipt[]; attendance: Attendance[];
  settings: AppSettings; otherBonus?: number;
}): PayrollLine {
  const { profile, year, month, orders, receipts, attendance, settings } = opts;
  const base = profile.baseSalary;
  let crossCommission = 0;
  if (settings.crossCommissionFromSaleId) {
    const commBase = saleCommissionBase(settings.crossCommissionFromSaleId, year, month, orders, receipts);
    crossCommission = Math.round(commBase * settings.crossCommissionPct / 100);
  }
  const otherBonus = opts.otherBonus || 0;
  const offDayDeduction = offUnpaidDeduction(profile, year, month, attendance);
  const total = base + crossCommission + otherBonus - offDayDeduction;
  return {
    id: "", profileId: profile.id, baseSalary: base,
    commissionAmount: 0, crossCommission, newCustomerBonus: 0,
    extraBatchesBonus: 0, attitudeBonus: 0, otherBonus, offDayDeduction, total,
  };
}

// Lương xưởng (Rule 8.10 / 12.10): bồi dưỡng mẻ vượt 10/ngày × 150k
export function calcFactoryPayroll(opts: {
  profile: Profile;
  year: number; month: number;
  productionDays: ProductionDay[]; attendance: Attendance[];
  settings: AppSettings; otherBonus?: number;
}): PayrollLine {
  const { profile, year, month, productionDays, attendance, settings } = opts;
  const mk = monthKey(year, month);
  const base = profile.baseSalary;

  const monthDays = productionDays.filter(d => d.status === "closed" && d.productionDate.startsWith(mk));
  const totalBatches = monthDays.reduce((s, d) => s + d.batch1Count + d.batch2Count, 0);
  const workingDays = monthDays.length;
  const extraBatches = Math.max(0, totalBatches - settings.factoryBatchThreshold * workingDays);
  const extraBatchesBonus = Math.round(extraBatches * settings.factoryExtraBatchBonus);

  const otherBonus = opts.otherBonus || 0;
  const offDayDeduction = offUnpaidDeduction(profile, year, month, attendance);
  const total = base + extraBatchesBonus + otherBonus - offDayDeduction;
  return {
    id: "", profileId: profile.id, baseSalary: base,
    commissionAmount: 0, crossCommission: 0, newCustomerBonus: 0,
    extraBatchesBonus, attitudeBonus: 0, otherBonus, offDayDeduction, total,
  };
}
