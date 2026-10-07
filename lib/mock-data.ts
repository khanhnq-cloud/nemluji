import type {
  Profile, Customer, CustomerBranch, Product, Order, Receipt,
  DebtStatement, Lead, Material, ProductionRecipe, ProductionDay,
  StockTransfer, ClInventory, Attendance, PayrollPeriod, RecoveryLog,
  DestructionLog, NewCustomerCredit, AppSettings, Expense, MckLog,
} from "@/types";

// ---------- Profiles (users) ----------
// Chỉ 2 tài khoản: 1 admin + 1 nhân viên (khớp với user trong Supabase Auth theo email).
export const PROFILES: Profile[] = [
  { id: "u_admin", fullName: "Quản trị viên", email: "admin@nnnt.vn",    role: "admin", baseSalary: 0, commissionPct: 0, status: "active" },
  { id: "u_sale",  fullName: "Nhân viên",     email: "nhanvien@nnnt.vn", role: "sale",  baseSalary: 0, commissionPct: 5, debtCommissionPct: 3, status: "active" },
];

// ---------- Products (danh mục) ----------
// isFactoryOutput = thành phẩm của xưởng → hiện thành cột trong Sổ Xưởng (TT/TTC/Ngắn/Vụn)
export const PRODUCTS: Product[] = [
  { id: "p_tt",   sku: "TT",   name: "Nem nướng TT",   unit: "kg",  defaultPrice: 220000, fixCost: 150000, isActive: true, isFactoryOutput: true },
  { id: "p_ttc",  sku: "TTC",  name: "Nem nướng TTC",  unit: "kg",  defaultPrice: 260000, fixCost: 175000, isActive: true, isFactoryOutput: true },
  { id: "p_ngan", sku: "NGAN", name: "Nem ngắn",       unit: "kg",  defaultPrice: 180000, fixCost: 125000, isActive: true, isFactoryOutput: true },
  { id: "p_vun",  sku: "VUN",  name: "Nem vụn",        unit: "kg",  defaultPrice: 160000, fixCost: 110000, isActive: true, isFactoryOutput: true },
  { id: "p_cham", sku: "CHAM", name: "Nước chấm",      unit: "túi", defaultPrice: 25000,  fixCost: 12000,  isActive: true, isFactoryOutput: false },
  { id: "p_ram",  sku: "RAM",  name: "Ram giòn",       unit: "kg",  defaultPrice: 240000, fixCost: 165000, isActive: true, isFactoryOutput: false },
];

// ---------- Dữ liệu nghiệp vụ: để trống ----------
export const CUSTOMERS: Customer[] = [];
export const CUSTOMER_BRANCHES: CustomerBranch[] = [];
export const ORDERS: Order[] = [];
export const RECEIPTS: Receipt[] = [];
export const DEBT_STATEMENTS: DebtStatement[] = [];
export const LEADS: Lead[] = [];

// ---------- Materials + Recipe (danh mục NVL + định mức, tồn kho = 0) ----------
// Đơn giá + định mức lấy theo sổ "Kiểm Kho" (file Quản Lý Xưởng.xlsx). sortOrder = thứ tự cột sổ.
// Tỏi / Hành / Thịt xay / Giò thừa: theo dõi tồn nhưng KHÔNG có định mức trừ tự động.
export const MATERIALS: Material[] = [
  { id: "m_ga",    name: "Thịt gà",   unit: "kg", unitPrice: 67000,  warningDays: 3, qty: 0, isActive: true, sortOrder: 1 },
  { id: "m_mo",    name: "Mỡ",        unit: "kg", unitPrice: 38000,  warningDays: 3, qty: 0, isActive: true, sortOrder: 2 },
  { id: "m_nac",   name: "Thịt nạc",  unit: "kg", unitPrice: 58000,  warningDays: 3, qty: 0, isActive: true, sortOrder: 3 },
  { id: "m_toi",   name: "Tỏi",       unit: "kg", unitPrice: 50000,  warningDays: 3, qty: 0, isActive: true, sortOrder: 4 },
  { id: "m_hanh",  name: "Hành",      unit: "kg", unitPrice: 30000,  warningDays: 3, qty: 0, isActive: true, sortOrder: 5 },
  { id: "m_botsa", name: "Bột sả",    unit: "kg", unitPrice: 150000, warningDays: 3, qty: 0, isActive: true, sortOrder: 6 },
  { id: "m_botv",  name: "Bột vàng",  unit: "kg", unitPrice: 300000, warningDays: 3, qty: 0, isActive: true, sortOrder: 7 },
  { id: "m_aaa",   name: "AAA",       unit: "kg", unitPrice: 270000, warningDays: 3, qty: 0, isActive: true, sortOrder: 8 },
  { id: "m_tieu",  name: "Tiêu",      unit: "kg", unitPrice: 170000, warningDays: 3, qty: 0, isActive: true, sortOrder: 9 },
  { id: "m_mam",   name: "Mắm (L)",   unit: "L",  unitPrice: 13000,  warningDays: 3, qty: 0, isActive: true, sortOrder: 10 },
  { id: "m_duong", name: "Đường",     unit: "kg", unitPrice: 19200,  warningDays: 3, qty: 0, isActive: true, sortOrder: 11 },
  { id: "m_muoi",  name: "Muối đỏ",   unit: "kg", unitPrice: 80000,  warningDays: 3, qty: 0, isActive: true, sortOrder: 12 },
  { id: "m_michinh", name: "Mì chính", unit: "kg", unitPrice: 41000, warningDays: 3, qty: 0, isActive: true, sortOrder: 13 },
  { id: "m_cbq",   name: "CBQ",       unit: "kg", unitPrice: 140000, warningDays: 3, qty: 0, isActive: true, sortOrder: 14 },
  { id: "m_hhht",  name: "HHHT",      unit: "đv", unitPrice: 85500,  warningDays: 3, qty: 0, isActive: true, sortOrder: 15 },
  { id: "m_xay",   name: "Thịt xay",  unit: "kg", unitPrice: 0,      warningDays: 3, qty: 0, isActive: true, sortOrder: 16 },
  { id: "m_gio",   name: "Giò thừa",  unit: "kg", unitPrice: 70000,  warningDays: 3, qty: 0, isActive: true, sortOrder: 17 },
];

export const RECIPES: ProductionRecipe[] = [
  { materialId: "m_ga",    batch1Rate: 10,     batch2Rate: 0 },
  { materialId: "m_mo",    batch1Rate: 7,      batch2Rate: 6 },
  { materialId: "m_nac",   batch1Rate: 0,      batch2Rate: 4 },
  { materialId: "m_toi",   batch1Rate: 0,      batch2Rate: 0 },
  { materialId: "m_hanh",  batch1Rate: 0,      batch2Rate: 0 },
  { materialId: "m_botsa", batch1Rate: 0,      batch2Rate: 0.245 },
  { materialId: "m_botv",  batch1Rate: 0,      batch2Rate: 0.1 },
  { materialId: "m_aaa",   batch1Rate: 0,      batch2Rate: 0.1 },
  { materialId: "m_tieu",  batch1Rate: 0,      batch2Rate: 0.06 },
  { materialId: "m_mam",   batch1Rate: 0.575,  batch2Rate: 0 },
  { materialId: "m_duong", batch1Rate: 1,      batch2Rate: 0 },
  { materialId: "m_muoi",  batch1Rate: 0.1874, batch2Rate: 0 },
  { materialId: "m_michinh", batch1Rate: 0.2,  batch2Rate: 0 },
  { materialId: "m_cbq",   batch1Rate: 0.075,  batch2Rate: 0 },
  { materialId: "m_hhht",  batch1Rate: 1,      batch2Rate: 0 },
  { materialId: "m_xay",   batch1Rate: 0,      batch2Rate: 0 },
  { materialId: "m_gio",   batch1Rate: 0,      batch2Rate: 0 },
];

export const PRODUCTION_DAYS: ProductionDay[] = [];
export const STOCK_TRANSFERS: StockTransfer[] = [];

// Tồn kho thành phẩm: mỗi sản phẩm một dòng, số lượng 0
const emptyStock = (): ClInventory[] => PRODUCTS.map(p => ({ productId: p.id, qtyKg: 0 }));
// Kho Cát Linh (bán hàng trừ từ đây)
export const CL_INVENTORY: ClInventory[] = emptyStock();
// Kho Xưởng (sản xuất cộng vào đây; chuyển kho trừ ra)
export const FACTORY_INVENTORY: ClInventory[] = emptyStock();
// Kho Recover riêng — hàng MCK đã hút lại tại xưởng, chờ chuyển về Cát Linh
export const RECOVER_INVENTORY: ClInventory[] = [];

export const EXPENSES: Expense[] = [];
export const RECOVERY_LOGS: RecoveryLog[] = [];
export const DESTRUCTION_LOGS: DestructionLog[] = [];
export const MCK_LOGS: MckLog[] = [];
export const ATTENDANCE: Attendance[] = [];
export const PAYROLL_PERIODS: PayrollPeriod[] = [];
export const NEW_CUSTOMER_CREDITS: NewCustomerCredit[] = [];

export const DEFAULT_SETTINGS: AppSettings = {
  defaultCommissionPct: 5,
  defaultDebtCommissionPct: 3,
  defaultEarlyPayPct: 2,
  factoryBatchThreshold: 10,
  factoryExtraBatchBonus: 150000,
  factoryOvertimeDayBonus: 200000,
  nvlWarningDays: 3,
  standardOutputPerBatch2: 33.5,   // sổ: sản lượng chuẩn / mẻ 2
  materialCostPerBatch2: 1674323,  // sổ: chi phí NVL / mẻ 2
  plannedBatchesPerDay: 8,         // số mẻ dự kiến/ngày cho dự báo NVL
};

// Quận/huyện Hà Nội (khu vực sale). Ngoại tỉnh/khác → cho phép nhập tay ở form.
export const REGIONS = [
  "Ba Đình", "Hoàn Kiếm", "Hai Bà Trưng", "Đống Đa", "Tây Hồ", "Cầu Giấy",
  "Thanh Xuân", "Hoàng Mai", "Long Biên", "Nam Từ Liêm", "Bắc Từ Liêm", "Hà Đông",
  "Đông Anh", "Gia Lâm", "Thanh Trì", "Hoài Đức", "Đan Phượng", "Sóc Sơn", "Mê Linh",
];

export const SOURCES = ["Facebook / TikTok", "Website", "Giới thiệu", "Sales thị trường", "Khác"];
