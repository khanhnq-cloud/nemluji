import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const formatMoney = (n: number | null | undefined) => {
  if (n === null || n === undefined || isNaN(Number(n))) return "0 đ";
  const v = Math.round(Number(n));
  return new Intl.NumberFormat("vi-VN").format(v) + " đ";
};

export const formatNumber = (n: number | null | undefined, digits = 0) => {
  if (n === null || n === undefined || isNaN(Number(n))) return "0";
  return new Intl.NumberFormat("vi-VN", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(Number(n));
};

export const formatKg = (n: number | null | undefined) => formatNumber(n, 1) + " kg";

export const formatPct = (n: number | null | undefined, digits = 1) => {
  if (n === null || n === undefined || isNaN(Number(n))) return "0%";
  return Number(n).toFixed(digits) + "%";
};

export const formatDate = (d: string | Date | null | undefined) => {
  if (!d) return "";
  const date = typeof d === "string" ? new Date(d) : d;
  if (isNaN(date.getTime())) return "";
  return date.toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric" });
};

export const formatTime = (d: string | Date | null | undefined) => {
  if (!d) return "";
  const date = typeof d === "string" ? new Date(d) : d;
  if (isNaN(date.getTime())) return "";
  return date.toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" });
};

export const formatDateTime = (d: string | Date | null | undefined) => {
  if (!d) return "";
  return `${formatDate(d)} ${formatTime(d)}`.trim();
};

export const todayISO = () => new Date().toISOString().slice(0, 10);

export const monthISO = (d: Date | string = new Date()) => {
  const date = typeof d === "string" ? new Date(d) : d;
  return date.toISOString().slice(0, 7);
};

export const daysBetween = (a: string, b: string) => {
  const d1 = new Date(a).getTime();
  const d2 = new Date(b).getTime();
  return Math.round((d2 - d1) / (1000 * 60 * 60 * 24));
};

export const addDays = (date: string, days: number) => {
  const d = new Date(date);
  d.setDate(d.getDate() + Math.round(days));
  return d.toISOString().slice(0, 10);
};

let seqCounter = 1;
export function generateCode(prefix: string, useYear = true) {
  const year = new Date().getFullYear();
  const seq = String(seqCounter++).padStart(6, "0");
  return useYear ? `${prefix}-${year}-${seq}` : `${prefix}-${seq}`;
}

// Sinh mã tuần tự tăng dần, KHÔNG trùng — dựa trên các mã đã tồn tại.
// Quét max số thứ tự của tất cả mã cùng prefix (mọi năm) rồi +1, format theo năm hiện tại.
// VD: existing có DH-2026-000005 → trả DH-2026-000006.
export function nextSequentialCode(prefix: string, existingCodes: (string | undefined)[], useYear = true) {
  const re = new RegExp(`^${prefix}-(?:\\d{4}-)?(\\d+)$`);
  let max = 0;
  for (const code of existingCodes) {
    if (!code) continue;
    const m = code.match(re);
    if (m) { const n = parseInt(m[1], 10); if (n > max) max = n; }
  }
  const seq = String(max + 1).padStart(6, "0");
  const year = new Date().getFullYear();
  return useYear ? `${prefix}-${year}-${seq}` : `${prefix}-${seq}`;
}

export function newId() {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}

// ---- Labels ----
export const CUSTOMER_GROUP_LABEL: Record<string, string> = {
  quan_an_nha_hang: "Quán ăn / Nhà hàng",
  sieu_thi_minimart: "Siêu thị / Minimart",
  npp: "NPP",
  le: "Khách lẻ",
};

// Nhóm B2B có người phụ trách (cần tên + SĐT người phụ trách)
export const B2B_GROUPS = ["quan_an_nha_hang", "sieu_thi_minimart", "npp"];

// Khách do công ty trực tiếp phụ trách (không gán sale cụ thể)
export const COMPANY_ASSIGNEE = "company";

export function assigneeName(profiles: { id: string; fullName: string }[], id: string | undefined) {
  if (!id) return "—";
  if (id === COMPANY_ASSIGNEE) return "Công ty";
  return profiles.find(p => p.id === id)?.fullName || "—";
}

export const PAYMENT_STATUS_LABEL: Record<string, string> = {
  cash_done: "Tiền mặt (đã thu)",
  da_ck: "Đã CK",
  chua_ck: "Chưa CK",
  cong_no: "Công nợ",
  tang: "Hàng tặng",
};

export const RECEIPT_STATUS_LABEL: Record<string, string> = {
  pending: "Chờ",
  waiting_admin: "Chờ Admin duyệt",
  approved: "Đã duyệt (tiền về)",
  rejected: "Từ chối",
  cancelled: "Đã huỷ",
};

export const LEAD_STATUS_LABEL: Record<string, string> = {
  kem: "Kém",
  trung_binh: "Trung bình",
  tiem_nang: "Tiềm năng",
  dang_chot: "Đang chốt",
  da_chot: "Đã chốt",
  mat: "Mất",
};

export const VISIT_TYPE_LABEL: Record<string, string> = {
  gap: "Gặp trực tiếp",
  goi: "Gọi điện",
  zalo: "Zalo",
};

export const ROLE_LABEL: Record<string, string> = {
  admin: "Admin (Chủ DN)",
  manager: "Manager",
  sale: "Sale",
  warehouse_hn: "Kho Hà Nội",
  factory_da: "Xưởng Đông Anh",
  accountant: "Kế toán",
};

export const ATTENDANCE_LABEL: Record<string, string> = {
  work: "Làm",
  off_paid: "Nghỉ có phép",
  off_unpaid: "Nghỉ không phép",
  half: "Nửa ngày",
};

export const TRANSFER_STATUS_LABEL: Record<string, string> = {
  pending: "Chờ nhận",
  received: "Đã nhận",
  cancelled: "Đã huỷ",
};
