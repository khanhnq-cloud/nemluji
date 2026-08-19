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

// Cấp bậc trong xưởng — quyết định công thức lương (chỉ quản lý mới có mẻ làm thêm)
export type FactoryLevel = "manager" | "staff";

export interface Profile {
  id: string;
  fullName: string;
  email: string;
  role: Role;
  baseSalary: number;
  commissionPct: number; // % hoa hồng trên đơn đã thu tiền, mặc định 5
  debtCommissionPct?: number; // % hoa hồng trên công nợ kỳ trước thu được
  factoryLevel?: FactoryLevel; // chỉ dùng khi role = factory_da, mặc định staff
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
  isFactoryOutput?: boolean; // là thành phẩm của xưởng → hiện thành cột trong Sổ Xưởng
}

// Số lượng thành phẩm theo sản phẩm (tồn kho / output / chuyển kho tách loại)
export interface ProductQty { productId: string; qtyKg: number; }
// Số lượng NVL theo nguyên liệu (tồn đầu / cuối / nhập thêm trong Sổ Xưởng)
export interface MaterialQty { materialId: string; qty: number; }

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
  sortOrder?: number; // thứ tự cột trong Sổ Xưởng
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
  // Tổng (dẫn xuất từ các mảng bên dưới — giữ để tương thích dashboard/report)
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

  // --- Sổ Xưởng: chi tiết theo loại thành phẩm ---
  outputs?: ProductQty[];        // Ra thành phẩm, tách TT/TTC/Ngắn/Vụn...
  transfersOut?: ProductQty[];   // Mang về Kho CL, tách loại
  factoryStockOpen?: ProductQty[];  // Kho Xưởng đầu ngày = tồn cuối ngày SX trước
  factoryStockEnd?: ProductQty[];   // Tổng Kho Xưởng = open + output − transferOut

  // --- Sổ Xưởng: chi tiết NVL trong ngày ---
  materialOpening?: MaterialQty[];   // tồn đầu ngày
  materialClosing?: MaterialQty[];   // tồn cuối ngày (tự trừ định mức)
  materialIntake?: MaterialQty[];    // dòng "+nhập" trong ngày

  // --- Snapshot cấu hình tại thời điểm chốt (giữ toàn vẹn lịch sử) ---
  recipeSnapshot?: ProductionRecipe[];
  standardOutputPerBatch2?: number;  // sản lượng chuẩn / mẻ 2
  materialCostPerBatch2?: number;    // chi phí NVL / mẻ 2
  lossPerBatch?: number;             // hao hụt / mẻ
  materialStockValueEnd?: number;    // giá trị tồn NVL cuối ngày
}

export interface RecoveryLog {
  id: string;
  logDate: string;
  productId: string; // sản phẩm recover (hút chân không lại → về kho recover)
  qtyKg: number;
  note?: string;
  createdBy: string;
  mckLogId?: string;        // nguồn: hàng MCK cần recover
  transferId?: string;      // phiếu chuyển CL → Xưởng
  sentToFactoryDate?: string; // ngày chuyển sang xưởng
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

export type ExpenseType =
  | "destruction"
  | "mck_ship"
  | "factory_extra"
  | "shipping"
  | "materials"
  | "marketing"
  | "utilities"
  | "salary"
  | "other";

export type ExpensePaymentMethod = "cash" | "bank_transfer";

export interface Expense {
  id: string;
  code: string; // PC-2026-000001
  date: string;
  type: ExpenseType;
  amount: number;
  paymentMethod?: ExpensePaymentMethod;
  payee?: string;
  note?: string;
  refId?: string; // id chứng từ gốc (vd destruction log)
  createdBy?: string;
  createdAt?: string;
}

export type TransferDirection = "factory_to_cl" | "cl_to_factory" | "recover_to_cl";

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
  direction?: TransferDirection; // mặc định factory_to_cl (tương thích dữ liệu cũ)
  shipFee?: number;              // phí ship (chuyển MCK về xưởng) → sinh phiếu chi
  expenseId?: string;           // phiếu chi phí ship
  mckLogId?: string;            // nguồn hàng MCK
}

// --- MCK: hàng mất chân không tại Kho Cát Linh ---
export type MckStatus =
  | "pending"         // chờ xử lý tại CL
  | "revacuumed_cl"   // hút lại được tại CL → về tồn bán được
  | "destroyed"       // tiêu huỷ
  | "sent_to_factory" // đã tạo phiếu chuyển về xưởng
  | "recovered"       // xưởng đã hút lại → kho recover
  | "returned_cl";    // đã chuyển lại về CL

export interface MckLog {
  id: string;
  code: string; // MCK-2026-000001
  logDate: string;
  productId: string;
  qtyKg: number;
  status: MckStatus;
  transferId?: string;     // phiếu chuyển CL → Xưởng
  destructionId?: string;
  expenseId?: string;
  resolvedQty?: number;    // đã xử lý (hút lại/tiêu huỷ/chuyển)
  note?: string;
  createdBy: string;
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

// 3 nhóm tính lương (mục 12.5 / 12.10)
export type PayrollGroup = "sale" | "factory_manager" | "factory_staff" | "standard";

export interface PayrollLine {
  id: string;
  profileId: string;
  group: PayrollGroup;

  baseSalary: number; // lương cứng theo hồ sơ (đủ tháng)
  baseSalaryEarned: number; // thực nhận: nhóm xưởng chia theo ngày công, còn lại = baseSalary

  // --- Nhóm xưởng ---
  monthDays: number; // số ngày trong tháng
  workedDays: number; // số ngày đi làm
  extraBatches: number; // số mẻ làm thêm (chỉ quản lý xưởng)
  extraBatchRate: number; // chi phí / mẻ
  extraBatchesAmount: number;
  overtimeDays: number; // số ngày làm tăng ca
  overtimeDayRate: number; // chi phí / ngày
  overtimeAmount: number;

  // --- Nhóm sale + quản lý ---
  commissionPct: number; // % hoa hồng đơn đã thu tiền trong tháng
  commissionBase: number;
  commissionAmount: number;
  debtCommissionPct: number; // % hoa hồng công nợ kỳ trước thu được trong tháng
  debtCommissionBase: number;
  debtCommissionAmount: number;

  // --- Chung ---
  adjustment: number; // thưởng (+) / phạt (−) tuỳ chỉnh
  adjustmentReason?: string;

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
  defaultCommissionPct: number; // % hoa hồng đơn đã thu tiền
  defaultDebtCommissionPct: number; // % hoa hồng công nợ kỳ trước thu được
  defaultEarlyPayPct: number;
  factoryBatchThreshold: number; // mẻ thường/ngày = 10, vượt ngưỡng tính mẻ làm thêm
  factoryExtraBatchBonus: number; // chi phí / mẻ làm thêm
  factoryOvertimeDayBonus: number; // chi phí / ngày làm tăng ca
  nvlWarningDays: number; // 3
  standardOutputPerBatch2: number; // sản lượng chuẩn / mẻ 2 (sổ: 33.5) → hao hụt/mẻ
  materialCostPerBatch2: number;   // chi phí NVL / mẻ 2 (sổ: 1.674.323) → giá thành/kg
  plannedBatchesPerDay: number;    // số mẻ dự kiến/ngày cho dự báo NVL còn dùng được
}
