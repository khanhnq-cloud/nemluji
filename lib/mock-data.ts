import type {
  Profile, Customer, CustomerBranch, Product, Order, Receipt,
  DebtStatement, Lead, Material, ProductionRecipe, ProductionDay,
  StockTransfer, ClInventory, Attendance, PayrollPeriod, RecoveryLog,
  DestructionLog, NewCustomerCredit, AppSettings, Expense, MckLog,
} from "@/types";

// ---------- Profiles (users) ----------
// Chỉ 2 tài khoản: 1 superadmin + 1 admin + 1 nhân viên (khớp với user trong Supabase Auth theo email).
export const PROFILES: Profile[] = [
  { id: "u_super", fullName: "Super Admin",  email: "superadmin@nemluji.vn", role: "superadmin", baseSalary: 0, commissionPct: 0, status: "active" },
  { id: "u_admin", fullName: "Quản trị viên", email: "admin@nemluji.vn",    role: "admin", baseSalary: 0, commissionPct: 0, status: "active" },
  { id: "u_sale",  fullName: "Nhân viên",     email: "nhanvien@nemluji.vn", role: "sale",  baseSalary: 0, commissionPct: 5, debtCommissionPct: 3, status: "active" },
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

// ---------- Materials + Recipe: để trống (thêm NVL + định mức ở Cài đặt → Cấu hình Xưởng) ----------
export const MATERIALS: Material[] = [];
export const RECIPES: ProductionRecipe[] = [];

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



