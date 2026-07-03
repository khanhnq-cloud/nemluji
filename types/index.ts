// ============================================================
// Domain model - Nem Nướng Nha Trang Internal Webapp (NNNT-CRM)
// Theo guideline mục 10 (database schema)
// ============================================================

export type Role =
  | "admin"
  | "manager"
  | "sale"
  | "warehouse_hn"
  | "factory_da"
  | "accountant";

export interface Profile {
  id: string;
  fullName: string;
  email: string;
  role: Role;
  baseSalary: number;
  commissionPct: number; // %, mặc định 5
  region?: string;
  status: "active" | "inactive";
}

export type CustomerGroup =
  | "quan_an_nha_hang" // Quán ăn / Nhà hàng
  | "sieu_thi_minimart" // Siêu thị / Minimart
  | "npp"
  | "le";

export interface Customer {
  id: string;
  customerCode: string;
  fullName: string;
  customerGroup: CustomerGroup;
  region: string;
  assignedSaleId: string; // id sale, hoặc "company" (do công ty phụ trách)
  source?: string;
  phone?: string; // SĐT liên hệ chính
  contactName?: string; // tên người phụ trách (B2B)
  contactPhone?: string; // SĐT người phụ trách (B2B)
  companyName?: string;
  companyAddress?: string;
  companyPhone?: string;
  companyFax?: string;
  legalRepresentative?: string;
  legalRepresentativeTitle?: string;
  status: "active" | "pause" | "lost";
  note?: string;
}

export interface CustomerBranch {
  id: string;
  branchCode: string; // KH-...-CN1
  customerId: string;
  branchName: string;
  address: string;
  phone: string;
  status: "active" | "paused";
  lastOrderDate?: string;
  avgOrderGapDays?: number;
  estNextOrderDate?: string;
}

export interface Product {
  id: string;
  sku: string;
  name: string;
  unit: string; // kg / túi
  defaultPrice: number;
  fixCost: number; // giá vốn cố định (dùng cho cost + hàng tặng)
  isActive: boolean;
}

export type PaymentStatus = "cash_done" | "da_ck" | "chua_ck" | "cong_no" | "tang";

export interface OrderItem {
  id: string;
  productId: string;
  quantity: number;
  unitPrice: number;
  isGift: boolean;
  fixCostUnit: number;
  lineRevenue: number; // isGift ? 0 : qty*unitPrice
  lineCost: number; // qty*fixCostUnit
}

export interface Order {
  id: string;
  orderCode: string;
  orderDate: string;
  customerId: string;
  branchId: string;
  saleId: string;
  items: OrderItem[];
  shipFee: number; // có thể âm
  discountSpecial: number; // VNĐ
  discountMonthlyPct: number; // % chiết khấu số lượng tại đơn hàng
  discountEarlyPayPct: number; // %, mặc định 2
  revenue: number; // subtotal
  revenueNet: number;
  cost: number;
  saleCommissionPct: number;
  saleCommission: number;
  profitNet: number;
  paymentStatus: PaymentStatus;
  status: "active" | "cancelled";
  cancelReason?: string;
  note?: string;
  createdAt: string; // thời điểm tạo đơn (ISO datetime, có giờ)
}

export type ReceiptStatus = "pending" | "waiting_admin" | "approved" | "rejected" | "cancelled";

export interface Receipt {
  id: string;
  receiptCode: string;
  orderId?: string;
  customerId: string;
  amount: number;
  paymentMethod: string; // cash / chuyển khoản
  receiptDate: string;
  status: ReceiptStatus;
  approvedBy?: string;
  approvedAt?: string;
  debtStatementId?: string;
  note?: string;
}

export interface DebtStatementOrderSnapshot {
  orderId: string;
  orderCode: string;
  orderDate: string;
  branchId: string;
  amount: number;
  paidAmount: number;
  grossAmount?: number;
  quantityDiscountPct?: number;
  quantityDiscountAmount?: number;
}

export type EarlyPaymentDiscountTiming = "before_vat" | "after_vat";

export interface DebtStatementLineSnapshot {
  description: string;
  unit: string;
  quantity: number;
  unitPrice: number;
  amount: number;
}

export interface DebtStatement {
  id: string;
  code: string; // CN-2026-06-...
  customerId: string;
  periodMonth: string; // YYYY-MM
  openingBalance: number;
  totalDue: number;
  totalPaid: number;
  closingBalance: number;
  status: "open" | "closed";
  receiptIds: string[];
  orderIds?: string[];
  orderSnapshots?: DebtStatementOrderSnapshot[];
  lineSnapshots?: DebtStatementLineSnapshot[];
  grossAmountBeforeQuantityDiscount?: number;
  quantityDiscountAppliedAtOrder?: boolean;
  quantityDiscountPct?: number;
  quantityDiscountAmount?: number;
  earlyPaymentDiscountPct?: number;
  earlyPaymentDiscountAmount?: number;
  earlyPaymentDiscountTiming?: EarlyPaymentDiscountTiming;
  taxableAmount?: number;
  vatPct?: number;
  vatAmount?: number;
  totalBeforeEarlyPaymentDiscount?: number;
  totalAfterVat?: number;
  createdAt?: string;
}

export type LeadStatus = "kem" | "trung_binh" | "tiem_nang" | "dang_chot" | "da_chot" | "mat";
export type VisitType = "gap" | "goi" | "zalo";

export interface LeadVisit {
  id: string;
  leadId: string;
  visitDate: string;
  visitType: VisitType;
  content: string;
  nextActionDate?: string;
  nextActionNote?: string;
  newSample: { productId: string; qty: number }[];
  createdBy: string;
}

export interface Lead {
  id: string;
  leadCode: string;
  saleId: string;
  customerName: string;
  region: string;
  customerGroup: CustomerGroup;
  phone: string;
  addresses: string[];
  offeredPrice?: number;
  offeredGiftProgram?: string;
  offeredDiscountProgram?: string;
  expectedRevenue?: number;
  sampleQtyTotal: number;
  sampleCostTotal: number;
  leadStatus: LeadStatus;
  convertedCustomerId?: string;
  convertedAt?: string;
  createdDate: string;
  visits: LeadVisit[];
}

export interface Material {
  id: string;
  name: string;
  unit: string;
  unitPrice: number;
  warningDays: number; // mặc định 3
  qty: number; // tồn kho hiện tại
  isActive: boolean;
}

export interface ProductionRecipe {
  materialId: string;
  batch1Rate: number; // định mức / mẻ 1
  batch2Rate: number; // định mức / mẻ 2
  note?: string;
}

export interface MaterialUsage {
  materialId: string;
  usedQty: number;
  unitPriceAtUse: number;
  totalCost: number;
}

export interface ProductionDay {
  id: string;
  productionCode: string; // PSX-2026-000001
  productionDate: string;
  batch1Count: number;
  batch2Count: number;
  outputKg: number;
  transferToClKg: number;
  factoryStockKgEnd: number;
  lossKg: number;
  lossPct: number;
  costPerKg: number;
  extraCostFactory: number;
  usages: MaterialUsage[];
  status: "open" | "closed";
  closedBy?: string;
  closedAt?: string;
  note?: string;
}

export interface RecoveryLog {
  id: string;
  logDate: string;
  productId: string; // sản phẩm recover (hút chân không → về tồn kho xưởng)
  qtyKg: number;
  note?: string;
  createdBy: string;
}

export interface DestructionLog {
  id: string;
  logDate: string;
  productId: string;
  warehouse: "factory" | "cl"; // tiêu huỷ từ kho nào
  qtyKg: number;
  unitCost: number; // = fix_cost sản phẩm
  totalLoss: number; // = fix_cost × số lượng (giá trị phiếu chi)
  reason: string;
  expenseId?: string; // link sang phiếu chi
  createdBy: string;
}

export interface Expense {
  id: string;
  code: string; // PC-2026-000001
  date: string;
  type: "destruction" | "factory_extra" | "other";
  amount: number;
  note?: string;
  refId?: string; // id chứng từ gốc (vd destruction log)
}

export interface StockTransfer {
  id: string;
  transferCode: string; // TR-2026-000001
  transferDate: string;
  productId: string;
  qtyKg: number;
  status: "pending" | "received" | "cancelled";
  receivedBy?: string;
  receivedAt?: string;
  note?: string;
}

export interface ClInventory {
  productId: string;
  qtyKg: number;
}

export interface Attendance {
  id: string;
  profileId: string;
  workDate: string;
  status: "work" | "off_paid" | "off_unpaid" | "half";
  note?: string;
}

export interface PayrollLine {
  id: string;
  profileId: string;
  baseSalary: number;
  commissionAmount: number;
  crossCommission: number;
  newCustomerBonus: number;
  extraBatchesBonus: number;
  attitudeBonus: number;
  otherBonus: number;
  offDayDeduction: number;
  total: number;
  note?: string;
}

export interface PayrollPeriod {
  id: string;
  code: string; // PL-2026-06
  year: number;
  month: number;
  status: "draft" | "approved" | "locked";
  approvedBy?: string;
  approvedAt?: string;
  lines: PayrollLine[];
}

export interface NewCustomerCredit {
  id: string;
  customerId: string;
  saleId: string;
  startMonth: string; // tháng bắt đầu đếm
  qualifyingMonth?: string; // tháng đủ 3 tháng
  bonusAmount: number;
  status: "pending_qualification" | "qualified" | "cancelled";
}

export interface AppSettings {
  defaultCommissionPct: number;
  defaultEarlyPayPct: number;
  newCustomerBonus: number;
  attitudeBonus: number;
  factoryBatchThreshold: number; // mẻ thường = 10
  factoryExtraBatchBonus: number; // 150000
  crossCommissionPct: number; // 1%
  crossCommissionFromSaleId?: string; // sale nào
  crossCommissionToProfileId?: string; // kho nào
  nvlWarningDays: number; // 3
}
