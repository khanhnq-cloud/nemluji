import type {
  Profile, Customer, CustomerBranch, Product, Order, Receipt,
  DebtStatement, Lead, Material, ProductionRecipe, ProductionDay,
  StockTransfer, ClInventory, Attendance, PayrollPeriod, RecoveryLog,
  DestructionLog, NewCustomerCredit, AppSettings, Expense,
} from "@/types";

const today = new Date();
const iso = (d: Date) => d.toISOString().slice(0, 10);
const daysAgo = (n: number) => { const d = new Date(today); d.setDate(d.getDate() - n); return iso(d); };
const dtAgo = (n: number, h: number, m: number) => { const d = new Date(today); d.setDate(d.getDate() - n); d.setHours(h, m, 0, 0); return d.toISOString(); };

// ---------- Profiles (users) ----------
export const PROFILES: Profile[] = [
  { id: "u_admin",   fullName: "Chủ DN",       email: "admin@nnnt.vn",   role: "admin",        baseSalary: 0,          commissionPct: 0, status: "active" },
  { id: "u_manager", fullName: "Quản lý Vận hành", email: "manager@nnnt.vn", role: "manager",  baseSalary: 18_000_000, commissionPct: 0, status: "active" },
  { id: "u_hoa",     fullName: "Nguyễn Thị Hoa", email: "hoa@nnnt.vn",   role: "sale",         baseSalary: 6_000_000,  commissionPct: 5, region: "Hoàn Kiếm", status: "active" },
  { id: "u_manh",    fullName: "Trần Văn Mạnh",  email: "manh@nnnt.vn",  role: "sale",         baseSalary: 6_000_000,  commissionPct: 5, region: "Hai Bà Trưng", status: "active" },
  { id: "u_ngoc",    fullName: "Lê Thị Ngọc",    email: "ngoc@nnnt.vn",  role: "sale",         baseSalary: 6_000_000,  commissionPct: 5, region: "Đông Anh", status: "active" },
  { id: "u_hieu",    fullName: "Phạm Văn Hiếu",  email: "hieu@nnnt.vn",  role: "warehouse_hn", baseSalary: 8_000_000,  commissionPct: 0, status: "active" },
  { id: "u_factory", fullName: "Đỗ Văn Tâm",     email: "xuong@nnnt.vn", role: "factory_da",   baseSalary: 9_000_000,  commissionPct: 0, status: "active" },
  { id: "u_acc",     fullName: "Vũ Thị Kế Toán", email: "ketoan@nnnt.vn", role: "accountant",  baseSalary: 10_000_000, commissionPct: 0, status: "active" },
];

// ---------- Products ----------
export const PRODUCTS: Product[] = [
  { id: "p_tt",   sku: "TT",   name: "Nem nướng TT",   unit: "kg",  defaultPrice: 220000, fixCost: 150000, isActive: true },
  { id: "p_ttc",  sku: "TTC",  name: "Nem nướng TTC",  unit: "kg",  defaultPrice: 260000, fixCost: 175000, isActive: true },
  { id: "p_vun",  sku: "VUN",  name: "Nem vụn",        unit: "kg",  defaultPrice: 160000, fixCost: 110000, isActive: true },
  { id: "p_cham", sku: "CHAM", name: "Nước chấm",      unit: "túi", defaultPrice: 25000,  fixCost: 12000,  isActive: true },
  { id: "p_ram",  sku: "RAM",  name: "Ram giòn",       unit: "kg",  defaultPrice: 240000, fixCost: 165000, isActive: true },
];

// ---------- Customers + Branches ----------
export const CUSTOMERS: Customer[] = [
  { id: "c_khanh",  customerCode: "KH-2026-000001", fullName: "Anh Khánh",       customerGroup: "quan_an_nha_hang",  region: "Ba Đình",   assignedSaleId: "u_hoa",  source: "Sales thị trường", phone: "0911000001", contactName: "Anh Khánh", contactPhone: "0911000001", status: "active" },
  { id: "c_hapro",  customerCode: "KH-2026-000002", fullName: "Siêu thị Hapro",  customerGroup: "sieu_thi_minimart", region: "Hoàn Kiếm", assignedSaleId: "u_manh", source: "Facebook / TikTok", phone: "0911000002", contactName: "Chị Lan (thu mua)", contactPhone: "0911000022", status: "active" },
  { id: "c_npp_da", customerCode: "KH-2026-000003", fullName: "NPP Đông Anh",    customerGroup: "npp",               region: "Đông Anh",  assignedSaleId: "u_ngoc", source: "Giới thiệu", phone: "0911000003", contactName: "Anh Tuấn", contactPhone: "0911000033", status: "active" },
  { id: "c_le",     customerCode: "KH-2026-000004", fullName: "Cô Mai (lẻ)",     customerGroup: "le",                region: "Cầu Giấy",  assignedSaleId: "u_hoa",  source: "Website", phone: "0911000004", status: "active" },
];

// Anh Khánh có 2 chi nhánh (Phố Súng + Văn Cao) — ví dụ trong file nguồn
export const CUSTOMER_BRANCHES: CustomerBranch[] = [
  { id: "b_khanh_sung", branchCode: "KH-2026-000001-CN1", customerId: "c_khanh", branchName: "Khánh - Phố Súng", address: "12 Phố Súng, Hà Nội", phone: "0911000001", status: "active", lastOrderDate: daysAgo(5),  avgOrderGapDays: 7,  estNextOrderDate: daysAgo(-2) },
  { id: "b_khanh_vc",   branchCode: "KH-2026-000001-CN2", customerId: "c_khanh", branchName: "Khánh - Văn Cao",  address: "55 Văn Cao, Hà Nội",  phone: "0911000011", status: "active", lastOrderDate: daysAgo(15), avgOrderGapDays: 14, estNextOrderDate: daysAgo(1)  },
  { id: "b_hapro",      branchCode: "KH-2026-000002-CN1", customerId: "c_hapro", branchName: "Hapro Hàng Bài",   address: "1 Hàng Bài, Hà Nội",  phone: "0911000002", status: "active", lastOrderDate: daysAgo(8),  avgOrderGapDays: 10, estNextOrderDate: daysAgo(-2) },
  { id: "b_npp",        branchCode: "KH-2026-000003-CN1", customerId: "c_npp_da", branchName: "NPP Đông Anh",    address: "Tổ 5 Đông Anh",       phone: "0911000003", status: "active", lastOrderDate: daysAgo(20), avgOrderGapDays: 14, estNextOrderDate: daysAgo(6)  },
  { id: "b_le",         branchCode: "KH-2026-000004-CN1", customerId: "c_le",    branchName: "Cô Mai",          address: "Cầu Giấy, Hà Nội",    phone: "0911000004", status: "active", lastOrderDate: daysAgo(2),  avgOrderGapDays: 4,  estNextOrderDate: daysAgo(-2) },
];

// ---------- Orders ----------
// Sử dụng giá trị đã tính sẵn cho khớp logic (xem lib/calc/discount.ts)
export const ORDERS: Order[] = [
  {
    id: "o1", orderCode: "DH-2026-000001", orderDate: daysAgo(5), createdAt: dtAgo(5, 9, 15),
    customerId: "c_khanh", branchId: "b_khanh_sung", saleId: "u_hoa",
    items: [
      { id: "oi1", productId: "p_tt",   quantity: 10, unitPrice: 220000, isGift: false, fixCostUnit: 150000, lineRevenue: 2200000, lineCost: 1500000 },
      { id: "oi2", productId: "p_cham", quantity: 20, unitPrice: 25000,  isGift: false, fixCostUnit: 12000,  lineRevenue: 500000,  lineCost: 240000 },
      { id: "oi3", productId: "p_cham", quantity: 5,  unitPrice: 25000,  isGift: true,  fixCostUnit: 12000,  lineRevenue: 0,       lineCost: 60000 },
    ],
    shipFee: 50000, discountSpecial: 0, discountMonthlyPct: 8, discountEarlyPayPct: 2,
    revenue: 2700000, revenueNet: 2384320, cost: 1800000, saleCommissionPct: 5, saleCommission: 119216, profitNet: 465104,
    paymentStatus: "cash_done", status: "active",
  },
  {
    id: "o2", orderCode: "DH-2026-000002", orderDate: daysAgo(15), createdAt: dtAgo(15, 14, 30),
    customerId: "c_khanh", branchId: "b_khanh_vc", saleId: "u_hoa",
    items: [
      { id: "oi4", productId: "p_ttc", quantity: 8, unitPrice: 260000, isGift: false, fixCostUnit: 175000, lineRevenue: 2080000, lineCost: 1400000 },
    ],
    shipFee: 30000, discountSpecial: 0, discountMonthlyPct: 8, discountEarlyPayPct: 0,
    revenue: 2080000, revenueNet: 1883600, cost: 1400000, saleCommissionPct: 5, saleCommission: 94180, profitNet: 389420,
    paymentStatus: "cong_no", status: "active",
  },
  {
    id: "o3", orderCode: "DH-2026-000003", orderDate: daysAgo(8), createdAt: dtAgo(8, 10, 5),
    customerId: "c_hapro", branchId: "b_hapro", saleId: "u_manh",
    items: [
      { id: "oi5", productId: "p_tt",  quantity: 25, unitPrice: 220000, isGift: false, fixCostUnit: 150000, lineRevenue: 5500000, lineCost: 3750000 },
      { id: "oi6", productId: "p_ram", quantity: 10, unitPrice: 240000, isGift: false, fixCostUnit: 165000, lineRevenue: 2400000, lineCost: 1650000 },
    ],
    shipFee: 100000, discountSpecial: 200000, discountMonthlyPct: 10, discountEarlyPayPct: 2,
    revenue: 7900000, revenueNet: 6691400, cost: 5400000, saleCommissionPct: 5, saleCommission: 334570, profitNet: 956830,
    paymentStatus: "da_ck", status: "active",
  },
  {
    id: "o4", orderCode: "DH-2026-000004", orderDate: daysAgo(20), createdAt: dtAgo(20, 16, 45),
    customerId: "c_npp_da", branchId: "b_npp", saleId: "u_ngoc",
    items: [
      { id: "oi7", productId: "p_tt", quantity: 40, unitPrice: 215000, isGift: false, fixCostUnit: 150000, lineRevenue: 8600000, lineCost: 6000000 },
    ],
    shipFee: -150000, discountSpecial: 0, discountMonthlyPct: 8, discountEarlyPayPct: 0,
    revenue: 8600000, revenueNet: 8062000, cost: 6000000, saleCommissionPct: 5, saleCommission: 403100, profitNet: 1658900,
    paymentStatus: "cong_no", status: "active",
  },
  {
    id: "o5", orderCode: "DH-2026-000005", orderDate: daysAgo(2), createdAt: dtAgo(2, 11, 20),
    customerId: "c_le", branchId: "b_le", saleId: "u_hoa",
    items: [
      { id: "oi8", productId: "p_tt", quantity: 2, unitPrice: 240000, isGift: false, fixCostUnit: 150000, lineRevenue: 480000, lineCost: 300000 },
    ],
    shipFee: 20000, discountSpecial: 0, discountMonthlyPct: 0, discountEarlyPayPct: 0,
    revenue: 480000, revenueNet: 460000, cost: 300000, saleCommissionPct: 5, saleCommission: 23000, profitNet: 137000,
    paymentStatus: "cash_done", status: "active",
  },
];

// ---------- Receipts (sinh tự động từ orders) ----------
export const RECEIPTS: Receipt[] = [
  { id: "r1", receiptCode: "PT-2026-000001", orderId: "o1", customerId: "c_khanh",  amount: 2384320, paymentMethod: "cash",         receiptDate: daysAgo(5),  status: "approved", approvedBy: "u_admin", approvedAt: daysAgo(5) },
  { id: "r2", receiptCode: "PT-2026-000002", orderId: "o2", customerId: "c_khanh",  amount: 1883600, paymentMethod: "chuyển khoản", receiptDate: daysAgo(15), status: "pending" },
  { id: "r3", receiptCode: "PT-2026-000003", orderId: "o3", customerId: "c_hapro",  amount: 6691400, paymentMethod: "chuyển khoản", receiptDate: daysAgo(8),  status: "waiting_admin" },
  { id: "r4", receiptCode: "PT-2026-000004", orderId: "o4", customerId: "c_npp_da", amount: 8062000, paymentMethod: "chuyển khoản", receiptDate: daysAgo(20), status: "pending" },
  { id: "r5", receiptCode: "PT-2026-000005", orderId: "o5", customerId: "c_le",     amount: 460000,  paymentMethod: "cash",         receiptDate: daysAgo(2),  status: "approved", approvedBy: "u_admin", approvedAt: daysAgo(2) },
];

export const DEBT_STATEMENTS: DebtStatement[] = [];

// ---------- Leads + Visits ----------
export const LEADS: Lead[] = [
  {
    id: "l1", leadCode: "LD-2026-000001", saleId: "u_hoa", customerName: "Quán Phở Thái", region: "Đống Đa",
    customerGroup: "quan_an_nha_hang", phone: "0922000001", addresses: ["Thái Thịnh, Đống Đa"],
    offeredPrice: 220000, offeredGiftProgram: "Tặng 1kg/10kg", expectedRevenue: 5000000,
    sampleQtyTotal: 2, sampleCostTotal: 300000, leadStatus: "tiem_nang", createdDate: daysAgo(10),
    visits: [
      { id: "v1", leadId: "l1", visitDate: daysAgo(10), visitType: "gap", content: "Gặp chủ quán, để lại 2kg nem thử", newSample: [{ productId: "p_tt", qty: 2 }], nextActionDate: daysAgo(-2), nextActionNote: "Quay lại lấy feedback", createdBy: "u_hoa" },
    ],
  },
  {
    id: "l2", leadCode: "LD-2026-000002", saleId: "u_manh", customerName: "Nhà hàng Sen", region: "Tây Hồ",
    customerGroup: "quan_an_nha_hang", phone: "0922000002", addresses: ["Thanh Niên, Tây Hồ"],
    offeredPrice: 255000, expectedRevenue: 8000000,
    sampleQtyTotal: 3, sampleCostTotal: 525000, leadStatus: "dang_chot", createdDate: daysAgo(20),
    visits: [
      { id: "v2", leadId: "l2", visitDate: daysAgo(20), visitType: "gap", content: "Phát 3kg TTC", newSample: [{ productId: "p_ttc", qty: 3 }], createdBy: "u_manh" },
      { id: "v3", leadId: "l2", visitDate: daysAgo(7),  visitType: "goi", content: "Bếp trưởng phản hồi tốt, đang chờ duyệt ngân sách", nextActionDate: daysAgo(-1), nextActionNote: "Chốt hợp đồng tháng", newSample: [], createdBy: "u_manh" },
    ],
  },
];

// ---------- Materials + Recipe (mục 8.5.2) ----------
export const MATERIALS: Material[] = [
  { id: "m_ga",    name: "Thịt gà",   unit: "kg", unitPrice: 80000,  warningDays: 3, qty: 120, isActive: true },
  { id: "m_mo",    name: "Mỡ",        unit: "kg", unitPrice: 45000,  warningDays: 3, qty: 90,  isActive: true },
  { id: "m_toi",   name: "Tỏi",       unit: "kg", unitPrice: 50000,  warningDays: 3, qty: 8,   isActive: true },
  { id: "m_hanh",  name: "Hành",      unit: "kg", unitPrice: 30000,  warningDays: 3, qty: 9,   isActive: true },
  { id: "m_botsa", name: "Bột sả",    unit: "kg", unitPrice: 90000,  warningDays: 3, qty: 4,   isActive: true },
  { id: "m_botv",  name: "Bột vàng",  unit: "kg", unitPrice: 70000,  warningDays: 3, qty: 3,   isActive: true },
  { id: "m_aaa",   name: "AAA",       unit: "kg", unitPrice: 120000, warningDays: 3, qty: 2,   isActive: true },
  { id: "m_tieu",  name: "Tiêu",      unit: "kg", unitPrice: 250000, warningDays: 3, qty: 1.5, isActive: true },
  { id: "m_mam",   name: "Mắm (L)",   unit: "L",  unitPrice: 35000,  warningDays: 3, qty: 18,  isActive: true },
  { id: "m_duong", name: "Đường",     unit: "kg", unitPrice: 22000,  warningDays: 3, qty: 30,  isActive: true },
  { id: "m_muoi",  name: "Muối đỏ",   unit: "kg", unitPrice: 18000,  warningDays: 3, qty: 12,  isActive: true },
  { id: "m_michinh", name: "Mì chính", unit: "kg", unitPrice: 60000, warningDays: 3, qty: 6,   isActive: true },
  { id: "m_cbq",   name: "CBQ",       unit: "kg", unitPrice: 90000,  warningDays: 3, qty: 4,   isActive: true },
  { id: "m_hhht",  name: "HHHT",      unit: "đv", unitPrice: 110000, warningDays: 3, qty: 20,  isActive: true },
  { id: "m_gio",   name: "Giò thừa",  unit: "kg", unitPrice: 70000,  warningDays: 3, qty: 10,  isActive: true },
];

export const RECIPES: ProductionRecipe[] = [
  { materialId: "m_ga",    batch1Rate: 9,     batch2Rate: 3.5 },
  { materialId: "m_mo",    batch1Rate: 8,     batch2Rate: 6 },
  { materialId: "m_toi",   batch1Rate: 0,     batch2Rate: 0.7 },
  { materialId: "m_hanh",  batch1Rate: 0,     batch2Rate: 0.7 },
  { materialId: "m_botsa", batch1Rate: 0,     batch2Rate: 0.245 },
  { materialId: "m_botv",  batch1Rate: 0,     batch2Rate: 0.1 },
  { materialId: "m_aaa",   batch1Rate: 0,     batch2Rate: 0.08 },
  { materialId: "m_tieu",  batch1Rate: 0,     batch2Rate: 0.06 },
  { materialId: "m_mam",   batch1Rate: 0.575, batch2Rate: 0 },
  { materialId: "m_duong", batch1Rate: 1,     batch2Rate: 0 },
  { materialId: "m_muoi",  batch1Rate: 0.126, batch2Rate: 0 },
  { materialId: "m_michinh", batch1Rate: 0.2, batch2Rate: 0 },
  { materialId: "m_cbq",   batch1Rate: 0.075, batch2Rate: 0 },
  { materialId: "m_hhht",  batch1Rate: 1,     batch2Rate: 0 },
  { materialId: "m_gio",   batch1Rate: 0,     batch2Rate: 0 },
];

// ---------- Production days ----------
export const PRODUCTION_DAYS: ProductionDay[] = [
  {
    id: "pd1", productionCode: "PSX-2026-000001", productionDate: daysAgo(1),
    batch1Count: 5, batch2Count: 5, outputKg: 78, transferToClKg: 60, factoryStockKgEnd: 18,
    lossKg: 7, lossPct: 8.2, costPerKg: 95000, extraCostFactory: 150000,
    usages: [], status: "closed", closedBy: "u_factory", closedAt: daysAgo(1),
  },
];

export const STOCK_TRANSFERS: StockTransfer[] = [
  { id: "t1", transferCode: "TR-2026-000001", transferDate: daysAgo(1), productId: "p_tt", qtyKg: 60, status: "received", receivedBy: "u_hieu", receivedAt: daysAgo(1) },
];

// Tồn kho thành phẩm tại Kho CL Hà Nội (bán hàng trừ từ đây)
export const CL_INVENTORY: ClInventory[] = [
  { productId: "p_tt",   qtyKg: 35 },
  { productId: "p_ttc",  qtyKg: 12 },
  { productId: "p_vun",  qtyKg: 5 },
  { productId: "p_cham", qtyKg: 80 },
  { productId: "p_ram",  qtyKg: 8 },
];

// Tồn kho thành phẩm tại Xưởng Đông Anh (sản xuất + recover cộng vào đây; chuyển kho trừ ra)
export const FACTORY_INVENTORY: ClInventory[] = [
  { productId: "p_tt",   qtyKg: 18 },
  { productId: "p_ttc",  qtyKg: 5 },
  { productId: "p_vun",  qtyKg: 2 },
  { productId: "p_cham", qtyKg: 10 },
  { productId: "p_ram",  qtyKg: 3 },
];

export const EXPENSES: Expense[] = [];
export const RECOVERY_LOGS: RecoveryLog[] = [];
export const DESTRUCTION_LOGS: DestructionLog[] = [];
export const ATTENDANCE: Attendance[] = [];
export const PAYROLL_PERIODS: PayrollPeriod[] = [];
export const NEW_CUSTOMER_CREDITS: NewCustomerCredit[] = [];

export const DEFAULT_SETTINGS: AppSettings = {
  defaultCommissionPct: 5,
  defaultEarlyPayPct: 2,
  newCustomerBonus: 100000,
  attitudeBonus: 1000000,
  factoryBatchThreshold: 10,
  factoryExtraBatchBonus: 150000,
  crossCommissionPct: 1,
  crossCommissionFromSaleId: "u_hoa",
  crossCommissionToProfileId: "u_hieu",
  nvlWarningDays: 3,
};

// Quận/huyện Hà Nội (khu vực sale). Ngoại tỉnh/khác → cho phép nhập tay ở form.
export const REGIONS = [
  "Ba Đình", "Hoàn Kiếm", "Hai Bà Trưng", "Đống Đa", "Tây Hồ", "Cầu Giấy",
  "Thanh Xuân", "Hoàng Mai", "Long Biên", "Nam Từ Liêm", "Bắc Từ Liêm", "Hà Đông",
  "Đông Anh", "Gia Lâm", "Thanh Trì", "Hoài Đức", "Đan Phượng", "Sóc Sơn", "Mê Linh",
];

export const SOURCES = ["Facebook / TikTok", "Website", "Giới thiệu", "Sales thị trường", "Khác"];

export const DEMO_USERS = PROFILES.map(p => ({
  email: p.email,
  password: "123456",
  profileId: p.id,
  fullName: p.fullName,
  role: p.role,
}));
